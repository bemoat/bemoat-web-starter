import { hasStrictImmutableFindingDisposition } from './immutable-finding-disposition.ts'

const FULL_SHA_RE = /^[0-9a-f]{40}$/i
function stateConflict(message: string): Error {
  return new Error(`STATE_CONFLICT: ${message}`)
}

type CandidateBinding = {
  verdict: string | null
  pr: string | null
  base: string | null
  reviewed_head: string | null
  repository: string | null
  issue: string | null
}

/** Strict candidate-only shape validation called by the production parser. */
export function validateStrictReviewVerdictCandidate(body: string, binding: CandidateBinding): void {
  const lines = body.split(/\r?\n/)
  if (lines[0] !== '## REVIEW_VERDICT' || lines.filter((line) => line === '## REVIEW_VERDICT').length !== 1) {
    throw stateConflict('REVIEW_VERDICT candidate must start with exactly one canonical heading')
  }

  const one = (label: string, expression: RegExp): RegExpMatchArray => {
    const matches = [...body.matchAll(expression)]
    if (matches.length !== 1 || !matches[0]) {
      throw stateConflict(`REVIEW_VERDICT candidate requires exactly one canonical ${label} field`)
    }
    return matches[0]
  }
  const repositoryField = one('Repository', /^Repository:[ \t]*(?:`([^`\s]+)`|([^`\s]+))[ \t]*$/gm)
  const repository = repositoryField[1] ?? repositoryField[2] ?? ''
  const task = one('Task', /^Task:[ \t]*Issue #([1-9]\d*)[ \t]*$/gm)[1] ?? ''
  const verdict = one('Verdict', /^\*\*Verdict:\*\*[ \t]*(.+?)[ \t]*$/gm)[1] ?? ''
  const target = one('PR / base / head', /^\*\*PR \/ base \/ head:\*\*[ \t]*PR #([1-9]\d*) · `([^`\s]+)` · `([^`\s]+)`[ \t]*$/gm)
  const approvedBase = one('Approved base', /^\*\*Approved base:\*\*[ \t]*`([^`\s@]+)@([^`\s]+)`[ \t]*$/gm)
  const fieldOccurrences = (label: string): string[] => {
    const expression = new RegExp('^[ \\t]*(?:[-*+][ \\t]+)?(?:\\*\\*|__)?(?:' + label + ')(?:\\*\\*|__)?[ \\t]*:', 'i')
    return lines.filter((line) => expression.test(line))
  }
  const canonicalFields = [
    ['Repository', 'Repository'],
    ['Task', 'Task(?:\\s*\\/\\s*Issue)?'],
    ['Verdict', 'Verdict'],
    ['PR / base / head', 'PR\\s*\\/\\s*base\\s*\\/\\s*head'],
    ['Approved base', 'Approved\\s+base'],
  ] as const
  for (const [label, expression] of canonicalFields) {
    if (fieldOccurrences(expression).length !== 1) {
      throw stateConflict(`REVIEW_VERDICT candidate requires exactly one ${label} field occurrence`)
    }
  }
  const repositoryFields = [...body.matchAll(/^[ \t]*(?:-[ \t]*)?(?:\*\*|__)?Repository:(?:\*\*|__)?[ \t]*(?:`([^`\s]+)`|([^`\s]+))[ \t]*$/gim)]
  const taskFields = [...body.matchAll(/^[ \t]*(?:-[ \t]*)?(?:\*\*|__)?(?:Task\s*\/\s*Issue(?:\*\*|__)?(?::(?:\*\*|__)?)?|Task(?:\*\*|__)?:(?:\*\*|__)?)[ \t]*(.*)$/gim)]
  if (repositoryFields.length !== 1 || taskFields.length !== 1) {
    throw stateConflict('REVIEW_VERDICT candidate contains duplicate or alternate Repository or Task identity fields')
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
    !/^[1-9]\d*$/.test(task) || !['ELIGIBLE FOR FOUNDER REVIEW', 'CORRECTION REQUIRED'].includes(verdict)) {
    throw stateConflict('REVIEW_VERDICT candidate contains malformed or unsupported canonical data')
  }
  const baseBranch = target[2] ?? ''
  const reviewedHead = target[3] ?? ''
  const approvedBranch = approvedBase[1] ?? ''
  const approvedSha = approvedBase[2] ?? ''
  if (!FULL_SHA_RE.test(reviewedHead) || !FULL_SHA_RE.test(approvedSha) ||
    baseBranch !== approvedBranch || !baseBranch.trim()) {
    throw stateConflict('REVIEW_VERDICT candidate requires matching full reviewed-head and approved-base identities')
  }

  const supersedes = [...body.matchAll(/^[ \t]*(?:[-*+][ \t]+)?(?:\*\*|__)?(?:Supersedes|Supersedes review|Supersedes predecessor)(?:\*\*|__)?(?::(?:\*\*|__)?)?[ \t]*(.*)$/gim)]
  if (supersedes.length > 1 || (supersedes.length === 1 &&
    !/^\*\*Supersedes:\*\*[ \t]*[1-9]\d*[ \t]*$/.test(supersedes[0]?.[0] ?? ''))) {
    throw stateConflict('REVIEW_VERDICT candidate Supersedes field is malformed or duplicated')
  }

  const alternateCanonicalFields = [
    'PR(?![ \t]*/[ \t]*base[ \t]*/[ \t]*head)',
    'Exact\\s+reviewed\\s+head',
    'Exact\\s+head\\s+reviewed',
    'Branch',
  ]
  if (alternateCanonicalFields.some((label) => fieldOccurrences(label).length > 0)) {
    throw stateConflict('REVIEW_VERDICT candidate contains unsupported alternate identity fields')
  }

  if (binding.repository !== repository.toLowerCase() || binding.issue !== task ||
    binding.pr !== target[1] || binding.base !== baseBranch ||
    binding.reviewed_head?.toLowerCase() !== reviewedHead.toLowerCase() || binding.verdict !== verdict) {
    throw stateConflict('REVIEW_VERDICT candidate canonical identity fields are ambiguous or inconsistent')
  }

  const dispositionHeadings = [...body.matchAll(/^### Immutable finding disposition\s*$/gim)]
  if (verdict === 'CORRECTION REQUIRED') {
    if (dispositionHeadings.length !== 1) {
      throw stateConflict('CORRECTION REQUIRED requires exactly one immutable finding disposition')
    }
    const heading = dispositionHeadings[0]!
    const section = body.slice((heading.index ?? 0) + heading[0].length).trim().match(/^```json[ \t]*\r?\n([\s\S]*?)\r?\n```$/)?.[1]
    if (!section) throw stateConflict('immutable finding disposition must contain one JSON record')
    let parsed: unknown
    try {
      parsed = JSON.parse(section)
    } catch {
      throw stateConflict('immutable finding disposition JSON is malformed')
    }
    if (!hasStrictImmutableFindingDisposition(parsed, reviewedHead)) {
      throw stateConflict('immutable finding disposition does not match the production finding contract')
    }
  } else if (dispositionHeadings.length > 0) {
    throw stateConflict('immutable finding disposition is only supported for CORRECTION REQUIRED')
  }
}
