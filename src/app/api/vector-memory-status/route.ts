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
  recallAvailable: boolean
  recallLatency: number | null
  issues: string[]
}

// 检查 Ollama 是否运行并获取本地模型（后端检测）
// 注意：如果后端和Ollama不在同一台机器，这个检测会失败
// 所以前端也有检测逻辑
async function checkOllamaBackend(): Promise<{ running: boolean; models: string[] }> {
  const ports = [11434, 11435]
  for (const port of ports) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      })
      if (response.ok) {
        const data = await response.json()
        const models = (data.models || []).map((m: { name: string }) => m.name)
        return { running: true, models }
      }
    } catch {
      continue
    }
  }
  
  // 尝试 localhost
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    if (response.ok) {
      const data = await response.json()
      const models = (data.models || []).map((m: { name: string }) => m.name)
      return { running: true, models }
    }
  } catch {
    // ignore
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

// 测试向量记忆 recall 功能
async function testRecall(
  enabled: boolean,
  embeddingBaseUrl: string | null,
  embeddingModel: string | null,
  embeddingProvider: string | null
): Promise<{ available: boolean; latency: number | null }> {
  if (!enabled || !embeddingBaseUrl || !embeddingModel) {
    return { available: false, latency: null }
  }
  
  try {
    const startTime = Date.now()
    
    // 如果是 Ollama provider，使用 OpenAI 兼容 API 测试 embedding
    if (embeddingProvider === 'openai-compatible' && embeddingBaseUrl.includes('localhost:11434')) {
      const response = await fetch(`${embeddingBaseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: embeddingModel,
          input: 'test recall'
        }),
        signal: AbortSignal.timeout(5000)
      })
      
      const latency = Date.now() - startTime
      
      if (response.ok) {
        return { available: true, latency }
      }
    }
    // 其他 provider，尝试发送一个简单的 embedding 请求
    else {
      const response = await fetch(`${embeddingBaseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: embeddingModel,
          input: 'test recall'
        }),
        signal: AbortSignal.timeout(5000)
      })
      
      const latency = Date.now() - startTime
      
      if (response.ok) {
        return { available: true, latency }
      }
    }
    
    return { available: false, latency: null }
  } catch {
    return { available: false, latency: null }
  }
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
    const { running: ollamaRunning, models: ollamaModels } = await checkOllamaBackend()
    
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
    
    // 判断向量记忆是否完全启用：只要配置在 openclaw.json 中且启用即可
    const pluginInstalled = pluginInConfig // 配置了就认为已安装
    const enabled = pluginInConfig && pluginEnabled && memorySlot
    
    // 测试 recall 功能
    const { available: recallAvailable, latency: recallLatency } = await testRecall(
      enabled,
      embeddingBaseUrl,
      embeddingModel,
      embeddingProvider
    )
    
    if (enabled && !recallAvailable) {
      issues.push('向量记忆 recall 功能不可用')
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
      recallAvailable,
      recallLatency,
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
      recallAvailable: false,
      recallLatency: null,
      issues: ['检测向量记忆状态时出错']
    }, { status: 500 })
  }
}
