import type { PolicyEvidence } from './model.ts'
import { json, type ContextCommandRunner } from './runtime.ts'

export interface ProtectedPolicyResult {
  branch: string
  sha: string | null
  policy: PolicyEvidence | null
  errors: string[]
}

export function parseProtectedPolicyContent({ repo, branch, sha, content }: {
  repo: string
  branch: string
  sha: string
  content: string
}): PolicyEvidence | null {
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/)
  const policyId = frontmatter ? frontmatterValue(frontmatter[1], 'policy_id') : null
  const version = frontmatter ? frontmatterValue(frontmatter[1], 'version') : null
  const canonicalRepository = frontmatter ? uniqueFrontmatterValue(frontmatter[1], 'canonical_repository') : null
  const trustedFounderLogin = frontmatter ? uniqueFrontmatterValue(frontmatter[1], 'trusted_founder_login') : null
  const legacyStopText = frontmatter ? uniqueFrontmatterValue(frontmatter[1], 'legacy_stop_handoffs') : null
  const legacyStopEntries = legacyStopText ? legacyStopText.split(',').map((entry) => entry.trim()) : []
  const legacyStopHandoffs = canonicalRepository === repo && legacyStopEntries.length > 0 &&
    legacyStopEntries.every((entry) => /^[1-9]\d*:[1-9]\d*:[0-9a-f]{40}:[0-9a-f]{64}$/.test(entry)) &&
    new Set(legacyStopEntries).size === legacyStopEntries.length
    ? legacyStopEntries : []
  if (!policyId || !version) return null
  return {
    path: 'docs/mission-control/mission-control-guide.md',
    policyId,
    version,
    trustedFounderLogin: canonicalRepository === repo && trustedFounderLogin && /^[A-Za-z0-9-]+$/.test(trustedFounderLogin)
      ? trustedFounderLogin : null,
    legacyStopHandoffs,
    sourceSha: sha,
    url: `https://github.com/${repo}/blob/${branch}/docs/mission-control/mission-control-guide.md`,
  }
}

function frontmatterValue(content: string, key: string): string | null {
  return content.match(new RegExp(`^${key}:\\s*([^\\n]+)\\s*$`, 'mi'))?.[1]?.trim() ?? null
}

function uniqueFrontmatterValue(content: string, key: string): string | null {
  const lines = content.split('\n').filter((line) => new RegExp(`^${key}\\s*:`, 'i').test(line))
  return lines.length === 1 ? lines[0]!.replace(new RegExp(`^${key}\\s*:`, 'i'), '').trim() : null
}

export function readProtectedPolicy({ repo, baseBranch, run, cwd = process.cwd(), env = process.env }: {
  repo: string
  baseBranch: string
  run: ContextCommandRunner
  cwd?: string
  env?: NodeJS.ProcessEnv
}): ProtectedPolicyResult {
  const errors: string[] = []
  const ref = json<{ object?: { sha?: string } }>(run, 'gh', ['api', `repos/${repo}/git/ref/heads/${baseBranch}`], { cwd, env })
  const sha = ref.value?.object?.sha ?? null
  if (!sha) errors.push(`BLOCKED_EXTERNAL: protected ${baseBranch} SHA is unavailable${ref.error ? ` (${ref.error})` : ''}`)
  const content = sha
    ? json<{ sha?: string; content?: string; encoding?: string }>(run, 'gh', ['api', `repos/${repo}/contents/docs/mission-control/mission-control-guide.md?ref=${sha}`], { cwd, env })
    : { value: null, error: 'protected base SHA is unavailable' }
  let policy: PolicyEvidence | null = null
  if (!content.value?.content || content.value.encoding !== 'base64' || !content.value.sha) {
    errors.push(`BLOCKED_EXTERNAL: canonical policy source is unavailable${content.error ? ` (${content.error})` : ''}`)
  } else {
    const decoded = Buffer.from(content.value.content.replace(/\s/g, ''), 'base64').toString('utf8')
    policy = parseProtectedPolicyContent({ repo, branch: sha!, sha: content.value.sha, content: decoded })
    if (!policy) errors.push('EVIDENCE_CONFLICT: canonical policy frontmatter is missing policy_id or version')
  }
  return { branch: baseBranch, sha, policy, errors }
}
