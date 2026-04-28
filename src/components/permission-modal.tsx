'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PermissionModalProps {
  onAccept: () => void
  onDecline: () => void
}

export function PermissionModal({ onAccept, onDecline }: PermissionModalProps) {
  // 使用懒初始化检查用户是否已经同意过
  const [hasAgreed, setHasAgreed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ysk-permission-agreed') === 'true'
    }
    return false
  })

  const handleAccept = () => {
    localStorage.setItem('ysk-permission-agreed', 'true')
    setHasAgreed(true)
    onAccept()
  }

  const handleDecline = () => {
    onDecline()
  }

  return (
    <AnimatePresence>
      {!hasAgreed && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(15, 15, 25, 0.95)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              boxShadow: '0 0 30px rgba(0, 240, 255, 0.2)'
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* 顶部装饰条 */}
            <div 
              className="h-1 w-full"
              style={{
                background: 'linear-gradient(90deg, #00F0FF, #FF00FF, #00F0FF)'
              }}
            />
            
            {/* 内容区域 */}
            <div className="p-6">
              {/* 标题 */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 240, 255, 0.1)' }}>
                  <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white">使用许可声明</h2>
              </div>

              {/* 欢迎说明 */}
              <div className="space-y-4 text-sm">
                <div className="p-3 rounded-lg" style={{ background: 'rgba(0, 240, 255, 0.05)' }}>
                  <p className="text-cyan-400 font-semibold mb-1">欢迎使用 MeetClaw V2.4</p>
                  <p className="text-gray-300">MeetClaw 是 YSK 团队开发的 OpenClaw 设备监控与管理平台。</p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-white font-medium">📋 使用说明</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✅</span>
                      <span><strong className="text-white">免费使用</strong> - 本软件完全免费开放使用</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✅</span>
                      <span><strong className="text-white">开源</strong> - 基于 MIT 许可证开源</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-0.5">💡</span>
                      <span><strong className="text-white">设备监控</strong> - 实时监控 GPU、CPU、内存状态</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-0.5">💡</span>
                      <span><strong className="text-white">Agent 管理</strong> - 查看和管理 AI Agent 状态</span>
                    </li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg" style={{ background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                  <p className="text-cyan-400 text-xs">
                    💡 点击「我已了解」即可开始使用本软件。
                  </p>
                </div>
              </div>

              {/* 按钮区域 */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleDecline}
                  className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#9CA3AF'
                  }}
                >
                  关闭
                </button>
                <button
                  onClick={handleAccept}
                  className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 text-white"
                  style={{
                    background: 'linear-gradient(135deg, #00F0FF, #0080FF)',
                    boxShadow: '0 0 15px rgba(0, 240, 255, 0.3)'
                  }}
                >
                  我已了解
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
