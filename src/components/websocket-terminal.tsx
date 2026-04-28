 'use client'

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal as TerminalIcon, Play, Square, Copy, Download, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { randomUUID } from 'crypto'

interface TerminalLine {
  id: string
  content: string
  timestamp: number
  type: 'input' | 'output' | 'system' | 'error'
}

export interface Channel {
  id: string
  name: string
  nameZh: string
}

interface OpenClawCommand {
  command: string
  description: string
  category: 'status' | 'config' | 'session' | 'model' | 'agent' | 'channel' | 'node' | 'memory' | 'logs' | 'cron' | 'skills' | 'device' | 'update' | 'system' | 'help'
}

export const WebsocketTerminal = forwardRef<{ sendChatMessage: (channelId: string, text: string) => boolean; channels: Channel[]; selectedChannel: string; setSelectedChannel: (channel: string) => void }>((props, ref) => {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [inputCommand, setInputCommand] = useState('')
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>(() => {
    const initialLines: TerminalLine[] = [
      { id: '1', content: '欢迎使用 OpenClaw TUI 终端', timestamp: Date.now(), type: 'system' },
      { id: '2', content: '正在连接到 OpenClaw 服务...', timestamp: Date.now(), type: 'system' },
      { id: '3', content: '键入 "help" 查看可用命令', timestamp: Date.now(), type: 'system' }
    ];
    return initialLines;
  })
  const [isMinimized, setIsMinimized] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [availableCommands, setAvailableCommands] = useState<OpenClawCommand[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [channels, setChannels] = useState<{ id: string; name: string; nameZh: string }[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string>('main')
  const [currentInstanceId, setCurrentInstanceId] = useState<string>('')
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('')

  const wsRef = useRef<WebSocket | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 添加终端行
  const addTerminalLine = (content: string, type: 'input' | 'output' | 'system' | 'error' = 'output') => {
    setTerminalLines(prev => {
      const newLine: TerminalLine = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        content,
        timestamp: Date.now(),
        type
      }
      // 限制历史记录数量
      if (prev.length > 100) {
        return [...prev.slice(-99), newLine]
      }
      return [...prev, newLine]
    })
  }

  // WebSocket 连接管理
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null
    const reconnectInterval = 5000 // 5 秒重连间隔

    const connect = async () => {
      setIsLoading(true)
      setConnectionStatus('connecting')

      // 🔑 从 URL hash 中提取 token（官方 UI 格式：#token=xxx）
      let urlToken: string | null = null
      const hash = window.location.hash
      if (hash && hash.startsWith('#token=')) {
        urlToken = hash.substring(7) // 移除 '#token=' 前缀
        console.log('🔑 从 URL hash 中提取 token:', urlToken?.substring(0, 20) + '...')
      }

      // 先从 API 获取 Gateway 认证信息和设备信息
      let deviceInfo: {
        deviceId?: string
        instanceId?: string
        publicKey?: string  // 关键：公钥用于设备身份验证
        privateKey?: string  // 私钥用于挑战响应签名
        clientId?: string
        clientMode?: string
        platform?: string
        token?: string
        scopes?: string[]
      } = {}
      let gatewayPort = 18789
      let gatewayToken: string | null = null
      let gatewayTlsEnabled = false
      let gatewayAuthMode: string = 'token' // none, token, password, trusted-proxy

      try {
        const deviceResponse = await fetch('/api/gateway-device')
        if (deviceResponse.ok) {
          const deviceData = await deviceResponse.json()
          gatewayAuthMode = deviceData.gatewayAuthMode || 'token'
          gatewayToken = deviceData.gatewayToken
          gatewayPort = deviceData.gatewayPort || 18789
          gatewayTlsEnabled = deviceData.gatewayTlsEnabled || false

          if (deviceData.success && deviceData.device) {
            deviceInfo = {
              deviceId: deviceData.device.deviceId,
              instanceId: deviceData.device.instanceId,
              publicKey: deviceData.device.publicKey,  // 获取公钥
              privateKey: deviceData.device.privateKey,  // 获取私钥用于签名
              clientId: deviceData.device.clientId,
              clientMode: deviceData.device.clientMode,
              platform: deviceData.device.platform,
              token: deviceData.device.token,
              scopes: deviceData.device.scopes
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch device/config info:', e)
      }

      try {
        let wsProtocol = 'ws://';

        if (window.location.protocol === 'https:' && gatewayTlsEnabled) {
          wsProtocol = 'wss://';
        } else if (gatewayTlsEnabled && window.location.protocol === 'http:') {
          console.log('注意：页面通过 HTTP 访问，但 OpenClaw 启用了 TLS.');
          wsProtocol = 'ws://';
        } else if (!gatewayTlsEnabled) {
          wsProtocol = 'ws://';
        }

        // 优先使用环境变量配置的 Gateway 地址，否则使用当前页面主机名
        // 局域网访问时，WebSocket 连接需要指向部署了 OpenClaw Gateway 的机器
        const gatewayHost = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_HOST || window.location.hostname;
        const wsUrl = `${wsProtocol}${gatewayHost}:${gatewayPort}`;
        console.log('🔌 WebSocket 连接信息:', {
          protocol: wsProtocol,
          hostname: window.location.hostname,
          port: gatewayPort,
          url: wsUrl,
          gatewayTlsEnabled,
          pageProtocol: window.location.protocol
        });
        console.log(`尝试连接到：${wsUrl}`);
        const ws = new WebSocket(wsUrl)
        
        // 🔍 关键：将 WebSocket 实例存储到 ref 中
        wsRef.current = ws
        console.log('🔌 wsRef.current 已设置为:', ws)

        const capturedDeviceInfo = deviceInfo
        const capturedGatewayToken = gatewayToken
        const capturedUrlToken = urlToken  // 🔑 捕获 URL 中的 token

        // 使用 deviceId 作为稳定的 instanceId
        let instanceId: string
        if (capturedDeviceInfo.deviceId) {
          instanceId = capturedDeviceInfo.deviceId
          console.log('使用已配对设备的 deviceId 作为 instanceId:', instanceId.substring(0, 12) + '...')
        } else {
          instanceId = localStorage.getItem('openclaw-instance-id') || `meetclaw-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
          localStorage.setItem('openclaw-instance-id', instanceId)
          console.log('生成新的 instanceId:', instanceId)
        }
        const capturedInstanceId = instanceId

        ws.onopen = () => {
          console.log('✅ Connected to OpenClaw WebSocket:', wsUrl)
          console.log('🔌 ws.onopen: wsRef.current === ws:', wsRef.current === ws)
          console.log('🔌 ws.onopen: ws.readyState:', ws.readyState)
          addTerminalLine(`✓ 已连接到 OpenClaw 服务 (${wsUrl})`, 'system')
          addTerminalLine(`🔌 WebSocket readyState: ${ws.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`, 'system')
          // 🔑 关键：设置连接状态为已连接
          setIsConnected(true)
          setConnectionStatus('connected')
          setIsLoading(false)
          console.log('🟢 连接状态已更新：isConnected = true')
        }

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          console.error('❌ WebSocket readyState:', ws.readyState);
          console.error('❌ WebSocket URL:', ws.url);
          console.error('❌ 连接信息:', {
            url: wsUrl,
            port: gatewayPort,
            tlsEnabled: gatewayTlsEnabled,
            pageProtocol: window.location.protocol
          });
          addTerminalLine(`❌ WebSocket 连接错误：${error}`, 'error');
        }

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          console.log('❌ WebSocket close event:', event);
          setIsConnected(false)
          setIsLoading(false)
          setConnectionStatus('disconnected')
          if (event.code === 1000 || event.code === 1001) {
            addTerminalLine('连接已正常关闭', 'system')
          } else if (event.code === 1008) {
            addTerminalLine('❌ 认证失败 (1008): Policy Violation', 'error')
            addTerminalLine(`原因：${event.reason || 'device identity required'}`, 'error')
          } else {
            addTerminalLine(`连接已断开 (code: ${event.code})`, 'error')
            if (event.reason) {
              addTerminalLine(`原因：${event.reason}`, 'error')
            }
          }
        }

        ws.onmessage = async (event) => {
          try {
            const message = event.data
            console.log('RAW WebSocket message:', message)
            const jsonData = JSON.parse(message)
            console.log('Parsed message:', JSON.stringify(jsonData, null, 2))

            const messageType = jsonData.event || jsonData.type || jsonData.method
            
            if (messageType === "connect.challenge" || messageType === "challenge") {
              addTerminalLine('收到连接挑战，正在发送认证信息...', 'system')
              console.log('📥 收到挑战，准备发送 connect 请求')

              interface ConnectParams {
                minProtocol: number;
                maxProtocol: number;
                client: {
                  id: string;
                  displayName: string;
                  version: string;
                  platform: string;
                  mode: string;
                  instanceId: string;
                };
                role: string;
                scopes: string[];
                userAgent: string;
                locale: string;
                auth?: {
                  token: string;
                };
                device?: {
                  id: string;
                  publicKey: string;
                  signature: string;
                  signedAt: number;
                  nonce?: string;
                };
              }

              const clientId = capturedDeviceInfo.clientId || "gateway-client"
              // 🔑 参考 OpenClaw-Chat-Gateway：client.mode 使用 "webchat"
              // 这是前端 Web 应用的标准模式
              const clientMode = "webchat"
              const role = "operator"       // 角色 - 决定权限
              const platform = capturedDeviceInfo.platform || "darwin"
              
              // 🔍 调试：检查 token 是否有效
              const effectiveToken = capturedUrlToken || capturedGatewayToken || capturedDeviceInfo.token
              console.log('🔑 使用的认证 token:', effectiveToken ? effectiveToken.substring(0, 20) + '...' : '无')
              console.log('🔑 token 来源:', capturedUrlToken ? 'URL' : capturedGatewayToken ? 'Gateway' : capturedDeviceInfo.token ? 'Device' : '无')
              console.log('🔑 capturedDeviceInfo.clientMode:', capturedDeviceInfo.clientMode)
              console.log('🔑 capturedDeviceInfo.platform:', capturedDeviceInfo.platform)
              
              console.log('🔑 连接认证信息:')
              console.log('  - clientId:', clientId)
              console.log('  - client.mode:', clientMode)
              console.log('  - role:', role)
              console.log('  - capturedUrlToken:', capturedUrlToken ? '存在' : '不存在')
              console.log('  - capturedGatewayToken:', capturedGatewayToken ? '存在' : '不存在')
              console.log('  - capturedDeviceInfo.token:', capturedDeviceInfo.token ? '存在' : '不存在')

              // 🔑 根据 OpenClaw 协议：认证 token 优先级
              // 错误信息 "gateway token mismatch" 表明需要使用 Gateway token 进行认证
              let authToken: string | undefined = undefined
              let authDeviceToken: string | undefined = undefined
              
              // 🔑 认证 token 优先级（参考 OpenClaw-Chat-Gateway）：
              // OpenClaw-Chat-Gateway 使用 ~/.openclaw/openclaw.json 中的 gateway.auth.token
              // 1. URL hash 中的 token（官方 UI 格式：#token=xxx）- 最高优先级
              // 2. Gateway token（来自 ~/.openclaw/openclaw.json）- OpenClaw-Chat-Gateway 使用的方式
              // 3. 配对设备的 operator token（来自 ~/.openclaw/devices/paired.json）- 备用
              // 4. 持久化的设备令牌（来自前次连接的 hello-ok.auth.deviceToken）
              
              // 1. 最高优先级：URL hash 中的 token
              if (capturedUrlToken) {
                authToken = capturedUrlToken
                addTerminalLine('✓ 使用 URL 中的 token 进行认证', 'system')
                console.log('🔑 URL token:', capturedUrlToken.substring(0, 20) + '...')
              }
              // 2. 其次：Gateway token（OpenClaw-Chat-Gateway 的方式）
              else if (capturedGatewayToken) {
                authToken = capturedGatewayToken
                addTerminalLine('✓ 使用 Gateway token 进行认证', 'system')
                console.log('🔑 Gateway token:', authToken.substring(0, 20) + '...')
              }
              // 3. 再次：配对设备的 operator token（备用）
              else if (capturedDeviceInfo.token) {
                authToken = capturedDeviceInfo.token
                addTerminalLine('✓ 使用配对设备的 operator token 进行认证', 'system')
                console.log('🔑 配对设备 token:', authToken.substring(0, 20) + '...')
                console.log('🔑 配对设备 scopes:', capturedDeviceInfo.scopes)
                addTerminalLine(`📋 配对设备 scopes: ${capturedDeviceInfo.scopes?.join(', ') || 'unknown'}`, 'system')
              }
              // 4. 最后：持久化的设备令牌
              else if (localStorage.getItem('openclaw-device-token')) {
                authDeviceToken = localStorage.getItem('openclaw-device-token')!
                addTerminalLine('✓ 使用持久化的设备令牌进行认证', 'system')
                console.log('🔑 持久化设备令牌:', authDeviceToken.substring(0, 20) + '...')
              }
              
              if (!authToken && !authDeviceToken) {
                addTerminalLine('⚠️ 未找到认证 token', 'error')
                addTerminalLine('💡 请检查 ~/.openclaw/openclaw.json 中的 gateway.auth.token', 'system')
                addTerminalLine('💡 或者在 URL 中添加 #token=xxx 参数', 'system')
              }

              addTerminalLine(`✓ 客户端 ID: ${clientId}`, 'system')
              addTerminalLine(`✓ 客户端模式：${clientMode}`, 'system')

              // 🔑 参考 OpenClaw-Chat-Gateway 的 connect 请求格式
              // 请求完整的 operator scopes（服务器会根据 token 权限进行授权）
              const requestedScopes = [
                "operator.admin",
                "operator.write",
                "operator.read"
              ]
              
              // OpenClaw-Chat-Gateway 格式：
              // - client.mode 使用 "webchat"（前端 Web 应用标准）
              // - 包含 caps: [] 字段
              // - auth 包含 token 和 password
              const connectParams = {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: clientId,
                  displayName: "MeetClaw Terminal",
                  version: "1.0.0",
                  platform: platform,
                  mode: clientMode,  // webchat
                  instanceId: capturedInstanceId
                },
                caps: [],  // 参考 OpenClaw-Chat-Gateway
                auth: authToken ? {
                  token: authToken,
                  password: undefined  // 可选，仅当使用密码认证时
                } : undefined,
                role: role,  // 角色：operator
                scopes: requestedScopes
              }
              
              const connectMsg = {
                type: "req",
                id: `conn-${Date.now()}`,
                method: "connect",
                params: connectParams
              }
              
              // 🔍 调试：打印发送的 connect 消息
              console.log('=== 发送 connect 请求 ===')
              console.log('connectMsg:', JSON.stringify(connectMsg, null, 2))
              if (connectParams.auth?.token) {
                console.log('🔑 auth.token:', connectParams.auth.token.substring(0, 20) + '...')
              }
              console.log('📋 scopes:', connectParams.scopes)
              console.log('🎭 role:', connectParams.role)
              console.log('🎭 client.mode:', connectParams.client.mode)

              ws.send(JSON.stringify(connectMsg))
              addTerminalLine(`🔑 使用 ${authToken ? 'token' : '无认证'} 进行认证`, 'system')
              addTerminalLine(`🎭 客户端类型 (mode): ${clientMode}`, 'system')
              addTerminalLine(`🎭 角色 (role): ${role}`, 'system')
              addTerminalLine(`📋 请求 scopes: ${requestedScopes.join(', ')}`, 'system')
              
              // 🔍 调试：记录使用的 token 信息
              if (authToken) {
                console.log('🔑 CONNECT 使用 token:', authToken.substring(0, 20) + '...')
              }
              if (authDeviceToken) {
                console.log('🔑 CONNECT 使用 deviceToken:', authDeviceToken.substring(0, 20) + '...')
              }
            } else if (jsonData.type === "res" && jsonData.id?.startsWith("conn-")) {
              console.log('🔍 CONNECT 响应收到:', {
                ok: jsonData.ok,
                id: jsonData.id,
                hasPayload: !!jsonData.payload
              })
              
              if (!jsonData.ok) {
                const errorCode = jsonData.error?.code
                const errorMessage = jsonData.error?.message
                console.log('❌ CONNECT 响应错误:', {
                  code: errorCode,
                  message: errorMessage,
                  fullError: jsonData.error
                })
                addTerminalLine(`❌ 认证失败 (${errorCode}): ${errorMessage}`, 'error')
                if (errorCode === 1008 || errorMessage?.includes('Policy Violation')) {
                  addTerminalLine('💡 原因：client.mode 或 role 参数不匹配', 'system')
                  addTerminalLine('💡 请检查 OpenClaw 控制面板中的设备配置', 'system')
                  addTerminalLine('📋 当前发送的参数：mode=backend, role=operator', 'system')
                }
                setIsLoading(false)
                setConnectionStatus('disconnected')
                return
              }
              
              if (jsonData.ok) {
                setIsConnected(true)
                setIsLoading(false)
                setConnectionStatus('connected')
                addTerminalLine('✅ 连接认证成功！', 'system')

                // 🔍 调试：打印完整的 connect 响应
                console.log('📥 CONNECT 响应 payload 完整内容:')
                console.log(JSON.stringify(jsonData, null, 2))
                
                // 🔍 关键：打印 payload 的所有键
                console.log('🔍 payload 的所有键:', Object.keys(jsonData.payload || {}))
                
                // � 关键：检查连接模式和授权范围
                const presence = jsonData.payload?.snapshot?.presence
                console.log('📥 presence 原始数据:', presence)
                if (presence && Array.isArray(presence)) {
                  console.log('📥 presence 列表:')
                  presence.forEach((p: any, index: number) => {
                    console.log(`  [${index}] mode=${p.mode}, scopes=${JSON.stringify(p.scopes)}, instanceId=${p.instanceId}`)
                  })
                  
                  // 🔍 修复：查找当前连接的设备（webchat, backend, operator, frontend 等）
                  const currentPresence = presence.find((p: { mode?: string }) =>
                    p.mode === 'webchat' || p.mode === 'backend' || p.mode === 'operator' || p.mode === 'frontend'
                  )
                  console.log('🎭 当前连接模式 (presence.mode):', currentPresence?.mode)
                  console.log('📋 当前连接 scopes (presence.scopes):', currentPresence?.scopes)
                  addTerminalLine(`🎭 连接模式：${currentPresence?.mode || 'unknown'}`, 'system')
                  addTerminalLine(`📋 授权范围：${(currentPresence?.scopes || []).join(', ')}`, 'system')
                }
                
                console.log('📥 payload.grantedScopes:', jsonData.payload?.grantedScopes)
                console.log('📥 payload.snapshot.presence:', jsonData.payload?.snapshot?.presence)
                console.log('📥 payload.auth:', jsonData.payload?.auth)
                console.log('📥 payload.auth.scopes:', jsonData.payload?.auth?.scopes)
                console.log('📥 payload.auth.mode:', jsonData.payload?.auth?.mode)

                // 先设置 instanceId 和 deviceId，以便后续权限提取使用
                if (jsonData.payload?.authToken) {
                  localStorage.setItem('openclaw-auth-token', jsonData.payload.authToken)
                }
                if (jsonData.payload?.deviceId) {
                  const deviceId = jsonData.payload.deviceId;
                  localStorage.setItem('openclaw-device-id', deviceId)
                  setCurrentDeviceId(deviceId);
                }
                if (capturedInstanceId) {
                  localStorage.setItem('openclaw-instance-id', capturedInstanceId)
                  setCurrentInstanceId(capturedInstanceId);
                }
                
                // 🔑 关键：持久化设备令牌（deviceToken）供后续连接使用
                // 根据 OpenClaw 协议：配对后 Gateway 会发放 deviceToken，客户端应持久化并在后续连接中复用
                if (jsonData.payload?.auth?.deviceToken) {
                  const deviceToken = jsonData.payload.auth.deviceToken;
                  localStorage.setItem('openclaw-device-token', deviceToken);
                  console.log('🔑 已持久化设备令牌:', deviceToken.substring(0, 20) + '...');
                  addTerminalLine('✓ 已保存设备令牌', 'system');
                }
                
                // 同时持久化 grantedScopes，以便在重新连接时复用已批准的作用域
                if (jsonData.payload?.auth?.scopes && Array.isArray(jsonData.payload.auth.scopes)) {
                  localStorage.setItem('openclaw-auth-scopes', JSON.stringify(jsonData.payload.auth.scopes));
                  console.log('📋 已持久化授权作用域:', jsonData.payload.auth.scopes);
                }

                // 🔍 调试：打印完整的 payload 结构
                console.log('🔍 CONNECT 响应完整 payload 结构:')
                console.log('  - payload:', JSON.stringify(jsonData.payload, null, 2))
                console.log('  - payload.grantedScopes:', jsonData.payload?.grantedScopes)
                console.log('  - payload.auth:', jsonData.payload?.auth)
                console.log('  - payload.auth.scopes:', jsonData.payload?.auth?.scopes)
                console.log('  - payload.auth.mode:', jsonData.payload?.auth?.mode)
                console.log('  - payload.snapshot.presence:', jsonData.payload?.snapshot?.presence)
                console.log('  - payload.snapshot.presence[0]:', jsonData.payload?.snapshot?.presence?.[0])
                
                // 🔑 关键：检查 presence 中每个设备的模式和 scopes
                if (jsonData.payload?.snapshot?.presence && Array.isArray(jsonData.payload.snapshot.presence)) {
                  jsonData.payload.snapshot.presence.forEach((p: any, index: number) => {
                    console.log(`  - presence[${index}]:`, {
                      mode: p.mode,
                      scopes: p.scopes,
                      instanceId: p.instanceId,
                      deviceId: p.deviceId
                    })
                  })
                }
                
                // 从 snapshot.presence 中提取当前设备的 scopes
                // OpenClaw 返回格式：payload.snapshot.presence[] 包含当前连接的设备信息
                let grantedScopes: string[] = []
                
                // 1. 优先使用 payload.auth.scopes（OpenClaw 标准返回格式）
                if (jsonData.payload?.auth?.scopes && Array.isArray(jsonData.payload.auth.scopes)) {
                  grantedScopes = jsonData.payload.auth.scopes
                  console.log('✅ 从 payload.auth.scopes 获取授权范围:', grantedScopes)
                }
                // 2. 其次使用 payload.grantedScopes（最直接的方式）
                else if (jsonData.payload?.grantedScopes && Array.isArray(jsonData.payload.grantedScopes)) {
                  grantedScopes = jsonData.payload.grantedScopes
                  console.log('✅ 从 payload.grantedScopes 获取授权范围:', grantedScopes)
                }
                // 3. 从 snapshot.presence 中提取
                else if (jsonData.payload?.snapshot?.presence && Array.isArray(jsonData.payload.snapshot.presence)) {
                  // 🔍 修复：查找当前连接的设备（webchat, backend, operator, frontend 等）
                  const currentPresence = jsonData.payload.snapshot.presence.find(
                    (p: { instanceId?: string; mode?: string; deviceId?: string }) =>
                      p.mode === 'webchat' || p.mode === 'backend' || p.mode === 'operator' || p.mode === 'frontend'
                  )
                  if (currentPresence && currentPresence.scopes && Array.isArray(currentPresence.scopes)) {
                    grantedScopes = currentPresence.scopes
                    console.log('✅ 从 snapshot.presence 获取授权范围:', grantedScopes)
                    console.log('🎭 连接模式:', currentPresence.mode)
                  } else {
                    console.log('⚠️ 未找到 webchat/backend/operator/frontend mode 的 presence 或没有 scopes')
                    console.log('📥 完整 presence 列表:', jsonData.payload.snapshot.presence)
                    // 尝试使用第一个 presence
                    const firstPresence = jsonData.payload.snapshot.presence[0]
                    if (firstPresence && firstPresence.scopes && Array.isArray(firstPresence.scopes)) {
                      grantedScopes = firstPresence.scopes
                      console.log('✅ 使用第一个 presence 的授权范围:', grantedScopes)
                    }
                  }
                }
                
                console.log('🔍 提取的授权范围:', grantedScopes)
                
                // 当服务器未返回明确授权范围时，默认给予完整权限
                // 这是因为使用 token 认证时，服务器信任 token 持有者拥有完整权限
                if (grantedScopes.length === 0) {
                  grantedScopes = ['operator.read', 'operator.write', 'operator.admin', 'operator.approvals', 'operator.pairing']
                  addTerminalLine('ℹ️ 未获取到授权范围，默认使用完整权限 (operator.read, operator.write, operator.admin)', 'system')
                  console.log('✅ 使用默认授权范围:', grantedScopes)
                } else {
                  addTerminalLine(`📋 授权范围：${grantedScopes.join(', ')}`, 'system')
                }
                
                console.log('💾 存储到 localStorage 的授权范围:', grantedScopes)
                
                // 将授权范围存储到 localStorage，供其他组件使用
                localStorage.setItem('openclaw-granted-scopes', JSON.stringify(grantedScopes))
                
                // 🔍 验证存储
                const storedScopes = localStorage.getItem('openclaw-granted-scopes')
                console.log('🔍 验证存储：localStorage.openclaw-granted-scopes =', storedScopes)
                
                // 检查权限
                const hasWritePermission = grantedScopes.includes('operator.write') || grantedScopes.includes('operator.admin');
                const hasReadPermission = grantedScopes.includes('operator.read') || grantedScopes.includes('operator.write') || grantedScopes.includes('operator.admin');

                if (hasReadPermission) {
                  addTerminalLine('✅ 具备读取权限', 'system');
                }

                if (hasWritePermission) {
                  addTerminalLine('✅ 具备写入权限', 'system');
                }

                localStorage.setItem('openclaw-permissions', JSON.stringify({
                  read: hasReadPermission,
                  write: hasWritePermission,
                  scopes: grantedScopes
                }));

                if (jsonData.payload?.server?.version) {
                  addTerminalLine(`🖥️ 服务器版本：${jsonData.payload.server.version}`, 'system')
                }
                
                // 连接成功后自动获取频道列表 - 改为在 useEffect 中处理
                // 避免 ESLint 错误：Cannot access variable before it is declared
              } else {
                addTerminalLine(`❌ 连接失败：${jsonData.error?.message || '未知错误'}`, 'error')
                setConnectionStatus('error')
                setIsLoading(false)

                if (jsonData.error?.code?.includes('DEVICE') || jsonData.error?.message?.includes('device')) {
                  addTerminalLine('💡 提示：可能需要在 OpenClaw 界面中批准此设备', 'system')
                } else if (jsonData.error?.code === "NOT_PAIRED") {
                  addTerminalLine('💡 提示：设备未配对，请在 OpenClaw 界面中确认配对', 'system')
                }

                ws.close()
                return
              }
            } else if (jsonData.type === "event") {
              if (jsonData.event === "tick") {
                // 心跳事件
              } else if (jsonData.event === "health") {
                console.log('Health event received:', jsonData)
              } else if (jsonData.event === "presence") {
                console.log('Presence event received:', jsonData)
                // 从 presence 事件中更新权限
                const presence = jsonData.payload?.presence;
                if (presence && Array.isArray(presence)) {
                  const currentPresence = presence.find(
                    (p: { instanceId?: string; mode?: string; deviceId?: string }) =>
                      p.instanceId === currentInstanceId && p.mode === 'backend'
                  ) || presence.find(
                    (p: { deviceId?: string }) => p.deviceId === currentDeviceId
                  );
                  if (currentPresence && currentPresence.scopes && Array.isArray(currentPresence.scopes)) {
                    const grantedScopes = currentPresence.scopes;
                    console.log('🔐 从 presence 事件更新权限:', grantedScopes);
                    const hasWritePermission = grantedScopes.includes('operator.write') || grantedScopes.includes('operator.admin');
                    const hasReadPermission = grantedScopes.includes('operator.read') || grantedScopes.includes('operator.write') || grantedScopes.includes('operator.admin');
                    localStorage.setItem('openclaw-permissions', JSON.stringify({
                      read: hasReadPermission,
                      write: hasWritePermission,
                      scopes: grantedScopes
                    }));
                    addTerminalLine(`📋 权限已更新：${grantedScopes.join(', ')}`, 'system');
                  }
                }
              } else if (jsonData.event === "chat.message") {
                // 聊天消息事件 - OpenClaw Gateway 推送的 AI 回复
                const chatPayload = jsonData.payload || {}
                const messageText = chatPayload?.text || chatPayload?.content || JSON.stringify(chatPayload)
                const channelId = chatPayload?.channelId || 'main'
                console.log('📨 [Terminal] 收到 chat.message 事件:', { channelId, messageText })
                addTerminalLine(`💬 [${channelId}] AI: ${messageText}`, 'output')
                // 触发自定义事件通知 UI 更新
                console.log('🔔 [Terminal] 触发 openclaw:chat:message 事件')
                window.dispatchEvent(new CustomEvent('openclaw:chat:message', {
                  detail: { channelId, text: messageText, payload: chatPayload }
                }))
              } else if (jsonData.event === "chat") {
                // 🔑 处理 chat 事件（OpenClaw-Chat-Gateway 格式）
                // 格式：chat: { runId, sessionKey, seq, state, message }
                const chatPayload = jsonData.payload || {}
                const state = chatPayload.state // 'delta' or 'final'
                const message = chatPayload.message // { role, content, timestamp }
                console.log('📨 [Terminal] 收到 chat 事件:', { state, message })
                
                if (state === 'final' && message) {
                  // 提取 AI 回复文本
                  let messageText = ''
                  if (Array.isArray(message.content)) {
                    messageText = message.content
                      .filter((part: any) => part.type === 'text')
                      .map((part: any) => part.text)
                      .join('')
                  } else if (typeof message.content === 'string') {
                    messageText = message.content
                  } else {
                    messageText = JSON.stringify(message.content)
                  }
                  
                  // 从 sessionKey 提取 channelId (格式：agent:{agentId}:chat:{channelId})
                  const sessionKey = chatPayload.sessionKey || ''
                  const channelId = sessionKey.split(':').pop() || 'main'
                  
                  console.log('📨 [Terminal] 提取的消息文本:', { channelId, messageText })
                  addTerminalLine(`💬 [${channelId}] AI: ${messageText}`, 'output')
                  // 触发自定义事件通知 UI 更新 - 这会关闭 AI 思考动画
                  console.log('🔔 [Terminal] 触发 openclaw:chat:message 事件 (chat 事件)')
                  window.dispatchEvent(new CustomEvent('openclaw:chat:message', {
                    detail: { channelId, text: messageText, payload: chatPayload }
                  }))
                } else if (state === 'delta') {
                  // 流式输出中的增量更新
                  let deltaText = ''
                  if (message?.content && Array.isArray(message.content)) {
                    deltaText = message.content
                      .filter((part: any) => part.type === 'text')
                      .map((part: any) => part.text)
                      .join('')
                  }
                  if (deltaText) {
                    addTerminalLine(`💭 AI 思考中：${deltaText.substring(0, 50)}...`, 'system')
                  }
                }
              } else {
                addTerminalLine(`${jsonData.event}: ${JSON.stringify(jsonData.payload, null, 2)}`, 'output')
              }
            } else if (jsonData.type === "res") {
              console.log('🔍 收到 res 响应:', {
                id: jsonData.id,
                ok: jsonData.ok,
                error: jsonData.error
              })
              
              // 处理 chat.send 响应 - JSON-RPC 标准响应格式
              if (jsonData.id?.startsWith('chat-')) {
                if (jsonData.ok) {
                  console.log('✅ Chat message sent successfully');
                  addTerminalLine('✅ 消息发送成功', 'system');
                } else {
                  const errorMsg = jsonData.error?.message || 'Unknown error';
                  const errorCode = jsonData.error?.code;
                  console.log('❌ Chat send error:', { code: errorCode, message: errorMsg });
                  console.log('📋 当前 localStorage.openclaw-granted-scopes:', localStorage.getItem('openclaw-granted-scopes'));
                  console.log('🔑 当前 localStorage.openclaw-device-token:', localStorage.getItem('openclaw-device-token')?.substring(0, 20) + '...');
                  addTerminalLine(`❌ 发送失败：${errorMsg}`, 'error');
                  if (errorCode === 'INVALID_REQUEST' || errorMsg.includes('missing scope')) {
                    addTerminalLine('💡 权限不足，请在 OpenClaw 中检查设备权限', 'system');
                    addTerminalLine('🔑 请确认已使用正确的 token 进行认证', 'system');
                  }
                }
              }
              // 处理 channels.list 响应
              else if (jsonData.id?.startsWith('channels-')) {
                if (!jsonData.ok) {
                  // channels.list 方法可能不存在，使用默认频道
                  console.log('⚠️ channels.list 不可用:', jsonData.error?.message)
                  const defaultChannels: Channel[] = [
                    { id: 'main', name: 'Main', nameZh: '主频道' },
                    { id: 'voice', name: 'Voice', nameZh: '语音频道' }
                  ]
                  setChannels(defaultChannels)
                  addTerminalLine('📺 使用默认频道列表', 'system')
                  // 触发自定义事件，让父组件可以获取频道列表
                  window.dispatchEvent(new CustomEvent('openclaw:channels:loaded', {
                    detail: { channels: defaultChannels }
                  }))
                } else {
                  const channelsData = jsonData.payload
                  if (Array.isArray(channelsData)) {
                    const parsedChannels: Channel[] = channelsData.map((ch: { id?: string; channelId?: string; name?: string; channelName?: string; nameZh?: string }) => ({
                      id: ch.id || ch.channelId || 'unknown',
                      name: ch.name || ch.channelName || 'Unknown',
                      nameZh: ch.nameZh || ch.name || '未知频道'
                    }))
                    setChannels(parsedChannels)
                    addTerminalLine(`📺 已加载 ${parsedChannels.length} 个频道`, 'system')
                    // 触发自定义事件，让父组件可以获取频道列表
                    window.dispatchEvent(new CustomEvent('openclaw:channels:loaded', {
                      detail: { channels: parsedChannels }
                    }))
                  }
                }
              } else if (jsonData.ok) {
                addTerminalLine(JSON.stringify(jsonData.payload, null, 2), 'output')
              } else {
                addTerminalLine(`❌ 错误：${jsonData.error?.message || '未知错误'}`, 'error')
              }
            } else {
              addTerminalLine(JSON.stringify(jsonData, null, 2), 'output')
            }
          } catch (e) {
            addTerminalLine(event.data, 'output')
          }
        }

        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          setIsLoading(false)
          setConnectionStatus('error')
          addTerminalLine('⚠️ WebSocket 连接发生错误', 'error')
        }

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          setIsConnected(false)
          setIsLoading(false)
          setConnectionStatus('disconnected')

          if (event.code === 1000 || event.code === 1001) {
            addTerminalLine('连接已正常关闭', 'system')
          } else if (event.code === 1008) {
            addTerminalLine('❌ 认证失败 (1008): Policy Violation', 'error')
            addTerminalLine(`原因：${event.reason || 'device identity required'}`, 'error')
            addTerminalLine('', 'system')
            addTerminalLine('🔧 解决方案:', 'system')
            addTerminalLine('1. 打开 OpenClaw 控制面板 (http://127.0.0.1:18789)', 'system')
            addTerminalLine('2. 检查 "Pending Devices" 或 "Paired Devices"', 'system')
            addTerminalLine('3. 确保设备已批准并具有 operator.write 权限', 'system')
            addTerminalLine('', 'system')
            addTerminalLine('💡 已配对设备 ID: ' + (capturedDeviceInfo.deviceId?.substring(0, 16) + '...' || '未知'), 'system')
            addTerminalLine('💡 点击刷新按钮重新尝试连接', 'system')
          } else {
            addTerminalLine(`连接已断开 (code: ${event.code})`, 'error')
            if (event.reason) {
              addTerminalLine(`原因：${event.reason}`, 'error')
            }
            addTerminalLine('请检查 OpenClaw 服务是否正在运行', 'system')
          }
        }

        wsRef.current = ws
      } catch (error) {
        console.error('Failed to establish WebSocket connection:', error)
        setIsLoading(false)
        setConnectionStatus('error')
        addTerminalLine('❌ 无法建立 WebSocket 连接', 'error')

        if (reconnectTimeout) clearTimeout(reconnectTimeout)
        reconnectTimeout = setTimeout(connect, reconnectInterval)
      }
    }

    connect()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount')
      }
    }
  }, [])

  // 获取频道列表
  const fetchChannels = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }
    
    const fetchMsg = {
      type: "req",
      id: `channels-${Date.now()}`,
      method: "channels.list",
      params: {}
    }
    
    wsRef.current.send(JSON.stringify(fetchMsg))
  }
  
  // 连接成功后自动获取频道列表
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const timer = setTimeout(() => {
        fetchChannels()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [connectionStatus])
  
  // 发送聊天消息 - 符合 OpenClaw Gateway JSON-RPC 协议
  // 参考 OpenClaw-Chat-Gateway/backend/src/openclaw-client.ts:426
  const sendChatMessage = (channelId: string, text: string) => {
    console.log('🔍 sendChatMessage 调用:', { channelId, text })
    console.log('🔌 WebSocket 状态:', wsRef.current?.readyState)
    
    // 如果 WebSocket 未打开，尝试重连一次
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (wsRef.current?.readyState === WebSocket.CLOSED) {
        console.log('🔄 WebSocket 已关闭，尝试重新连接...')
        addTerminalLine('🔄 连接已断开，正在重连...', 'system')
        connectToOpenClaw()
        // 延迟发送，等待连接建立
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            sendChatMessage(channelId, text)
          } else {
            addTerminalLine('❌ 重连失败，请刷新页面', 'error')
          }
        }, 2000)
        return false
      }
      console.warn('⚠️ WebSocket 未就绪')
      addTerminalLine('WebSocket 连接未就绪', 'error')
      return false
    }
    
    // 从 localStorage 获取授权范围
    const grantedScopesStr = localStorage.getItem('openclaw-granted-scopes')
    let grantedScopes: string[] = []
    if (grantedScopesStr) {
      try {
        grantedScopes = JSON.parse(grantedScopesStr)
        console.log('📋 已获取授权范围:', grantedScopes)
      } catch (e) {
        console.warn('Could not parse granted scopes:', e)
      }
    } else {
      console.log('⚠️ 未找到授权范围，使用默认值')
    }
    
    // 检查是否有写入权限
    const hasWritePermission = grantedScopes.includes('operator.write') ||
                               grantedScopes.includes('operator.admin')
    
    // 🔑 构建标准 JSON-RPC 请求 - 参考 OpenClaw-Chat-Gateway
    // OpenClaw Gateway 格式：{ type: "req", id: string, method: string, params: object }
    // chat.send 参数：sessionKey, message, idempotencyKey, attachments (可选)
    // sessionKey 格式：agent:{agentId}:chat:{channelId}
    const agentId = 'main'
    const sessionKey = `agent:${agentId}:chat:${channelId}`
    
    // 生成 idempotencyKey（浏览器环境使用 crypto.randomUUID 或降级方案）
    let idempotencyKey: string
    if ('randomUUID' in crypto) {
      idempotencyKey = crypto.randomUUID()
    } else {
      idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }
    
    const chatMsg = {
      type: "req",
      id: `chat-${Date.now()}`,
      method: "chat.send",
      params: {
        sessionKey: sessionKey,
        message: text,
        idempotencyKey: idempotencyKey
      }
    }
    
    console.log('📤 发送聊天消息:', JSON.stringify(chatMsg, null, 2))
    wsRef.current.send(JSON.stringify(chatMsg))
    addTerminalLine(`📤 发送消息到 [${channelId}]: ${text}`, 'input')
    
    if (!hasWritePermission) {
      addTerminalLine('⚠️ 当前可能缺少 operator.write 权限，消息可能发送失败', 'system')
      addTerminalLine(`📋 当前授权范围：${grantedScopes.join(', ') || '无'}`, 'system')
    }
    
    return true
  }
  
  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    sendChatMessage,
    channels,
    selectedChannel,
    setSelectedChannel
  }))

  // 发送命令
  const sendCommand = (command: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addTerminalLine('WebSocket 连接未就绪', 'error')
      return
    }

    const permissionsStr = localStorage.getItem('openclaw-permissions');
    let hasReadPermission = true;
    let hasWritePermission = true;

    if (permissionsStr) {
      try {
        const permissions = JSON.parse(permissionsStr);
        hasReadPermission = permissions.read || false;
        hasWritePermission = permissions.write || false;
      } catch (e) {
        console.warn('Could not parse permissions:', e);
      }
    }

    const isWriteCommand = command.includes('create') || command.includes('delete') ||
                           command.includes('update') || command.includes('set') ||
                           command.includes('modify') || command.includes('patch') ||
                           command.includes('apply') || command.includes('restart') ||
                           command.includes('approve') || command.includes('revoke') ||
                           command.includes('enable') || command.includes('disable') ||
                           command.includes('install') || command.includes('abort');

    if (isWriteCommand && !hasWritePermission) {
      addTerminalLine(`⚠️ 权限不足：当前连接不允许执行修改操作 "${command}"`, 'error');
      addTerminalLine('💡 提示：请使用具有管理员权限的账户重新配对设备', 'system');
      return;
    }

    if (!hasReadPermission && !isWriteCommand) {
      addTerminalLine(`⚠️ 权限不足：当前连接不允许执行读取操作 "${command}"`, 'error');
      addTerminalLine('💡 提示：请使用具有读取权限的账户重新配对设备', 'system');
      return;
    }

    const generateId = () => `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const parseCommandArgs = (cmd: string): { method: string; params: Record<string, unknown> } => {
      const parts = cmd.trim().split(/\s+/)
      const baseCmd = parts[0].toLowerCase()
      const args = parts.slice(1)

      switch (baseCmd) {
        // === 状态与健康检查 ===
        case 'status':
        case 'gateway':
          return { method: 'gateway.status', params: {} }

        case 'health':
          return { method: 'health', params: {} }

        case 'version':
          return { method: 'gateway.status', params: {} }

        // === 配置管理 ===
        case 'config':
          if (args[0] === 'get') {
            return {
              method: 'config.get',
              params: args[1] ? { path: args[1] } : {}
            }
          } else if (args[0] === 'set') {
            if (args.length < 3) {
              addTerminalLine('❌ 用法：config.set <path> <value>', 'error')
              return { method: '', params: {} }
            }
            let value: string | number | boolean | object = args[2]
            try {
              value = JSON.parse(args.slice(2).join(' '))
            } catch (e) {
              // 保持为字符串
            }
            return {
              method: 'config.set',
              params: { path: args[1], value }
            }
          } else if (args[0] === 'list') {
            return { method: 'config.list', params: {} }
          } else {
            return { method: 'config.get', params: {} }
          }

        // === 会话管理 ===
        case 'sessions':
          if (args[0] === 'list') {
            return { method: 'sessions.list', params: {} }
          } else if (args[0] === 'get') {
            return {
              method: 'sessions.get',
              params: args[1] ? { sessionId: args[1] } : {}
            }
          } else {
            return { method: 'sessions.list', params: {} }
          }

        // === 通道管理 ===
        case 'channels':
          if (args[0] === 'status') {
            return { method: 'channels.status', params: {} }
          } else if (args[0] === 'list') {
            return { method: 'channels.list', params: {} }
          } else if (args[0] === 'get') {
            return {
              method: 'channels.get',
              params: args[1] ? { channelId: args[1] } : {}
            }
          } else {
            return { method: 'channels.status', params: {} }
          }

        // === 内存管理 ===
        case 'memory':
          if (args[0] === 'status') {
            return { method: 'memory.status', params: {} }
          } else if (args[0] === 'get') {
            return {
              method: 'memory.get',
              params: args[1] ? { key: args[1] } : {}
            }
          } else if (args[0] === 'set') {
            if (args.length < 3) {
              addTerminalLine('❌ 用法：memory.set <key> <value>', 'error')
              return { method: '', params: {} }
            }
            return {
              method: 'memory.set',
              params: { key: args[1], value: args.slice(2).join(' ') }
            }
          } else if (args[0] === 'delete') {
            return {
              method: 'memory.delete',
              params: args[1] ? { key: args[1] } : {}
            }
          } else {
            return { method: 'memory.status', params: {} }
          }

        // === 日志管理 ===
        case 'logs':
          if (args[0] === 'get') {
            return {
              method: 'logs.get',
              params: {
                limit: args[1] ? parseInt(args[1]) : 50,
                level: args.find(a => a.startsWith('level='))?.split('=')[1] as string || undefined
              }
            }
          } else {
            return {
              method: 'logs.get',
              params: { limit: 50 }
            }
          }

        // === 聊天 ===
        case 'chat':
          if (args[0] === 'send') {
            return {
              method: 'chat.send',
              params: {
                channelId: args[1] || 'default',
                text: args.slice(2).join(' ')
              }
            }
          } else {
            return {
              method: 'chat.send',
              params: {
                channelId: 'default',
                text: args.join(' ')
              }
            }
          }

        // === 定时任务 ===
        case 'cron':
          if (args[0] === 'list') {
            return { method: 'cron.list', params: {} }
          } else if (args[0] === 'get') {
            return {
              method: 'cron.get',
              params: args[1] ? { cronId: args[1] } : {}
            }
          } else {
            return { method: 'cron.list', params: {} }
          }

        // === 技能管理 ===
        case 'skills':
          if (args[0] === 'list') {
            return { method: 'skills.list', params: {} }
          } else if (args[0] === 'get') {
            return {
              method: 'skills.get',
              params: args[1] ? { skillId: args[1] } : {}
            }
          } else {
            return { method: 'skills.list', params: {} }
          }

        // === 设备管理 ===
        case 'devices':
          if (args[0] === 'list') {
            return { method: 'devices.list', params: {} }
          } else if (args[0] === 'get') {
            return {
              method: 'devices.get',
              params: args[1] ? { deviceId: args[1] } : {}
            }
          } else if (args[0] === 'approve') {
            return {
              method: 'devices.approve',
              params: args[1] ? { requestId: args[1] } : {}
            }
          } else if (args[0] === 'revoke') {
            return {
              method: 'devices.revoke',
              params: args[1] ? { deviceId: args[1] } : {}
            }
          } else {
            return { method: 'devices.list', params: {} }
          }

        // === 执行命令 ===
        case 'exec':
          return {
            method: 'exec',
            params: {
              command: args.join(' ')
            }
          }

        // === 更新管理 ===
        case 'update':
          if (args[0] === 'check') {
            return { method: 'update.check', params: {} }
          } else if (args[0] === 'apply') {
            return { method: 'update.apply', params: {} }
          } else {
            return { method: 'update.check', params: {} }
          }

        // === 帮助 ===
        case 'help':
          const helpText = `
OpenClaw Gateway WebSocket API 帮助

可用命令:
  status / gateway     - 查看网关状态
  health              - 健康检查
  version             - 查看版本

  config get [path]   - 获取配置
  config set <path> <value> - 设置配置
  config list         - 列出配置

  sessions list       - 列出会话
  sessions get <id>   - 获取会话详情

  channels status     - 查看通道状态
  channels list       - 列出通道
  channels get <id>   - 获取通道详情

  memory status       - 查看内存状态
  memory get <key>    - 获取内存值
  memory set <key> <value> - 设置内存值
  memory delete <key> - 删除内存值

  logs get [limit]    - 获取日志

  chat send <channel> <text> - 发送消息

  cron list           - 列出定时任务
  cron get <id>       - 获取定时任务详情

  skills list         - 列出技能
  skills get <id>     - 获取技能详情

  devices list        - 列出设备
  devices get <id>    - 获取设备详情
  devices approve <id> - 批准设备
  devices revoke <id>  - 撤销设备

  exec <command>      - 执行命令

  update check        - 检查更新
  update apply        - 应用更新

  help                - 显示此帮助信息
`.trim()
          addTerminalLine(helpText, 'output')
          return { method: '', params: {} }

        // === 默认 ===
        default:
          addTerminalLine(`❌ 未知命令：${baseCmd}`, 'error')
          addTerminalLine('输入 "help" 查看可用命令', 'system')
          return { method: '', params: {} }
      }
    }

    const { method, params } = parseCommandArgs(command)

    if (!method) {
      return
    }

    const commandId = generateId()
    const commandMessage = {
      type: "req",
      id: commandId,
      method: method,
      params: params
    }

    addTerminalLine(`$ ${command}`, 'input')
    console.log('Sending command:', commandMessage)
    wsRef.current.send(JSON.stringify(commandMessage))
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputCommand.trim()) {
      executeCommand(inputCommand.trim())
      setInputCommand('')
    }
  }

  const executeCommand = (cmd: string) => {
    sendCommand(cmd)
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }
    }, 100)
  }

  const clearTerminal = () => {
    setTerminalLines([])
  }

  const copyTerminalContent = () => {
    const content = terminalLines.map(line => line.content).join('\n')
    navigator.clipboard.writeText(content)
    addTerminalLine('✅ 终端内容已复制到剪贴板', 'system')
  }

  const reconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User requested reconnect')
    }
    setTerminalLines([])
    setIsConnected(false)
    setConnectionStatus('disconnected')
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  const clearCacheAndReconnect = () => {
    localStorage.removeItem('openclaw-auth-token')
    localStorage.removeItem('openclaw-device-id')
    localStorage.removeItem('openclaw-instance-id')
    localStorage.removeItem('openclaw-permissions')
    reconnect()
  }

  const presetCommands = [
    { command: 'status', description: '网关状态', category: 'status' },
    { command: 'health', description: '健康检查', category: 'status' },
    { command: 'version', description: '版本信息', category: 'status' },
    { command: 'config list', description: '配置列表', category: 'config' },
    { command: 'channels status', description: '通道状态', category: 'channel' },
    { command: 'channels list', description: '通道列表', category: 'channel' },
    { command: 'sessions list', description: '会话列表', category: 'session' },
    { command: 'memory status', description: '内存状态', category: 'memory' },
    { command: 'logs get 50', description: '最近日志', category: 'logs' },
    { command: 'devices list', description: '设备列表', category: 'device' },
    { command: 'skills list', description: '技能列表', category: 'skills' },
    { command: 'cron list', description: '定时任务', category: 'cron' },
    { command: 'help', description: '帮助信息', category: 'help' },
  ]

  const groupedCommands = presetCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = []
    }
    acc[cmd.category].push(cmd)
    return acc
  }, {} as Record<string, typeof presetCommands>)

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines])

  return (
    <motion.div
      className="fixed bottom-4 right-4 z-50"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <AnimatePresence>
        {isMinimized ? (
          <motion.div
            className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-800/90 transition-colors"
            onClick={() => setIsMinimized(false)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <TerminalIcon className="w-6 h-6 text-cyan-400" />
          </motion.div>
        ) : (
          <motion.div
            className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl"
            style={{ width: '800px', maxHeight: '600px' }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800/50 rounded-t-lg">
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-medium text-gray-200">OpenClaw Terminal</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  isConnected ? 'bg-green-900/50 text-green-400' :
                  connectionStatus === 'connecting' ? 'bg-yellow-900/50 text-yellow-400' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {connectionStatus === 'connected' ? '已连接' :
                   connectionStatus === 'connecting' ? '连接中...' :
                   connectionStatus === 'error' ? '错误' : '未连接'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reconnect}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                  title="重新连接"
                >
                  <RefreshCw className="w-4 h-4 text-gray-400 hover:text-cyan-400" />
                </button>
                <button
                  onClick={clearCacheAndReconnect}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                  title="清除缓存并重新连接"
                >
                  <svg className="w-4 h-4 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                  title="最小化"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 终端内容区 */}
            <div
              ref={terminalRef}
              className="p-4 font-mono text-sm text-gray-100 overflow-y-auto"
              style={{ height: '400px' }}
            >
              {terminalLines.map((line) => (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`mb-1 whitespace-pre-wrap ${
                    line.type === 'input' ? 'text-cyan-400' :
                    line.type === 'system' ? 'text-yellow-400' :
                    line.type === 'error' ? 'text-red-400' :
                    'text-gray-300'
                  }`}
                >
                  {line.type === 'input' && <span className="text-green-400 mr-2">$</span>}
                  {line.content}
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-yellow-400"
                >
                  正在连接...
                </motion.div>
              )}
            </div>

            {/* 命令输入区 */}
            <div className="px-4 py-2 border-t border-gray-700 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <span className="text-green-400 font-mono">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputCommand}
                  onChange={(e) => setInputCommand(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isConnected ? "输入命令..." : "等待连接..."}
                  disabled={!isConnected}
                  className="flex-1 bg-transparent border-none outline-none text-gray-100 font-mono text-sm"
                />
              </div>
            </div>

            {/* 预设命令区 */}
            <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/30 rounded-b-lg">
              <div className="flex flex-wrap gap-2">
                {Object.entries(groupedCommands).map(([category, cmds]) => (
                  <div key={category} className="flex flex-wrap gap-1 items-center">
                    <span className="text-xs text-gray-500 uppercase">{category}:</span>
                    {cmds.map((cmd, index) => (
                      <motion.button
                        key={index}
                        onClick={() => executeCommand(cmd.command)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        title={cmd.description}
                      >
                        {cmd.command}
                      </motion.button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

WebsocketTerminal.displayName = 'WebsocketTerminal'
