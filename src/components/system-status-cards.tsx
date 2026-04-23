'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Users, Database, Brain, Activity, Cpu, Network } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'

interface StatusCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  status: 'success' | 'warning' | 'error' | 'info'
  index: number
  isUpdating: boolean
}

function StatusCard({ icon, label, value, status, index, isUpdating }: StatusCardProps) {
  const statusColors = {
    success: { bg: 'rgba(0, 255, 102, 0.1)', border: 'rgba(0, 255, 102, 0.3)', color: '#00FF66' },
    warning: { bg: 'rgba(255, 170, 0, 0.1)', border: 'rgba(255, 170, 0, 0.3)', color: '#FFAA00' },
    error: { bg: 'rgba(255, 64, 64, 0.1)', border: 'rgba(255, 64, 64, 0.3)', color: '#FF4040' },
    info: { bg: 'rgba(0, 240, 255, 0.1)', border: 'rgba(0, 240, 255, 0.3)', color: '#00F0FF' },
  }
  
  const colors = statusColors[status]
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="relative px-4 py-2.5 rounded-xl flex items-center gap-3 overflow-hidden"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* 流水灯边框效果 */}
      <AnimatePresence>
        {isUpdating && (
          <>
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* 顶部流水灯 */}
              <motion.div
                className="absolute top-0 left-0 h-0.5 w-full"
                style={{ background: `linear-gradient(90deg, transparent, ${colors.color}, transparent)` }}
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 0.8, ease: 'linear', repeat: 2 }}
              />
              {/* 右侧流水灯 */}
              <motion.div
                className="absolute top-0 right-0 w-0.5 h-full"
                style={{ background: `linear-gradient(180deg, transparent, ${colors.color}, transparent)` }}
                initial={{ y: '-100%' }}
                animate={{ y: '100%' }}
                transition={{ duration: 0.8, ease: 'linear', repeat: 2, delay: 0.2 }}
              />
              {/* 底部流水灯 */}
              <motion.div
                className="absolute bottom-0 left-0 h-0.5 w-full"
                style={{ background: `linear-gradient(90deg, transparent, ${colors.color}, transparent)` }}
                initial={{ x: '100%' }}
                animate={{ x: '-100%' }}
                transition={{ duration: 0.8, ease: 'linear', repeat: 2, delay: 0.4 }}
              />
              {/* 左侧流水灯 */}
              <motion.div
                className="absolute top-0 left-0 w-0.5 h-full"
                style={{ background: `linear-gradient(180deg, transparent, ${colors.color}, transparent)` }}
                initial={{ y: '100%' }}
                animate={{ y: '-100%' }}
                transition={{ duration: 0.8, ease: 'linear', repeat: 2, delay: 0.6 }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      <div 
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 relative z-10"
        style={{ background: `${colors.color}20`, color: colors.color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
        <div className="text-lg font-bold truncate" style={{ color: colors.color }}>{value}</div>
      </div>
    </motion.div>
  )
}

// 格式化 Token 数量（使用 K/M 后缀）
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}

export function SystemStatusCards() {
  const [mounted, setMounted] = useState(false)
  const [agentCount, setAgentCount] = useState(0) // 活跃 agent 数量
  const [systemLoad, setSystemLoad] = useState<number | null>(null) // 系统负载百分比
  const [ollamaRunningCount, setOllamaRunningCount] = useState<number | null>(null) // Ollama 运行中的模型数量
  const [vectorMemoryStatus, setVectorMemoryStatus] = useState<{
    enabled: boolean
    pluginInstalled: boolean
    pluginEnabled: boolean
    embeddingModel: string | null
    ollamaRunning: boolean
    ollamaEmbeddingModels: string[]
    issues: string[]
  } | null>(null) // 向量记忆详细状态
  const [tokenConsumption, setTokenConsumption] = useState<number | null>(null) // Token 消耗总量
  const [updatingCards, setUpdatingCards] = useState<Set<number>>(new Set())
  
  // 用于跟踪之前的值，以便在值变化时触发动画
  const prevAgentCountRef = useRef<number | null>(null)
  const prevSystemLoadRef = useRef<number | null>(null)
  const prevTokenRef = useRef<number | null>(null)
  
  // 客户端挂载后才执行动态更新
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // 获取活跃 agent 数量
  useEffect(() => {
    const fetchAgentCount = async () => {
      try {
        const response = await fetch('/api/agents')
        if (!response.ok) {
          return // 静默失败，不显示错误
        }
        const data = await response.json()
        if (data.activeAgents !== undefined) {
          const newCount = data.activeAgents
          // 检查值是否变化，变化则触发动画
          if (prevAgentCountRef.current !== null && prevAgentCountRef.current !== newCount) {
            setUpdatingCards(prev => new Set(prev).add(0)) // card index 0 是活跃的龙虾
            setTimeout(() => {
              setUpdatingCards(prev => {
                const newSet = new Set(prev)
                newSet.delete(0)
                return newSet
              })
            }, 1600)
          }
          prevAgentCountRef.current = newCount
          setAgentCount(newCount)
        }
      } catch (error) {
        console.error('Failed to fetch agent count:', error)
      }
    }
    fetchAgentCount()
    const interval = setInterval(fetchAgentCount, 30000) // 每30秒更新
    return () => clearInterval(interval)
  }, [])
  
  // 获取系统负载（CPU 和内存计算）
  useEffect(() => {
    const fetchSystemLoad = async () => {
      try {
        const response = await fetch('/api/system-info')
        if (!response.ok) {
          return // 静默失败，不显示错误
        }
        const data = await response.json()
        if (data.device?.cpu?.usage !== undefined && data.device?.memory?.usage !== undefined) {
          // 系统负载 = (CPU使用率 + 内存使用率) / 2
          const load = (data.device.cpu.usage + data.device.memory.usage) / 2
          // 检查值是否变化，变化则触发动画（允许小数点后一位的微小变化）
          if (prevSystemLoadRef.current !== null) {
            const prevLoad = prevSystemLoadRef.current
            const loadDiff = Math.abs(load - prevLoad)
            if (loadDiff > 0.5) { // 负载变化超过 0.5% 才触发动画
              setUpdatingCards(prev => new Set(prev).add(5)) // card index 5 是系统负载
              setTimeout(() => {
                setUpdatingCards(prev => {
                  const newSet = new Set(prev)
                  newSet.delete(5)
                  return newSet
                })
              }, 1600)
            }
          }
          prevSystemLoadRef.current = load
          setSystemLoad(load)
        }
      } catch (error) {
        console.error('Failed to fetch system load:', error)
      }
    }
    
    fetchSystemLoad()
    const interval = setInterval(fetchSystemLoad, 15000) // 每15秒更新 (从5秒改为15秒，减少负载)
    return () => clearInterval(interval)
  }, [])
  
  // 随机更新卡片值和流水灯效果（只有值真正变化才闪亮）
  // 获取 Ollama 运行中的模型数量
  useEffect(() => {
    const fetchOllamaStatus = async () => {
      try {
        const response = await fetch('/api/ollama-status')
        if (!response.ok) {
          return // 静默失败，不显示错误
        }
        const data = await response.json()
        // 显示已下载的模型数量，如果没有则显示正在运行的模型数量
        const newCount = data.downloadedCount ?? data.runningCount ?? 0
        setOllamaRunningCount(newCount)
      } catch (error) {
        console.error('Failed to fetch Ollama status:', error)
        setOllamaRunningCount(0)
      }
    }
    
    fetchOllamaStatus()
    const interval = setInterval(fetchOllamaStatus, 30000) // 每30秒更新
    return () => clearInterval(interval)
  }, [])
  
  // 获取向量记忆详细状态
  useEffect(() => {
    const fetchVectorMemoryStatus = async () => {
      try {
        const response = await fetch('/api/vector-memory-status')
        if (!response.ok) {
          return // 静默失败，不显示错误
        }
        const data = await response.json()
        setVectorMemoryStatus({
          enabled: data.enabled,
          pluginInstalled: data.pluginInstalled,
          pluginEnabled: data.pluginEnabled,
          embeddingModel: data.embeddingModel,
          ollamaRunning: data.ollamaRunning,
          ollamaEmbeddingModels: data.ollamaEmbeddingModels || [],
          issues: data.issues || []
        })
      } catch (error) {
        console.error('Failed to fetch vector memory status:', error)
        setVectorMemoryStatus(null)
      }
    }
    
    fetchVectorMemoryStatus()
    const interval = setInterval(fetchVectorMemoryStatus, 60000) // 每60秒更新
    return () => clearInterval(interval)
  }, [])
  
  // 获取 Token 消耗
  useEffect(() => {
    const fetchTokenConsumption = async () => {
      try {
        const response = await fetch('/api/openclaw-status')
        if (!response.ok) {
          setTokenConsumption(0) // 静默失败，设置为 0
          return
        }
        const data = await response.json()
        const newTokens = data.sessions?.contextTokens ?? 0
        
        // 检查值是否变化，变化则触发动画
        if (prevTokenRef.current !== null && prevTokenRef.current !== newTokens) {
          setUpdatingCards(prev => new Set(prev).add(1)) // index 1 是 Token 消耗
          setTimeout(() => {
            setUpdatingCards(prev => {
              const newSet = new Set(prev)
              newSet.delete(1)
              return newSet
            })
          }, 1600)
        }
        prevTokenRef.current = newTokens
        setTokenConsumption(newTokens)
      } catch (error) {
        console.error('Failed to fetch token consumption:', error)
        // 即使失败也设置为 0，避免一直显示 "加载中..."
        setTokenConsumption(0)
      }
    }
    
    fetchTokenConsumption()
    const interval = setInterval(fetchTokenConsumption, 60000) // 每60秒更新 (从10秒改为60秒，token数据变化不频繁)
    return () => clearInterval(interval)
  }, [])
  
  // Agent 数量变化回调（从日志接收）- 保留接口但不再使用随机波动
  const handleAgentCountChange = useCallback((newCount: number) => {
    setAgentCount(newCount)
    setUpdatingCards(prevSet => new Set(prevSet).add(0)) // index 0 是活跃龙虾
    setTimeout(() => {
      setUpdatingCards(prevSet => {
        const newSet = new Set(prevSet)
        newSet.delete(0)
        return newSet
      })
    }, 1600)
  }, [])
  
  // 注册回调到 activity-log（保留兼容性）
  useEffect(() => {
    import('./activity-log').then(module => {
      if (module.setShrimpCountChangeCallback) {
        // 兼容旧的回调接口
        module.setShrimpCountChangeCallback((change: number) => {
          // 不再使用，agent 数量从 API 获取
        })
      }
    })
  }, [])
  
  // 获取系统负载状态
  const getLoadStatus = (load: number | null): 'success' | 'warning' | 'error' => {
    if (load === null) return 'warning'
    if (load < 50) return 'success'
    if (load < 80) return 'warning'
    return 'error'
  }
  
  const cards: StatusCardProps[] = [
    {
      icon: <Users className="w-4 h-4" />,
      label: '活跃的龙虾',
      value: agentCount,
      status: agentCount >= 2 ? 'success' : agentCount >= 1 ? 'warning' : 'error',
      index: 0,
      isUpdating: updatingCards.has(0),
    },
    {
      icon: <Database className="w-4 h-4" />,
      label: 'Token 消耗',
      value: tokenConsumption !== null ? formatTokens(tokenConsumption) : '加载中...',
      status: tokenConsumption !== null && tokenConsumption > 0 ? 'success' : 'warning',
      index: 1,
      isUpdating: updatingCards.has(1),
    },
    {
      icon: <Brain className="w-4 h-4" />,
      label: 'Ollama 模型',
      value: ollamaRunningCount !== null ? `${ollamaRunningCount} 模型` : '检测中...',
      status: ollamaRunningCount !== null && ollamaRunningCount > 0 ? 'success' : 'warning',
      index: 2,
      isUpdating: updatingCards.has(2),
    },
    {
      icon: <Network className="w-4 h-4" />,
      label: '向量记忆',
      value: vectorMemoryStatus === null ? '检测中...' :
             vectorMemoryStatus.enabled ? '已激活' :
             vectorMemoryStatus.pluginInstalled ? '插件已安装' : '未安装',
      status: vectorMemoryStatus?.enabled ? 'success' :
              vectorMemoryStatus?.pluginInstalled ? 'info' : 'warning',
      index: 3,
      isUpdating: updatingCards.has(3),
    },
    {
      icon: <Cpu className="w-4 h-4" />,
      label: '系统负载',
      value: systemLoad !== null ? `${systemLoad.toFixed(1)}%` : '加载中...',
      status: getLoadStatus(systemLoad),
      index: 4,
      isUpdating: updatingCards.has(4),
    },
  ]
  
  return (
    <div className="grid grid-cols-6 gap-3 px-4 py-3">
      {cards.map((card) => (
        <StatusCard key={card.label} {...card} />
      ))}
    </div>
  )
}