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
export type RedWipSuiteReport = {
  numFailedTests: number
  numPassedTests: number
  numFailedTestSuites: number
  unhandledErrors?: unknown[]
  suites: Array<{
    file: string
    status: string
    assertions: Array<{ status: string; name: string; message: string }>
    error?: string
    failureMessage?: string
  }>
}

export type RedWipRunnerTaskReport = {
  unhandledErrors: string[]
  tasks: Array<{
    type: string
    name: string
    fullName: string
    state: string
    errors: string[]
    children: RedWipRunnerTaskReport['tasks']
  }>
}

type VitestTaskLike = {
  type?: string
  name?: string
  relativeModuleId?: string
  task?: VitestTaskLike
  result?: { state?: string; errors?: unknown[] } | (() => { state?: string; errors?: unknown[] })
  errors?: () => unknown[]
  children?: { array?: () => VitestTaskLike[] }
  tasks?: VitestTaskLike[]
  state?: () => string
}

export const CANONICAL_RED_WIP_ORIGIN = 'https://github.com/bemoat/bemoat-web-starter.git'

export function validateCanonicalOriginTransport(input: {
  configuredFetchUrls: string[]
  configuredPushUrls: string[]
  effectiveFetchUrls: string[]
  effectivePushUrls: string[]
}): string[] {
  const exactSingle = (urls: string[]) => urls.length === 1 && urls[0] === CANONICAL_RED_WIP_ORIGIN
  return exactSingle(input.configuredFetchUrls) &&
    (input.configuredPushUrls.length === 0 || exactSingle(input.configuredPushUrls)) &&
    exactSingle(input.effectiveFetchUrls) && exactSingle(input.effectivePushUrls)
    ? [] : ['origin fetch and push transports must resolve exactly to the canonical GitHub repository URL']
}

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

export function validateRedWipSuiteReport(approval: RedWipApproval, report: RedWipSuiteReport): string[] {
  const reasons: string[] = []
  if (!Number.isInteger(report.numFailedTests) || !Number.isInteger(report.numPassedTests) || !Number.isInteger(report.numFailedTestSuites)) {
    return ['integration suite returned an incomplete or malformed JSON report']
  }
  if (report.unhandledErrors?.length) reasons.push('integration report contains an unhandled runtime or collection error')
  if (report.suites.some((suite) => suite.status !== 'passed' && suite.status !== 'failed')) {
    reasons.push('integration report contains an ambiguous suite status')
  }
  const failures: RedWipFailure[] = []
  for (const suite of report.suites) {
    const suiteFailures = suite.assertions.filter((assertion) => assertion.status === 'failed')
    if (suite.error?.trim() || suite.failureMessage?.trim()) reasons.push('integration report contains a suite setup, collection, or runtime error')
    if (suite.status === 'failed' && suiteFailures.length === 0) reasons.push('a failed suite has no explicitly approved assertion failure')
    if (suite.status === 'passed' && suiteFailures.length > 0) reasons.push('integration report suite status contradicts its failed assertions')
    failures.push(...suiteFailures.map((assertion) => ({ name: assertion.name, file: suite.file, message: assertion.message })))
  }
  if (failures.length !== report.numFailedTests) reasons.push('integration report assertion failure count is contradictory')
  reasons.push(...validateRedWipFailureSet(approval, failures, report.numFailedTests, report.numPassedTests))
  return [...new Set(reasons)]
}

export function validateRedWipRunnerTaskReport(approval: RedWipApproval, report: RedWipRunnerTaskReport): string[] {
  if (!report || !Array.isArray(report.tasks) || !Array.isArray(report.unhandledErrors) ||
      report.tasks.some((task) => !task || !['module', 'suite', 'test'].includes(task.type) || typeof task.name !== 'string' ||
        typeof task.fullName !== 'string' || typeof task.state !== 'string' || !Array.isArray(task.errors) || !Array.isArray(task.children))) {
    return ['integration runner returned an incomplete or malformed task error report']
  }
  const reasons: string[] = []
  if (report.unhandledErrors.length) reasons.push('integration runner reported unhandled runtime or collection errors')
  const approved = new Map(approval.expected_failures.map(({ test_name, expected_message }) => [test_name, expected_message]))
  const allowedFailedTests: string[] = []
  const visit = (task: RedWipRunnerTaskReport['tasks'][number]) => {
    if (task.errors.length) {
      if (task.type !== 'test') {
        reasons.push('integration runner reported a module or suite hook, setup, collection, or runtime error')
      } else {
        const expectedMessage = approved.get(task.fullName)
        if (task.state !== 'failed' || expectedMessage === undefined || task.errors.length !== 1 || !task.errors[0].includes(expectedMessage)) {
          reasons.push('integration runner reported an error outside the exact Issue-approved assertion set')
        } else {
          allowedFailedTests.push(task.fullName)
        }
      }
    }
    task.children.forEach(visit)
  }
  report.tasks.forEach(visit)
  if (allowedFailedTests.length !== approved.size || new Set(allowedFailedTests).size !== allowedFailedTests.length ||
      [...approved.keys()].some((name) => !allowedFailedTests.includes(name))) {
    reasons.push('integration runner task errors do not exactly match the Issue-approved assertion set')
  }
  return [...new Set(reasons)]
}

function serializeVitestError(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const candidate = error as { stack?: unknown; message?: unknown }
    if (typeof candidate.stack === 'string') return candidate.stack
    if (typeof candidate.message === 'string') return candidate.message
  }
  return JSON.stringify(error) ?? String(error)
}

function serializeVitestTask(task: VitestTaskLike, parentNames: string[] = []): RedWipRunnerTaskReport['tasks'][number] {
  const rawTask = task.task ?? task
  const type = task.type ?? rawTask.type ?? 'unknown'
  const name = task.name ?? task.relativeModuleId ?? rawTask.name ?? ''
  const names = type === 'suite' ? [...parentNames, name] : parentNames
  const rawResult = typeof rawTask.result === 'function' ? rawTask.result() : rawTask.result
  const collectionErrors = task.errors?.() ?? []
  const resultErrors = Array.isArray(rawResult?.errors) ? rawResult.errors : []
  const children = task.children?.array?.() ?? (type === 'suite' ? task.tasks ?? [] : [])
  const state = rawResult?.state === 'fail' || rawResult?.state === 'failed' ? 'failed' :
    rawResult?.state === 'pass' || rawResult?.state === 'passed' ? 'passed' :
      rawResult?.state === 'skip' || rawResult?.state === 'skipped' ? 'skipped' :
        typeof task.state === 'function' ? task.state() : 'unknown'
  return {
    type: type === 'module' ? 'module' : type,
    name,
    fullName: type === 'test' ? [...parentNames, name].join(' ') : '',
    state,
    errors: [...new Set([...collectionErrors, ...resultErrors].map(serializeVitestError))],
    children: children.map((child) => serializeVitestTask(child, names)),
  }
}

export default class RedWipVitestReporter {
  async onTestRunEnd(testModules: readonly VitestTaskLike[], unhandledErrors: readonly unknown[]) {
    const output = process.env.BEMOAT_RED_WIP_TASK_REPORT
    if (!output) throw new Error('BEMOAT_RED_WIP_TASK_REPORT must name the full runner task report output')
    const report: RedWipRunnerTaskReport = {
      unhandledErrors: unhandledErrors.map(serializeVitestError),
      tasks: testModules.map((module) => serializeVitestTask(module)),
    }
    const { writeFile } = await import('node:fs/promises')
    await writeFile(output, JSON.stringify(report))
  }
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
