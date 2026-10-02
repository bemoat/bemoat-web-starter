/**
 * Deterministic PR-to-Issue ownership contract shared by Context and Handoff.
 *
 * Authority is merged repository policy plus GitHub native closing references.
 * Inherited matcher tokens are not authority.
 *
 * Authoritative ownership:
 * - native `closingIssuesReferences` when Issue identity agrees and repository
 *   identity agrees or is omitted.
 *
 * Uniquely authorized explicit textual ownership forms:
 * - GitHub closing keywords that native `closingIssuesReferences` encodes
 *   (`close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved`)
 * - AGENTS.md / workflow non-closing linkage (`Part of #<n>`, `Refs #<n>`)
 *
 * Not ownership evidence:
 * - bare/generic `Issue #N`
 * - `related to`, `references`, singular `ref`
 * - `task issue`
 * - incidental prose in regression notes, acceptance audits, history,
 *   dependencies, or scope descriptions that lacks an authorized relation
 */

export const AUTHORIZED_TEXTUAL_PR_ISSUE_RELATIONS = Object.freeze([
  'part of',
  'refs',
  'close',
  'closes',
  'closed',
  'fix',
  'fixes',
  'fixed',
  'resolve',
  'resolves',
  'resolved',
] as const)

const NEGATIVE_OWNERSHIP_PREFIX =
  /(?:no|not|without|except|excluding|does not include|out of scope)[\s:,-]*$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function nativeRepositoryIdentityMatches(repository: unknown, repo: string): boolean {
  if (!isRecord(repository)) return false

  const expectedParts = repo.split('/')
  if (expectedParts.length !== 2 || expectedParts.some((part) => !part)) return false
  const [expectedOwner, expectedName] = expectedParts
  const hasNameWithOwner = hasOwn(repository, 'nameWithOwner')
  const hasOwner = hasOwn(repository, 'owner')
  const hasName = hasOwn(repository, 'name')
  const hasUrl = hasOwn(repository, 'url')

  if (hasNameWithOwner && repository.nameWithOwner !== repo) return false

  if (hasOwner !== hasName) return false
  if (hasOwner) {
    if (!isRecord(repository.owner) || repository.owner.login !== expectedOwner || repository.name !== expectedName) return false
  }

  if (hasUrl) {
    if (typeof repository.url !== 'string') return false
    try {
      const url = new URL(repository.url)
      if (
        url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port !== '' ||
        url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '' ||
        ![`/${repo}`, `/${repo}/`].includes(url.pathname)
      ) return false
    } catch {
      return false
    }
  }

  // The URL can corroborate a repository identity, but cannot establish one alone.
  return hasNameWithOwner || hasOwner && hasName
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function nativeClosingIssuesOwnIssue(
  closingIssuesReferences: unknown,
  repo: string,
  issueNumber: string,
): boolean {
  if (!Array.isArray(closingIssuesReferences)) return false
  return closingIssuesReferences.some((value) => {
    if (!isRecord(value)) return false
    if (String(value.number ?? '') !== issueNumber) return false
    if (!hasOwn(value, 'repository')) return true
    return nativeRepositoryIdentityMatches(value.repository, repo)
  })
}

function textualRelationPattern(repo: string, issueNumber: string): RegExp {
  const alternation = [...AUTHORIZED_TEXTUAL_PR_ISSUE_RELATIONS]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|')
  const escapedRepo = escapeRegExp(repo)
  return new RegExp(
    `(?<![A-Za-z])(?:${alternation})(?![A-Za-z])\\s*(?:${escapedRepo})?\\s*#${issueNumber}\\b`,
    'gi',
  )
}

function authorizedTextualRelationOwnsIssue(
  title: unknown,
  body: unknown,
  repo: string,
  issueNumber: string,
): boolean {
  const haystack = `${String(title ?? '')}\n${String(body ?? '')}`
  const relation = textualRelationPattern(repo, issueNumber)
  let match
  while ((match = relation.exec(haystack)) !== null) {
    const prefix = haystack.substring(Math.max(0, match.index - 30), match.index)
    if (!NEGATIVE_OWNERSHIP_PREFIX.test(prefix)) return true
  }
  return false
}

export function prOwnsIssue(
  record: {
    title?: unknown
    body?: unknown
    closingIssuesReferences?: unknown
  },
  repo: string,
  issueNumber: string,
): boolean {
  if (nativeClosingIssuesOwnIssue(record.closingIssuesReferences, repo, issueNumber)) return true
  return authorizedTextualRelationOwnsIssue(record.title, record.body, repo, issueNumber)
}
