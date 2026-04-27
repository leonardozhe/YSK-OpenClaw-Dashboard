'use client'

import { useState, useEffect, useCallback, useRef, useId, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { LottieLobster } from '@/components/lottie-lobster'
import { ContactsPanel } from '@/components/contact-card'
import { DeviceMonitor } from '@/components/device-monitor'
import { SystemStatusCards } from '@/components/system-status-cards'
import { ToastNotifications } from '@/components/toast-notifications'
import { SettingsModal } from '@/components/settings-modal'
import { AgentProfileModal } from '@/components/agent-profile-modal'
import { WebsocketTerminalRef } from '@/components/smart-terminal'
import { PermissionModal } from '@/components/permission-modal'
import {
  ParticleBackground,
  AIGlow,
  SoundWaves,
  SparkleEffect,
  CelebrationEffect,
  ScanlineEffect,
  MatrixRainEffect,
  FloatingParticlesEffect,
  GlitchEffect
} from '@/components/voice-animations'
import { ChatInput, MessageList } from '@/components/chat-input'
import { CopyButton } from '@/components/copy-button'
import { SmartTerminal } from '@/components/smart-terminal'
import { WebsocketTerminal, Channel } from '@/components/websocket-terminal'
import { contacts, Contact, Message, getAIResponse, cn } from '@/lib/utils'
import { usePersistentConfig } from '@/hooks/use-persistent-config'

// Channel 数据类型
interface ChannelData {
  id: string
  name: string
  nameZh: string
  nameEn: string
  icon: string
  enabled: boolean
  configured: boolean
}

export default function Home() {
  // 使用 useId 生成稳定的组件 ID，避免 hydration 不匹配
  const componentId = useId()
  
  // 消息 ID 计数器（使用递增数字代替随机数）
  const messageIdCounter = useRef(0)
  const generateMessageId = useCallback((prefix: string) => {
    messageIdCounter.current += 1
    return `${prefix}-${Date.now()}-${messageIdCounter.current}`
  }, [])
  
  // 状态
  // 使用初始化函数直接从 localStorage 加载，避免 SSR/hydration 问题
  const [currentAssistant, setCurrentAssistant] = useState<Contact>(() => {
    if (typeof window === 'undefined') return contacts[0]
    const savedAssistantId = localStorage.getItem('openclaw-chat-assistant')
    if (savedAssistantId) {
      const assistant = contacts.find(c => c.id === savedAssistantId)
      if (assistant) return assistant
    }
    return contacts[0]
  })
  const [channels, setChannels] = useState<ChannelData[]>([])
  const [chatChannels, setChatChannels] = useState<Channel[]>([])
  // 可用的 agents 列表
  const [availableAgents, setAvailableAgents] = useState<{ id: string; name: string; alias?: string; slug?: string; bio?: string; status: string; channel: string }[]>([])
  // 当前选中的 agent ID（用于选择与哪个 agent 聊天）
  // 使用初始化函数直接从 localStorage 加载，避免 SSR/hydration 问题
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'main'
    return localStorage.getItem('openclaw-selected-agent-id') || 'main'
  })
  // 为每个 agent 维护独立的聊天记录，使用 Record<agentId, messages[]>
  const [agentChatMessages, setAgentChatMessages] = useState<Record<string, { id: string; text: string; isUser: boolean; timestamp: number; model?: string; upvotes?: number; downvotes?: number; ctxPercent?: number }[]>>(() => {
    if (typeof window === 'undefined') return {}
    const saved = localStorage.getItem('openclaw-agent-chat-messages')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed
        }
      } catch (e) {
        console.error('Failed to parse saved agent chat messages:', e)
      }
    }
    return {}
  })
  // selectedChatChannel 与 selectedAgentId 同步
  const selectedChatChannel = selectedAgentId
  const [chatMessages, setChatMessages] = useState<{ id: string; channelId: string; text: string; isUser: boolean; timestamp: number; model?: string; upvotes?: number; downvotes?: number; ctxPercent?: number }[]>([])
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const websocketTerminalRef = useRef<WebsocketTerminalRef>(null) // 使用 SmartTerminal 导出的类型
  const chatInputRef = useRef<HTMLInputElement>(null) // 聊天输入框 ref
  const messagesEndRef = useRef<HTMLDivElement>(null) // 消息列表底部 ref，用于自动滚屏
  const [isSleeping, setIsSleeping] = useState(false)
  const [isTerminalOpen, setIsTerminalOpen] = useState(false) // Terminal 弹窗状态
  const [isAnimating, setIsAnimating] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [celebrationTrigger, setCelebrationTrigger] = useState(0)
  const [isChatOpen, setIsChatOpen] = useState(false) // 默认关闭聊天框
  const [isAIThinking, setIsAIThinking] = useState(false) // AI 思考状态
  // 使用 useSyncExternalStore 检测客户端挂载（修复 hydration 错误）
  const mounted = useSyncExternalStore(
    () => () => {}, // subscribe: 不需要订阅外部系统
    () => true,     // getSnapshot: 客户端始终返回 true
    () => false     // getServerSnapshot: 服务端返回 false
  )
  
  // Agent 个人信息弹窗状态
  const [isAgentProfileOpen, setIsAgentProfileOpen] = useState(false)
  const [selectedProfileAgentId, setSelectedProfileAgentId] = useState('')
  const [selectedProfileAgentName, setSelectedProfileAgentName] = useState('')
  const [selectedProfileAgentAvatar, setSelectedProfileAgentAvatar] = useState('')
  
  // 使用配置持久化 Hook
  const { config, isLoading: configLoading, saveConfig, importConfig, downloadConfig: exportConfigFn, resetConfig } = usePersistentConfig()
  
  // 设置相关状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [customTitle, setCustomTitle] = useState('YSK小龙虾工作监控系统')
  const [customLogo, setCustomLogo] = useState('/openclaw.png')
  const [lobsterCount, setLobsterCount] = useState(5)
  const [teamName, setTeamName] = useState('海洋战队')
  const [unit, setUnit] = useState('只虾')
  const [avatarStyle, setAvatarStyle] = useState('bottts')
  const [effects, setEffects] = useState<string[]>(['scanline'])
  const [mainProcessName, setMainProcessName] = useState('龙虾船长')
  
  // 初始化加载配置
  useEffect(() => {
    if (!configLoading && config) {
      setCustomTitle(config.customTitle)
      setCustomLogo(config.customLogo)
      setLobsterCount(config.lobsterCount)
      setTeamName(config.teamName)
      setUnit(config.unit)
      setAvatarStyle(config.avatarStyle)
      setEffects(config.effects)
      setMainProcessName(config.mainProcessName)
      setSelectedAgentId(config.selectedAgentId)
      setCurrentAssistant(contacts.find(c => c.id === config.chatAssistant) || contacts[0])
      if (Object.keys(config.agentChatMessages).length > 0) {
        setAgentChatMessages(config.agentChatMessages)
      }
      if (config.presetCommands.length > 0) {
        setPresetCommands(config.presetCommands)
      }
      if (config.permissionAgreed) {
        setShowPermissionModal(false)
      }
    }
  }, [configLoading, config])
  const [githubStars, setGithubStars] = useState<number | null>(null)
  
  // 版本检查状态
  const [updateInfo, setUpdateInfo] = useState<{ hasUpdate: boolean; latestVersion: string; releaseUrl: string } | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  
  // 权限审批状态
  const [showPermissionModal, setShowPermissionModal] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('ysk-permission-agreed') !== 'true'
  })
  
  
  // 睡眠计时器
  useEffect(() => {
    if (isVoiceMode || chatMessages.length > 0 || isChatOpen) {
      const wakeTimer = setTimeout(() => {
        setIsSleeping(false)
      }, 0)
      return () => clearTimeout(wakeTimer)
    }
    
    const timer = setTimeout(() => {
      setIsSleeping(true)
    }, 10000)
    
    return () => clearTimeout(timer)
  }, [isVoiceMode, chatMessages, isChatOpen])
  
  // 初始化加载 channels
  // 初始化加载 channels
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('/api/channels')
        if (!response.ok) {
          return // 静默失败，不显示错误
        }
        const data = await response.json()
        if (data.channels) {
          setChannels(data.channels)
        }
      } catch (error) {
        console.error('Failed to fetch channels:', error)
      }
    }
    fetchChannels()
  }, [])
  
  // 获取可用 agents 列表（只显示永久会话）
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch('/api/agents')
        if (!response.ok) {
          return
        }
        const data = await response.json()
        if (data.agents && Array.isArray(data.agents)) {
          // 只过滤永久会话（chatType === 'permanent'）
          const permanentAgents = data.agents.filter((a: { chatType?: string }) => a.chatType === 'permanent')
          setAvailableAgents(permanentAgents)
          // 如果当前选中的 agent 不在列表中，设置为第一个 agent
          if (!permanentAgents.find((a: { id: string }) => a.id === selectedAgentId) && permanentAgents.length > 0) {
            setSelectedAgentId(permanentAgents[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error)
      }
    }
    fetchAgents()
  }, [])
  
  // 获取 GitHub stars
  useEffect(() => {
    const fetchGithubStars = async () => {
      try {
        const response = await fetch('/api/github-stars')
        if (!response.ok) {
          return // 静默失败，不显示错误
        }
        const data = await response.json()
        if (data.stars !== undefined) {
          setGithubStars(data.stars)
        }
      } catch (error) {
        console.error('Failed to fetch GitHub stars:', error)
      }
    }
    fetchGithubStars()
  }, [])
  
  // 24 小时检查一次 GitHub 新版本
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/api/version-check')
        if (!response.ok) return
        
        const data = await response.json()
        
        // 无论是否有更新都设置状态
        setUpdateInfo({
          hasUpdate: data.hasUpdate,
          latestVersion: data.latestVersion || data.currentVersion,
          releaseUrl: data.release?.html_url || 'https://github.com/leonardozhe/YSK-OpenClaw-Dashboard/releases'
        })
        
        // 如果有更新，弹窗提示
        if (data.hasUpdate) {
          const lastPromptedVersion = localStorage.getItem('meetclaw-last-prompted-version')
          if (lastPromptedVersion !== data.latestVersion) {
            setShowUpdateModal(true)
            localStorage.setItem('meetclaw-last-prompted-version', data.latestVersion)
          }
        }
      } catch (error) {
        console.error('Failed to check for updates:', error)
      }
    }
    
    checkForUpdates()
    
    // 24 小时检查一次
    const interval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])
  
  // 选择联系人 - 打开 Agent 个人信息弹窗
  const handleSelectContact = useCallback((contact: Contact) => {
    setSelectedProfileAgentId(contact.id)
    setSelectedProfileAgentName(contact.name)
    setSelectedProfileAgentAvatar(contact.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${contact.id}`)
    setIsAgentProfileOpen(true)
  }, [])
  
  // 处理联系人状态变化
  const handleStatusChange = useCallback((contactId: string, newStatus: Contact['status']) => {
    // 如果是当前选中的联系人，更新其状态
    if (currentAssistant.id === contactId) {
      setCurrentAssistant(prev => ({ ...prev, status: newStatus }))
    }
  }, [currentAssistant.id])
  
  // 发送消息
  const handleSendMessage = useCallback((text: string) => {
    setIsSleeping(false)
    setIsAIThinking(true) // 开始思考
    
    // 添加用户消息
    const userMsg: Message = {
      id: generateMessageId('user'),
      text,
      type: 'user',
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMsg])
    
    // 模拟 AI 思考和回复 (固定 2 秒延迟，避免 hydration 不匹配)
    const thinkTime = 2000
    setTimeout(() => {
      const aiMsg: Message = {
        id: generateMessageId('ai'),
        text: getAIResponse(text, currentAssistant.name),
        type: 'ai',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, aiMsg])
      setIsAIThinking(false) // 结束思考
      setCelebrationTrigger(prev => prev + 1)
    }, thinkTime)
  }, [currentAssistant, generateMessageId])
  
  // 发送聊天消息到 OpenClaw - 修改为按 agent 存储消息
  const handleSendChatMessage = useCallback((text: string) => {
    console.log('🔍 handleSendChatMessage 调用:', { text, selectedAgentId })
    console.log('🔌 websocketTerminalRef:', websocketTerminalRef.current)
    console.log('🔌 websocketTerminalRef.current.sendChatMessage:', websocketTerminalRef.current?.sendChatMessage)
    
    if (!websocketTerminalRef.current) {
      console.warn('⚠️ websocketTerminalRef 为空')
      return
    }
    
    const success = websocketTerminalRef.current.sendChatMessage(selectedAgentId, text)
    console.log('📤 sendChatMessage 返回:', success)
    
    if (success) {
      // 添加用户消息到当前选中 agent 的聊天列表
      const userMsg = {
        id: generateMessageId('user-chat'),
        text,
        isUser: true,
        timestamp: Date.now()
      }
      setAgentChatMessages(prev => ({
        ...prev,
        [selectedAgentId]: [...(prev[selectedAgentId] || []), userMsg]
      }))
      setIsSleeping(false)
      setIsAIThinking(true)
      console.log('✅ 用户消息已添加，AI 思考状态已开启')
    } else {
      console.warn('⚠️ sendChatMessage 返回 false')
    }
  }, [selectedAgentId, generateMessageId])

  // 监听 WebSocket 聊天消息事件 - 按 agent 存储消息
  // 使用 ref 来避免闭包问题
  const selectedAgentIdRef = useRef(selectedAgentId)
  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId
  }, [selectedAgentId])
  
  // 消息去重：存储最近处理过的消息 ID，避免重复处理
  const processedMessageIds = useRef<Set<string>>(new Set())
  const MAX_STORED_IDS = 100
  
  useEffect(() => {
    const handleChatMessage = (event: CustomEvent) => {
      const { channelId, text, payload } = event.detail
      console.log('📨 收到聊天消息事件:', { channelId, text, payload })
      if (!text) {
        console.warn('⚠️ 聊天消息为空:', payload)
        return
      }
      
      // 生成消息的唯一标识（使用 payload 中的 runId 或内容 + 时间戳）
      const messageId = payload?.runId || payload?.id || `${channelId}:${text}:${payload?.timestamp || Date.now()}`
      
      // 检查是否已处理过此消息
      if (processedMessageIds.current.has(messageId)) {
        console.log('⚠️ 消息已处理，跳过:', messageId)
        return
      }
      
      // 添加到已处理集合
      processedMessageIds.current.add(messageId)
      
      // 限制存储的 ID 数量，避免内存泄漏
      if (processedMessageIds.current.size > MAX_STORED_IDS) {
        const iterator = processedMessageIds.current.values()
        const toDelete = []
        for (let i = 0; i < MAX_STORED_IDS / 2; i++) {
          const result = iterator.next()
          if (!result.done) toDelete.push(result.value)
        }
        toDelete.forEach(id => processedMessageIds.current.delete(id))
      }
      
      // 添加 AI 回复到当前选中 agent 的聊天列表
      // 使用稳定的 ID 生成，避免 Math.random() 导致 hydration 不匹配
      const aiMsg = {
        id: generateMessageId('ai-chat'),
        text,
        isUser: false,
        timestamp: Date.now(),
        model: 'qwen3.5-plus',
        upvotes: 0,
        downvotes: 0,
        ctxPercent: 100
      }
      setAgentChatMessages(prev => ({
        ...prev,
        [selectedAgentIdRef.current]: [...(prev[selectedAgentIdRef.current] || []), aiMsg]
      }))
      // 关闭 AI 思考状态
      setIsAIThinking(false)
      console.log('✅ AI 思考状态已关闭')
    }
    
    window.addEventListener('openclaw:chat:message', handleChatMessage as EventListener)
    console.log('🔔 已注册 openclaw:chat:message 事件监听器')
    return () => {
      window.removeEventListener('openclaw:chat:message', handleChatMessage as EventListener)
      console.log('🔕 已移除 openclaw:chat:message 事件监听器')
    }
  }, []) // 空依赖，只注册一次

  // 自动滚屏到最新消息
  // 获取当前选中 agent 的聊天记录
  const currentAgentMessages = agentChatMessages[selectedAgentId] || []

  // 自动滚屏到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentAgentMessages])

  // 预制命令列表（状态管理，支持删除和自定义）
  // 使用初始化函数从 localStorage 加载
  const [presetCommands, setPresetCommands] = useState<Array<{ label: string; text: string; isCommand?: boolean }>>(() => {
    // SSR 检查：只在浏览器环境中访问 localStorage
    if (typeof window === 'undefined') {
      return [
        { label: '问候', text: '你好' },
        { label: '介绍', text: '请介绍一下你自己' },
        { label: '天气', text: '今天天气怎么样？' },
        { label: '写诗', text: '帮我写一首诗' },
        { label: '笑话', text: '讲个笑话' },
        { label: '备份', text: '/backup 备份当前配置', isCommand: true },
        { label: '重启', text: '/gateway restart 重启 Gateway', isCommand: true },
        { label: '压缩', text: '/compact 压缩上下文', isCommand: true }
      ]
    }
    const savedCommands = localStorage.getItem('openclaw-preset-commands')
    if (savedCommands) {
      try {
        const parsed = JSON.parse(savedCommands)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      } catch (e) {
        console.error('Failed to parse saved preset commands:', e)
      }
    }
    return [
      { label: '问候', text: '你好' },
      { label: '介绍', text: '请介绍一下你自己' },
      { label: '天气', text: '今天天气怎么样？' },
      { label: '写诗', text: '帮我写一首诗' },
      { label: '笑话', text: '讲个笑话' },
      { label: '备份', text: '/backup 备份当前配置', isCommand: true },
      { label: '重启', text: '/gateway restart 重启 Gateway', isCommand: true },
      { label: '压缩', text: '/compact 压缩上下文', isCommand: true }
    ]
  })
  
  // 添加新命令的弹窗状态
  const [isAddCommandOpen, setIsAddCommandOpen] = useState(false)
  const [newCommandLabel, setNewCommandLabel] = useState('')
  const [newCommandText, setNewCommandText] = useState('')
  
  // 保存命令和聊天记录到统一配置
  useEffect(() => {
    saveConfig({
      presetCommands,
      agentChatMessages,
      selectedAgentId,
      chatAssistant: currentAssistant.id
    })
  }, [presetCommands, agentChatMessages, selectedAgentId, currentAssistant.id, saveConfig])
  
  // 删除命令
  const handleDeleteCommand = useCallback((index: number) => {
    setPresetCommands(prev => prev.filter((_, i) => i !== index))
  }, [])
  
  // 添加新命令
  const handleAddCommand = useCallback(() => {
    if (newCommandLabel.trim() && newCommandText.trim()) {
      setPresetCommands(prev => [...prev, {
        label: newCommandLabel.trim(),
        text: newCommandText.trim()
      }])
      setNewCommandLabel('')
      setNewCommandText('')
      setIsAddCommandOpen(false)
    }
  }, [newCommandLabel, newCommandText])

  // /命令自动补全
  const [commandInput, setCommandInput] = useState('')
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false)
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)

  interface CommandSuggestion {
    cmd: string
    label?: string
    desc: string
    full: string
  }

  const commandSuggestions: CommandSuggestion[] = [
    // 系统配置命令
    { cmd: '/setup', label: '系统初始化', desc: '初始化系统配置', full: '/setup 初始化系统配置' },
    { cmd: '/onboard', label: '新手引导', desc: '新用户引导流程', full: '/onboard 新用户引导流程' },
    { cmd: '/config get', label: '获取配置', desc: '获取配置值', full: '/config get <key> 获取配置值' },
    { cmd: '/config set', label: '设置配置', desc: '设置配置值', full: '/config set <key> <value> 设置配置值' },
    { cmd: '/config unset', label: '删除配置', desc: '删除配置项', full: '/config unset <key> 删除配置项' },
    { cmd: '/config file', label: '配置文件', desc: '打开配置文件', full: '/config file 打开配置文件' },
    { cmd: '/config validate', label: '验证配置', desc: '验证配置语法', full: '/config validate 验证配置' },
    { cmd: '/completion', label: 'Shell 补全', desc: '生成补全脚本', full: '/completion 生成 Shell 补全脚本' },
    { cmd: '/doctor', label: '健康检查', desc: '系统诊断', full: '/doctor 系统健康检查' },
    { cmd: '/dashboard', label: '管理面板', desc: '打开面板', full: '/dashboard 打开管理面板' },
    // 备份与安全
    { cmd: '/backup create', label: '创建备份', desc: '备份配置', full: '/backup create 创建配置备份' },
    { cmd: '/backup verify', label: '验证备份', desc: '检查备份', full: '/backup verify <file> 验证备份文件' },
    { cmd: '/security audit', label: '安全审计', desc: '安全检查', full: '/security audit 安全审计' },
    { cmd: '/secrets reload', label: '重载密钥', desc: '重新加载', full: '/secrets reload 重新加载密钥' },
    { cmd: '/secrets audit', label: '密钥审计', desc: '密钥检查', full: '/secrets audit 密钥审计' },
    { cmd: '/secrets apply', label: '应用密钥', desc: '应用配置', full: '/secrets apply 应用密钥配置' },
    // 系统管理
    { cmd: '/reset', label: '系统重置', desc: '重置系统', full: '/reset 重置系统' },
    { cmd: '/uninstall', label: '卸载系统', desc: '卸载', full: '/uninstall 卸载系统' },
    { cmd: '/update wizard', label: '更新向导', desc: '更新引导', full: '/update wizard 更新向导' },
    { cmd: '/update status', label: '更新状态', desc: '检查更新', full: '/update status 检查更新状态' },
    // 频道与节点
    { cmd: '/channels list', label: '频道列表', desc: '所有频道', full: '/channels list 列出所有频道' },
    { cmd: '/channels status', label: '频道状态', desc: '查看状态', full: '/channels status 查看频道状态' },
    { cmd: '/channels capabilities', label: '频道能力', desc: '支持能力', full: '/channels capabilities 查看频道能力' },
    { cmd: '/nodes list', label: '节点列表', desc: '所有节点', full: '/nodes list 列出所有节点' },
    { cmd: '/nodes status', label: '节点状态', desc: '查看状态', full: '/nodes status 查看节点状态' },
    // 插件系统
    { cmd: '/plugins list', label: '插件列表', desc: '已安装插件', full: '/plugins list 列出所有插件' },
    { cmd: '/plugins install', label: '安装插件', desc: '新插件', full: '/plugins install <name> 安装插件' },
    { cmd: '/plugins uninstall', label: '卸载插件', desc: '移除插件', full: '/plugins uninstall <name> 卸载插件' },
    { cmd: '/plugins enable', label: '启用插件', desc: '激活插件', full: '/plugins enable <name> 启用插件' },
    { cmd: '/plugins disable', label: '禁用插件', desc: '停用插件', full: '/plugins disable <name> 禁用插件' },
    // 系统状态
    { cmd: '/status', label: '系统状态', desc: '运行状态', full: '/status 查看系统状态' },
    { cmd: '/system info', label: '系统信息', desc: '详细信息', full: '/system info 查看系统信息' },
    { cmd: '/health', label: '健康检查', desc: '服务健康', full: '/health 健康检查' },
    // 界面与语音
    { cmd: '/tui', label: '终端界面', desc: 'TUI 模式', full: '/tui 启动终端界面' },
    { cmd: '/voicecall', label: '语音通话', desc: '语音模式', full: '/voicecall 语音通话' },
    // Webhooks
    { cmd: '/webhooks list', label: 'Webhook 列表', desc: '所有订阅', full: '/webhooks list 列出所有 Webhooks' },
    { cmd: '/webhooks create', label: '创建订阅', desc: '新增 Webhook', full: '/webhooks create 创建 Webhook' },
    { cmd: '/webhooks delete', label: '删除订阅', desc: '移除 Webhook', full: '/webhooks delete <id> 删除 Webhook' },
    // 消息与会话
    { cmd: '/message list', label: '消息列表', desc: '历史消息', full: '/message list 列出消息' },
    { cmd: '/message send', label: '发送消息', desc: '推送消息', full: '/message send <content> 发送消息' },
    { cmd: '/sessions list', label: '会话列表', desc: '所有会话', full: '/sessions list 列出所有会话' },
    { cmd: '/sessions active', label: '活动会话', desc: '当前会话', full: '/sessions active 查看活动会话' },
    // 任务与流程
    { cmd: '/tasks list', label: '任务列表', desc: '所有任务', full: '/tasks list 列出所有任务' },
    { cmd: '/tasks status', label: '任务状态', desc: '执行进度', full: '/tasks status 查看任务状态' },
    { cmd: '/flows list', label: '流程列表', desc: '所有流程', full: '/flows list 列出所有流程' },
    { cmd: '/flows run', label: '运行流程', desc: '执行流程', full: '/flows run <name> 运行流程' },
    // Gateway 管理
    { cmd: '/gateway restart', label: '重启网关', desc: '重新启动', full: '/gateway restart 重启 Gateway' },
    { cmd: '/gateway stop', label: '停止网关', desc: '停止服务', full: '/gateway stop 停止 Gateway' },
    { cmd: '/gateway start', label: '启动网关', desc: '启动服务', full: '/gateway start 启动 Gateway' },
    { cmd: '/gateway status', label: '网关状态', desc: '运行状态', full: '/gateway status 查看 Gateway 状态' },
    // Agent 管理
    { cmd: '/agent list', label: 'Agent 列表', desc: '所有智能体', full: '/agent list 列出所有 Agent' },
    { cmd: '/agent create', label: '创建 Agent', desc: '新建智能体', full: '/agent create 创建新 Agent' },
    { cmd: '/agent delete', label: '删除 Agent', desc: '移除智能体', full: '/agent delete <id> 删除 Agent' },
    { cmd: '/agents active', label: '活动 Agent', desc: '当前智能体', full: '/agents active 查看活动 Agent' },
    // ACP/MCP协议
    { cmd: '/acp list', desc: '列出 ACP 连接', full: '/acp list 列出 ACP 连接' },
    { cmd: '/acp connect', desc: '连接 ACP', full: '/acp connect <url> 连接 ACP' },
    { cmd: '/mcp list', desc: '列出 MCP 服务器', full: '/mcp list 列出 MCP 服务器' },
    { cmd: '/mcp add', desc: '添加 MCP 服务器', full: '/mcp add <name> <url> 添加 MCP 服务器' },
    { cmd: '/mcp remove', desc: '移除 MCP 服务器', full: '/mcp remove <name> 移除 MCP 服务器' },
    // 审批管理
    { cmd: '/approvals list', label: '审批列表', desc: '所有审批', full: '/approvals list 列出所有审批' },
    { cmd: '/approvals pending', label: '待办审批', desc: '等待处理', full: '/approvals pending 查看待处理审批' },
    { cmd: '/approvals approve', label: '批准', desc: '通过审批', full: '/approvals approve <id> 批准' },
    { cmd: '/approvals reject', label: '拒绝', desc: '驳回审批', full: '/approvals reject <id> 拒绝' },
    // 记忆管理
    { cmd: '/memory clear', label: '清空记忆', desc: '清除记忆', full: '/memory clear 清空记忆' },
    { cmd: '/memory list', label: '记忆列表', desc: '所有记忆', full: '/memory list 列出所有记忆' },
    { cmd: '/memory search', label: '搜索记忆', desc: '查找记忆', full: '/memory search <query> 搜索记忆' },
    // 会话管理
    { cmd: '/session reset', label: '重置会话', desc: '清空会话', full: '/session reset 重置会话' },
    { cmd: '/session export', label: '导出会话', desc: '保存会话', full: '/session export <file> 导出会话' },
    { cmd: '/session import', label: '导入会话', desc: '加载会话', full: '/session import <file> 导入会话' },
    // 模型管理
    { cmd: '/model list', label: '模型列表', desc: '可用模型', full: '/model list 列出可用模型' },
    { cmd: '/model set', label: '设置模型', desc: '切换模型', full: '/model set <name> 设置当前模型' },
    { cmd: '/model info', label: '模型信息', desc: '模型详情', full: '/model info <name> 查看模型信息' },
    // 帮助
    { cmd: '/help', label: '帮助信息', desc: '使用指南', full: '/help 显示帮助信息' },
    { cmd: '/compact', label: '压缩上下文', desc: '精简对话', full: '/compact 压缩上下文' },
    { cmd: '/backup', label: '快速备份', desc: '一键备份', full: '/backup 备份当前配置' }
  ]

  const handleCommandInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCommandInput(value)
    if (value.startsWith('/')) {
      setShowCommandSuggestions(true)
      setSelectedCommandIndex(0)
    } else {
      setShowCommandSuggestions(false)
    }
  }

  // 过滤命令建议 - 根据用户输入匹配
  const filteredCommandSuggestions = commandInput.startsWith('/')
    ? commandSuggestions.filter(cmd => {
        const input = commandInput.slice(1).toLowerCase()
        return cmd.cmd.toLowerCase().includes(input) ||
               (cmd.label && cmd.label.toLowerCase().includes(input)) ||
               cmd.desc.toLowerCase().includes(input)
      })
    : []

  const handleCommandSelect = (fullCommand: string) => {
    // 直接发送命令，而不是只填充输入框
    // 使用 cmd 而不是 full，避免带注释
    const commandToUse = filteredCommandSuggestions[selectedCommandIndex]
    if (commandToUse) {
      handleSendChatMessage(commandToUse.cmd)
      setCommandInput('')
      setShowCommandSuggestions(false)
      chatInputRef.current?.focus()
    }
  }

  const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showCommandSuggestions && filteredCommandSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedCommandIndex(prev => (prev + 1) % filteredCommandSuggestions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedCommandIndex(prev => (prev - 1 + filteredCommandSuggestions.length) % filteredCommandSuggestions.length)
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommandSuggestions[selectedCommandIndex]) {
          handleCommandSelect(filteredCommandSuggestions[selectedCommandIndex].full)
        }
      } else if (e.key === 'Escape') {
        setShowCommandSuggestions(false)
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (commandInput.trim()) {
        handleSendChatMessage(commandInput.trim())
        setCommandInput('')
      }
    }
  }
  
  // 监听频道加载事件
  useEffect(() => {
    const handleChannelsLoaded = (event: CustomEvent) => {
      const { channels: loadedChannels } = event.detail
      setChatChannels(loadedChannels)
    }
    
    window.addEventListener('openclaw:channels:loaded', handleChannelsLoaded as EventListener)
    return () => {
      window.removeEventListener('openclaw:channels:loaded', handleChannelsLoaded as EventListener)
    }
  }, [])
  
  // 同步频道选择到 WebSocket 终端
  useEffect(() => {
    if (websocketTerminalRef.current && websocketTerminalRef.current.setSelectedChannel) {
      websocketTerminalRef.current.setSelectedChannel(selectedChatChannel)
    }
  }, [selectedChatChannel])
  
  // 切换语音模式
  const handleToggleVoiceMode = useCallback(() => {
    setIsVoiceMode(prev => !prev)
    if (!isVoiceMode) {
      setIsAnimating(true)
      setTimeout(() => setIsAnimating(false), 1000)
    }
  }, [isVoiceMode])
  
  // 保存设置
  const handleSaveSettings = useCallback((title: string, logo: string, count: number, team: string, unitName: string, style: string, newEffects: string[], newMainProcessName: string) => {
    setCustomTitle(title)
    setCustomLogo(logo)
    setLobsterCount(count)
    setTeamName(team)
    setUnit(unitName)
    setAvatarStyle(style)
    setEffects(newEffects)
    setMainProcessName(newMainProcessName)
    saveConfig({
      customTitle: title,
      customLogo: logo,
      lobsterCount: count,
      teamName: team,
      unit: unitName,
      avatarStyle: style,
      effects: newEffects,
      mainProcessName: newMainProcessName
    })
  }, [saveConfig])
  
// 格式化 star 数量
const formatStars = (stars: number): string => {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`
  }
  return stars.toString()
}

// 格式化时间戳为 HH:MM 格式
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

  // 权限审批处理
  const handlePermissionAccept = useCallback(() => {
    setShowPermissionModal(false)
  }, [])

  const handlePermissionDecline = useCallback(() => {
    alert('您已拒绝许可协议。继续使用即表示您同意本软件的使用条款。')
    setShowPermissionModal(false)
    saveConfig({ permissionAgreed: true })
  }, [saveConfig])

  // 防止 hydration 错误：只在客户端挂载后渲染完整内容
  if (!mounted) {
    return (
      <main className="animated-bg min-h-screen text-white overflow-hidden relative flex items-center justify-center">
        <div className="text-cyan-400 text-lg">Loading...</div>
      </main>
    )
  }

  return (
    <main className="animated-bg min-h-screen text-white overflow-hidden relative">
      {/* 特效层 - 根据设置条件渲染 */}
      {effects.includes('scanline') && <ScanlineEffect />}
      {effects.includes('matrix') && <MatrixRainEffect />}
      {effects.includes('particles') && <FloatingParticlesEffect />}
      {effects.includes('glitch') && <GlitchEffect />}
      
      {/* 粒子背景 */}
      <ParticleBackground />
      
      {/* 网格背景 */}
      <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />
      
      {/* 主容器 */}
      <div className="relative z-10 flex h-screen overflow-hidden">
        {/* 左侧设备监控 - 响应式宽度 */}
        <div className="hidden lg:block border-r flex-shrink-0 w-80" style={{
          background: 'rgba(8, 8, 12, 0.6)',
          borderColor: 'rgba(255, 255, 255, 0.06)'
        }}>
          <DeviceMonitor />
        </div>
        <div className="lg:hidden border-r flex-shrink-0 w-16" style={{
          background: 'rgba(8, 8, 12, 0.6)',
          borderColor: 'rgba(255, 255, 255, 0.06)'
        }}>
          <div className="flex items-center justify-center h-full">
            <svg className="w-8 h-8 text-cyan-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        
        {/* 中间区域 - 背景内容 */}
        <div className="flex-1 flex flex-col relative">
          {/* 顶部导航 */}
          <header className="flex items-center justify-between px-6 py-4">
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="w-[120px] h-[120px] flex items-center justify-center cursor-pointer relative overflow-hidden"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {customLogo.startsWith('data:') ? (
                  <img
                    src={customLogo}
                    alt="Custom Logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Image
                    src={customLogo}
                    alt="OpenClaw Logo"
                    width={120}
                    height={120}
                    className="w-full h-full object-contain"
                  />
                )}
              </motion.div>
              <h1
                className={`text-5xl font-extrabold text-gradient ${effects.includes('glitch') ? 'glitch' : ''}`}
                data-text={customTitle}
              >
                {customTitle}
              </h1>
            </motion.div>
            
            <motion.div
              className="flex flex-col items-end gap-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* 顶部图标行 */}
              <div className="flex items-center gap-3">
                {/* 文档链接 */}
                <motion.a
                  href="https://docs.openclaw.ai/zh-CN"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-white/10 hover:border-cyan-500/50 hover:bg-white/5 transition-all cursor-pointer group"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="文档"
                >
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </motion.a>
                
                {/* 设置按钮 */}
                <motion.button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 rounded-lg border border-white/10 hover:border-cyan-500/50 hover:bg-white/5 transition-all cursor-pointer group"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="设置"
                >
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </motion.button>
                
                {/* GitHub 链接 */}
                <motion.a
                  href="https://github.com/leonardozhe/YSK-OpenClaw-Dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-cyan-500/50 hover:bg-white/5 transition-all cursor-pointer group"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="GitHub"
                >
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  {githubStars !== null && (
                    <span className="text-xs text-gray-400 group-hover:text-white transition-colors flex items-center gap-0.5">
                      <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {formatStars(githubStars)}
                    </span>
                  )}
                </motion.a>
              </div>
              
              {/* Channel 状态行 */}
              <div className="flex items-center gap-6">
                {/* 动态显示激活的 Channel */}
                {channels.map((channel, index) => (
                  <div key={channel.id} className="flex items-center gap-1.5">
                    <span className="text-sm text-gray-400">{channel.nameZh === 'Telegram' ? 'TG' : channel.nameZh}</span>
                    <motion.div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: channel.enabled && channel.configured ? '#00FF66' : '#FF4040',
                        boxShadow: `0 0 6px ${channel.enabled && channel.configured ? '#00FF66' : '#FF4040'}`
                      }}
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.5 }}
                    />
                    <span className={`text-xs ${channel.enabled && channel.configured ? 'text-green-400' : 'text-red-400'}`}>
                      {channel.enabled && channel.configured ? '已连接' : '未配置'}
                    </span>
                  </div>
                ))}
                
                {/* 如果没有配置任何 channel，显示提示 */}
                {channels.length === 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-gray-400">暂无激活渠道</span>
                  </div>
                )}
              </div>
            </motion.div>
          </header>
          
          {/* 系统状态卡片 */}
          <SystemStatusCards />

          {/* OpenClaw 聊天框 - 最大化占据剩余空间 */}
          <div className="flex-1 px-4 pb-3 min-h-0">
            <div className="rounded-xl overflow-hidden border h-full flex flex-col" style={{
              background: 'rgba(15, 15, 25, 0.95)',
              borderColor: 'rgba(0, 240, 255, 0.2)',
              boxShadow: '0 0 30px rgba(0, 240, 255, 0.1)'
            }}>
              {/* 聊天头部 - 频道选择器和模型信息 */}
              <div className="px-4 py-2.5 border-b flex items-center justify-between flex-shrink-0" style={{
                borderColor: 'rgba(0, 240, 255, 0.15)',
                background: 'rgba(0, 240, 255, 0.03)'
              }}>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(0, 240, 255, 0.1)' }}>
                    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-xs font-bold text-white">OpenClaw 聊天</span>
                  </div>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white/5 border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                  >
                    {availableAgents.length > 0 ? (
                      availableAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.alias || agent.name} {agent.slug ? `(${agent.slug})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value="main">主进程</option>
                    )}
                  </select>
                </div>
                {/* 状态指示器 */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22C55E', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span>在线</span>
                  </div>
                </div>
              </div>
              
              {/* 聊天消息列表 - 占据剩余空间 */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0, 240, 255, 0.3) rgba(0, 0, 0, 0.2)'
              }}>
                {currentAgentMessages.length === 0 && !isAIThinking ? (
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 240, 255, 0.1)', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                        <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <p className="text-base font-medium text-white">暂无消息</p>
                      <p className="text-xs mt-2 text-gray-500">选择 Agent 后，输入消息或点击预制命令开始对话</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {currentAgentMessages.map((msg, index) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] px-4 py-2.5 rounded-xl border backdrop-blur-sm relative group ${
                            msg.isUser
                              ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 border-cyan-400/40 text-white'
                              : 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-400/40 text-green-50'
                          }`}
                          style={{
                            boxShadow: msg.isUser
                              ? '0 0 25px rgba(6, 182, 212, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                              : '0 0 20px rgba(34, 197, 94, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                          }}
                        >
                          {/* 复制按钮 - 仅在 AI 消息显示 */}
                          {!msg.isUser && (
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(msg.text)
                                  // 显示复制成功提示
                                  const toast = document.createElement('div')
                                  toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-500/90 text-white rounded-lg text-sm font-medium z-50 animate-pulse'
                                  toast.textContent = '✓ 已复制到剪贴板'
                                  document.body.appendChild(toast)
                                  setTimeout(() => toast.remove(), 2000)
                                } catch (err) {
                                  console.error('复制失败:', err)
                                }
                              }}
                              className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white/10"
                              title="复制内容"
                            >
                              <svg className="w-3.5 h-3.5 text-gray-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              msg.isUser
                                ? 'bg-gradient-to-r from-cyan-400 to-blue-400'
                                : 'bg-gradient-to-r from-green-400 to-emerald-400'
                            }`}>
                              {msg.isUser ? (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                </svg>
                              ) : (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                </svg>
                              )}
                            </div>
                            <span className={`text-xs font-medium ${msg.isUser ? 'text-cyan-300' : 'text-green-300'}`}>
                              {msg.isUser ? '你' : 'AI'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(msg.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          {!msg.isUser && msg.model && (
                            <div className="mt-2 text-xs text-gray-500">
                              <span className="font-medium text-gray-400">Assistant</span>
                              <span className="mx-1.5 text-gray-600">·</span>
                              <span className="text-gray-400">{msg.model}</span>
                              <span className="mx-1.5 text-gray-600">·</span>
                              <span className="text-green-400">↑{msg.upvotes}</span>
                              <span className="mx-1.5 text-gray-600">·</span>
                              <span className="text-red-400">↓{msg.downvotes}</span>
                              <span className="mx-1.5 text-gray-600">·</span>
                              <span className="text-gray-400">{msg.ctxPercent}% ctx</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {/* AI 思考动画 */}
                    {isAIThinking && (
                      <motion.div
                        className="flex items-center"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
                          <div className="flex gap-1">
                            <motion.span
                              className="w-1.5 h-1.5 rounded-full bg-green-400"
                              animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: 0 }}
                            />
                            <motion.span
                              className="w-1.5 h-1.5 rounded-full bg-green-400"
                              animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: 0.15 }}
                            />
                            <motion.span
                              className="w-1.5 h-1.5 rounded-full bg-green-400"
                              animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: 0.3 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </>
                )}
                {/* 自动滚屏锚点 */}
                <div ref={messagesEndRef} />
              </div>
              
              {/* 预制命令按钮栏 */}
              <div className="px-4 py-2 border-t flex-shrink-0" style={{
                borderColor: 'rgba(0, 240, 255, 0.1)',
                background: 'rgba(0, 240, 255, 0.02)'
              }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 mr-2">快捷命令:</span>
                  {presetCommands.map((cmd, index) => (
                    <div key={`${cmd.label}-${cmd.text}`} className="flex items-center gap-1 group">
                      <motion.button
                        onClick={() => handleSendChatMessage(cmd.text)}
                        className="px-2.5 py-1 rounded text-xs font-medium transition-all hover:scale-105"
                        style={{
                          background: 'rgba(0, 240, 255, 0.15)',
                          color: '#00F0FF',
                          border: '1px solid rgba(0, 240, 255, 0.3)'
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {cmd.label}
                      </motion.button>
                      <button
                        onClick={() => handleDeleteCommand(index)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all"
                        title="删除此命令"
                      >
                        <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {/* 添加新命令按钮 */}
                  <motion.button
                    onClick={() => setIsAddCommandOpen(true)}
                    className="px-2.5 py-1 rounded text-xs font-medium transition-all hover:scale-105 flex items-center gap-1"
                    style={{
                      background: 'rgba(156, 163, 175, 0.15)',
                      color: '#9CA3AF',
                      border: '1px solid rgba(156, 163, 175, 0.3)'
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    添加
                  </motion.button>
                </div>
              </div>
              
              {/* 聊天输入框 */}
              <div className="px-4 py-3 border-t flex-shrink-0 relative" style={{
                borderColor: 'rgba(0, 240, 255, 0.15)',
                background: 'rgba(0, 240, 255, 0.02)'
              }}>
                {/* /命令自动补全提示 */}
                {showCommandSuggestions && (
                  <div className="absolute bottom-full left-4 right-20 mb-2 rounded-lg border overflow-hidden shadow-lg z-10" style={{
                    background: 'rgba(15, 15, 25, 0.98)',
                    borderColor: 'rgba(0, 240, 255, 0.3)',
                    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    {filteredCommandSuggestions.length > 0 ? (
                      filteredCommandSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.cmd}
                          onClick={() => handleCommandSelect(suggestion.full)}
                          className={`w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors ${
                            index === selectedCommandIndex
                              ? 'bg-cyan-500/20'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-cyan-400 min-w-[140px]">{suggestion.cmd}</span>
                            {suggestion.label && (
                              <span className="text-xs font-medium text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded">{suggestion.label}</span>
                            )}
                            <span className="text-xs text-gray-500">- {suggestion.desc}</span>
                          </div>
                          {index === selectedCommandIndex && (
                            <span className="text-xs text-cyan-400">↹ 选择</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        未找到匹配的命令
                      </div>
                    )}
                  </div>
                )}
                
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (commandInput.trim()) {
                      handleSendChatMessage(commandInput.trim())
                      setCommandInput('')
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={commandInput}
                    onChange={handleCommandInputChange}
                    onKeyDown={handleCommandKeyDown}
                    placeholder="输入消息或 / 命令，按回车发送..."
                    disabled={isAIThinking}
                    className="flex-1 bg-white/5 border border-cyan-500/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
                  />
                  <motion.button
                    type="submit"
                    disabled={isAIThinking}
                    className="relative px-6 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.1) 0%, rgba(0, 255, 102, 0.1) 100%)',
                      border: '1px solid rgba(0, 240, 255, 0.3)',
                      boxShadow: '0 0 20px rgba(0, 240, 255, 0.2), inset 0 0 20px rgba(0, 240, 255, 0.05)',
                      color: '#00F0FF',
                      textShadow: '0 0 10px rgba(0, 240, 255, 0.5)'
                    }}
                    whileHover={{
                      scale: isAIThinking ? 1 : 1.05,
                      boxShadow: '0 0 30px rgba(0, 240, 255, 0.4), inset 0 0 30px rgba(0, 240, 255, 0.1)',
                      borderColor: 'rgba(0, 240, 255, 0.6)'
                    }}
                    whileTap={{ scale: isAIThinking ? 1 : 0.95 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>发送</span>
                    </div>
                  </motion.button>
                </form>
                
                {/* 版本号显示在输入框最下面一行 */}
              </div>
            </div>
          </div>
          
          {/* 底部版权信息栏 - 放在中间区域底部 */}
          <div className="py-2 px-4 border-t flex-shrink-0" style={{
            background: 'rgba(8, 8, 12, 0.6)',
            borderColor: 'rgba(255, 255, 255, 0.06)'
          }}>
            <div className="flex items-center justify-center gap-3">
              {/* 版本状态提示 */}
              {updateInfo?.hasUpdate ? (
                <motion.button
                  onClick={() => setShowUpdateModal(true)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
                  style={{
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#f59e0b'
                  }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  whileHover={{ scale: 1.1 }}
                >
                  发现新版本 V{updateInfo.latestVersion}，点击升级
                </motion.button>
              ) : updateInfo?.latestVersion && !updateInfo.hasUpdate ? (
                <div className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981'
                }}>
                  ✓ 当前已是最新版 V{updateInfo.latestVersion}
                </div>
              ) : null}
              
              <div className="text-xs text-gray-500">
                Powered by <a href="https://clawbang.cn" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">ClawBang.cn</a> © 2026 All Rights Reserved V2.3
              </div>
            </div>
          </div>
          
          {/* 悬浮聊天框 - 点击头像时显示 */}
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 w-[800px] rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(15, 15, 25, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: `0 0 60px rgba(0, 240, 255, 0.15), 0 0 100px rgba(255, 0, 255, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)`
                }}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                {/* 聊天头部 */}
                <div className="px-5 py-3 border-b flex items-center gap-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                    style={{
                      border: `2px solid ${currentAssistant.color}`,
                      boxShadow: `0 0 20px ${currentAssistant.color}30`
                    }}
                  >
                    <img
                      src={currentAssistant.avatar || `https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${currentAssistant.id}`}
                      alt={currentAssistant.name}
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold truncate" style={{ color: currentAssistant.color }}>
                      {currentAssistant.name}
                    </h2>
                    <p className="text-xs text-gray-500 truncate">{currentAssistant.title}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* AI 思考动画 */}
                    {isAIThinking && (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: 'rgba(0, 240, 255, 0.1)' }}>
                        <motion.div
                          className="w-2 h-2 rounded-full bg-cyan-400"
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      </div>
                    )}
                    {/* 关闭按钮 */}
                    <motion.button
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      onClick={() => setIsChatOpen(false)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </motion.button>
                  </div>
                </div>
                
                {/* 消息区域 - 扁平化 */}
                <div className="h-[280px] overflow-y-auto px-5 py-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="mb-3">
                        <LottieLobster
                          color={currentAssistant.color}
                          size={100}
                          isSleeping={isSleeping}
                          isListening={isVoiceMode}
                        />
                      </div>
                      <p className="text-sm font-semibold mb-1" style={{ color: currentAssistant.color }}>
                        {isSleeping ? '💤 休眠中...' : `GM! 我是 ${currentAssistant.name}`}
                      </p>
                      <p className="text-xs text-gray-500 mb-2 max-w-xs">
                        {currentAssistant.bio}
                      </p>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {currentAssistant.skills.slice(0, 3).map((skill, i) => (
                          <span
                            key={`${skill}-${i}`}
                            className="px-2 py-0.5 text-xs rounded-full"
                            style={{
                              background: `${currentAssistant.color}15`,
                              border: `1px solid ${currentAssistant.color}25`,
                              color: currentAssistant.color
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <MessageList
                        messages={messages}
                        assistantName={currentAssistant.name}
                        assistantColor={currentAssistant.color}
                        avatarStyle={avatarStyle}
                      />
                      {/* AI 思考动画 */}
                      {isAIThinking && (
                        <motion.div
                          className="flex items-center gap-2 mt-3 ml-10"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="flex gap-1.5">
                            <motion.span
                              className="w-2 h-2 rounded-full bg-cyan-400"
                              animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                            />
                            <motion.span
                              className="w-2 h-2 rounded-full bg-cyan-400"
                              animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                            />
                            <motion.span
                              className="w-2 h-2 rounded-full bg-cyan-400"
                              animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </>
                  )}
                </div>
                
                {/* 底部输入区 */}
                <div className="px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    isVoiceMode={isVoiceMode}
                    onToggleVoiceMode={handleToggleVoiceMode}
                    isDisabled={isAIThinking}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
        </div>
        
        {/* 右侧联系人面板 */}
        <ContactsPanel
          activeContactId={currentAssistant.id}
          onSelectContact={handleSelectContact}
          onStatusChange={handleStatusChange}
          teamName={teamName}
          unit={unit}
          avatarStyle={avatarStyle}
          mainProcessName={mainProcessName}
        />
      </div>
      
      {/* 右下角弹窗通知 */}
      <ToastNotifications />
      
      {/* 设置弹窗 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTitle={customTitle}
        currentLogo={customLogo}
        currentLobsterCount={lobsterCount}
        currentTeamName={teamName}
        currentUnit={unit}
        currentAvatarStyle={avatarStyle}
        currentEffects={effects}
        currentMainProcessName={mainProcessName}
        onSave={handleSaveSettings}
        onExport={() => {
          const currentConfig = {
            customTitle,
            customLogo,
            lobsterCount,
            teamName,
            unit,
            avatarStyle,
            effects,
            mainProcessName,
            selectedAgentId,
            chatAssistant: currentAssistant.id,
            presetCommands,
            agentChatMessages,
            permissionAgreed: !showPermissionModal,
            version: '2.3',
            lastSavedAt: new Date().toISOString()
          } as any
          exportConfigFn()
        }}
        onImport={(content: string) => importConfig(content)}
        onReset={resetConfig}
      />
      
      {/* Agent 个人信息弹窗 */}
      <AgentProfileModal
        isOpen={isAgentProfileOpen}
        onClose={() => setIsAgentProfileOpen(false)}
        agentId={selectedProfileAgentId}
        agentName={selectedProfileAgentName}
        avatarUrl={selectedProfileAgentAvatar}
      />
      
      {/* 添加快捷命令弹窗 */}
      <AnimatePresence>
        {isAddCommandOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddCommandOpen(false)} />
            <motion.div
              className="relative w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(15, 15, 25, 0.98)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                boxShadow: '0 0 60px rgba(0, 240, 255, 0.2)'
              }}
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* 头部 */}
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(0, 240, 255, 0.2)' }}>
                <h3 className="text-base font-medium text-white">添加快捷命令</h3>
                <button
                  onClick={() => setIsAddCommandOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* 内容 */}
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">命令名称</label>
                  <input
                    type="text"
                    value={newCommandLabel}
                    onChange={(e) => setNewCommandLabel(e.target.value)}
                    placeholder="例如：问候"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">命令内容</label>
                  <textarea
                    value={newCommandText}
                    onChange={(e) => setNewCommandText(e.target.value)}
                    placeholder="例如：你好"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                  />
                </div>
              </div>
              
              {/* 底部按钮 */}
              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: 'rgba(0, 240, 255, 0.2)' }}>
                <button
                  onClick={() => setIsAddCommandOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddCommand}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 transition-colors"
                >
                  添加
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* SmartTerminal - 隐藏渲染，仅提供 ref 给聊天功能使用 */}
      <div className="hidden">
        <SmartTerminal ref={websocketTerminalRef} />
      </div>
      
      {/* Terminal 弹窗 */}
      <AnimatePresence>
        {isTerminalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsTerminalOpen(false)} />
            <motion.div
              className="relative w-full max-w-5xl h-[80vh] rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(15, 15, 25, 0.98)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                boxShadow: '0 0 60px rgba(0, 240, 255, 0.2)'
              }}
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Terminal 头部 */}
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(0, 240, 255, 0.2)', background: 'rgba(0, 240, 255, 0.05)' }}>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-white">OpenClaw Terminal</span>
                </div>
                <button
                  onClick={() => setIsTerminalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Terminal 内容 */}
              <div className="h-[calc(100%-52px)]">
                <SmartTerminal className="h-full" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 权限审批弹窗 - 仅在首次安装时显示 */}
      {showPermissionModal && (
        <PermissionModal
          onAccept={handlePermissionAccept}
          onDecline={handlePermissionDecline}
        />
      )}
      
      {/* 新版本提示弹窗 */}
      <AnimatePresence>
        {showUpdateModal && updateInfo?.hasUpdate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowUpdateModal(false)} />
            <motion.div
              className="relative w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(15, 15, 25, 0.98)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                boxShadow: '0 0 60px rgba(16, 185, 129, 0.2)'
              }}
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* 头部 */}
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.2)' }}>
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-18.356-2M4.582 9A8.003 8.003 0 0119.418 15M9 19V9m6 10V9" />
                    </svg>
                  </div>
                  <h3 className="text-base font-medium text-white">发现新版本 V{updateInfo.latestVersion}</h3>
                </div>
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* 内容 */}
              <div className="px-5 py-4">
                <p className="text-sm text-gray-400 mb-3">
                  MeetClaw 已发布新版本，建议升级到最新版以获取最新功能和修复。
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUpdateModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    稍后提醒
                  </button>
                  <a
                    href={updateInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-center bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                  >
                    查看更新
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
