'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, RefreshCw, X, Copy, Check, Shield, Activity, Wifi, AlertTriangle, Network } from 'lucide-react'

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
  }
  service: {
    status: string
    pid: number | null
    label: string
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
  }[]
  networks: {
    tailscale: { running: boolean; ip: string | null; status: string | null }
    zerotier: { running: boolean; ip: string | null; networkCount: number }
  }
  skills: {
    installed: number
    activated: number
  }
  sessions: {
    active: number
    contextTokens: number
  }
  dashboard: string
  health: 'healthy' | 'warning' | 'error' | 'unknown'
  rpc: {
    ok: boolean
    url: string
  }
}

export function OpenClawStatusCard() {
  const [status, setStatus] = useState<OpenClawStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDeviceApprovalTip, setShowDeviceApprovalTip] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/openclaw-status')
      if (!response.ok) {
        // API 返回错误状态（如 500），仍然解析 JSON
        const data = await response.json()
        setStatus(data)
        return
      }
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Failed to fetch OpenClaw status:', error)
      // 设置错误状态，让 UI 显示友好提示
      setStatus({
        version: 'unknown',
        latestVersion: null,
        gateway: { mode: 'unknown', address: '', bindMode: '', port: 18789 },
        service: { status: 'unknown', pid: null, label: 'unknown' },
        securityAudit: { critical: 0, warn: 0, info: 0, details: [] },
        channels: [],
        networks: {
          tailscale: { running: false, ip: null, status: null },
          zerotier: { running: false, ip: null, networkCount: 0 }
        },
        skills: { installed: 0, activated: 0 },
        sessions: { active: 0, contextTokens: 0 },
        dashboard: '',
        health: 'unknown',
        rpc: { ok: false, url: '' }
      })
    } finally {
      setLoading(false)
    }
  }, [])
  
  // 单独检查设备审批状态
  const checkDeviceApproval = useCallback(async () => {
    try {
      const deviceResponse = await fetch('/api/gateway-device')
      const deviceData = await deviceResponse.json()
      if (deviceData.device) {
        // 如果设备未批准或没有设备，显示提醒
        setShowDeviceApprovalTip(!deviceData.device.approved || !deviceData.device.deviceId)
      } else {
        setShowDeviceApprovalTip(true)
      }
    } catch (deviceError) {
      console.warn('Failed to fetch gateway device:', deviceError)
      // 如果获取设备信息失败，也显示提醒
      setShowDeviceApprovalTip(true)
    }
  }, [])

  // 单独获取并更新token数据
  const fetchTokenData = useCallback(async () => {
    try {
      const response = await fetch('/api/openclaw-status')
      if (!response.ok) return
      const data = await response.json()
      if (data.sessions?.contextTokens !== undefined && status) {
        setStatus(prev => prev ? {
          ...prev,
          sessions: {
            ...prev.sessions,
            contextTokens: data.sessions.contextTokens,
            totalTokens: data.sessions.totalTokens,
            sessionTokens: data.sessions.sessionTokens,
            last30DaysTokens: data.sessions.last30DaysTokens
          }
        } : null)
      }
    } catch (error) {
      console.error('Failed to fetch token data:', error)
    }
  }, [status])

  // 单独获取版本和安全审计信息
  const fetchVersionAndSecurity = useCallback(async () => {
    try {
      const response = await fetch('/api/openclaw-status')
      if (!response.ok) return
      const data = await response.json()
      if (status && (data.version || data.securityAudit)) {
        setStatus(prev => prev ? {
          ...prev,
          version: data.version || prev.version,
          latestVersion: data.latestVersion || prev.latestVersion,
          securityAudit: data.securityAudit || prev.securityAudit
        } : null)
      }
    } catch (error) {
      console.error('Failed to fetch version and security data:', error)
    }
  }, [status])

  useEffect(() => {
    fetchStatus()
    // 每 10 分钟刷新一次版本和安全审计信息（静态数据）
    const versionRefreshInterval = setInterval(fetchVersionAndSecurity, 600000) // 10 分钟 = 600,000 毫秒
    // 每 60 秒刷新一次token数据（从30秒改为60秒，减少频繁调用）
    const tokenRefreshInterval = setInterval(fetchTokenData, 60000) // 60 秒 = 60 * 1000 毫秒

    return () => {
      clearInterval(versionRefreshInterval)
      clearInterval(tokenRefreshInterval)
    }
  }, [fetchStatus, fetchTokenData, fetchVersionAndSecurity])

  const handleOpenDashboard = () => {
    if (status?.dashboard) {
      window.open(status.dashboard, '_blank')
    }
  }

  const getHealthColor = () => {
    if (!status) return '#6B7280'
    switch (status.health) {
      case 'healthy':
        return '#10B981'
      case 'warning':
        return '#F59E0B'
      case 'error':
        return '#EF4444'
      default:
        // 默认情况：根据 RPC 状态判断
        return status.rpc?.ok ? '#10B981' : '#6B7280'
    }
  }

  const getHealthText = () => {
    if (!status) return '未知'
    switch (status.health) {
      case 'healthy':
        return '健康运行中'
      case 'warning':
        return '警告'
      case 'error':
        return '异常'
      default:
        // 默认情况：根据 RPC 和其他指标综合判断
        if (status.rpc?.ok) return '运行中'
        if (status.service?.status === 'running') return '运行中'
        return '未知'
    }
  }

  // 计算版本发布至今的天数
  const getDaysSinceVersion = (version: string) => {
    const match = version.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/)
    if (match) {
      const year = parseInt(match[1])
      const month = parseInt(match[2]) - 1
      const day = parseInt(match[3])
      const versionDate = new Date(year, month, day)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - versionDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays
    }
    return 0
  }

  // 格式化数字：百万用 M，千用 K
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toLocaleString()
  }

  // 获取安全等级的中文显示
  const getSecurityLevelText = (level: string) => {
    switch (level) {
      case 'critical':
        return '严重'
      case 'warn':
        return '警告'
      case 'info':
        return '信息'
      default:
        return level
    }
  }

  // 获取安全等级的颜色
  const getSecurityLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return '#EF4444'
      case 'warn':
        return '#F59E0B'
      case 'info':
        return '#3B82F6'
      default:
        return '#6B7280'
    }
  }

  // 生成安全审计报告文本
  const generateSecurityReport = () => {
    if (!status?.securityAudit?.details) return ''
    
    let report = '🦞 OpenClaw 安全审计报告\n\n'
    report += `摘要: ${status.securityAudit.critical} 严重 · ${status.securityAudit.warn} 警告 · ${status.securityAudit.info} 信息\n\n`
    
    status.securityAudit.details.forEach((item, index) => {
      const levelText = getSecurityLevelText(item.level)
      report += `【${levelText}】${item.title}\n`
      report += `描述: ${item.description}\n`
      if (item.fix) {
        report += `修复建议: ${item.fix}\n`
      }
      report += '\n'
    })
    
    return report
  }

  // 复制安全审计报告
  const handleCopyReport = async () => {
    const report = generateSecurityReport()
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const hasSecurityIssues = status?.securityAudit && 
    (status.securityAudit.critical > 0 || status.securityAudit.warn > 0 || status.securityAudit.info > 0)

  if (loading) {
    return (
      <motion.div
        className="relative p-3 rounded-xl overflow-hidden"
        style={{
          background: 'rgba(15, 15, 25, 0.9)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-center py-4">
          {/* 炫酷的加载动画 */}
          <div className="relative flex items-center justify-center">
            <motion.div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: '#00F0FF' }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="w-4 h-4 rounded-full absolute"
              style={{ backgroundColor: '#FF00FF' }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
                rotate: 120
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.2
              }}
            />
            <motion.div
              className="w-4 h-4 rounded-full absolute"
              style={{ backgroundColor: '#00FF66' }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
                rotate: 240
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.4
              }}
            />
          </div>
          <span className="ml-3 text-white/60 text-xs">正在获取状态...</span>
        </div>
      </motion.div>
    )
  }

  return (
    <>
      {/* 设备审批提醒 */}
      {showDeviceApprovalTip && (
        <motion.div
          className="mb-3 p-3 rounded-xl border"
          style={{
            background: 'rgba(255, 170, 0, 0.1)',
            border: '1px solid rgba(255, 170, 0, 0.3)'
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-medium text-amber-400 mb-1">设备审批提醒</h4>
              <p className="text-[10px] text-white/70 mb-2">
                新安装的客户需要到 OpenClaw 后台进行设备审批才能正常使用。
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeviceApprovalTip(false)}
                  className="text-[9px] px-2 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                >
                  我知道了
                </button>
                {status?.dashboard && (
                  <a
                    href={status.dashboard}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    打开后台
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
      
      <motion.div
        className="relative p-3 rounded-xl overflow-hidden"
        style={{
          background: 'rgba(15, 15, 25, 0.9)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* 头部 - 服务状态 */}
        <div className="relative flex items-center gap-2.5 mb-2">
          {/* 状态信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: getHealthColor(), boxShadow: `0 0 8px ${getHealthColor()}` }}
              />
              <span className="text-xs font-medium text-white/90">{getHealthText()}</span>
            </div>
          </div>
          
          {/* 右侧信息：RPC + 网络状态 */}
          <div className="text-right">
            {/* RPC 状态 */}
            {status?.rpc?.ok !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                background: status.rpc.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: status.rpc.ok ? '#10B981' : '#EF4444'
              }}>
                RPC {status.rpc.ok ? '正常' : '异常'}
              </span>
            )}
          </div>
        </div>

        {/* Tailscale */}
        <div className="mb-2 p-1.5 rounded-lg" style={{ background: 'rgba(6, 182, 212, 0.05)' }}>
          <div className="flex justify-between items-center text-[9px]">
            <div className="flex items-center gap-1">
              <Network className="w-2.5 h-2.5" style={{ color: status?.networks?.tailscale?.running ? '#00F0FF' : '#6B7280' }} />
              <span className="text-white/40">Tailscale</span>
            </div>
            {status?.networks?.tailscale?.running ? (
              <div className="flex items-center gap-2">
                <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10B981'
                }}>
                  已激活
                </span>
                {status.networks?.tailscale?.ip && (
                  <span className="text-[9px] font-mono text-cyan-400">{status.networks.tailscale.ip}</span>
                )}
              </div>
            ) : (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{
                background: 'rgba(107, 114, 128, 0.2)',
                color: '#6B7280'
              }}>
                未激活
              </span>
            )}
          </div>
        </div>

        {/* Skills 信息 */}
        {status?.skills && status.skills.installed > 0 && (
          <div className="mb-2 p-1.5 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
            <div className="flex justify-between items-center text-[10px]">
              <div className="flex items-center gap-1">
                <svg className="w-2.5 h-2.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span className="text-white/40">Skills</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">{status.skills.installed} 已安装</span>
                {status.skills.activated > 0 && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="text-amber-400">{status.skills.activated} 已激活</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Token 消耗 */}
        {status?.sessions?.contextTokens !== undefined && status.sessions.contextTokens > 0 && (
          <div className="mb-2 p-1.5 rounded-lg" style={{ background: 'rgba(6, 182, 212, 0.05)' }}>
            <div className="flex justify-between items-center text-[10px]">
              <div className="flex items-center gap-1">
                <svg className="w-2.5 h-2.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span className="text-white/40">消息/Token</span>
              </div>
              <div className="flex items-center gap-1">
                {/* 旋转齿轮动画图标 */}
                <motion.svg
                  className="w-2.5 h-2.5 text-cyan-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                >
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </motion.svg>
                <span className="text-[9px] font-mono text-cyan-400">{formatNumber(status.sessions.contextTokens)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Token 未统计提示 */}
        {(!status?.sessions?.contextTokens || status.sessions.contextTokens === 0) && (
          <div className="mb-2 p-1.5 rounded-lg" style={{ background: 'rgba(107, 114, 128, 0.1)' }}>
            <div className="flex justify-between items-center text-[10px]">
              <div className="flex items-center gap-1">
                <svg className="w-2.5 h-2.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span className="text-white/40">消息/Token</span>
              </div>
              <span className="text-[9px] font-mono text-gray-500">未统计</span>
            </div>
          </div>
        )}

        {/* 安全审计 */}
        {hasSecurityIssues && (
          <div className="mb-2 p-1.5 rounded-lg" style={{ background: 'rgba(245, 158, 11, 0.05)' }}>
            <div className="flex justify-between items-center text-[10px]">
              <div className="flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-amber-400" />
                <span className="text-white/40">安全审计</span>
              </div>
              <div className="flex items-center gap-1.5">
                {(status?.securityAudit?.critical ?? 0) > 0 && (
                  <button
                    onClick={() => setShowSecurityModal(true)}
                    className="px-1 py-0.5 rounded cursor-pointer transition-colors hover:bg-red-500/20"
                    style={{ color: '#EF4444' }}
                  >
                    {status?.securityAudit?.critical} 严重
                  </button>
                )}
                {(status?.securityAudit?.warn ?? 0) > 0 && (
                  <button
                    onClick={() => setShowSecurityModal(true)}
                    className="px-1 py-0.5 rounded cursor-pointer transition-colors hover:bg-amber-500/20"
                    style={{ color: '#F59E0B' }}
                  >
                    {status?.securityAudit?.warn} 警告
                  </button>
                )}
                {(status?.securityAudit?.info ?? 0) > 0 && (
                  <button
                    onClick={() => setShowSecurityModal(true)}
                    className="px-1 py-0.5 rounded cursor-pointer transition-colors hover:bg-blue-500/20"
                    style={{ color: '#3B82F6' }}
                  >
                    {status?.securityAudit?.info} 信息
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 版本信息 */}
        <div className="mb-2 p-1.5 rounded-lg" style={{ background: 'rgba(6, 182, 212, 0.05)' }}>
          <div className="flex justify-between items-center text-[9px]">
            <div className="flex items-center gap-1">
              <svg className="w-2 h-2 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span className="text-white/40">版本</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-cyan-400">v{status?.version || 'unknown'}</span>
              {/* 新版本提示 */}
              {status?.latestVersion && status.latestVersion !== `v${status.version}` && (
                <motion.span
                  className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-1"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  新版本 {status.latestVersion}
                </motion.span>
              )}
            </div>
          </div>
        </div>

        {/* 打开 Dashboard 按钮 */}
        {status?.dashboard && (
          <button
            onClick={handleOpenDashboard}
            className="w-full py-1.5 rounded-lg text-[10px] font-medium text-white/70 hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
            style={{ 
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.15))',
              border: '1px solid rgba(6, 182, 212, 0.2)'
            }}
          >
            <ExternalLink className="w-3 h-3" />
            <span>打开 Dashboard</span>
          </button>
        )}
      </motion.div>

      {/* 安全审计详情弹窗 */}
      <AnimatePresence>
        {showSecurityModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* 背景遮罩 */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSecurityModal(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            
            {/* 弹窗内容 */}
            <motion.div
              className="relative w-full max-w-md rounded-xl overflow-hidden"
              style={{
                background: 'rgba(15, 15, 25, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)'
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              {/* 头部 */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-white/90">安全审计详情</span>
                </div>
                <button
                  onClick={() => setShowSecurityModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              
              {/* 内容 */}
              <div className="p-4 max-h-80 overflow-y-auto">
                {status?.securityAudit?.details && status.securityAudit.details.length > 0 ? (
                  <div className="space-y-3">
                    {status.securityAudit.details.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg"
                        style={{
                          background: `${getSecurityLevelColor(item.level)}10`,
                          borderLeft: `3px solid ${getSecurityLevelColor(item.level)}`
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: `${getSecurityLevelColor(item.level)}20`,
                              color: getSecurityLevelColor(item.level)
                            }}
                          >
                            {getSecurityLevelText(item.level)}
                          </span>
                          <span className="text-xs text-white/90 font-medium">{item.title}</span>
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-white/60 leading-relaxed mb-1.5">
                            {item.description}
                          </p>
                        )}
                        {item.fix && (
                          <div className="text-[11px] text-white/50">
                            <span className="text-cyan-400/80">修复建议:</span> {item.fix}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-white/40 text-sm">暂无安全审计详情</p>
                  </div>
                )}
              </div>
              
              {/* 底部 */}
              <div className="p-4 border-t border-white/10">
                {/* 统计信息 */}
                <div className="flex items-center justify-center gap-4 mb-3">
                  {(status?.securityAudit?.critical ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-[10px] text-white/60">{status?.securityAudit?.critical} 严重</span>
                    </div>
                  )}
                  {(status?.securityAudit?.warn ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-[10px] text-white/60">{status?.securityAudit?.warn} 警告</span>
                    </div>
                  )}
                  {(status?.securityAudit?.info ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-[10px] text-white/60">{status?.securityAudit?.info} 信息</span>
                    </div>
                  )}
                </div>
                
                {/* 复制按钮 */}
                <button
                  onClick={handleCopyReport}
                  className="w-full py-2 rounded-lg text-xs font-medium text-white/80 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))',
                    border: '1px solid rgba(6, 182, 212, 0.3)'
                  }}
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>复制报告给小龙虾处理</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}