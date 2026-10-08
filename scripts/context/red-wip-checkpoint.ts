export const RED_WIP_APPROVAL_MARKER = '<!-- BEMOAT_RED_WIP_APPROVAL'
export const RED_WIP_COMMIT_PREFIX = 'WIP RED'

export type RedWipApproval = {
  schema_version: 1
  issue_number: string
  repository: string
  branch: string
  protected_base_sha: string
  test_path: string
  expected_failures: Array<{ test_name: string; expected_message: string }>
}

export type RedWipFailure = { name: string; file: string; message: string }

export type RedWipMutationState = {
  staged: boolean
  commitSha: string | null
  pushAttempted: boolean
  pushSucceeded: boolean
  readbackSha: string | null
}

export function createRedWipMutationState(): RedWipMutationState {
  return { staged: false, commitSha: null, pushAttempted: false, pushSucceeded: false, readbackSha: null }
}

export function redWipMutationPerformed(state: RedWipMutationState): boolean {
  return state.staged || state.commitSha !== null || state.pushSucceeded || state.readbackSha !== null
}

export type RedWipEvidence = {
  explicitOptIn: boolean
  issueNumber: string
  repository: string
  branch: string
  upstream: string
  localHead: string
  upstreamHead: string
  liveTopicHead: string
  protectedBaseSha: string
  liveProtectedBaseSha: string
  protectedBaseIsAncestor: boolean
  stagedPaths: string[]
  unstagedPaths: string[]
  untrackedPaths: string[]
  failures: RedWipFailure[]
  totalFailed: number
  totalPassed: number
}

export function parseRedWipApproval(issueBody: string, issueNumber: string): RedWipApproval {
  const matches = [...issueBody.matchAll(/<!-- BEMOAT_RED_WIP_APPROVAL\s*([\s\S]*?)\s*-->/g)]
  const markerCount = issueBody.split(RED_WIP_APPROVAL_MARKER).length - 1
  if (matches.length !== 1 || markerCount !== 1) {
    throw new Error('Issue must contain exactly one canonical RED WIP approval block.')
  }
  let value: unknown
  try {
    value = JSON.parse(matches[0][1])
  } catch {
    throw new Error('Issue RED WIP approval block must contain valid JSON.')
  }
  if (!isApproval(value) || value.issue_number !== issueNumber) {
    throw new Error('Issue RED WIP approval block has wrong identity or shape.')
  }
  if (!/^[^/\s:]+\/[^/\s:]+$/.test(value.repository)) {
    throw new Error('Issue RED WIP approval must bind a canonical repository identity.')
  }
  if (!/^\d+$/.test(value.issue_number) || !/^[0-9a-f]{40}$/i.test(value.protected_base_sha)) {
    throw new Error('Issue RED WIP approval block has an invalid Issue or protected-base SHA.')
  }
  if (!new RegExp(`^(fix|test)/${issueNumber}-[a-z0-9-]+$`).test(value.branch)) {
    throw new Error('Issue RED WIP approval must bind the same-Issue numbered task branch.')
  }
  if (!/^tests\/int\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.int\.spec\.ts$/.test(value.test_path)) {
    throw new Error('Issue RED WIP approval path must be a canonical integration-test path.')
  }
  const names = value.expected_failures.map(({ test_name }) => test_name)
  if (new Set(names).size !== names.length) {
    throw new Error('Issue RED WIP approval must not contain duplicate assertion identities.')
  }
  return value
}

export function validateRedWipCandidate(approval: RedWipApproval, evidence: RedWipEvidence): string[] {
  const reasons = validateRedWipCandidateState(approval, evidence)
  reasons.push(...validateRedWipFailureSet(approval, evidence.failures, evidence.totalFailed, evidence.totalPassed))
  return reasons
}

export function validateRedWipFailureSet(
  approval: RedWipApproval,
  failures: RedWipFailure[],
  totalFailed: number,
  totalPassed: number,
): string[] {
  const reasons: string[] = []
  const expected = new Map(approval.expected_failures.map(({ test_name, expected_message }) => [test_name, expected_message]))
  const actualNames = failures.map(({ name }) => name)
  if (totalFailed !== expected.size || failures.length !== expected.size) reasons.push('integration run must contain exactly the Issue-approved failed assertion set')
  if (new Set(actualNames).size !== actualNames.length) reasons.push('integration report contains duplicate failed assertion identities')
  if (actualNames.some((name) => !expected.has(name)) || [...expected.keys()].some((name) => !actualNames.includes(name))) {
    reasons.push('integration failures do not exactly match Issue approval')
  }
  for (const failure of failures) {
    const expectedMessage = expected.get(failure.name)
    if (failure.file !== approval.test_path || expectedMessage === undefined || !failure.message.includes(expectedMessage)) {
      reasons.push('a failed assertion does not exactly match Issue approval')
    }
  }
  if (totalPassed < 1) reasons.push('integration run must prove the remaining suite passed')
  return reasons
}

export function redWipCommitSubject(approval: RedWipApproval): string {
  const names = approval.expected_failures.map(({ test_name }) => test_name).join(', ')
  return `${RED_WIP_COMMIT_PREFIX} #${approval.issue_number}: ${names}`
}

export function validateRedWipCandidateState(approval: RedWipApproval, evidence: RedWipEvidence): string[] {
  const reasons: string[] = []
  if (!evidence.explicitOptIn) reasons.push('explicit RED WIP command opt-in is required')
  if (approval.issue_number !== evidence.issueNumber || approval.repository !== evidence.repository || approval.branch !== evidence.branch) {
    reasons.push('Issue approval does not bind the current repository, Issue, and branch')
  }
  if (!evidence.branch.includes(`/${evidence.issueNumber}-`) || evidence.upstream !== `origin/${evidence.branch}`) {
    reasons.push('current branch or upstream is not the canonical same-Issue topic branch')
  }
  if (!evidence.localHead || evidence.localHead !== evidence.upstreamHead || evidence.localHead !== evidence.liveTopicHead) {
    reasons.push('local, upstream, and live topic heads do not match')
  }
  if (approval.protected_base_sha !== evidence.protectedBaseSha || evidence.protectedBaseSha !== evidence.liveProtectedBaseSha || !evidence.protectedBaseIsAncestor) {
    reasons.push('approved protected base is stale or is not an ancestor of the topic branch')
  }
  if (evidence.stagedPaths.length) reasons.push('staged changes are not eligible for RED WIP recovery')
  if (evidence.untrackedPaths.length) reasons.push('untracked files make the candidate ambiguous')
  if (evidence.unstagedPaths.length !== 1 || evidence.unstagedPaths[0] !== approval.test_path) {
    reasons.push('only the exact Issue-approved test path may be modified')
  }
  return reasons
}

export function validateRedWipPush(input: {
  approval: RedWipApproval
  issueNumber: string
  repository: string
  branch: string
  localSha: string
  remoteSha: string
  localRef: string
  remoteRef: string
  parentSha: string
  commitSubject: string
  changedPaths: string[]
  pushedCommitCount: number
}): string[] {
  const reasons: string[] = []
  const { approval } = input
  if (input.pushedCommitCount !== 1) reasons.push('a RED WIP push must contain exactly one new commit')
  if (approval.issue_number !== input.issueNumber || approval.repository !== input.repository || approval.branch !== input.branch) {
    reasons.push('live Issue approval does not bind this push identity')
  }
  if (input.localRef !== `refs/heads/${input.branch}` || input.remoteRef !== `refs/heads/${input.branch}`) {
    reasons.push('pre-push local and remote refs must be the exact approved task branch')
  }
  if (input.commitSubject !== redWipCommitSubject(approval)) {
    reasons.push('commit subject is not the exact approved WIP RED label')
  }
  if (!input.remoteSha || input.parentSha !== input.remoteSha) reasons.push('RED WIP commit is not directly based on the live remote topic head')
  if (input.changedPaths.length !== 1 || input.changedPaths[0] !== approval.test_path) {
    reasons.push('pushed commit contains paths outside Issue approval')
  }
  if (!/^[0-9a-f]{40}$/i.test(input.localSha)) reasons.push('pushed commit SHA is invalid')
  return reasons
}

export function validateRedWipReadback(expectedSha: string, liveSha: string): string[] {
  return expectedSha && expectedSha === liveSha ? [] : ['live remote topic SHA does not exactly match the pushed checkpoint']
}

function isApproval(value: unknown): value is RedWipApproval {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const requiredKeys = ['schema_version', 'issue_number', 'repository', 'branch', 'protected_base_sha', 'test_path', 'expected_failures']
  return Object.keys(record).length === requiredKeys.length && requiredKeys.every((key) => key in record) &&
    record.schema_version === 1 &&
    ['issue_number', 'repository', 'branch', 'protected_base_sha', 'test_path']
      .every((key) => typeof record[key] === 'string' && record[key].trim() !== '') &&
    Array.isArray(record.expected_failures) && record.expected_failures.length > 0 && record.expected_failures.every((failure) =>
      typeof failure === 'object' && failure !== null && !Array.isArray(failure) && Object.keys(failure).length === 2 &&
      typeof failure.test_name === 'string' && failure.test_name.trim() !== '' &&
      typeof failure.expected_message === 'string' && failure.expected_message.trim() !== '')
}
