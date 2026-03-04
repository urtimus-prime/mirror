import { Marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { markedEmoji } from 'marked-emoji'
import { gemoji } from 'gemoji'
import sanitizeHtml from 'sanitize-html'

// Build unicode emoji map from gemoji
const emojis: Record<string, string> = {}
for (const gem of gemoji) {
  for (const name of gem.names) {
    emojis[name] = gem.emoji
  }
}

const skillMarked = new Marked()
skillMarked.use(gfmHeadingId())
skillMarked.use(markedEmoji({ emojis, renderer: (token: any) => token.emoji }))

// --- Types ---

export interface SkillNodeData {
  id: string
  skillName: string
  skillDescription: string
  category: string
  tier: number
  skillState: 'locked' | 'available' | 'unlocked' | 'maxed'
  iconEmoji: string
  maxLevel: number
  currentLevel: number
  prerequisiteIds: string[]
  x: number
  y: number
  skillContent: string // rendered SKILL.md HTML
  relatedFiles: string[] // other files in the skill directory
}

export interface SkillConnectorData {
  sourceId: string
  targetId: string
  isActive: boolean
}

export interface SkillTreeData {
  nodes: SkillNodeData[]
  connectors: SkillConnectorData[]
  username: string
  provider: string
}

// --- Layout (ported from skill-tree-layout.ts) ---

const TIER_SPACING_Y = 180
const NODE_SPACING_X = 160

function computeLayout(nodes: { id: string; tier: number }[]): Map<string, { x: number; y: number }> {
  const tiers = new Map<number, { id: string; tier: number }[]>()
  for (const node of nodes) {
    const list = tiers.get(node.tier) ?? []
    list.push(node)
    tiers.set(node.tier, list)
  }

  // Find max tier width to center everything
  let maxCount = 0
  for (const tierNodes of tiers.values()) {
    if (tierNodes.length > maxCount) maxCount = tierNodes.length
  }
  const centerX = Math.max(400, (maxCount * NODE_SPACING_X) / 2 + 100)

  const result = new Map<string, { x: number; y: number }>()
  const startY = 100

  for (const [tier, tierNodes] of tiers) {
    const count = tierNodes.length
    const totalWidth = (count - 1) * NODE_SPACING_X
    const startX = centerX - totalWidth / 2

    for (let i = 0; i < tierNodes.length; i++) {
      result.set(tierNodes[i].id, {
        x: startX + i * NODE_SPACING_X,
        y: startY + tier * TIER_SPACING_Y,
      })
    }
  }

  return result
}

// --- GitHub/GitLab fetching ---

interface SkillJson {
  name?: string
  icon?: string
  description?: string
  maxLevel?: number
  currentLevel?: number
}

interface RawSkillEntry {
  dirPath: string // e.g. "skills/combat/slash"
  skillJson: SkillJson
  skillMd: string
  relatedFiles: string[]
  tier: number
  category: string
  parentPath: string | null
}

async function fetchGitHubTree(username: string): Promise<{ path: string; type: string }[] | null> {
  const url = `https://api.github.com/repos/${username}/${username}/git/trees/HEAD?recursive=1`
  const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' }
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`
  }
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) return null
    const data = await res.json()
    return (data.tree || []).filter((item: any) =>
      typeof item.path === 'string' && item.path.startsWith('skills/')
    )
  } catch {
    return null
  }
}

async function fetchGitLabTree(provider: string, username: string): Promise<{ path: string; type: string }[] | null> {
  const projectId = encodeURIComponent(`${username}/${username}`)
  const url = `https://${provider}/api/v4/projects/${projectId}/repository/tree?recursive=true&path=skills&per_page=100`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return (data || []).map((item: any) => ({
      path: item.path,
      type: item.type === 'tree' ? 'tree' : 'blob',
    }))
  } catch {
    return null
  }
}

async function fetchRawFile(provider: string, username: string, filePath: string): Promise<string | null> {
  let url: string
  if (provider === 'github.com') {
    url = `https://raw.githubusercontent.com/${username}/${username}/main/${filePath}`
  } else {
    url = `https://${provider}/${username}/${username}/-/raw/main/${filePath}`
  }
  try {
    let res = await fetch(url)
    if (!res.ok && provider === 'github.com') {
      // try master branch
      url = `https://raw.githubusercontent.com/${username}/${username}/master/${filePath}`
      res = await fetch(url)
    } else if (!res.ok) {
      url = `https://${provider}/${username}/${username}/-/raw/master/${filePath}`
      res = await fetch(url)
    }
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function deriveState(entry: RawSkillEntry, allEntries: Map<string, RawSkillEntry>): 'locked' | 'available' | 'unlocked' | 'maxed' {
  const { currentLevel = 0, maxLevel = 1 } = entry.skillJson
  if (currentLevel >= maxLevel) return 'maxed'
  if (currentLevel > 0) return 'unlocked'

  // Check if all prerequisites are unlocked/maxed
  if (entry.parentPath) {
    const parent = allEntries.get(entry.parentPath)
    if (parent) {
      const parentState = deriveState(parent, allEntries)
      if (parentState === 'unlocked' || parentState === 'maxed') {
        return 'available'
      }
      return 'locked'
    }
  }

  // Top-level skills are always available
  return 'available'
}

export async function fetchSkillTree(provider: string, username: string): Promise<SkillTreeData | null> {
  // Check cache
  let kv: any = null
  try {
    const kvModule = await import('@vercel/kv')
    kv = kvModule.kv
  } catch { /* KV not available locally */ }

  const cacheKey = `skills:${provider}:${username}`
  if (kv) {
    try {
      const cached = await kv.get(cacheKey)
      if (cached) return cached as SkillTreeData
    } catch { /* ignore cache errors */ }
  }

  // Fetch tree
  let treeItems: { path: string; type: string }[] | null = null
  if (provider === 'github.com') {
    treeItems = await fetchGitHubTree(username)
  } else {
    treeItems = await fetchGitLabTree(provider, username)
  }

  if (!treeItems || treeItems.length === 0) return null

  // Find all skill.json files
  const skillJsonPaths = treeItems
    .filter(item => item.type === 'blob' && item.path.endsWith('/skill.json'))
    .map(item => item.path)

  if (skillJsonPaths.length === 0) return null

  // Build a set of all file paths for related files lookup
  const allFilePaths = new Set(treeItems.filter(i => i.type === 'blob').map(i => i.path))

  // Fetch all skill.json and SKILL.md files in parallel
  const rawEntries = new Map<string, RawSkillEntry>()

  await Promise.all(skillJsonPaths.map(async (jsonPath) => {
    const dirPath = jsonPath.replace(/\/skill\.json$/, '')
    const parts = dirPath.replace(/^skills\//, '').split('/')
    const tier = parts.length - 1
    const category = parts[0]
    const parentPath = tier > 0 ? 'skills/' + parts.slice(0, -1).join('/') : null

    // Fetch skill.json
    const jsonContent = await fetchRawFile(provider, username, jsonPath)
    if (!jsonContent) return

    let skillJson: SkillJson
    try {
      skillJson = JSON.parse(jsonContent)
    } catch {
      return
    }

    // Fetch SKILL.md
    const mdPath = dirPath + '/SKILL.md'
    const mdContent = await fetchRawFile(provider, username, mdPath)

    // Find related files in this directory (exclude skill.json and SKILL.md)
    const relatedFiles = treeItems!
      .filter(item => {
        if (item.type !== 'blob') return false
        if (!item.path.startsWith(dirPath + '/')) return false
        const relative = item.path.slice(dirPath.length + 1)
        // Only direct children, not nested
        if (relative.includes('/')) return false
        if (relative === 'skill.json' || relative === 'SKILL.md') return false
        return true
      })
      .map(item => item.path.slice(dirPath.length + 1))

    rawEntries.set(dirPath, {
      dirPath,
      skillJson,
      skillMd: mdContent || '',
      relatedFiles,
      tier,
      category,
      parentPath,
    })
  }))

  if (rawEntries.size === 0) return null

  // Build node list with layout
  const nodeStubs = Array.from(rawEntries.values()).map(e => ({
    id: e.dirPath,
    tier: e.tier,
  }))

  const layoutMap = computeLayout(nodeStubs)

  // Build nodes
  const nodes: SkillNodeData[] = []
  for (const [dirPath, entry] of rawEntries) {
    const layout = layoutMap.get(dirPath)
    if (!layout) continue

    const state = deriveState(entry, rawEntries)

    // Render SKILL.md
    let skillContent = ''
    if (entry.skillMd) {
      const rawHtml = await skillMarked.parse(entry.skillMd)
      skillContent = sanitizeHtml(rawHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li',
          'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
          'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre',
        ]),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          '*': ['class', 'id'],
          'a': ['href', 'name', 'target', 'rel'],
          'img': ['src', 'alt'],
        },
      })
    }

    nodes.push({
      id: dirPath,
      skillName: entry.skillJson.name || entry.dirPath.split('/').pop() || 'Unknown',
      skillDescription: entry.skillJson.description || '',
      category: entry.category,
      tier: entry.tier,
      skillState: state,
      iconEmoji: entry.skillJson.icon || '',
      maxLevel: entry.skillJson.maxLevel || 1,
      currentLevel: entry.skillJson.currentLevel || 0,
      prerequisiteIds: entry.parentPath ? [entry.parentPath] : [],
      x: layout.x,
      y: layout.y,
      skillContent,
      relatedFiles: entry.relatedFiles,
    })
  }

  // Build connectors
  const connectors: SkillConnectorData[] = []
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  for (const node of nodes) {
    for (const prereqId of node.prerequisiteIds) {
      const source = nodeMap.get(prereqId)
      if (source) {
        connectors.push({
          sourceId: prereqId,
          targetId: node.id,
          isActive: source.skillState === 'unlocked' || source.skillState === 'maxed',
        })
      }
    }
  }

  const result: SkillTreeData = { nodes, connectors, username, provider }

  // Cache for 5 minutes
  if (kv) {
    try {
      await kv.set(cacheKey, result, { ex: 300 })
    } catch { /* ignore */ }
  }

  return result
}

// Check if a user has a skills/ directory (lightweight check for profile page link)
export async function hasSkillTree(provider: string, username: string): Promise<boolean> {
  if (provider === 'github.com') {
    const url = `https://api.github.com/repos/${username}/${username}/contents/skills`
    const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' }
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`
    }
    try {
      const res = await fetch(url, { headers })
      return res.ok
    } catch {
      return false
    }
  } else {
    const projectId = encodeURIComponent(`${username}/${username}`)
    const url = `https://${provider}/api/v4/projects/${projectId}/repository/tree?path=skills&per_page=1`
    try {
      const res = await fetch(url)
      if (!res.ok) return false
      const data = await res.json()
      return Array.isArray(data) && data.length > 0
    } catch {
      return false
    }
  }
}
