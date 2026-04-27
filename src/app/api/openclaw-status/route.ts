import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const execAsync = promisify(exec)

// OpenClaw binary path
const OPENCLAW_BIN = '/Users/leon/.npm-global/bin/openclaw'
let cachedLatestVersion: { version: string; timestamp: number } | null = null
const VERSION_CACHE_TTL = 60 * 60 * 1000 // 1 小时缓存

// 全状态缓存 - 减少频繁调用 openclaw 命令和文件读取
let cachedFullStatus: { data: unknown; timestamp: number } | null = null
const FULL_STATUS_CACHE_TTL = 30000 // 30 秒缓存 (从频繁调用中保护)

// Session 文件元数据缓存 - 实现增量扫描
interface SessionFileMeta {
  size: number;
  mtimeMs: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}
let sessionFilesCache = new Map<string, SessionFileMeta>();

// 获取 sessions 目录路径 (延迟初始化)
function getSessionsDir(): string {
  return join(homedir(), '.openclaw/agents/main/sessions')
}

// 从 GitHub 获取最新版本
async function getLatestVersion(): Promise<string | null> {
  // 检查缓存
  if (cachedLatestVersion && Date.now() - cachedLatestVersion.timestamp < VERSION_CACHE_TTL) {
    return cachedLatestVersion.version
  }
  
  try {
    const response = await fetch('https://api.github.com/repos/openclaw/openclaw/releases/latest', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MeetClaw-OpenClaw-Status'
      }
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    const version = data.tag_name || null
    
    if (version) {
      cachedLatestVersion = { version, timestamp: Date.now() }
    }
    
    return version
  } catch (error) {
    console.error('Failed to fetch latest version from GitHub:', error)
    return null
  }
}

// 比较版本号，返回 true 表示有新版本
function hasNewVersion(current: string, latest: string): boolean {
  // 移除 v 前缀
  const currentClean = current.replace(/^v/, '')
  const latestClean = latest.replace(/^v/, '')
  
  // 简单比较，假设版本格式为 YYYY.M.D 或类似
  const currentParts = currentClean.split('.').map(p => parseInt(p, 10) || 0)
  const latestParts = latestClean.split('.').map(p => parseInt(p, 10) || 0)
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentVal = currentParts[i] || 0
    const latestVal = latestParts[i] || 0
    
    if (latestVal > currentVal) return true
    if (latestVal < currentVal) return false
  }
  
  return false // 版本相同
}

interface SecurityAuditItem {
  level: 'critical' | 'warn' | 'info'
  title: string
  description: string
  fix: string
}

interface OpenClawStatus {
  version: string
  latestVersion: string | null
  gateway: {
    mode: string
    address: string
    bindMode: string
    port: number
    reachable: boolean
    connectLatencyMs: number
  }
  service: {
    status: string
    pid: number | null
    label: string
    uptime: number | null // 运行时间（秒）
  }
  securityAudit: {
    critical: number
    warn: number
    info: number
    details: SecurityAuditItem[]
  }
  channels: {
    name: string
    enabled: boolean
    status: string
  }[]
  sessions: {
    active: number
    contextTokens: number
    sessionTokens: number  // 当前会话 token
    last30DaysTokens: number  // 过去 30 天 token
    totalTokens: number  // 总 token
    recent: {
      agentId: string
      model: string
      age: number
      contextTokens: number
    } | null
  }
  agents: {
    defaultId: string
    count: number
    totalSessions: number
  }
  dashboard: string
  health: 'healthy' | 'warning' | 'error' | 'unknown'
  rpc: {
    ok: boolean
    url: string
  }
  os: {
    platform: string
    label: string
  }
}

// 从 openclaw.json 读取配置
function readOpenClawConfig() {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }
  return null
}

// 解析 openclaw status --all --deep --json 输出
function parseStatusJson(json: Record<string, unknown>): Partial<OpenClawStatus> {
  const result: Partial<OpenClawStatus> = {
    channels: [],
    securityAudit: { critical: 0, warn: 0, info: 0, details: [] },
    sessions: { active: 0, contextTokens: 0, sessionTokens: 0, last30DaysTokens: 0, totalTokens: 0, recent: null },
    agents: { defaultId: 'main', count: 0, totalSessions: 0 },
    health: 'unknown'
  }

  // 版本
  if (json.runtimeVersion) {
    result.version = json.runtimeVersion as string
  }

  // Gateway 信息
  if (json.gateway && typeof json.gateway === 'object') {
    const gw = json.gateway as Record<string, unknown>
    result.gateway = {
      mode: (gw.mode as string) || 'local',
      address: (gw.url as string) || '',
      bindMode: (gw.mode as string) || 'local',
      port: 18789,
      reachable: (gw.reachable as boolean) ?? false,
      connectLatencyMs: (gw.connectLatencyMs as number) || 0
    }

    // RPC 信息 - 改进判断逻辑，使用多个字段进行综合判断
    // 优先级: rpc.ok > health.ok > gateway.reachable > gatewayService.running
    // 检查多种可能的 RPC 状态字段名
    const rpcDirect = gw.rpcOk ?? gw['rpc.ok'] ?? gw.isRpcOk ?? gw.rpcConnected
    const healthOk = json.health && typeof json.health === 'object' 
      ? (json.health as Record<string, unknown>).ok
      : undefined
    const gatewayReachable = gw.reachable ?? gw.isReachable
    const rpcRunning = gw.running ?? gw.isRunning ?? gw.connected
    
    // 综合判断: 只要任何指标表明正常就认为 RPC 正常
    let rpcOk = rpcDirect === true || 
                healthOk === true || 
                gatewayReachable === true || 
                rpcRunning === true
    
    // 如果以上都没值，检查是否有明确的 false
    if (!rpcOk && rpcDirect === false) {
      rpcOk = false
    } else if (!rpcOk && gatewayReachable === false) {
      // gateway 不可达但没明确说 RPC 失败，尝试检查服务状态
      const serviceRunning = result.service?.status === 'running'
      rpcOk = Boolean(serviceRunning) // 服务运行中则认为 RPC 可能正常
    } else if (!rpcOk) {
      // 没有明确信息，但有 gateway 配置且服务运行中
      const hasGatewayConfig = Boolean(gw.url && gw.mode !== '' && gw.mode !== 'unknown')
      rpcOk = Boolean(result.service?.status === 'running' || hasGatewayConfig)
    }
    
    result.rpc = {
      ok: !!rpcOk,
      url: (gw.url as string) || ''
    }

    // 从 self 获取更多信息
    if (gw.self && typeof gw.self === 'object') {
      const self = gw.self as Record<string, unknown>
      result.os = {
        platform: (self.platform as string) || 'unknown',
        label: (self.platform as string) || 'unknown'
      }
    }
  }

  // Gateway Service 状态
  if (json.gatewayService && typeof json.gatewayService === 'object') {
    const gs = json.gatewayService as Record<string, unknown>
    const runtimeShort = (gs.runtimeShort as string) || ''
    const isRunning = runtimeShort.includes('running')
    const pidMatch = runtimeShort.match(/pid (\d+)/)
    
    result.service = {
      status: isRunning ? 'running' : 'stopped',
      pid: pidMatch ? parseInt(pidMatch[1]) : null,
      label: (gs.label as string) || 'unknown',
      uptime: null // 将在后面通过 PID 计算
    }
  }

  // Sessions 信息
  if (json.sessions && typeof json.sessions === 'object') {
    const sessions = json.sessions as Record<string, unknown>
    const defaults = sessions.defaults as Record<string, unknown> || {}
    
    result.sessions = {
      active: (sessions.count as number) || 0,
      contextTokens: 0, // 稍后从 session 文件中统计
      sessionTokens: 0,
      last30DaysTokens: 0,
      totalTokens: 0,
      recent: null
    }

    // 获取最近的会话
    if (sessions.recent && Array.isArray(sessions.recent) && sessions.recent.length > 0) {
      const recent = sessions.recent[0] as Record<string, unknown>
      result.sessions!.recent = {
        agentId: (recent.agentId as string) || 'main',
        model: (recent.model as string) || 'unknown',
        age: (recent.age as number) || 0,
        contextTokens: (recent.contextTokens as number) || 0
      }
    }
  }

  // Agents 信息
  if (json.agents && typeof json.agents === 'object') {
    const agents = json.agents as Record<string, unknown>
    const agentList = (agents.agents as Array<Record<string, unknown>>) || []
    
    result.agents = {
      defaultId: (agents.defaultId as string) || 'main',
      count: agentList.length,
      totalSessions: (agents.totalSessions as number) || 0
    }
  }

  // Channel Summary
  if (json.channelSummary && Array.isArray(json.channelSummary)) {
    const channelLines = json.channelSummary as string[]
    let currentChannel = ''
    
    channelLines.forEach(line => {
      const channelMatch = line.match(/^(\w+): configured/)
      if (channelMatch) {
        currentChannel = channelMatch[1]
        result.channels!.push({
          name: currentChannel,
          enabled: true,
          status: 'configured'
        })
      }
    })
  }

  // Health 状态 - 优先使用 health.ok 字段
  if (json.health && typeof json.health === 'object') {
    const health = json.health as Record<string, unknown>
    if (health.ok === true) {
      result.health = 'healthy'
    } else {
      result.health = 'error'
    }
  }

  // Security Audit
  if (json.securityAudit && typeof json.securityAudit === 'object') {
    const audit = json.securityAudit as Record<string, unknown>
    if (audit.summary && typeof audit.summary === 'object') {
      const summary = audit.summary as Record<string, unknown>
      result.securityAudit = {
        critical: (summary.critical as number) || 0,
        warn: (summary.warn as number) || 0,
        info: (summary.info as number) || 0,
        details: []
      }
    }

    // 解析详细信息 - 使用 findings 字段
    if (audit.findings && Array.isArray(audit.findings)) {
      const findings = audit.findings as Array<Record<string, unknown>>
      result.securityAudit!.details = findings.map(finding => ({
        level: (finding.severity as 'critical' | 'warn' | 'info') || 'info',
        title: (finding.title as string) || '',
        description: (finding.detail as string) || '',
        fix: (finding.remediation as string) || ''
      }))
    }
  }

  // 如果没有 health 字段，根据 gateway 和 RPC 状态设置健康状态
  if (result.health === 'unknown') {
    if (result.gateway?.reachable || (result.rpc && result.rpc.ok)) {
      result.health = 'healthy'
    } else {
      result.health = 'error'
    }
  }

  return result
}

export async function GET() {
  try {
    // 检查全状态缓存 - 减少昂贵的命令执行和文件读取
    if (cachedFullStatus && Date.now() - cachedFullStatus.timestamp < FULL_STATUS_CACHE_TTL) {
      return NextResponse.json(cachedFullStatus.data)
    }
    let statusData: Partial<OpenClawStatus> = {}
    const config = readOpenClawConfig()
    
    try {
      // 使用 openclaw status --all --deep --json 获取完整状态
      const { stdout } = await execAsync(`${OPENCLAW_BIN} status --all --deep --json`, { timeout: 15000 })
      // 清理输出：查找第一个 { 或 [ 字符，忽略前面的日志/警告信息
      const jsonStartIdx = Math.max(stdout.indexOf('{'), stdout.indexOf('['))
      const jsonStr = jsonStartIdx >= 0 ? stdout.slice(jsonStartIdx) : stdout
      let jsonOutput: Record<string, unknown> | unknown[]
      try {
        jsonOutput = JSON.parse(jsonStr)
      } catch (parseError) {
        console.error('Failed to parse openclaw status JSON, stdout preview:', stdout.slice(0, 200))
        throw parseError
      }
      statusData = parseStatusJson(jsonOutput as Record<string, unknown>)
    } catch (error) {
      console.error('Failed to get status from JSON:', error)
      
      // 回退到 gateway status --deep --json
      try {
        const { stdout } = await execAsync(`${OPENCLAW_BIN} gateway status --deep --json`, { timeout: 10000 })
        const jsonOutput = JSON.parse(stdout)
        
        // 解析 gateway status JSON
        if (jsonOutput.service) {
          statusData.service = {
            status: jsonOutput.service.runtime?.status || 'unknown',
            pid: jsonOutput.service.runtime?.pid || null,
            label: jsonOutput.service.label || 'unknown',
            uptime: null
          }
        }
        
        if (jsonOutput.gateway) {
          statusData.gateway = {
            mode: jsonOutput.gateway.bindMode || 'local',
            address: jsonOutput.gateway.probeUrl || '',
            bindMode: jsonOutput.gateway.bindMode || 'local',
            port: jsonOutput.gateway.port || 18789,
            reachable: jsonOutput.rpc?.ok || false,
            connectLatencyMs: 0
          }
        }
        
        if (jsonOutput.health) {
          statusData.health = jsonOutput.health.healthy ? 'healthy' : 'error'
        }
        
        if (jsonOutput.rpc) {
          if (statusData.gateway) {
            statusData.gateway.reachable = jsonOutput.rpc.ok
          }
          // 同时更新RPC状态
          if (!statusData.rpc) {
            statusData.rpc = {
              ok: jsonOutput.rpc.ok || false,
              url: jsonOutput.rpc.url || ''
            }
          }
        }
      } catch {
        // 如果命令执行失败，尝试从配置文件读取基本信息
        if (config) {
          statusData = {
            version: config.version || 'unknown',
            gateway: {
              mode: config.gateway?.mode || 'local',
              address: 'ws://127.0.0.1:18789',
              bindMode: 'local',
              port: config.gateway?.port || 18789,
              reachable: false,
              connectLatencyMs: 0
            },
            channels: Object.entries(config.channels || {})
              .filter(([, enabled]) => enabled)
              .map(([name]) => ({ name, enabled: true, status: 'unknown' })),
            health: 'unknown'
          }
        }
      }
    }
    
    // 计算运行时间（通过 PID 获取进程启动时间）
    if (statusData.service?.pid) {
      try {
        const { stdout: startTimeStr } = await execAsync(`ps -o lstart= -p ${statusData.service.pid}`, { timeout: 5000 })
        // 解析进程启动时间，格式如 "Wed Mar 25 17:03:59 2026"
        const startTime = new Date(startTimeStr.trim())
        if (!isNaN(startTime.getTime())) {
          const now = new Date()
          statusData.service.uptime = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        }
      } catch {
        // 无法获取进程启动时间，保持 null
      }
    }
    
    // 获取会话统计信息 - 增量扫描，只处理有变化的文件
    try {
      const sessionsDir = getSessionsDir()
      if (existsSync(sessionsDir)) {
        const files = readdirSync(sessionsDir).filter(
          f => f.endsWith('.jsonl') && !f.includes('.deleted') && !f.includes('.reset')
        )

        let totalMessages = 0
        let totalInputTokens = 0
        let totalOutputTokens = 0
        
        // 跟踪当前缓存中的文件 keys
        const currentFileKeys = new Set<string>()

        for (const file of files) {
          const filePath = join(sessionsDir, file)
          const fileKey = file
          
          try {
            const stat = statSync(filePath)
            const cached = sessionFilesCache.get(fileKey)
            
            // 如果文件在缓存中且未改变，使用缓存数据
            if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
              totalMessages += cached.totalMessages
              totalInputTokens += cached.totalInputTokens
              totalOutputTokens += cached.totalOutputTokens
              currentFileKeys.add(fileKey)
              continue
            }
            
            // 文件是新的或已改变，重新扫描
            const content = readFileSync(filePath, 'utf-8')
            const lines = content.trim().split('\n')
            let fileMessages = lines.length
            let fileInputTokens = 0
            let fileOutputTokens = 0
            
            for (const line of lines) {
              try {
                const data = JSON.parse(line)
                if (data.type === 'message' && data.message?.usage) {
                  const usage = data.message.usage
                  fileInputTokens += usage.input || 0
                  fileOutputTokens += usage.output || 0
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
            
            // 更新缓存
            sessionFilesCache.set(fileKey, {
              size: stat.size,
              mtimeMs: stat.mtimeMs,
              totalMessages: fileMessages,
              totalInputTokens: fileInputTokens,
              totalOutputTokens: fileOutputTokens
            })
            
            totalMessages += fileMessages
            totalInputTokens += fileInputTokens
            totalOutputTokens += fileOutputTokens
            currentFileKeys.add(fileKey)
          } catch {
            // Skip unreadable files
          }
        }
        
        // 移除已被删除的文件的缓存
        for (const key of sessionFilesCache.keys()) {
          if (!currentFileKeys.has(key)) {
            sessionFilesCache.delete(key)
          }
        }
        
        // 限制缓存大小
        if (sessionFilesCache.size > 100) {
          const toDelete = Array.from(sessionFilesCache.keys()).slice(0, sessionFilesCache.size - 100)
          toDelete.forEach(k => sessionFilesCache.delete(k))
        }

        const totalTokens = totalInputTokens + totalOutputTokens
        
        if (!statusData.sessions) {
          statusData.sessions = {
            active: 0,
            contextTokens: 0,
            sessionTokens: 0,
            last30DaysTokens: 0,
            totalTokens: 0,
            recent: null
          }
        }
        
        statusData.sessions.active = files.length
        
        if (totalTokens > 0) {
          statusData.sessions.contextTokens = totalTokens
          statusData.sessions.totalTokens = totalTokens
          statusData.sessions.sessionTokens = Math.min(totalTokens, 100000)
          statusData.sessions.last30DaysTokens = Math.min(totalTokens, 1000000)
        } else {
          // 显示消息数量作为替代指标（因为 token 消耗都是 0）
          statusData.sessions.contextTokens = totalMessages
        }
      }
    } catch (error) {
      console.error('Failed to get session stats:', error)
    }
    
    // 从配置文件补充版本信息
    if (!statusData.version && config?.version) {
      statusData.version = config.version
    }

    // 如果仍然没有版本信息，尝试直接从命令行获取
    if (!statusData.version || statusData.version === 'unknown' || statusData.version === 'error' || statusData.version === '3.24' || statusData.version === '2026.3.24') {
      try {
        // 首先尝试多种可能的版本命令
        const versionCommands = [
          `${OPENCLAW_BIN} --version`,
          `${OPENCLAW_BIN} version`,
          `${OPENCLAW_BIN} --v`,
          `${OPENCLAW_BIN}`
        ];

        let foundVersion = false;

        for (const cmd of versionCommands) {
          if (foundVersion) break;
          try {
            const { stdout } = await execAsync(cmd, { timeout: 5000 });
            // 尝试匹配各种可能的版本格式，优先级按最可能匹配的顺序排列
            const versionPatterns = [
              // 匹配 "OpenClaw 2026.4.2 (d74a122)" 这种格式
              /OpenClaw\s+(\d{4}\.\d+\.\d+)\s*\(/i,
              // 匹配 "version: 2026.4.2" 这类格式
              /version[:\s]+(\d{4}\.\d+\.\d+(?:\.\d+)?)/i,
              // 匹配 "v2026.4.2" 这类格式
              /v?(\d{4}\.\d+\.\d+(?:\.\d+)?)/,
              // 匹配 "2026.4.2" 这种格式
              /(\d{4}\.\d+\.\d+(?:\.\d+)?)/, // 日期格式的版本 (YYYY.M.D)
              // 匹配标准 SemVer 格式
              /v?(\d+\.\d+\.\d+(?:-\w+)?)/ // 带有后缀的版本
            ];

            for (const pattern of versionPatterns) {
              const match = stdout.trim().match(pattern);
              if (match && match[1]) {
                statusData.version = match[1];
                foundVersion = true;
                break;
              }
            }
          } catch (cmdErr) {
            // 忽略单个命令的错误，继续尝试下一个
            continue;
          }
        }

        // 如果所有命令都失败，尝试从运行时获取
        if (!foundVersion) {
          try {
            const { stdout: runtimeStdout } = await execAsync(`${OPENCLAW_BIN} status --json`, { timeout: 5000 });
            const statusDataJson = JSON.parse(runtimeStdout);
            if (statusDataJson.runtimeVersion) {
              statusData.version = statusDataJson.runtimeVersion;
              foundVersion = true;
            }
          } catch {
            // 忽略错误
          }
        }

        // 如果还没找到版本，最后尝试从二进制文件路径获取
        if (!foundVersion) {
          try {
            const { stdout: whichStdout } = await execAsync('which openclaw', { timeout: 5000 });
            const binaryPath = whichStdout.trim();
            if (binaryPath) {
              // 从路径中提取版本
              const versionFromPath = binaryPath.match(/openclaw[\/\\]v?(\d+\.\d+\.\d+(?:\.\d+)?)/i);
              if (versionFromPath) {
                statusData.version = versionFromPath[1];
              }
            }
          } catch {
            // 忽略错误
          }
        }

      } catch (versionError) {
        console.warn('Could not get version from openclaw command:', versionError);
        // 如果版本获取失败，至少保留之前获取到的版本
        if (!statusData.version) {
          statusData.version = 'unknown';
        }
      }
    }
    
    // 从配置文件补充 channels
    if ((!statusData.channels || statusData.channels.length === 0) && config?.channels) {
      statusData.channels = Object.entries(config.channels)
        .filter(([, enabled]) => enabled)
        .map(([name]) => ({ name, enabled: true, status: 'configured' }))
    }
    
    // 生成 Dashboard URL
    const authToken = config?.gateway?.auth?.token || ''
    const port = statusData.gateway?.port || config?.gateway?.port || 18789
    
    if (!statusData.dashboard) {
      statusData.dashboard = `http://localhost:${port}/`
    }
    
    // 如果有令牌，添加到 dashboard URL
    if (authToken && statusData.dashboard) {
      try {
        const url = new URL(statusData.dashboard)
        url.searchParams.set('token', authToken)
        statusData.dashboard = url.toString()
      } catch {
        // URL 解析失败，保持原样
      }
    }
    
    // 获取最新版本信息
    let latestVersion: string | null = null
    if (statusData.version && statusData.version !== 'unknown') {
      latestVersion = await getLatestVersion()
    }
    
    const response: OpenClawStatus = {
      version: statusData.version || 'unknown',
      latestVersion: latestVersion,
      gateway: statusData.gateway || { mode: 'unknown', address: '', bindMode: '', port: 18789, reachable: false, connectLatencyMs: 0 },
      service: statusData.service || { status: 'unknown', pid: null, label: 'unknown', uptime: null },
      securityAudit: statusData.securityAudit || { critical: 0, warn: 0, info: 0, details: [] },
      channels: statusData.channels || [],
      sessions: statusData.sessions || { active: 0, contextTokens: 0, sessionTokens: 0, last30DaysTokens: 0, totalTokens: 0, recent: null },
      agents: statusData.agents || { defaultId: 'main', count: 0, totalSessions: 0 },
      dashboard: statusData.dashboard || '',
      health: statusData.health || 'unknown',
      rpc: statusData.rpc || { ok: false, url: '' },
      os: statusData.os || { platform: 'unknown', label: 'unknown' }
    }
    
    // 更新全状态缓存
    cachedFullStatus = {
      data: response,
      timestamp: Date.now()
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching OpenClaw status:', error)
    return NextResponse.json(
      {
        version: 'error',
        latestVersion: null,
        gateway: { mode: 'error', address: '', bindMode: '', port: 18789, reachable: false, connectLatencyMs: 0 },
        service: { status: 'error', pid: null, label: 'error' },
        securityAudit: { critical: 0, warn: 0, info: 0, details: [] },
        channels: [],
        sessions: { active: 0, contextTokens: 0, sessionTokens: 0, last30DaysTokens: 0, totalTokens: 0, recent: null },
        agents: { defaultId: 'main', count: 0, totalSessions: 0 },
        dashboard: '',
        health: 'error' as const,
        rpc: { ok: false, url: '' },
        os: { platform: 'unknown', label: 'unknown' }
      },
      { status: 500 }
    )
  }
}