'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Contact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Clock, FileText, AlertCircle, Info, AlertTriangle, Bug, RefreshCw } from 'lucide-react'

// Agent 数据类型（从 API 获取）
export interface AgentData {
  id: string
  name: string
  alias?: string  // Agent 的别名（显示用）
  slug?: string   // Agent 的 slug 名字（显示在别名下方）
  bio?: string    // Agent 的简介
  status: 'online' | 'busy' | 'away' | 'offline'
  lastActive: number
  channel: string
  origin: string
  provider: string
  chatType: 'temporary' | 'permanent'  // 临时或永久会话
}

// 将 AgentData 转换为 Contact 格式
function agentToContact(agent: AgentData, index: number, avatarStyle: string = 'bottts', mainProcessName: string = '龙虾船长'): Contact {
  // 根据渠道和来源生成友好的标题
  const channelNames: Record<string, string> = {
    'webchat': 'Web 聊天',
    'discord': 'Discord',
    'slack': 'Slack',
    'telegram': 'Telegram',
    'terminal': '终端',
    'api': 'API',
    'unknown': '未知渠道',
    '未知渠道': '未知渠道'  // 已经是中文，直接返回
  }
  
  const originNames: Record<string, string> = {
    'openclaw-tui': 'OpenClaw TUI',
    'openclaw-web': 'OpenClaw Web',
    'openclaw-cli': 'OpenClaw CLI',
    'openclaw': 'OpenClaw',
    'unknown': '未知来源',
    '未知来源': '未知来源'  // 已经是中文，直接返回
  }
  
  const channel = channelNames[agent.channel] || agent.channel
  const origin = originNames[agent.origin] || agent.origin
  
  // 显示名称：使用 alias（如果有），否则使用 agent.name
  // 对于 main agent，使用用户自定义的名称
  const baseName = agent.name === 'main'
    ? mainProcessName
    : (agent.alias || agent.name)
  
  // 副标题：显示 slug（如果有），否则显示来源和渠道
  const subTitle = agent.slug 
    ? `${agent.slug} · ${channel}`
    : `${origin} · ${channel}`
  
  // Bio: 使用 agent 的 bio（如果有），否则显示最后活跃时间
  const bioText = agent.bio 
    ? agent.bio 
    : `最后活跃：${formatLastActive(agent.lastActive)}`
  
  return {
    id: agent.id,
    name: baseName,
    title: subTitle,
    bio: bioText,
    skills: [],
    status: agent.status,
    color: getStatusColor(agent.status),
    avatar: `https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${agent.name}`
  }
}

// 格式化最后活跃时间
function formatLastActive(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

// 获取状态颜色
function getStatusColor(status: Contact['status']): string {
  switch (status) {
    case 'online': return '#4ADE80'
    case 'busy': return '#F87171'
    case 'away': return '#FACC15'
    case 'offline': return '#6B7280'
    default: return '#6B7280'
  }
}

// 状态图标组件 - 带动画
function StatusIcon({ status }: { status: Contact['status'] }) {
  switch (status) {
    case 'online':
      // 工作中 - 齿轮旋转动画
      return (
        <motion.div
          className="w-5 h-5 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4ADE80"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </motion.svg>
        </motion.div>
      )
    case 'busy':
      // 忙碌中 - 闪电脉冲动画
      return (
        <motion.div
          className="w-5 h-5 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="#F87171"
            stroke="#F87171"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </motion.svg>
        </motion.div>
      )
    case 'away':
      // 休息中 - 月亮呼吸动画
      return (
        <motion.div
          className="w-5 h-5 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="#FACC15"
            stroke="#FACC15"
            strokeWidth="1"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </motion.svg>
        </motion.div>
      )
    case 'offline':
      // 离线 - 等待/沙漏动画
      return (
        <motion.div
          className="w-5 h-5 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: [0, 180, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
          </motion.svg>
        </motion.div>
      )
    default:
      return null
  }
}

// 状态文字
function getStatusText(status: Contact['status']): string {
  switch (status) {
    case 'online': return '工作中'
    case 'busy': return '忙碌中'
    case 'away': return '休息中'
    case 'offline': return '等待'
    default: return ''
  }
}

interface ContactCardProps {
  contact: Contact
  isActive: boolean
  onClick: () => void
  index: number
}

export function ContactCard({ contact, isActive, onClick, index }: ContactCardProps) {
  const statusClass = {
    'online': 'status-online',
    'busy': 'status-busy',
    'away': 'status-away',
    'offline': 'status-offline'
  }[contact.status]

  return (
    <motion.div
      className={cn(
        'contact-card rounded-lg p-3 cursor-pointer',
        isActive && 'active'
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: 'easeOut'
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {/* 头像 */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-darker ring-1 ring-white/10">
            <img
              src={contact.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${contact.name}`}
              alt={contact.name}
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* 状态指示器 */}
          <div
            className={cn('status-indicator', statusClass)}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              border: '2px solid #0a0a10'
            }}
          />
        </div>
        
        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-white/90 text-sm truncate">{contact.name}</h3>
            {/* 状态图标 */}
            <div className="flex items-center gap-1.5">
              <StatusIcon status={contact.status} />
              {isActive && (
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: contact.color }}
                />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-white/40 truncate">
              {contact.title}
            </p>
            <span className="text-[10px] text-white/30 flex-shrink-0">
              {getStatusText(contact.status)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// 状态类型
type ContactStatus = Contact['status']

// 随机生成新状态
function getRandomStatus(currentStatus: ContactStatus): ContactStatus {
  const statuses: ContactStatus[] = ['online', 'busy', 'away', 'offline']
  // 权重：online 40%, busy 30%, away 20%, offline 10%
  const weights = [0.4, 0.3, 0.2, 0.1]
  
  // 随机决定是否保持当前状态（30%概率）
  if (Math.random() < 0.3) {
    return currentStatus
  }
  
  // 否则随机选择新状态
  let random = Math.random()
  for (let i = 0; i < statuses.length; i++) {
    random -= weights[i]
    if (random <= 0) {
      return statuses[i]
    }
  }
  return 'online'
}

// Cron 任务接口
interface CronJob {
  id: string
  name: string
  schedule: string
  scheduleHuman: string
  enabled: boolean
  lastRun: string | null
  nextRun: string | null
  command: string
}

// 日志条目接口
interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  source?: string
  raw?: string
}

// 联系人列表面板 - 从 API 获取实际 agent 数据
interface ContactsPanelProps {
  activeContactId: string
  onSelectContact: (contact: Contact) => void
  onStatusChange?: (contactId: string, newStatus: Contact['status']) => void
  teamName?: string
  unit?: string
  avatarStyle?: string
  mainProcessName?: string
}

// Cron 任务卡片
function CronJobCard({ job }: { job: CronJob }) {
  return (
    <motion.div
      className="p-2 rounded-lg border"
      style={{
        background: job.enabled ? 'rgba(0, 240, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
        borderColor: job.enabled ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'
      }}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${job.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
          {job.enabled ? '启用' : '禁用'}
        </span>
        <span className="text-xs font-medium text-white/80 truncate">{job.name}</span>
      </div>
    </motion.div>
  )
}

// 日志详情弹窗组件
function LogDetailModal({ entry, isOpen, onClose }: { entry: LogEntry | null; isOpen: boolean; onClose: () => void }) {
  if (!entry) return null
  
  const levelColors = {
    error: 'text-red-400 bg-red-500/20 border-red-500/30',
    warn: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
    info: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    debug: 'text-gray-400 bg-gray-500/20 border-gray-500/30'
  }
  
  const LevelIcon = {
    error: AlertCircle,
    warn: AlertTriangle,
    info: Info,
    debug: Bug
  }[entry.level]
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 背景遮罩 */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* 弹窗内容 */}
          <motion.div
            className="relative w-full max-w-lg rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(10, 10, 15, 0.98) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* 头部 */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${levelColors[entry.level]}`}>
                  <LevelIcon className="w-4 h-4" />
                  {entry.level.toUpperCase()}
                </span>
                <span className="text-white/50 text-xs">{entry.source || 'System'}</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 内容 */}
            <div className="p-4 space-y-3">
              {/* 时间戳 */}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider">时间戳</label>
                <p className="text-sm text-white/80 mt-1">{entry.timestamp}</p>
              </div>
              
              {/* 消息内容 */}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider">消息内容</label>
                <div
                  className="mt-1 p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 font-mono break-all max-h-60 overflow-y-auto"
                  style={{ wordBreak: 'break-word' }}
                >
                  {entry.message}
                </div>
              </div>
              
              {/* 原始日志 */}
              {entry.raw && (
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">原始日志</label>
                  <div
                    className="mt-1 p-3 rounded-lg bg-black/30 border border-white/5 text-xs text-white/50 font-mono break-all max-h-40 overflow-y-auto"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {entry.raw}
                  </div>
                </div>
              )}
            </div>
            
            {/* 底部操作 */}
            <div className="p-4 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(entry.message)
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
              >
                复制消息
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-xs text-cyan-400 transition-colors"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// 日志条目组件
function LogEntryItem({ entry, onClick }: { entry: LogEntry; onClick: () => void }) {
  const levelColors = {
    error: 'text-red-400 bg-red-500/10',
    warn: 'text-yellow-400 bg-yellow-500/10',
    info: 'text-blue-400 bg-blue-500/10',
    debug: 'text-gray-400 bg-gray-500/10'
  }
  
  const LevelIcon = {
    error: AlertCircle,
    warn: AlertTriangle,
    info: Info,
    debug: Bug
  }[entry.level]
  
  return (
    <div
      className="flex items-start gap-2 py-1.5 px-2 rounded text-[11px] hover:bg-white/5 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <span className="text-white/30 flex-shrink-0 w-16 truncate">{entry.timestamp.split('T')[1]?.slice(0, 8) || ''}</span>
      <span className={`flex-shrink-0 px-1 rounded ${levelColors[entry.level]}`}>
        <LevelIcon className="w-3 h-3 inline mr-0.5" />
        {entry.level.toUpperCase()}
      </span>
      <span className="text-white/60 flex-1 truncate">{entry.message}</span>
    </div>
  )
}

export function ContactsPanel({
  activeContactId,
  onSelectContact,
  onStatusChange,
  teamName = '海洋战队',
  unit = '只虾',
  avatarStyle = 'bottts',
  mainProcessName = '龙虾船长'
}: ContactsPanelProps) {
  const [agents, setAgents] = useState<AgentData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Cron 和 Logs 状态
  const [activeTab, setActiveTab] = useState<'cron' | 'logs'>('cron')
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoadingCron, setIsLoadingCron] = useState(false)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  
  // 日志详情弹窗状态
  const [selectedLogEntry, setSelectedLogEntry] = useState<LogEntry | null>(null)
  const [isLogDetailOpen, setIsLogDetailOpen] = useState(false)
  
  // 从 API 获取 agent 数据
  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/agents')
      const data = await response.json()
      if (data.agents) {
        setAgents(data.agents)
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])
  
  // 获取 cron 任务
  const fetchCronJobs = useCallback(async () => {
    setIsLoadingCron(true)
    try {
      const response = await fetch('/api/cron')
      const data = await response.json()
      setCronJobs(data.jobs || [])
    } catch (error) {
      console.error('Failed to fetch cron jobs:', error)
    } finally {
      setIsLoadingCron(false)
    }
  }, [])
  
  // 获取日志
  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true)
    try {
      const response = await fetch('/api/logs?limit=50')
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setIsLoadingLogs(false)
    }
  }, [])
  
  // 初始化加载
  useEffect(() => {
    fetchAgents()
    // 每 30 秒刷新一次
    const interval = setInterval(fetchAgents, 30000)
    return () => clearInterval(interval)
  }, [fetchAgents])
  
  // 当切换到 cron 或 logs tab 时加载数据
  useEffect(() => {
    if (activeTab === 'cron') {
      fetchCronJobs()
    } else {
      fetchLogs()
    }
  }, [activeTab, fetchCronJobs, fetchLogs])
  
  // 将 agent 数据转换为 Contact 格式
  const contacts = useMemo(() => {
    return agents.map((agent, index) => agentToContact(agent, index, avatarStyle, mainProcessName))
  }, [agents, avatarStyle, mainProcessName])
  
  const onlineCount = contacts.filter(c => c.status === 'online').length
  const totalCount = contacts.length
  
  return (
    <>
    <aside className="hidden lg:block w-72 border-l flex-col" style={{
      background: 'rgba(8, 8, 12, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.06)'
    }}>
      {/* 上部 60% - 联系人列表 */}
      <div className="h-[60%] flex flex-col">
        {/* 面板标题 - 显示在线/总数 */}
        <div className="p-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/80 tracking-wide flex items-center gap-2">
              <span className="text-lg">🦞</span>
              {teamName}
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-green-400 font-medium">{onlineCount}</span>
              </span>
              <span className="text-white/30">/</span>
              <span className="text-white/50">{totalCount} {unit}</span>
            </div>
          </div>
        </div>
        
        {/* 联系人列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {contacts.map((contact, index) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              isActive={activeContactId === contact.id}
              onClick={() => onSelectContact(contact)}
              index={index}
            />
          ))}
        </div>
      </div>
      
      {/* 下部 40% - Cron/Logs Tab */}
      <div className="h-[40%] flex flex-col border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
        {/* Tab 切换 */}
        <div className="flex items-center border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'cron'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5'
                : 'text-white/50 hover:text-white/70'
            }`}
            onClick={() => setActiveTab('cron')}
          >
            <Clock className="w-3.5 h-3.5" />
            循环任务
          </button>
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'logs'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5'
                : 'text-white/50 hover:text-white/70'
            }`}
            onClick={() => setActiveTab('logs')}
          >
            <FileText className="w-3.5 h-3.5" />
            系统日志
          </button>
        </div>
        
        {/* Tab 内容 */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'cron' ? (
            <div className="h-full overflow-y-auto p-2 space-y-1.5">
              {isLoadingCron ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                </div>
              ) : cronJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/30">
                  <Clock className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-xs">暂无定时任务</span>
                </div>
              ) : (
                cronJobs.map((job) => (
                  <CronJobCard key={job.id} job={job} />
                ))
              )}
            </div>
          ) : (
            <div ref={logsContainerRef} className="h-full overflow-y-auto p-1">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/30">
                  <FileText className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-xs">暂无日志</span>
                </div>
              ) : (
                logs.slice(0, 50).map((entry, i) => (
                  <LogEntryItem
                    key={i}
                    entry={entry}
                    onClick={() => {
                      setSelectedLogEntry(entry)
                      setIsLogDetailOpen(true)
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 日志详情弹窗 */}
      <LogDetailModal
        entry={selectedLogEntry}
        isOpen={isLogDetailOpen}
        onClose={() => setIsLogDetailOpen(false)}
      />
    </aside>
    <aside className="lg:hidden border-l flex flex-col items-center justify-center p-4" style={{
      background: 'rgba(8, 8, 12, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.06)'
    }}>
      <svg className="w-8 h-8 text-cyan-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M10 20a3 3 0 01-5.356-1.857M10 20v-2c0-.656.126-1.283.356-1.857m0 0a3 3 0 015.356 0M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </aside>
    </>
  )
}