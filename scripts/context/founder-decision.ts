export interface FounderDecisionRecord {
  schema_version: 1
  record_type: 'FOUNDER_DECISION'
  repository: string
  issue_number: string
  pr_number: null
  branch: string
  exact_head: string
  protected_base: { branch: string; sha: string }
  policy: { path: string; policy_id: string; version: string; source_sha: string }
  source_founder_gate: { comment_id: string; url: string }
  decision: 'PROCEED'
  authority: { role: 'FOUNDER'; login: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).sort().join('\u0000') === [...expected].sort().join('\u0000')
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isFounderDecisionRecord(value: unknown): value is FounderDecisionRecord {
  if (!isRecord(value) || !hasExactKeys(value, [
    'schema_version', 'record_type', 'repository', 'issue_number', 'pr_number', 'branch', 'exact_head',
    'protected_base', 'policy', 'source_founder_gate', 'decision', 'authority',
  ])) return false
  const protectedBase = value.protected_base
  const policy = value.policy
  const sourceGate = value.source_founder_gate
  const authority = value.authority
  return value.schema_version === 1 && value.record_type === 'FOUNDER_DECISION' &&
    nonEmptyString(value.repository) && nonEmptyString(value.issue_number) && value.pr_number === null &&
    nonEmptyString(value.branch) && nonEmptyString(value.exact_head) &&
    isRecord(protectedBase) && hasExactKeys(protectedBase, ['branch', 'sha']) &&
    nonEmptyString(protectedBase.branch) && nonEmptyString(protectedBase.sha) &&
    isRecord(policy) && hasExactKeys(policy, ['path', 'policy_id', 'version', 'source_sha']) &&
    nonEmptyString(policy.path) && nonEmptyString(policy.policy_id) && nonEmptyString(policy.version) &&
    nonEmptyString(policy.source_sha) &&
    isRecord(sourceGate) && hasExactKeys(sourceGate, ['comment_id', 'url']) &&
    nonEmptyString(sourceGate.comment_id) && nonEmptyString(sourceGate.url) &&
    value.decision === 'PROCEED' &&
    isRecord(authority) && hasExactKeys(authority, ['role', 'login']) &&
    authority.role === 'FOUNDER' && nonEmptyString(authority.login)
}

export function parseFounderDecisionComment(body: string): FounderDecisionRecord | null {
  const fence = '`'.repeat(3)
  const prefix = `## FOUNDER_DECISION\n\n${fence}json\n`
  const suffix = `\n${fence}\n`
  if (!body.startsWith(prefix) || !body.endsWith(suffix)) return null

  let value: unknown
  try {
    value = JSON.parse(body.slice(prefix.length, -suffix.length))
  } catch {
    return null
  }
  if (!isFounderDecisionRecord(value)) return null

  const canonical = `## FOUNDER_DECISION\n\n${fence}json\n${JSON.stringify(value, null, 2)}\n${fence}\n`
  return canonical === body ? value : null
}
