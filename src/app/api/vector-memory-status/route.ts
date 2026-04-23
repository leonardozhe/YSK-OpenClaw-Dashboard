import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface VectorMemoryStatus {
  enabled: boolean
  pluginInstalled: boolean
  pluginEnabled: boolean
  pluginInConfig: boolean
  memorySlotConfigured: boolean
  embeddingModel: string | null
  embeddingProvider: string | null
  embeddingBaseUrl: string | null
  embeddingAvailable: boolean
  ollamaRunning: boolean
  ollamaEmbeddingModels: string[]
  autoCapture: boolean
  autoRecall: boolean
  issues: string[]
}

// 检查 lancedb 插件是否已安装
async function checkPluginInstalled(): Promise<{ installed: boolean; pluginName: string | null }> {
  try {
    // 检查 OpenClaw 插件目录 - 多种可能的路径
    const openclawDir = join(homedir(), '.openclaw')
    
    // 优先级：lancedb-pro > lancedb
    const possibleNames = [
      'memory-lancedb-pro',
      'memory-lancedb',
      '@openclaw/memory-lancedb-pro',
      '@openclaw/memory-lancedb',
      '@openclaw/lancedb-pro',
      '@openclaw/lancedb',
      'lancedb-pro',
      'lancedb'
    ]
    
    // 1. 检查 ~/.openclaw/node_modules (如果存在)
    const nodeModulesPath = join(openclawDir, 'node_modules')
    for (const name of possibleNames) {
      if (existsSync(join(nodeModulesPath, name))) {
        return { installed: true, pluginName: name }
      }
    }
    
    // 2. 检查全局 npm 安装路径 (常见路径)
    const npmGlobalPaths = [
      join(homedir(), '.npm-global', 'lib', 'node_modules', 'openclaw', 'node_modules'),
      join(homedir(), '.nvm', 'versions', 'node', 'lib', 'node_modules', 'openclaw', 'node_modules'),
      '/usr/local/lib/node_modules/openclaw/node_modules',
      '/opt/homebrew/lib/node_modules/openclaw/node_modules',
    ]
    
    for (const basePath of npmGlobalPaths) {
      if (existsSync(basePath)) {
        for (const name of possibleNames) {
          if (existsSync(join(basePath, name))) {
            return { installed: true, pluginName: name }
          }
        }
        // 也检查 @lancedb 目录
        if (existsSync(join(basePath, '@lancedb'))) {
          return { installed: true, pluginName: '@lancedb/lancedb' }
        }
      }
    }
    
    // 3. 尝试通过 npm list 检查
    try {
      const { stdout } = await execAsync('npm list --prefix ~/.openclaw 2>/dev/null | grep -E "memory-lancedb|lancedb"', { shell: '/bin/bash' })
      if (stdout.trim()) {
        const match = stdout.match(/(memory-lancedb[-pro]?|@openclaw\/memory-lancedb[-pro]?|@openclaw\/lancedb[-pro]?|lancedb[-pro]?)/)
        if (match) {
          return { installed: true, pluginName: match[1] }
        }
      }
    } catch {
      // npm list 失败，继续
    }
    
    // 4. 尝试通过 npm list 检查全局路径
    try {
      const { stdout } = await execAsync('npm list -g --depth=0 2>/dev/null | grep -E "memory-lancedb|lancedb|openclaw"', { shell: '/bin/bash' })
      if (stdout.trim()) {
        const match = stdout.match(/(memory-lancedb[-pro]?|@openclaw\/memory-lancedb[-pro]?|@openclaw\/lancedb[-pro]?|lancedb[-pro]?)/)
        if (match) {
          return { installed: true, pluginName: match[1] }
        }
      }
    } catch {
      // npm list 失败，继续
    }
    
    return { installed: false, pluginName: null }
  } catch {
    return { installed: false, pluginName: null }
  }
}

// 检查 Ollama 是否运行并获取 embedding 模型
async function checkOllamaEmbeddingModels(): Promise<{ running: boolean; models: string[] }> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })
    if (response.ok) {
      const data = await response.json()
      const models = (data.models || []).map((m: { name: string }) => m.name)
      return { running: true, models }
    }
  } catch {
    // Ollama 未运行
  }
  return { running: false, models: [] }
}

// 检查 embedding 模型是否可用
function checkEmbeddingModelAvailable(
  embeddingModel: string | null,
  ollamaModels: string[]
): boolean {
  if (!embeddingModel) return false
  
  // 检查 Ollama 中是否有匹配的 embedding 模型
  if (ollamaModels.length > 0) {
    const normalizedTarget = embeddingModel.toLowerCase().replace('nomic-embed-text', 'nomic')
    return ollamaModels.some((m: string) =>
      m.toLowerCase().includes(normalizedTarget) || normalizedTarget.includes(m.toLowerCase().split(':')[0])
    )
  }
  
  return false
}

export async function GET() {
  const issues: string[] = []
  
  try {
    const configPath = join(homedir(), '.openclaw', 'openclaw.json')
    
    if (!existsSync(configPath)) {
      return NextResponse.json({
        enabled: false,
        pluginInstalled: false,
        pluginEnabled: false,
        pluginInConfig: false,
        memorySlotConfigured: false,
        embeddingModel: null,
        embeddingProvider: null,
        embeddingBaseUrl: null,
        embeddingAvailable: false,
        ollamaRunning: false,
        ollamaEmbeddingModels: [],
        autoCapture: false,
        autoRecall: false,
        issues: ['OpenClaw 配置文件不存在']
      })
    }
    
    const content = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content)
    
    // 检查插件配置
    const plugins = config.plugins || {}
    const entries = plugins.entries || {}
    
    // 检查多种可能的插件名称（支持 lancedb 和 lancedb-pro）
    const possiblePluginNames = [
      'memory-lancedb-pro',
      'memory-lancedb',
      '@openclaw/memory-lancedb-pro',
      '@openclaw/memory-lancedb',
      '@openclaw/lancedb-pro',
      '@openclaw/lancedb',
      'lancedb-pro',
      'lancedb'
    ]
    
    // 找到第一个在配置中存在的插件
    let memoryPlugin: { enabled?: boolean; config?: { embedding?: { model?: string; provider?: string; baseURL?: string }; autoCapture?: boolean; autoRecall?: boolean } } | null = null
    let detectedPluginName: string | null = null
    for (const name of possiblePluginNames) {
      if (entries[name]) {
        memoryPlugin = entries[name]
        detectedPluginName = name
        break
      }
    }
    
    const pluginInConfig = memoryPlugin !== null
    const pluginEnabled = memoryPlugin?.enabled === true
    
    if (!pluginInConfig) {
      issues.push('未配置向量记忆插件 (memory-lancedb 或 memory-lancedb-pro)')
    } else if (!pluginEnabled) {
      issues.push(`向量记忆插件 (${detectedPluginName}) 已配置但未启用`)
    }
    
    // 检查 memory 插槽是否配置
    const memorySlotValue = plugins.slots?.memory
    const memorySlotConfigured = !!memorySlotValue
    
    // 检查 memory 插槽值是否匹配已知的 lancedb 插件名称
    const memorySlot = memorySlotValue ? possiblePluginNames.includes(memorySlotValue) : false
    
    if (!memorySlotConfigured) {
      issues.push('未配置 memory 插槽')
    } else if (!memorySlot) {
      issues.push(`memory 插槽配置不正确 (当前值: ${memorySlotValue})`)
    }
    
    // 获取嵌入式模型配置
    const embeddingConfig = memoryPlugin?.config?.embedding || {}
    const embeddingModel = embeddingConfig.model || null
    const embeddingProvider = embeddingConfig.provider || null
    const embeddingBaseUrl = embeddingConfig.baseURL || null
    
    if (!embeddingModel) {
      issues.push('未配置 embedding 模型')
    }
    if (!embeddingProvider) {
      issues.push('未配置 embedding provider')
    }
    if (!embeddingBaseUrl) {
      issues.push('未配置 embedding baseURL')
    }
    
    // 检查 Ollama 状态和 embedding 模型
    const { running: ollamaRunning, models: ollamaModels } = await checkOllamaEmbeddingModels()
    
    // 检测嵌入式模型是否可用
    let embeddingAvailable = false
    if (embeddingBaseUrl && embeddingModel) {
      try {
        // 如果是 Ollama，检查模型是否存在
        if (embeddingBaseUrl.includes('localhost:11434') || embeddingProvider === 'ollama') {
          embeddingAvailable = checkEmbeddingModelAvailable(embeddingModel, ollamaModels)
          if (!embeddingAvailable && ollamaRunning) {
            issues.push(`Ollama 中未找到 embedding 模型: ${embeddingModel}`)
          }
        } else {
          // 其他提供商，假设可用
          embeddingAvailable = true
        }
      } catch {
        embeddingAvailable = false
        issues.push('embedding 模型检测失败')
      }
    }
    
    // 获取自动捕获和召回配置
    const autoCapture = memoryPlugin?.config?.autoCapture === true
    const autoRecall = memoryPlugin?.config?.autoRecall === true
    
    // 判断向量记忆是否完全启用
    const pluginCheckResult = await checkPluginInstalled()
    const pluginInstalled = pluginCheckResult.installed
    const enabled = pluginInstalled && pluginEnabled && memorySlot && embeddingAvailable
    
    if (!pluginInstalled) {
      issues.push('向量记忆插件未安装 (支持 memory-lancedb 或 memory-lancedb-pro)')
    }
    
    return NextResponse.json({
      enabled,
      pluginInstalled,
      pluginEnabled,
      pluginInConfig,
      memorySlotConfigured,
      embeddingModel,
      embeddingProvider,
      embeddingBaseUrl,
      embeddingAvailable,
      ollamaRunning,
      ollamaEmbeddingModels: ollamaModels,
      autoCapture,
      autoRecall,
      issues
    })
  } catch (error) {
    console.error('Error checking vector memory status:', error)
    return NextResponse.json({
      enabled: false,
      pluginInstalled: false,
      pluginEnabled: false,
      pluginInConfig: false,
      memorySlotConfigured: false,
      embeddingModel: null,
      embeddingProvider: null,
      embeddingBaseUrl: null,
      embeddingAvailable: false,
      ollamaRunning: false,
      ollamaEmbeddingModels: [],
      autoCapture: false,
      autoRecall: false,
      issues: ['检测向量记忆状态时出错']
    }, { status: 500 })
  }
}