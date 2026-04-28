import { NextResponse } from 'next/server'

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  html_url: string
  published_at: string
}

const REPO_URL = 'https://api.github.com/repos/leonardozhe/YSK-OpenClaw-Dashboard'
const CURRENT_VERSION = '2.4'

// Cache for 24 hours
let cachedRelease: { version: string; data: GitHubRelease | null; timestamp: number } | null = null
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// 比较版本号（支持 x.y.z 格式）
function compareVersions(a: string, b: string): number {
  const normalize = (v: string) => v.replace(/^v/, '')
  const partsA = normalize(a).split('.').map(Number)
  const partsB = normalize(b).split('.').map(Number)
  
  const maxLen = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0
    if (numA > numB) return 1
    if (numA < numB) return -1
  }
  return 0
}

export async function GET() {
  try {
    // Check cache (24 hours)
    if (cachedRelease && Date.now() - cachedRelease.timestamp < CACHE_TTL) {
      return NextResponse.json({
        currentVersion: CURRENT_VERSION,
        latestVersion: cachedRelease.version,
        hasUpdate: compareVersions(cachedRelease.version, CURRENT_VERSION) > 0,
        release: cachedRelease.data,
        cached: true
      })
    }

    const response = await fetch(`${REPO_URL}/releases/latest`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MeetClaw-Dashboard'
      },
      // 5 second timeout
      signal: AbortSignal.timeout(5000)
    })

    if (response.status === 404) {
      // No releases found, return current version
      return NextResponse.json({
        currentVersion: CURRENT_VERSION,
        latestVersion: CURRENT_VERSION,
        hasUpdate: false,
        release: null,
        cached: false
      })
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const release: GitHubRelease = await response.json()
    const latestVersion = release.tag_name.replace(/^v/, '')
    
    const hasUpdate = compareVersions(latestVersion, CURRENT_VERSION) > 0

    // Update cache
    cachedRelease = {
      version: latestVersion,
      data: release,
      timestamp: Date.now()
    }

    return NextResponse.json({
      currentVersion: CURRENT_VERSION,
      latestVersion: latestVersion,
      hasUpdate,
      release: hasUpdate ? {
        tag_name: release.tag_name,
        name: release.name,
        body: release.body,
        html_url: release.html_url,
        published_at: release.published_at
      } : null,
      cached: false
    })
  } catch (error) {
    console.error('Failed to check for updates:', error)
    
    // Return cached data if available
    if (cachedRelease) {
      return NextResponse.json({
        currentVersion: CURRENT_VERSION,
        latestVersion: cachedRelease.version,
        hasUpdate: compareVersions(cachedRelease.version, CURRENT_VERSION) > 0,
        release: cachedRelease.data,
        cached: true,
        error: 'Using cached data'
      })
    }

    return NextResponse.json({
      currentVersion: CURRENT_VERSION,
      latestVersion: null,
      hasUpdate: false,
      release: null,
      error: 'Failed to check for updates'
    }, { status: 500 })
  }
}
