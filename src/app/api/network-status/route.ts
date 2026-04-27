import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface NetworkStatus {
  tailscale: {
    running: boolean
    ip: string | null
    status: string | null
  }
  zerotier: {
    running: boolean
    ip: string | null
    networks: Array<{ networkId: string; status: string }>
  }
}

export async function GET() {
  const result: NetworkStatus = {
    tailscale: { running: false, ip: null, status: null },
    zerotier: { running: false, ip: null, networks: [] }
  }

  // 检测 Tailscale
  try {
    const { stdout } = await execAsync('tailscale status --json 2>/dev/null || tailscale ip -4 2>/dev/null || echo "NOT_RUNNING"', { timeout: 5000 })
    if (!stdout.includes('NOT_RUNNING')) {
      result.tailscale.running = true
      // 尝试获取 IP
      const ipMatch = stdout.match(/(\d+\.\d+\.\d+\.\d+)/)
      if (ipMatch) result.tailscale.ip = ipMatch[1]
      // 尝试获取状态
      const statusMatch = stdout.match(/"Status":\s*"(\w+)"/)
      if (statusMatch) result.tailscale.status = statusMatch[1]
    }
  } catch {
    // Tailscale 未安装或未运行
  }

  // 检测 ZeroTier
  try {
    const { stdout: ztStatus } = await execAsync('zerotier-cli info 2>/dev/null || echo "NOT_RUNNING"', { timeout: 5000 })
    if (!ztStatus.includes('NOT_RUNNING') && !ztStatus.includes('cannot')) {
      result.zerotier.running = true
      // 获取 IP
      const ipMatch = ztStatus.match(/(\d+\.\d+\.\d+\.\d+)/)
      if (ipMatch) result.zerotier.ip = ipMatch[1]
      
      // 获取网络列表
      try {
        const { stdout: ztNetworks } = await execAsync('zerotier-cli listnetworks -j 2>/dev/null || echo "[]"', { timeout: 5000 })
        const networks = JSON.parse(ztNetworks.trim())
        if (Array.isArray(networks)) {
          result.zerotier.networks = networks
            .filter((n: any) => n.status === 'OK' || n.status === 'ACCESS_DENIED')
            .map((n: any) => ({
              networkId: n.nwid || '',
              status: n.status || 'UNKNOWN'
            }))
        }
      } catch {}
    }
  } catch {
    // ZeroTier 未安装或未运行
  }

  return NextResponse.json(result)
}
