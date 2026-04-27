'use client'

import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import { Server, Brain, Cpu, HardDrive, ArrowDown, ArrowUp, Monitor, RefreshCw, Network } from 'lucide-react'
import { VoiceVisualizer } from './voice-visualizer'
import { OpenClawStatusCard } from './openclaw-status-card'

// 品牌 Logo SVG 组件
function BrandLogo({ platform, className }: { platform: string; className?: string }) {
  const color = '#00F0FF'
  
  // Apple Logo
  if (platform === 'macOS') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill={color}>
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
    )
  }
  
  // Windows Logo
  if (platform === 'Windows') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill={color}>
        <path d="M3 12V6.75L9 5.43V11.91L3 12M20 3V11.91L10 11.91V5.21L20 3M3 13L9 13.09V19.9L3 18.75V13M20 21L10 19.09V13.09L20 13V21Z"/>
      </svg>
    )
  }
  
  // Linux Logo (Tux)
  if (platform === 'Linux') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill={color}>
        <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-7.126 2.688-8.74 5.625-.688 1.25-1.041 2.417-1.041 3.5 0 1.083.354 2.25 1.041 3.5 1.614 2.937 4.514 5.292 8.74 5.625.165.013.325.021.48.021 1.625 0 3.125-.5 4.375-1.5 1.25-1 2.125-2.5 2.125-4.25 0-.833-.167-1.667-.5-2.5-.333-.5-.75-.833-1.25-1-.5-.417-.833-.75 1.25-.75.5-.833.5-1.5.5-2.5 0-.833-.167-1.667-.5-2.5-.333-.5-.75-.833-1.25-1-.5-.417-.833-.75 1.25-.75.5-.833.5-1.5.5-2.5 0 .833-.167 1.667.5 2.5.333.5.75.833 1.25 1 .5.417.833.75-1.25.75-.5.833-.5 1.5-.5 2.5 0 .833.167 1.667.5 2.5.333.5.75.833 1.25 1 .5.417-.833.75-1.25.75-.5.833-.5 1.5-.5 2.5 0-.833-.167 1.667.5 2.5.333.5.75.833 1.25 1 .5.417.833.75-1.25.75-.5.833-.5 1.5.5 2.5 0-.833-.167 1.667.5 2.5.333.5.75.833 1.25 1 .5.417-.833.75-1.25.75-.5.833-.5 1.5.5 2.5 0-.833-.167 1.667-.5-2.5-.333-.5-.75.833-1.25-1-.5-.417-.833-.75 1.25-.75.5-.833.5 1.5.5 2.5 0-.833-.167 1.667-.5-2.5-.333-.5-.75-.833-1.25-1-.5.417-.833.75-1.25.75-.5.833-.5 1.5.5 2.5 0-.833-.167 1.667.5-2.5z"/>
      </svg>
    )
  }
  
  // 默认 Monitor 图标
  return <Monitor className={className} style={{ color }} />
}

// AI 厂商 Logo 组件 - 使用 LobeHub Icons
function VendorLogo({ vendor, className }: { vendor: string; className?: string }) {
  // LobeHub Icons 映射
  const iconMap: Record<string, string> = {
    'openai': 'openai',
    'anthropic': 'anthropic',
    'google': 'google',
    'gemini': 'gemini',
    'azure': 'azure',
    'deepseek': 'deepseek',
    'doubao': 'doubao',
    'qwen': 'qwen',
    'tongyi': 'qwen',
    'bailian': 'qwen',
    'groq': 'groq',
    'together': 'together',
    'fireworks': 'fireworks',
    'mistral': 'mistral',
    'siliconflow': 'siliconflow',
    'silicon': 'siliconflow',
    'huggingface': 'huggingface',
    'hf': 'huggingface',
    'openrouter': 'openrouter',
    'cerebras': 'cerebras',
    'perplexity': 'perplexity',
    'moonshot': 'moonshot',
    'kimi': 'moonshot',
    'zhipu': 'zhipu',
    'minimax': 'minimax',
  }
  
  const iconKey = iconMap[vendor.toLowerCase()] || vendor.toLowerCase()
  const iconUrl = `https://lobehub.com/icons/${iconKey}.svg`
  
  return (
    <img
      src={iconUrl}
      alt={vendor}
      className={className}
      style={{
        width: className?.includes('w-') ? undefined : '1rem',
        height: className?.includes('h-') ? undefined : '1rem',
        filter: 'brightness(0) saturate(100%) invert(75%) sepia(100%) saturate(1000%) hue-rotate(280deg)',
      }}
      onError={(e) => {
        // 如果图标加载失败，使用默认 Brain 图标
        e.currentTarget.style.display = 'none'
        const parent = e.currentTarget.parentElement
        if (parent) {
          parent.innerHTML = '<svg class="' + className + '" viewBox="0 0 24 24" fill="#FF00FF"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
        }
      }}
    />
  )
}

// 真实系统数据接口
interface RealSystemData {
  name: string
  cpu: {
    model: string
    cores: number
    usage: number
  }
  memory: {
    total: string
    used: string
    free: string
    usage: number
  }
  disk: {
    total: string
    used: string
    free: string
    usage: number
  } | null
  network: {
    ip: string
    download: number
    upload: number
  }
  system: {
    platform: string
    arch: string
    uptime: string
    version: string
    codename: string
    fullName: string
  }
}

// 供应商数据接口
interface ProviderModel {
  id: string
  name: string
  inUse: boolean
  status: 'work' | 'config'
}

interface ProviderData {
  id: string
  name: string
  nameEn: string
  nameZh: string
  icon: string
  baseUrl: string
  latency: number | null
  models: ProviderModel[]
  hasApiKey: boolean
  activated: boolean
  contextTokens?: number
}

// 本地机器卡片 - 显示真实系统数据
function LocalMachineCard({ data }: { data: RealSystemData | null }) {
  // 使用 useMemo 计算初始网络数据，避免在 effect 中调用 setState
  const initialNetwork = data?.network ? { download: data.network.download, upload: data.network.upload } : { download: 0, upload: 0 }
  const [networkData, setNetworkData] = useState(initialNetwork)
  
  // 当 data.network 变化时更新网络数据
  useEffect(() => {
    if (data?.network) {
      // 使用 setTimeout 延迟更新，避免同步调用 setState
      const timer = setTimeout(() => {
        setNetworkData({
          download: data.network.download,
          upload: data.network.upload
        })
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [data?.network])
  
  // 模拟网络流量变化
  useEffect(() => {
    const interval = setInterval(() => {
      setNetworkData(prev => ({
        download: Math.max(0.5, Math.min(10, prev.download + (Math.random() - 0.5) * 0.5)),
        upload: Math.max(0.2, Math.min(5, prev.upload + (Math.random() - 0.5) * 0.3))
      }))
    }, 2500)
    
    return () => clearInterval(interval)
  }, [])

  if (!data) {
    return (
      <motion.div
        className="relative p-4 rounded-xl overflow-hidden"
        style={{
          background: 'rgba(15, 15, 25, 0.9)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
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
          <span className="ml-3 text-white/60 text-xs">正在获取系统信息...</span>
        </div>
      </motion.div>
    )
  }

  const cpuColor = data.cpu.usage > 80 ? '#FF4040' : data.cpu.usage > 60 ? '#FFAA00' : '#00FF66'
  const memColor = data.memory.usage > 90 ? '#FF4040' : data.memory.usage > 70 ? '#FFAA00' : '#00F0FF'

  return (
    <motion.div
      className="relative p-4 rounded-xl overflow-hidden"
      style={{
        background: 'rgba(15, 15, 25, 0.9)',
        border: '1px solid rgba(0, 240, 255, 0.2)',
        boxShadow: '0 0 30px rgba(0, 240, 255, 0.1)'
      }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {/* 头部 */}
      <div className="relative flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,240,255,0.15)' }}>
          <BrandLogo platform={data.system.platform} className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-white/90 truncate block">{data.name}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-white/40">{data.cpu.model} · {data.memory.total}</span>
          </div>
        </div>
      </div>

      {/* CPU & Memory */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(0, 240, 255, 0.05)' }}>
          <div className="flex justify-between items-center text-[10px] mb-0.5">
            <div className="flex items-center gap-0.5">
              <Cpu className="w-2.5 h-2.5 text-white/40" />
              <span className="text-white/40">CPU</span>
            </div>
            <span className="text-[9px] font-mono" style={{ color: cpuColor }}>{data.cpu.usage.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: cpuColor }}
              animate={{ width: `${data.cpu.usage}%` }}
            />
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">{data.cpu.cores} 核心</div>
        </div>
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(255, 0, 255, 0.05)' }}>
          <div className="flex justify-between items-center text-[10px] mb-0.5">
            <div className="flex items-center gap-0.5">
              <HardDrive className="w-2.5 h-2.5 text-white/40" />
              <span className="text-white/40">内存</span>
            </div>
            <span className="text-[9px] font-mono" style={{ color: memColor }}>{data.memory.usage.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: memColor }}
              animate={{ width: `${data.memory.usage}%` }}
            />
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">{data.memory.used} / {data.memory.total}</div>
        </div>
      </div>

      {/* 磁盘信息 */}
      {data.disk && (
        <div className="mb-2 p-1.5 rounded-lg" style={{ background: 'rgba(0, 255, 102, 0.05)' }}>
          <div className="flex justify-between items-center text-[10px] mb-0.5">
            <div className="flex items-center gap-0.5">
              <Server className="w-2.5 h-2.5 text-white/40" />
              <span className="text-white/40">磁盘</span>
            </div>
            <span className="text-[9px] font-mono text-green-400">{data.disk.usage.toFixed(1)}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-green-400"
              animate={{ width: `${data.disk.usage}%` }}
            />
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">{data.disk.used} / {data.disk.total}</div>
        </div>
      )}

      {/* 网络和系统信息 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(255, 170, 0, 0.05)' }}>
          <div className="flex items-center gap-1 text-[9px] text-white/40 mb-0.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
            </svg>
            <span>网络 MB/s</span>
          </div>
          <div className="flex gap-1.5 text-[9px] font-mono">
            <div className="flex items-center gap-0.5">
              <ArrowDown className="w-2 h-2" style={{ color: '#00FF66' }} />
              <span className="text-white/50">{networkData.download.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <ArrowUp className="w-2 h-2" style={{ color: '#FF00FF' }} />
              <span className="text-white/50">{networkData.upload.toFixed(1)}</span>
            </div>
          </div>
          <div className="text-[9px] text-white/30 mt-0.5">IP: {data.network.ip}</div>
        </div>
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(0, 240, 255, 0.05)' }}>
          <div className="flex items-center gap-1 text-[9px] text-white/40 mb-0.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <span>系统</span>
          </div>
          <div className="text-[9px] text-white/70">{data.system.fullName || `${data.system.platform} ${data.system.arch}`}</div>
          {data.system.codename && <div className="text-[9px] text-cyan-400/70 mt-0.5">{data.system.codename}</div>}
          <div className="text-[9px] text-white/30 mt-0.5">运行 {data.system.uptime}</div>
        </div>
      </div>
    </motion.div>
  )
}

// 供应商卡片 - 显示供应商和模型信息
function ProviderCard({ provider, index }: { provider: ProviderData; index: number }) {
  const [showAll, setShowAll] = useState(false)
  
  // 分离工作和配置模型
  const workModels = provider.models.filter(m => m.status === 'work')
  const configModels = provider.models.filter(m => m.status === 'config')
  
  // 判断供应商是否处于激活状态
  const isProviderActivated = provider.activated
  const hasWorkModels = workModels.length > 0
  
  // 工作模型超过 5 个时，默认只显示前 5 个
  const MAX_VISIBLE_WORK = 5
  const visibleWorkModels = workModels.slice(0, MAX_VISIBLE_WORK)
  const hiddenWorkCount = Math.max(0, workModels.length - MAX_VISIBLE_WORK)
  const totalHiddenCount = hiddenWorkCount + configModels.length
  const hasHiddenModels = totalHiddenCount > 0

  return (
    <motion.div
      className="relative p-3 rounded-xl overflow-hidden"
      style={{
        background: 'rgba(15, 15, 25, 0.9)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: `0 0 20px ${isProviderActivated ? '#00FF66' : '#FFAA00'}10`
      }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.1 }}
    >
      {/* 脉冲动画背景 */}
      {isProviderActivated && (
        <motion.div
          className="absolute inset-0 opacity-10"
          style={{ background: 'radial-gradient(circle at 50% 50%, #00FF66 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* 头部 */}
      <div className="relative flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,0,255,0.1)' }}>
          <VendorLogo vendor={provider.icon} className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/90 truncate">{provider.nameZh}</span>
            {/* 显示隐藏模型按钮（包括隐藏的激活模型和可用模型） */}
            {hasHiddenModels && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-[9px] px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                style={{
                  background: showAll ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  color: showAll ? '#00F0FF' : 'rgba(255, 255, 255, 0.5)'
                }}
                title={showAll ? '收起隐藏的模型' : `显示 ${totalHiddenCount} 个隐藏模型`}
              >
                {showAll ? '收起' : `+${totalHiddenCount}`}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{
                background: provider.latency !== null
                  ? (provider.latency < 200 ? '#00FF66' : provider.latency < 500 ? '#FFAA00' : '#FF4444')
                  : '#888888',
                boxShadow: `0 0 6px ${provider.latency !== null
                  ? (provider.latency < 200 ? '#00FF66' : provider.latency < 500 ? '#FFAA00' : '#FF4444')
                  : '#888888'}`
              }} />
              <span className="text-[10px] text-white/40">
                {provider.latency !== null ? `${provider.latency}ms` : '超时'}
              </span>
            </div>
            {/* Token 消耗显示 */}
            {provider.contextTokens !== undefined && provider.contextTokens > 0 && (
              <div className="flex items-center gap-1">
                <svg className="w-2.5 h-2.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span className="text-[10px] text-cyan-400/80">
                  {(provider.contextTokens / 1000).toFixed(1)}k tokens
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 模型列表 - 工作模型（绿色）和配置模型（黄色） */}
      <div className="relative">
        {provider.models.length > 0 ? (
          <div className="space-y-1">
            {/* 工作模型 - 绿色，默认最多显示5个 */}
            {visibleWorkModels.map(model => (
              <div key={model.id} className="flex items-center justify-between p-1.5 rounded-lg" style={{
                background: 'rgba(0, 255, 102, 0.08)'
              }}>
                <span className="text-[10px] text-white/70">{model.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                  background: 'rgba(0, 255, 102, 0.2)',
                  color: '#00FF66'
                }}>
                  工作
                </span>
              </div>
            ))}
            
            {/* 隐藏的工作模型 - 展开时显示 */}
            {showAll && workModels.slice(MAX_VISIBLE_WORK).map(model => (
              <motion.div
                key={model.id}
                className="flex items-center justify-between p-1.5 rounded-lg"
                style={{ background: 'rgba(0, 255, 102, 0.08)' }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <span className="text-[10px] text-white/70">{model.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                  background: 'rgba(0, 255, 102, 0.2)',
                  color: '#00FF66'
                }}>
                  工作
                </span>
              </motion.div>
            ))}
            
            {/* 已配置但未工作的模型 - 黄色 */}
            {configModels.map(model => (
              <motion.div
                key={model.id}
                className="flex items-center justify-between p-1.5 rounded-lg"
                style={{ background: 'rgba(255, 170, 0, 0.06)' }}
                initial={{ opacity: showAll ? 0 : 1, height: 'auto' }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <span className="text-[10px] text-white/70">{model.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                  background: 'rgba(255, 170, 0, 0.2)',
                  color: '#FFAA00'
                }}>
                  配置
                </span>
              </motion.div>
            ))}
            
            {/* 无工作模型时的提示 */}
            {workModels.length === 0 && configModels.length > 0 && (
              <div className="p-1.5 rounded-lg text-center" style={{ background: 'rgba(255, 170, 0, 0.08)' }}>
                <span className="text-[10px] text-white/50">暂无工作模型</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-1.5 rounded-lg text-center" style={{ background: 'rgba(255, 170, 0, 0.08)' }}>
            <span className="text-[10px] text-white/50">暂无模型配置</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// 向量记忆状态接口
interface VectorMemoryStatus {
  enabled: boolean
  pluginInstalled: boolean
  pluginEnabled: boolean
  embeddingModel: string | null
  ollamaRunning: boolean
  ollamaEmbeddingModels: string[]
  recallAvailable: boolean
  recallLatency: number | null
  autoRecall: boolean
  issues: string[]
}

// 前端检测 Ollama（检测用户本地机器）
function checkLocalOllama(): Promise<{ running: boolean; models: string[] }> {
  return new Promise((resolve) => {
    const ports = [11434, 11435]
    let checked = 0
    
    function check(port: number) {
      const timeout = 2000
      const timer = setTimeout(() => {
        if (++checked >= ports.length * 2) resolve({ running: false, models: [] })
      }, timeout)
      
      fetch(`http://127.0.0.1:${port}/api/tags`)
        .then(res => res.json())
        .then(data => {
          clearTimeout(timer)
          const models = (data.models || []).map((m: { name: string }) => m.name)
          resolve({ running: true, models })
        })
        .catch(() => {
          if (++checked >= ports.length * 2) {
            clearTimeout(timer)
            // 尝试 localhost
            fetch('http://localhost:11434/api/tags')
              .then(res => res.json())
              .then(data => {
                const models = (data.models || []).map((m: { name: string }) => m.name)
                resolve({ running: true, models })
              })
              .catch(() => resolve({ running: false, models: [] }))
          }
        })
    }
    
    ports.forEach(check)
    ports.forEach(check)
    
    setTimeout(() => resolve({ running: false, models: [] }), 3000)
  })
}

export function DeviceMonitor() {
  const [systemData, setSystemData] = useState<RealSystemData | null>(null)
  const [providers, setProviders] = useState<ProviderData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeProviderIndex, setActiveProviderIndex] = useState(0)
  const [vectorMemory, setVectorMemory] = useState<VectorMemoryStatus | null>(null)

  // 获取系统信息
  const fetchSystemInfo = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/system-info')
      const data = await response.json()
      if (data.device) {
        setSystemData(data.device)
      }
    } catch (error) {
      console.error('Failed to fetch system info:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 获取向量记忆状态
  const fetchVectorMemory = useCallback(async () => {
    try {
      // 并行检测：后端检测 + 前端本地检测
      const [response, localOllama] = await Promise.all([
        fetch('/api/vector-memory-status'),
        checkLocalOllama()
      ])
      const data = await response.json()
      
      // 使用本地检测结果（更可靠），如果失败则使用后端结果
      const ollamaRunning = localOllama.running ? localOllama.running : data.ollamaRunning
      const localModels = localOllama.models.length > 0 ? localOllama.models : (data.ollamaEmbeddingModels || [])
      
      setVectorMemory({
        enabled: data.enabled,
        pluginInstalled: data.pluginInstalled,
        pluginEnabled: data.pluginEnabled,
        embeddingModel: data.embeddingModel,
        ollamaRunning: ollamaRunning,
        ollamaEmbeddingModels: localModels,
        recallAvailable: data.recallAvailable,
        recallLatency: data.recallLatency,
        autoRecall: data.autoRecall,
        issues: data.issues || []
      })
    } catch (error) {
      console.error('Failed to fetch vector memory status:', error)
    }
  }, [])

  // 获取供应商信息（不包括延迟）
  const fetchProviders = useCallback(async () => {
    try {
      const response = await fetch('/api/providers')
      const data = await response.json()
      if (data.providers) {
        setProviders(data.providers)
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    }
  }, [])

  // 重新测量延迟（高频更新部分）
  const refreshLatencies = useCallback(async () => {
    try {
      // 获取当前所有供应商的基础信息
      const response = await fetch('/api/providers')
      const data = await response.json()

      if (data.providers) {
        // 通过后端API来获取网络延迟，而不是从前端直接访问外部API
        const updatedProviders = await Promise.all(data.providers.map(async (originalProvider: ProviderData) => {
          // 为了防止CORS错误，使用后端代理来测试延迟
          try {
            // 仅当有有效的baseUrl时才测试延迟
            if (!originalProvider.baseUrl || originalProvider.baseUrl.trim() === '') {
              return {
                ...originalProvider,
                latency: null
              };
            }

            // 从baseUrl中提取主机名用于ping测试
            let hostname;
            try {
              const url = new URL(originalProvider.baseUrl);
              hostname = url.hostname;
            } catch {
              return {
                ...originalProvider,
                latency: null
              };
            }

            const startTime = Date.now();
            // 使用ping延迟测试API来测试纯网络延迟
            const testResponse = await fetch('/api/test-ping-latency', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ hostname })
            });

            const testResult = await testResponse.json();
            const newLatency = testResult.latency || null;

            // 保持原始的提供商其他信息，只更新延迟
            return {
              ...originalProvider,
              latency: newLatency
            };
          } catch (err) {
            console.error(`Failed to test ping latency for provider ${originalProvider.id}:`, err);
            // 保持原始延迟或设置为null
            return {
              ...originalProvider,
              latency: null
            };
          }
        }))

        setProviders(updatedProviders)
      }
    } catch (error) {
      console.error('Failed to refresh latencies:', error)
    }
  }, [])

  // 初始加载和定时刷新
  useEffect(() => {
    // 初始化所有数据
    fetchSystemInfo()
    fetchProviders()
    fetchVectorMemory()

    // 每 15 分钟刷新一次完整信息（包含 token、版本、安全审计等）
    const fullRefreshInterval = setInterval(() => {
      fetchSystemInfo()
      fetchProviders()
      fetchVectorMemory()
    }, 900000) // 15 分钟 = 15 * 60 * 1000 毫秒

    // 每 30 秒刷新一次延迟信息（从15秒改为30秒，减少网络负载）
    const latencyRefreshInterval = setInterval(refreshLatencies, 30000) // 30 秒 = 30000 毫秒

    return () => {
      clearInterval(fullRefreshInterval)
      clearInterval(latencyRefreshInterval)
    }
  }, [fetchSystemInfo, fetchProviders, fetchVectorMemory, refreshLatencies])

  // 统计使用中的模型数量
  const inUseCount = providers.filter(p => p.models.some(m => m.inUse)).length
  const activatedCount = providers.filter(p => p.activated).length

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* 本地机器 - 真实状态 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
            <Monitor className="w-4 h-4" style={{ color: '#00F0FF' }} />
            本地设备
          </h3>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00FF66', boxShadow: '0 0 6px #00FF66' }} />
        </div>
        <LocalMachineCard data={systemData} />
      </div>

      {/* AI 大模型 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
            <Brain className="w-4 h-4" style={{ color: '#FF00FF' }} />
            AI 大模型
          </h3>
          {/* 多供应商切换按钮 */}
          {providers.length > 1 && (
            <div className="flex gap-1 cursor-pointer">
              {providers.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActiveProviderIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${i === activeProviderIndex ? 'scale-125' : 'opacity-50 hover:opacity-80'}`}
                  style={{
                    background: p.activated ? '#00FF66' : '#FFAA00',
                    boxShadow: i === activeProviderIndex ? `0 0 6px ${p.activated ? '#00FF66' : '#FFAA00'}` : 'none'
                  }}
                  title={p.nameZh}
                />
              ))}
            </div>
          )}
          {/* 单供应商时显示状态点 */}
          {providers.length === 1 && (
            <div className="w-2 h-2 rounded-full" style={{ background: providers[0].activated ? '#00FF66' : '#FFAA00', boxShadow: `0 0 6px ${providers[0].activated ? '#00FF66' : '#FFAA00'}` }} />
          )}
          {/* 单供应商时显示状态点 */}
          {providers.length === 1 && (
            <div className="w-2 h-2 rounded-full" style={{ background: providers[0].activated ? '#00FF66' : '#FFAA00', boxShadow: `0 0 6px ${providers[0].activated ? '#00FF66' : '#FFAA00'}` }} />
          )}
        </div>
        <div className="space-y-2">
          {providers.length === 0 ? (
            <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(15, 15, 25, 0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xs text-white/40">暂无配置厂商</span>
            </div>
          ) : (
            <ProviderCard key={providers[activeProviderIndex]?.id} provider={providers[activeProviderIndex]} index={0} />
          )}
        </div>
      </div>

      {/* 向量记忆状态 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
            <Network className="w-4 h-4" style={{ color: '#00FF66' }} />
            向量记忆
          </h3>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{
            background: vectorMemory?.enabled ? '#00FF66' : vectorMemory?.pluginInstalled ? '#FFAA00' : '#FF4444',
            boxShadow: `0 0 6px ${vectorMemory?.enabled ? '#00FF66' : vectorMemory?.pluginInstalled ? '#FFAA00' : '#FF4444'}`
          }} />
        </div>
        <motion.div
          className="relative p-3 rounded-xl overflow-hidden"
          style={{
            background: 'rgba(15, 15, 25, 0.9)',
            border: `1px solid ${vectorMemory?.enabled ? 'rgba(0, 255, 102, 0.3)' : 'rgba(255,255,255,0.08)'}`
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {vectorMemory === null ? (
            <div className="text-center py-2">
              <span className="text-xs text-white/40">检测中...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {/* 插件状态 */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">LanceDB 插件</span>
                <span className="text-[10px]" style={{
                  color: vectorMemory.pluginInstalled ? '#00FF66' : '#FF4444'
                }}>
                  {vectorMemory.pluginInstalled ? '已安装' : '未安装'}
                </span>
              </div>
              
              {/* 插件启用状态 */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">插件启用</span>
                <span className="text-[10px]" style={{
                  color: vectorMemory.pluginEnabled ? '#00FF66' : '#FFAA00'
                }}>
                  {vectorMemory.pluginEnabled ? '已启用' : '未启用'}
                </span>
              </div>
              
              {/* Embedding 模型 */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">Embedding 模型</span>
                <span className="text-[10px] text-cyan-400">
                  {vectorMemory.embeddingModel || '未配置'}
                </span>
              </div>
              
              {/* Recall 功能状态 */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">Recall 功能</span>
                <span className="text-[10px]" style={{
                  color: vectorMemory.recallAvailable ? '#00FF66' : '#FF4444'
                }}>
                  {vectorMemory.recallAvailable
                    ? `正常 (${vectorMemory.recallLatency}ms)`
                    : '不可用'
                  }
                </span>
              </div>
              
              {/* Auto Recall 配置 */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">自动 Recall</span>
                <span className="text-[10px]" style={{
                  color: vectorMemory.autoRecall ? '#00FF66' : '#FFAA00'
                }}>
                  {vectorMemory.autoRecall ? '已启用' : '未启用'}
                </span>
              </div>
              
              {/* Ollama 状态 */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">Ollama 运行</span>
                <span className="text-[10px]" style={{
                  color: vectorMemory.ollamaRunning ? '#00FF66' : '#FF4444'
                }}>
                  {vectorMemory.ollamaRunning ? '运行中' : '未运行'}
                </span>
              </div>
              
              {/* 可用的 Embedding 模型 */}
              {vectorMemory.ollamaEmbeddingModels.length > 0 && (
                <div>
                  <span className="text-[10px] text-white/50 block mb-1">可用 Embedding 模型</span>
                  <div className="flex flex-wrap gap-1">
                    {vectorMemory.ollamaEmbeddingModels
                      .filter(m => m.toLowerCase().includes('embed') || m.toLowerCase().includes('nomic') || m.toLowerCase().includes('bge'))
                      .map(m => (
                        <span key={m} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                          background: 'rgba(0, 240, 255, 0.15)',
                          color: '#00F0FF'
                        }}>
                          {m}
                        </span>
                      ))
                    }
                  </div>
                </div>
              )}
              
              {/* 问题列表 */}
              {vectorMemory.issues.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <span className="text-[10px] text-white/50 block mb-1">待解决问题</span>
                  <div className="space-y-1">
                    {vectorMemory.issues.slice(0, 3).map((issue, i) => (
                      <div key={i} className="text-[9px] text-orange-400/80">• {issue}</div>
                    ))}
                    {vectorMemory.issues.length > 3 && (
                      <div className="text-[9px] text-white/40">+{vectorMemory.issues.length - 3} 更多</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* OpenClaw 状态 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
            <span className="text-base">🦞</span>
            OpenClaw 状态
          </h3>
        </div>
        <OpenClawStatusCard />
      </div>

      {/* 语音拾音动画 - 暂时隐藏 */}
      {/* <VoiceVisualizer /> */}
    </div>
  )
}