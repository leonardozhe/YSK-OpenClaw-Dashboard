'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { downloadConfig } from '@/hooks/use-persistent-config'

// 精选的 10 个 DiceBear 头像风格
const AVATAR_STYLES = [
  { id: 'bottts', name: '机器人', nameEn: 'Bottts', preview: 'Felix' },
  { id: 'adventurer', name: '冒险家', nameEn: 'Adventurer', preview: 'Luna' },
  { id: 'avataaars', name: '卡通头像', nameEn: 'Avataaars', preview: 'Aneka' },
  { id: 'big-smile', name: '大微笑', nameEn: 'Big Smile', preview: 'Happy' },
  { id: 'croodles', name: '涂鸦', nameEn: 'Croodles', preview: 'Leo' },
  { id: 'fun-emoji', name: '趣味表情', nameEn: 'Fun Emoji', preview: 'Cool' },
  { id: 'lorelei', name: '洛勒莱', nameEn: 'Lorelei', preview: 'Mia' },
  { id: 'notionists', name: '概念风', nameEn: 'Notionists', preview: 'Nova' },
  { id: 'shapes', name: '几何图形', nameEn: 'Shapes', preview: 'Zen' },
  { id: 'thumbs', name: '拇指人', nameEn: 'Thumbs', preview: 'Max' },
]

// 特效选项
const EFFECTS_OPTIONS = [
  { id: 'scanline', name: '扫描线', description: '由上而下的扫描线效果', icon: '📺' },
  { id: 'matrix', name: '矩阵雨', description: '类似黑客帝国的数字雨效果', icon: '💻' },
  { id: 'particles', name: '粒子漂浮', description: '漂浮的发光粒子背景', icon: '✨' },
  { id: 'glitch', name: '故障风', description: '赛博朋克风格的故障效果', icon: '🔮' },
]

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentTitle: string
  currentLogo: string
  currentLobsterCount: number
  currentTeamName: string
  currentUnit: string
  currentAvatarStyle: string
  currentEffects: string[]
  currentMainProcessName: string
  onSave: (title: string, logo: string, lobsterCount: number, teamName: string, unit: string, avatarStyle: string, effects: string[], mainProcessName: string) => void
  onExport: () => void
  onImport: (content: string) => boolean
  onReset: () => void
}

function SettingsModalContent({
  onClose,
  currentTitle,
  currentLogo,
  currentLobsterCount,
  currentTeamName,
  currentUnit,
  currentAvatarStyle,
  currentEffects,
  currentMainProcessName,
  onSave,
  onExport,
  onImport,
  onReset
}: Omit<SettingsModalProps, 'isOpen'>) {
  const [title, setTitle] = useState(currentTitle)
  const [logo, setLogo] = useState(currentLogo)
  const [logoPreview, setLogoPreview] = useState(currentLogo)
  const [lobsterCount, setLobsterCount] = useState(currentLobsterCount)
  const [teamName, setTeamName] = useState(currentTeamName)
  const [unit, setUnit] = useState(currentUnit)
  const [avatarStyle, setAvatarStyle] = useState(currentAvatarStyle)
  const [effects, setEffects] = useState<string[]>(currentEffects)
  const [mainProcessName, setMainProcessName] = useState(currentMainProcessName)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件')
        return
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过 2MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setLogo(base64)
        setLogoPreview(base64)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleResetLogo = () => {
    setLogo('/openclaw.png')
    setLogoPreview('/openclaw.png')
  }

  const handleSave = () => {
    onSave(title, logo, lobsterCount, teamName, unit, avatarStyle, effects, mainProcessName)
    onClose()
  }
  
  // 切换特效
  const toggleEffect = (effectId: string) => {
    setEffects(prev =>
      prev.includes(effectId)
        ? prev.filter(e => e !== effectId)
        : [...prev, effectId]
    )
  }

  return (
    <motion.div
      className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
      style={{
        background: 'rgba(15, 15, 25, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 0 40px rgba(0, 240, 255, 0.15), 0 0 80px rgba(255, 0, 255, 0.1)'
      }}
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.9, y: 20 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 z-10" style={{ background: 'rgba(15, 15, 25, 0.98)' }}>
        <h2 className="text-xl font-bold text-white">系统设置</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-6">
        {/* Logo Setting */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">Logo</label>
          <div className="flex items-center gap-4">
            <div 
              className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center bg-black/30 cursor-pointer hover:border-cyan-500/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {logoPreview ? (
                <img 
                  src={logoPreview} 
                  alt="Logo Preview" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2 text-sm rounded-lg border border-white/10 hover:border-cyan-500/50 hover:bg-white/5 transition-colors text-gray-300"
              >
                选择图片
              </button>
              <button
                onClick={handleResetLogo}
                className="w-full px-4 py-2 text-sm rounded-lg border border-white/10 hover:border-amber-500/50 hover:bg-white/5 transition-colors text-gray-400"
              >
                恢复默认
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">支持 JPG、PNG、SVG，最大 2MB</p>
        </div>

        {/* Title Setting */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">系统标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入系统标题"
            className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
          />
          <p className="text-xs text-gray-500">标题将显示在页面顶部</p>
        </div>

        {/* Team Name Setting */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">龙虾团队名称</label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="输入团队名称"
            className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
          />
          <p className="text-xs text-gray-500">团队名称将显示在右上角状态区域</p>
        </div>

        {/* Unit Setting */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">数量单位</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">x</span>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="只虾"
              className="flex-1 px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
            />
          </div>
          <p className="text-xs text-gray-500">设置龙虾数量的单位，如「只虾」、「个成员」等</p>
        </div>

        {/* Lobster Count Setting */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">龙虾数量</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="20"
              value={lobsterCount}
              onChange={(e) => setLobsterCount(parseInt(e.target.value))}
              className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="text-lg font-bold text-cyan-400 w-8 text-center">{lobsterCount}</span>
          </div>
          <p className="text-xs text-gray-500">设置显示的龙虾数量（1-20）</p>
        </div>

        {/* Avatar Style Setting */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">头像风格</label>
          <div className="grid grid-cols-5 gap-2">
            {AVATAR_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => setAvatarStyle(style.id)}
                className={`relative p-2 rounded-lg border transition-all hover:scale-105 ${
                  avatarStyle === style.id 
                    ? 'border-cyan-500 bg-cyan-500/10' 
                    : 'border-white/10 hover:border-white/30'
                }`}
                title={`${style.name} (${style.nameEn})`}
              >
                <img
                  src={`https://api.dicebear.com/9.x/${style.id}/svg?seed=${style.preview}`}
                  alt={style.name}
                  className="w-10 h-10 mx-auto"
                />
                <span className="block text-[10px] text-gray-400 mt-1 truncate">{style.name}</span>
                {avatarStyle === style.id && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">选择 Agent 头像的生成风格</p>
        </div>

        {/* Effects Settings */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">页面特效</label>
          <div className="space-y-2">
            {EFFECTS_OPTIONS.map((effect) => (
              <button
                key={effect.id}
                onClick={() => toggleEffect(effect.id)}
                className={`w-full p-3 rounded-lg border transition-all flex items-center gap-3 ${
                  effects.includes(effect.id)
                    ? 'border-cyan-500/50 bg-cyan-500/10'
                    : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                }`}
              >
                <span className="text-xl">{effect.icon}</span>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-white/90">{effect.name}</div>
                  <div className="text-xs text-gray-500">{effect.description}</div>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative ${
                  effects.includes(effect.id) ? 'bg-cyan-500' : 'bg-white/10'
                }`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    effects.includes(effect.id) ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">开启后将在页面显示对应的视觉效果</p>
        </div>

        {/* Main Process Name Setting */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">主进程名称</label>
          <input
            type="text"
            value={mainProcessName}
            onChange={(e) => setMainProcessName(e.target.value)}
            placeholder="龙虾船长"
            className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
          />
          <p className="text-xs text-gray-500">设置右侧联系人主进程的默认名称，默认为「龙虾船长」</p>
        </div>
      </div>

      {/* 配置管理 */}
      <div className="px-6 py-4 border-t border-white/10" style={{ background: 'rgba(15, 15, 25, 0.98)' }}>
        <label className="block text-sm font-medium text-gray-300 mb-3">配置管理</label>
        <div className="flex gap-2">
          <button
            onClick={onExport}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-white/10 hover:border-cyan-500/50 hover:bg-white/5 transition-colors text-gray-300 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            导出配置
          </button>
          <button
            onClick={() => importFileInputRef.current?.click()}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-white/10 hover:border-cyan-500/50 hover:bg-white/5 transition-colors text-gray-300 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h9a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m0 0l4 4" />
            </svg>
            导入配置
          </button>
          <button
            onClick={() => {
              if (confirm('确定要重置所有设置吗？此操作不可恢复。')) {
                onReset()
              }
            }}
            className="px-3 py-2 text-sm rounded-lg border border-red-500/30 hover:border-red-500/50 hover:bg-red-500/10 transition-colors text-red-400 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            重置
          </button>
        </div>
        <input
          ref={importFileInputRef}
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              const reader = new FileReader()
              reader.onload = (event) => {
                const content = event.target?.result as string
                const success = onImport(content)
                if (success) {
                  alert('配置导入成功，请刷新页面')
                } else {
                  alert('配置文件格式错误')
                }
              }
              reader.readAsText(file)
            }
            e.target.value = ''
          }}
          className="hidden"
        />
        <p className="text-xs text-gray-500 mt-2">升级版本前请导出备份配置，升级后导入恢复</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 sticky bottom-0" style={{ background: 'rgba(15, 15, 25, 0.98)' }}>
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition-colors"
        >
          保存设置
        </button>
      </div>
    </motion.div>
  )
}

export function SettingsModal({
  isOpen,
  onClose,
  currentTitle,
  currentLogo,
  currentLobsterCount,
  currentTeamName,
  currentUnit,
  currentAvatarStyle,
  currentEffects,
  currentMainProcessName,
  onSave,
  onExport,
  onImport,
  onReset
}: SettingsModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="settings-modal"
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <SettingsModalContent
            onClose={onClose}
            currentTitle={currentTitle}
            currentLogo={currentLogo}
            currentLobsterCount={currentLobsterCount}
            currentTeamName={currentTeamName}
            currentUnit={currentUnit}
            currentAvatarStyle={currentAvatarStyle}
            currentEffects={currentEffects}
            currentMainProcessName={currentMainProcessName}
            onSave={onSave}
            onExport={onExport}
            onImport={onImport}
            onReset={onReset}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}