import { CANONICAL_REPOSITORY_ID, HISTORICAL_REPOSITORY, type HistoricalRepositoryIdentityProof } from './historical-repository-identity.ts'
import { isPositiveInteger, asString, type ContextCommandRunner } from './runtime.ts'
import type { NativeReviewEvidence, RoleEvidence } from './model.ts'

type JsonResult<T> = { value: T | null; error: string | null }
function readJson<T>(run: ContextCommandRunner, args: string[], cwd: string, env: NodeJS.ProcessEnv): JsonResult<T> {
  const result = run('gh', ['api', ...args], { cwd, env })
  if (result.status !== 0 || result.error) return { value: null, error: result.error?.message || result.stderr.trim() || result.stdout.trim() }
  try { return { value: JSON.parse(result.stdout.trim()) as T, error: null } } catch { return { value: null, error: 'invalid JSON' } }
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function sameId(left: unknown, right: unknown): boolean { return isPositiveInteger(left) && isPositiveInteger(right) && String(left) === String(right) }
function rows(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null
  const list = value.every(Array.isArray) ? value.flat() : value
  return list.every(record) ? list : null
}

export function createHistoricalRepositoryProofReader(repo: string, issueNumber: string, run: ContextCommandRunner, cwd: string, env: NodeJS.ProcessEnv) {
  let pair: { current: HistoricalRepositoryIdentityProof['currentRepository']; historical: HistoricalRepositoryIdentityProof['historicalRepository'] } | null | undefined
  const repositories = () => {
    if (pair !== undefined) return pair
    const currentUrl = `https://api.github.com/repos/${repo}`
    const currentResult = readJson<Record<string, unknown>>(run, [`repos/${repo}`], cwd, env).value
    const current = repository(currentResult, currentUrl, false)
    if (!current) return (pair = null)
    const historicalUrl = `https://api.github.com/repos/${HISTORICAL_REPOSITORY}`
    const historicalResult = readJson<Record<string, unknown>>(run, [`repos/${HISTORICAL_REPOSITORY}`], cwd, env).value
    const historical = repository(historicalResult, historicalUrl, true)
    if (!historical) return (pair = null)
    return (pair = { current, historical })
  }
  const repository = (value: unknown, requestedUrl: string, redirected: boolean) => {
    if (!record(value) || !sameId(value.id, CANONICAL_REPOSITORY_ID) || typeof value.url !== 'string' || value.full_name !== repo) return null
    const allowedUrls = redirected
      ? [requestedUrl, `https://api.github.com/repos/${repo}`]
      : [requestedUrl]
    if (!allowedUrls.includes(value.url)) return null
    return { id: value.id as string | number, fullName: value.full_name, url: value.url }
  }

  function attachComments(comments: RoleEvidence[]) {
    const counts = new Map<string, number>()
    for (const comment of comments) counts.set(String(comment.id), (counts.get(String(comment.id)) ?? 0) + 1)
    const historic = comments.filter(({ body }) => body.includes(HISTORICAL_REPOSITORY))
    const listProof = new Map<string, Record<string, unknown>>()
    let unambiguous = true
    for (const comment of historic) {
      if (!isPositiveInteger(comment.id) || counts.get(String(comment.id)) !== 1) { unambiguous = false; break }
      const id = String(comment.id)
      const issueUrl = `https://api.github.com/repos/${repo}/issues/${issueNumber}`
      const resourceUrl = `https://github.com/${repo}/issues/${issueNumber}#issuecomment-${id}`
      const listed = readJson<unknown>(run, [`--paginate`, `--slurp`, `repos/${repo}/issues/${issueNumber}/comments`], cwd, env)
      const sameIdRows = rows(listed.value)?.filter((row) => sameId(row.id, id)) ?? []
      if (sameIdRows.length !== 1 || sameIdRows[0]!.html_url !== resourceUrl || sameIdRows[0]!.body !== comment.body ||
          sameIdRows[0]!.issue_url !== issueUrl || comment.url !== resourceUrl) { unambiguous = false; break }
      listProof.set(id, sameIdRows[0]!)
    }
    if (!unambiguous) return
    for (const comment of historic) {
      if (!isPositiveInteger(comment.id) || counts.get(String(comment.id)) !== 1) continue
      const id = String(comment.id)
      const issueUrl = `https://api.github.com/repos/${repo}/issues/${issueNumber}`
      const resourceUrl = `https://github.com/${repo}/issues/${issueNumber}#issuecomment-${id}`
      if (!listProof.has(id)) continue
      const native = readJson<Record<string, unknown>>(run, [`repos/${repo}/issues/comments/${id}`], cwd, env).value
      const author = record(native?.user) ? asString(native.user.login) : null
      if (!record(native) || !sameId(native.id, id) || native.html_url !== resourceUrl || native.body !== comment.body ||
          !author || author.toLowerCase() !== (comment.authorLogin ?? '').toLowerCase() ||
          (comment.authorAssociation && native.author_association !== comment.authorAssociation) || native.issue_url !== issueUrl) continue
      const parent = readJson<Record<string, unknown>>(run, [`repos/${repo}/issues/${issueNumber}`], cwd, env).value
      if (!record(parent) || !sameId(parent.number, issueNumber) || !isPositiveInteger(parent.id) || parent.url !== issueUrl ||
          parent.html_url !== `https://github.com/${repo}/issues/${issueNumber}` || parent.repository_url !== `https://api.github.com/repos/${repo}`) continue
      const repositoriesProof = repositories()
      if (!repositoriesProof) continue
      comment.repositoryIdentityProof = {
        claim: HISTORICAL_REPOSITORY,
        resource: { id: native.id as number, url: resourceUrl, body: native.body as string },
        parent: { kind: 'issue', id: parent.id as number, url: issueUrl, repositoryUrl: parent.repository_url as string },
        currentRepository: repositoriesProof.current,
        historicalRepository: repositoriesProof.historical,
      }
    }
  }

  function attachReview(review: NativeReviewEvidence, listed: Record<string, unknown>[], prNumber: string): NativeReviewEvidence {
    if (!review.body.includes(HISTORICAL_REPOSITORY) || review.id === null || !review.url) return review
    const matchingRows = listed.filter((row) => sameId(row.id ?? row.database_id ?? row.databaseId, review.id))
    if (matchingRows.length !== 1) return review
    const row = matchingRows[0]!
    const native = readJson<Record<string, unknown>>(run, [`repos/${repo}/pulls/${prNumber}/reviews/${review.id}`], cwd, env).value
    const author = record(native?.user) ? asString(native.user.login) : null
    const listedAuthor = record(row.user) ? asString(row.user.login) : null
    const parentUrl = `https://api.github.com/repos/${repo}/pulls/${prNumber}`
    if (!record(native) || !sameId(native.id ?? native.database_id ?? native.databaseId, review.id) || native.html_url !== review.url ||
        native.state !== review.state || row.state !== review.state ||
        native.body !== review.body || native.commit_id !== review.commitId || native.pull_request_url !== parentUrl || !author || author !== listedAuthor ||
        row.html_url !== native.html_url || row.body !== native.body || row.pull_request_url !== native.pull_request_url || row.commit_id !== native.commit_id) return review
    const parent = readJson<Record<string, unknown>>(run, [`repos/${repo}/pulls/${prNumber}`], cwd, env).value
    const base = record(parent?.base) && record(parent.base.repo) ? parent.base.repo : null
    if (!record(parent) || !sameId(parent.number, prNumber) || !isPositiveInteger(parent.id) || parent.url !== parentUrl ||
        parent.html_url !== `https://github.com/${repo}/pull/${prNumber}` || !base || !sameId(base.id, CANONICAL_REPOSITORY_ID) ||
        base.full_name !== repo || base.url !== `https://api.github.com/repos/${repo}`) return review
    const repositoriesProof = repositories()
    if (!repositoriesProof) return review
    return {
      ...review,
      repositoryIdentityProof: {
        claim: HISTORICAL_REPOSITORY,
        resource: { id: review.id, url: review.url, body: review.body },
        parent: { kind: 'pull', id: parent.id as number, url: parentUrl, repositoryUrl: base.url as string },
        currentRepository: repositoriesProof.current,
        historicalRepository: repositoriesProof.historical,
      },
    }
  }
  return { attachComments, attachReview }
}
