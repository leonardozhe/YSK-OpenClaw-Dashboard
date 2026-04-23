'use client'

import { useState, useEffect, useCallback } from 'react'

// 配置文件接口
export interface AppConfig {
  // 基础配置
  customTitle: string
  customLogo: string
  lobsterCount: number
  teamName: string
  unit: string
  avatarStyle: string
  effects: string[]
  mainProcessName: string
  
  // 聊天配置
  selectedAgentId: string
  chatAssistant: string
  
  // 预置命令
  presetCommands: Array<{ label: string; text: string; isCommand?: boolean }>
  
  // 聊天记录
  agentChatMessages: Record<string, Array<{
    id: string
    text: string
    isUser: boolean
    timestamp: number
    model?: string
    upvotes?: number
    downvotes?: number
    ctxPercent?: number
  }>>
  
  // 权限许可
  permissionAgreed: boolean
  
  // 元数据
  lastSavedAt?: string
  version: string
}

const CONFIG_VERSION = '2.3'
const CONFIG_FILE_KEY = 'meetclaw-config-v2'

// 默认配置
const defaultConfig: Omit<AppConfig, 'version'> = {
  customTitle: 'YSK小龙虾工作监控系统',
  customLogo: '/openclaw.png',
  lobsterCount: 5,
  teamName: '海洋战队',
  unit: '只虾',
  avatarStyle: 'bottts',
  effects: ['scanline'],
  mainProcessName: '龙虾船长',
  selectedAgentId: 'main',
  chatAssistant: 'claude',
  presetCommands: [
    { label: '问候', text: '你好' },
    { label: '介绍', text: '请介绍一下你自己' },
    { label: '天气', text: '今天天气怎么样？' },
    { label: '写诗', text: '帮我写一首诗' },
    { label: '笑话', text: '讲个笑话' },
    { label: '备份', text: '/backup 备份当前配置', isCommand: true },
    { label: '重启', text: '/gateway restart 重启 Gateway', isCommand: true },
    { label: '压缩', text: '/compact 压缩上下文', isCommand: true }
  ],
  agentChatMessages: {},
  permissionAgreed: false
}

// 从 localStorage 加载旧配置（兼容性）
function loadLegacyConfig(): Partial<AppConfig> {
  if (typeof window === 'undefined') return {}
  
  const config: Partial<AppConfig> = {}
  
  try {
    const title = localStorage.getItem('openclaw-custom-title')
    if (title) config.customTitle = title
    
    const logo = localStorage.getItem('openclaw-custom-logo')
    if (logo) config.customLogo = logo
    
    const lobsterCount = localStorage.getItem('openclaw-lobster-count')
    if (lobsterCount) config.lobsterCount = parseInt(lobsterCount)
    
    const teamName = localStorage.getItem('openclaw-team-name')
    if (teamName) config.teamName = teamName
    
    const unit = localStorage.getItem('openclaw-unit')
    if (unit) config.unit = unit
    
    const avatarStyle = localStorage.getItem('openclaw-avatar-style')
    if (avatarStyle) config.avatarStyle = avatarStyle
    
    const effects = localStorage.getItem('openclaw-effects')
    if (effects) config.effects = JSON.parse(effects)
    
    const mainProcessName = localStorage.getItem('openclaw-main-process-name')
    if (mainProcessName) config.mainProcessName = mainProcessName
    
    const selectedAgentId = localStorage.getItem('openclaw-selected-agent-id')
    if (selectedAgentId) config.selectedAgentId = selectedAgentId
    
    const chatAssistant = localStorage.getItem('openclaw-chat-assistant')
    if (chatAssistant) config.chatAssistant = chatAssistant
    
    const presetCommands = localStorage.getItem('openclaw-preset-commands')
    if (presetCommands) config.presetCommands = JSON.parse(presetCommands)
    
    const agentChatMessages = localStorage.getItem('openclaw-agent-chat-messages')
    if (agentChatMessages) config.agentChatMessages = JSON.parse(agentChatMessages)
    
    const permissionAgreed = localStorage.getItem('ysk-permission-agreed')
    if (permissionAgreed !== null) config.permissionAgreed = permissionAgreed === 'true'
  } catch (e) {
    console.error('Failed to load legacy config:', e)
  }
  
  return config
}

// 解析配置文件内容
export function parseConfig(content: string): AppConfig | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed.version && typeof parsed === 'object') {
      return parsed as AppConfig
    }
    return null
  } catch {
    return null
  }
}

// 导出配置文件
export function exportConfig(config: AppConfig): string {
  return JSON.stringify(config, null, 2)
}

// 下载配置文件
export function downloadConfig(config: AppConfig) {
  const content = exportConfig(config)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `meetclaw-config-v${config.version || CONFIG_VERSION}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 使用配置持久化 Hook
export function usePersistentConfig() {
  const [config, setConfig] = useState<AppConfig>({
    ...defaultConfig,
    version: CONFIG_VERSION
  })
  const [isLoading, setIsLoading] = useState(true)
  
  // 初始化加载配置
  useEffect(() => {
    const loadConfig = () => {
      try {
        // 1. 尝试从新配置格式加载
        const stored = localStorage.getItem(CONFIG_FILE_KEY)
        if (stored) {
          const parsed = parseConfig(stored)
          if (parsed) {
            setConfig(parsed)
            setIsLoading(false)
            return
          }
        }
        
        // 2. 从旧配置格式迁移
        const legacy = loadLegacyConfig()
        if (Object.keys(legacy).length > 0) {
          const migrated = {
            ...defaultConfig,
            ...legacy,
            version: CONFIG_VERSION,
            lastSavedAt: new Date().toISOString()
          }
          setConfig(migrated)
          // 保存为新格式
          localStorage.setItem(CONFIG_FILE_KEY, exportConfig(migrated))
        }
      } catch (e) {
        console.error('Failed to load config:', e)
      }
      setIsLoading(false)
    }
    
    loadConfig()
  }, [])
  
  // 保存配置
  const saveConfig = useCallback((updates: Partial<AppConfig>) => {
    setConfig(prev => {
      const updated = {
        ...prev,
        ...updates,
        lastSavedAt: new Date().toISOString()
      }
      localStorage.setItem(CONFIG_FILE_KEY, exportConfig(updated))
      return updated
    })
  }, [])
  
  // 导入配置文件
  const importConfig = useCallback((content: string): boolean => {
    const parsed = parseConfig(content)
    if (!parsed) return false
    
    setConfig(parsed)
    localStorage.setItem(CONFIG_FILE_KEY, exportConfig(parsed))
    return true
  }, [])
  
  // 重置为默认配置
  const resetConfig = useCallback(() => {
    const defaults = { ...defaultConfig, version: CONFIG_VERSION }
    setConfig(defaults)
    localStorage.setItem(CONFIG_FILE_KEY, exportConfig(defaults))
  }, [])
  
  return {
    config,
    isLoading,
    saveConfig,
    importConfig,
    downloadConfig: () => downloadConfig(config),
    resetConfig
  }
}
