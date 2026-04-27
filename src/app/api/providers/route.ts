import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

interface Model {
  id: string
  name: string
  api: string
  reasoning?: boolean
  input?: string[]
  contextWindow?: number
  maxTokens?: number
}

interface Provider {
  baseUrl?: string
  apiKey?: string
  api?: string
  models: Model[]
}

interface AgentDefaults {
  model?: {
    primary: string
  }
  models?: Record<string, object>
  contextTokens?: number
}

interface OpenClawConfig {
  models?: {
    mode?: string
    providers?: Record<string, Provider>
  }
  agents?: {
    defaults?: AgentDefaults
  }
}

// 厂商信息配置
interface VendorInfo {
  id: string
  nameEn: string
  nameZh: string
  icon: string
  baseUrl: string
  keywords: string[]
}

// 厂商信息映射表
const VENDOR_INFO: Record<string, VendorInfo> = {
  'openai': {
    id: 'openai',
    nameEn: 'OpenAI',
    nameZh: 'OpenAI',
    icon: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keywords: ['openai']
  },
  'anthropic': {
    id: 'anthropic',
    nameEn: 'Anthropic',
    nameZh: 'Anthropic (Claude)',
    icon: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keywords: ['anthropic', 'claude']
  },
  'google': {
    id: 'google',
    nameEn: 'Google AI / Gemini',
    nameZh: '谷歌 Gemini',
    icon: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keywords: ['google', 'gemini', 'vertex']
  },
  'azure': {
    id: 'azure',
    nameEn: 'Microsoft Azure OpenAI',
    nameZh: '微软 Azure OpenAI',
    icon: 'azure',
    baseUrl: 'https://{resource}.openai.azure.com',
    keywords: ['azure']
  },
  'deepseek': {
    id: 'deepseek',
    nameEn: 'DeepSeek',
    nameZh: '深度求索',
    icon: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    keywords: ['deepseek']
  },
  'doubao': {
    id: 'doubao',
    nameEn: 'ByteDance Volcano Engine',
    nameZh: '字节 豆包',
    icon: 'doubao',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    keywords: ['doubao', 'volcengine', 'volcano']
  },
  'qwen': {
    id: 'qwen',
    nameEn: 'Alibaba Tongyi (Qwen)',
    nameZh: '阿里 通义千问',
    icon: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    keywords: ['qwen', 'tongyi', 'alibaba', 'dashscope']
  },
  'groq': {
    id: 'groq',
    nameEn: 'Groq',
    nameZh: 'Groq',
    icon: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keywords: ['groq']
  },
  'together': {
    id: 'together',
    nameEn: 'Together AI',
    nameZh: 'Together AI',
    icon: 'together',
    baseUrl: 'https://api.together.xyz/v1',
    keywords: ['together']
  },
  'fireworks': {
    id: 'fireworks',
    nameEn: 'Fireworks AI',
    nameZh: 'Fireworks AI',
    icon: 'fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    keywords: ['fireworks']
  },
  'mistral': {
    id: 'mistral',
    nameEn: 'Mistral AI',
    nameZh: 'Mistral AI',
    icon: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    keywords: ['mistral']
  },
  'siliconflow': {
    id: 'siliconflow',
    nameEn: 'SiliconFlow',
    nameZh: '硅基流动',
    icon: 'siliconflow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    keywords: ['siliconflow', 'silicon']
  },
  'huggingface': {
    id: 'huggingface',
    nameEn: 'Hugging Face Inference',
    nameZh: 'Hugging Face',
    icon: 'huggingface',
    baseUrl: 'https://api-inference.huggingface.co/v1',
    keywords: ['huggingface', 'hf']
  },
  'openrouter': {
    id: 'openrouter',
    nameEn: 'OpenRouter',
    nameZh: 'OpenRouter',
    icon: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keywords: ['openrouter']
  },
  'cerebras': {
    id: 'cerebras',
    nameEn: 'Cerebras',
    nameZh: 'Cerebras',
    icon: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    keywords: ['cerebras']
  },
  'perplexity': {
    id: 'perplexity',
    nameEn: 'Perplexity AI',
    nameZh: 'Perplexity',
    icon: 'perplexity',
    baseUrl: 'https://api.perplexity.ai',
    keywords: ['perplexity']
  },
  // 兼容旧配置
  'bailian': {
    id: 'bailian',
    nameEn: 'Alibaba Bailian',
    nameZh: '阿里百炼',
    icon: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    keywords: ['bailian']
  },
  'moonshot': {
    id: 'moonshot',
    nameEn: 'Moonshot AI',
    nameZh: '月之暗面 (Kimi)',
    icon: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    keywords: ['moonshot', 'kimi']
  },
  'zhipu': {
    id: 'zhipu',
    nameEn: 'Zhipu AI',
    nameZh: '智谱 AI',
    icon: 'zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    keywords: ['zhipu', 'glm']
  },
  'minimax': {
    id: 'minimax',
    nameEn: 'MiniMax',
    nameZh: 'MiniMax',
    icon: 'minimax',
    baseUrl: 'https://api.minimax.chat/v1',
    keywords: ['minimax']
  },
  'kimi': {
    id: 'kimi',
    nameEn: 'Moonshot AI (Kimi)',
    nameZh: '月之暗面 (Kimi)',
    icon: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    keywords: ['kimi', 'moonshot']
  }
}

// 模型名称映射表 - 将模型 ID 转换为友好的显示名称
const MODEL_NAME_MAP: Record<string, string> = {
  // OpenAI
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'gpt-4': 'GPT-4',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  'o1': 'o1',
  'o1-mini': 'o1 Mini',
  'o1-preview': 'o1 Preview',
  'o1-pro': 'o1 Pro',
  'o3': 'o3',
  'o3-mini': 'o3 Mini',
  'o4-mini': 'o4 Mini',
  'gpt-5': 'GPT-5',
  'gpt-5-mini': 'GPT-5 Mini',
  'gpt-5-nano': 'GPT-5 Nano',
  
  // Anthropic/Claude
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-opus-4-20250414': 'Claude Opus 4',
  'claude-3.5-sonnet': 'Claude 3.5 Sonnet',
  'claude-3.5-haiku': 'Claude 3.5 Haiku',
  'claude-3-opus': 'Claude 3 Opus',
  'claude-3-sonnet': 'Claude 3 Sonnet',
  'claude-3-haiku': 'Claude 3 Haiku',
  'claude-3.7-sonnet': 'Claude 3.7 Sonnet',
  
  // Google/Gemini
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
  'gemini-1.5-flash-8b': 'Gemini 1.5 Flash 8B',
  'gemini-pro': 'Gemini Pro',
  'gemini-pro-vision': 'Gemini Pro Vision',
  
  // DeepSeek
  'deepseek-chat': 'DeepSeek Chat',
  'deepseek-coder': 'DeepSeek Coder',
  'deepseek-reasoner': 'DeepSeek Reasoner',
  'deepseek-v3': 'DeepSeek V3',
  'deepseek-r1': 'DeepSeek R1',
  'deepseek-v2.5': 'DeepSeek V2.5',
  
  // Qwen/通义千问
  'qwen3.6-plus': 'Qwen 3.6 Plus',
  'qwen3.5-plus': 'Qwen 3.5 Plus',
  'qwen3.5-turbo': 'Qwen 3.5 Turbo',
  'qwen3-max': 'Qwen 3 Max',
  'qwen3-coder-plus': 'Qwen 3 Coder Plus',
  'qwen3-coder-next': 'Qwen 3 Coder Next',
  'qwen2.5-max': 'Qwen 2.5 Max',
  'qwen2.5-plus': 'Qwen 2.5 Plus',
  'qwen2.5-turbo': 'Qwen 2.5 Turbo',
  'qwen2.5-72b-instruct': 'Qwen 2.5 72B',
  'qwen2.5-32b-instruct': 'Qwen 2.5 32B',
  'qwen-vl-max': 'Qwen VL Max',
  'qwen-vl-plus': 'Qwen VL Plus',
  'qwen-audio-turbo': 'Qwen Audio Turbo',
  'qwen-math-plus': 'Qwen Math Plus',
  'qwq-32b': 'QwQ 32B',
  
  // 豆包
  'doubao-pro-32k': 'Doubao Pro 32K',
  'doubao-pro-128k': 'Doubao Pro 128K',
  'doubao-pro-256k': 'Doubao Pro 256K',
  'doubao-lite-32k': 'Doubao Lite 32K',
  'doubao-lite-128k': 'Doubao Lite 128K',
  'doubao-1.5-pro-32k': 'Doubao 1.5 Pro 32K',
  'doubao-1.5-vision-pro-32k': 'Doubao 1.5 Vision Pro 32K',
  
  // Moonshot/Kimi
  'moonshot-v1-8k': 'Moonshot V1 8K',
  'moonshot-v1-32k': 'Moonshot V1 32K',
  'moonshot-v1-128k': 'Moonshot V1 128K',
  'kimi-k2.5': 'Kimi K2.5',
  'kimi-k2': 'Kimi K2',
  'kimi-latest': 'Kimi Latest',
  'moonshot-v1': 'Moonshot V1',
  
  // 智谱
  'glm-5': 'GLM-5',
  'glm-4.7': 'GLM-4.7',
  'glm-4-plus': 'GLM-4 Plus',
  'glm-4': 'GLM-4',
  'glm-4-air': 'GLM-4 Air',
  'glm-4-airx': 'GLM-4 AirX',
  'glm-4-flash': 'GLM-4 Flash',
  'glm-4-flashx': 'GLM-4 FlashX',
  'glm-4v': 'GLM-4V',
  'glm-4v-plus': 'GLM-4V Plus',
  'glm-4-alltools': 'GLM-4 AllTools',
  'cogview-4': 'CogView 4',
  'cogview-3': 'CogView 3',
  
  // MiniMax
  'MiniMax-M2.5': 'MiniMax M2.5',
  'MiniMax-M1': 'MiniMax M1',
  'abab6.5-chat': 'ABAB 6.5 Chat',
  'abab6.5s-chat': 'ABAB 6.5S Chat',
  'abab5.5-chat': 'ABAB 5.5 Chat',
  'minimax-m1': 'MiniMax M1',
  
  // Mistral
  'mistral-large-latest': 'Mistral Large',
  'mistral-large-2411': 'Mistral Large 2411',
  'mistral-medium-latest': 'Mistral Medium',
  'mistral-small-latest': 'Mistral Small',
  'mistral-saba': 'Mistral Saba',
  'codestral-latest': 'Codestral',
  'codestral-2501': 'Codestral 2501',
  'pixtral-large': 'Pixtral Large',
  'pixtral-12b': 'Pixtral 12B',
  
  // Groq
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B',
  'mixtral-8x7b-32768': 'Mixtral 8x7B',
  'gemma2-9b-it': 'Gemma 2 9B',
  'llama-3.2-3b-preview': 'Llama 3.2 3B',
  'llama-3.2-11b-vision-preview': 'Llama 3.2 11B Vision',
  'llama-3.2-90b-vision-preview': 'Llama 3.2 90B Vision',
  
  // SiliconFlow
  'Qwen/Qwen2.5-72B-Instruct': 'Qwen 2.5 72B',
  'Qwen/Qwen2.5-32B-Instruct': 'Qwen 2.5 32B',
  'deepseek-ai/DeepSeek-V2.5': 'DeepSeek V2.5',
  'deepseek-ai/DeepSeek-V3': 'DeepSeek V3',
  'deepseek-ai/DeepSeek-R1': 'DeepSeek R1',
  
  // Meta/Llama
  'llama-3.3-70b': 'Llama 3.3 70B',
  'llama-3.2-90b': 'Llama 3.2 90B',
  'llama-3.1-405b': 'Llama 3.1 405B',
  'llama-3.1-70b': 'Llama 3.1 70B',
  'llama-3-70b': 'Llama 3 70B',
  
  // xAI/Grok
  'grok-3': 'Grok 3',
  'grok-3-mini': 'Grok 3 Mini',
  'grok-2': 'Grok 2',
  
  // Cohere
  'command-r-plus': 'Command R+',
  'command-r': 'Command R',
  'command': 'Command',
  
  // Databricks
  'databricks-dbrx-instruct': 'DBRX Instruct',
  
  // NVIDIA
  'nemotron-4': 'Nemotron 4',
  'nemotron-mini': 'Nemotron Mini',
}

// 获取模型友好名称
function getModelDisplayName(modelId: string, modelName?: string): string {
  // 第一优先级：如果有精确映射，使用映射名称
  if (MODEL_NAME_MAP[modelId]) {
    return MODEL_NAME_MAP[modelId]
  }
  
  // 第二优先级：如果配置中有 name 且与 id 不同，使用配置的 name
  if (modelName && modelName !== modelId) {
    return modelName
  }
  
  // 第三优先级：尝试美化模型 ID
  let displayName = modelId
  
  // 移除日期后缀 (如 -2026-01-23 或 -20250514)
  displayName = displayName.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-\d{8}$/, '')
  
  // 尝试通过模式匹配识别常见模型
  const patterns: [RegExp, string][] = [
    // OpenAI 模式
    [/^gpt[-\s]/i, 'GPT'],
    [/^o[1-9]/i, 'o'],
    
    // Claude 模式
    [/^claude/i, 'Claude'],
    
    // Gemini 模式
    [/^gemini/i, 'Gemini'],
    
    // Qwen 模式
    [/^qwen/i, 'Qwen'],
    [/^qwq/i, 'QwQ'],
    
    // GLM 模式
    [/^glm/i, 'GLM'],
    [/^cogview/i, 'CogView'],
    
    // DeepSeek 模式
    [/^deepseek/i, 'DeepSeek'],
    
    // Doubao 模式
    [/^doubao/i, 'Doubao'],
    
    // Moonshot/Kimi 模式
    [/^moonshot/i, 'Moonshot'],
    [/^kimi/i, 'Kimi'],
    
    // MiniMax 模式
    [/^minimax/i, 'MiniMax'],
    [/^abab/i, 'ABAB'],
    
    // Mistral 模式
    [/^mistral/i, 'Mistral'],
    [/^codestral/i, 'Codestral'],
    [/^pixtral/i, 'Pixtral'],
    
    // Llama 模式
    [/^llama/i, 'Llama'],
    
    // Grok 模式
    [/^grok/i, 'Grok'],
    
    // Command 模式
    [/^command/i, 'Command'],
    
    // Nemotron 模式
    [/^nemotron/i, 'Nemotron'],
    
    // DBRX 模式
    [/^dbrx/i, 'DBRX'],
    
    // Gemma 模式
    [/^gemma/i, 'Gemma'],
    
    // Mixtral 模式
    [/^mixtral/i, 'Mixtral'],
  ]
  
  for (const [pattern, prefix] of patterns) {
    if (pattern.test(displayName)) {
      // 提取版本号部分
      const versionPart = displayName.replace(pattern, '').replace(/^[-\s]+/, '')
      if (versionPart) {
        return `${prefix} ${versionPart.replace(/-/g, ' ')}`
      }
      return prefix
    }
  }
  
  // 默认处理：首字母大写，替换连字符为空格
  displayName = displayName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  
  return displayName
}

// 根据 baseUrl 识别厂商
function identifyVendorByBaseUrl(baseUrl: string): VendorInfo | null {
  if (!baseUrl) return null
  const normalizedUrl = baseUrl.toLowerCase().replace(/\/$/, '').trim()
  if (!normalizedUrl) return null
  
  for (const vendor of Object.values(VENDOR_INFO)) {
    const vendorBaseUrl = vendor.baseUrl.toLowerCase().replace(/\/$/, '').trim()
    if (!vendorBaseUrl) continue
    // 检查 baseUrl 是否匹配（支持子域名和路径匹配）
    if (normalizedUrl.includes(vendorBaseUrl) || vendorBaseUrl.includes(normalizedUrl)) {
      return vendor
    }
    // 额外检查：提取域名进行匹配
    try {
      const inputDomain = new URL(baseUrl).hostname.toLowerCase()
      const vendorDomain = new URL(vendor.baseUrl).hostname.toLowerCase()
      if (inputDomain === vendorDomain || inputDomain.endsWith('.' + vendorDomain.replace(/^\*\./, ''))) {
        return vendor
      }
    } catch {
      // URL 解析失败，继续
    }
  }
  return null
}

// 根据 providerId 和 baseUrl 获取厂商信息
// 优先级: baseUrl 识别 > providerId 精确匹配 > 关键词匹配
function getVendorInfo(providerId: string, baseUrl?: string): VendorInfo {
  // 第一优先级：从 baseUrl 识别供应商（最可靠）
  if (baseUrl && baseUrl.trim()) {
    const identified = identifyVendorByBaseUrl(baseUrl)
    if (identified) {
      return identified
    }
  }
  
  // 第二优先级：通过 providerId 精确查找
  if (VENDOR_INFO[providerId]) {
    return VENDOR_INFO[providerId]
  }
  
  // 第三优先级：通过关键词匹配 providerId
  const lowerId = providerId.toLowerCase()
  for (const vendor of Object.values(VENDOR_INFO)) {
    if (vendor.keywords.some(kw => lowerId.includes(kw) || kw.includes(lowerId))) {
      return vendor
    }
  }
  
  // 返回默认值
  return {
    id: providerId,
    nameEn: providerId.charAt(0).toUpperCase() + providerId.slice(1),
    nameZh: providerId.charAt(0).toUpperCase() + providerId.slice(1),
    icon: 'default',
    baseUrl: baseUrl || '',
    keywords: [providerId]
  }
}

export async function GET() {
  try {
    const homeDir = homedir()
    const configPath = join(homeDir, '.openclaw', 'openclaw.json')

    if (!existsSync(configPath)) {
      return NextResponse.json({
        providers: [],
        error: 'OpenClaw config not found'
      })
    }

    const configContent = readFileSync(configPath, 'utf-8')
    const config: OpenClawConfig = JSON.parse(configContent)

    const providers: {
      id: string
      name: string
      nameEn: string
      nameZh: string
      icon: string
      baseUrl: string
      latency: number | null
      models: {
        id: string
        name: string
        inUse: boolean
      }[]
      hasApiKey: boolean
      activated: boolean
      contextTokens?: number
    }[] = []

    // 获取当前使用的模型
    const primaryModel = config.agents?.defaults?.model?.primary || ''
    const usedModels = Object.keys(config.agents?.defaults?.models || {})

    // 解析供应商
    if (config.models?.providers) {
      // 创建所有供应商的基本信息，延迟暂时设为null
      for (const [providerId, provider] of Object.entries(config.models.providers)) {
        const providerBaseUrl = (provider as Provider).baseUrl || ''
        const vendorInfo = getVendorInfo(providerId, providerBaseUrl)
        const hasApiKey = !!(provider as Provider).apiKey

        // 检查该供应商下是否有模型在使用
        const providerModels = (provider as Provider).models || []

        const models = providerModels.map(model => ({
          id: model.id,
          name: getModelDisplayName(model.id, model.name),
          inUse: usedModels.includes(`${providerId}/${model.id}`) || primaryModel === `${providerId}/${model.id}`
        }))

        // 供应商已激活：有 API Key 或有 baseUrl 配置，且有模型配置
        const hasApiKeyOrConfig = hasApiKey || !!providerBaseUrl
        const activated = hasApiKeyOrConfig && models.length > 0

        providers.push({
          id: providerId,
          name: vendorInfo.nameZh, // 默认中文名称
          nameEn: vendorInfo.nameEn,
          nameZh: vendorInfo.nameZh,
          icon: vendorInfo.icon,
          baseUrl: providerBaseUrl || vendorInfo.baseUrl,
          latency: null, // 初始延迟值为null，稍后由前端通过ping测试获取
          models,
          hasApiKey,
          activated,
          contextTokens: config.agents?.defaults?.contextTokens || 0
        })
      }
    }

    return NextResponse.json({
      providers,
      primaryModel,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error reading OpenClaw config:', error)
    return NextResponse.json({
      providers: [],
      error: 'Failed to read OpenClaw config'
    }, { status: 500 })
  }
}