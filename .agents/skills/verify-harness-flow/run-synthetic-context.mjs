#!/usr/bin/env node

import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { delimiter, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const skillDir = resolve(fileURLToPath(new URL('.', import.meta.url)))
const repoRoot = resolve(skillDir, '../../..')
const contextEntrypoint = resolve(repoRoot, 'scripts/agent-context.ts')
const handoffEntrypoint = resolve(repoRoot, 'scripts/agent-handoff.ts')
const canonicalOraclePath = resolve(repoRoot, 'docs/mission-control/flow-oracle.json')
const normalizedOraclePath = resolve(repoRoot, 'tests/fixtures/verify-harness-flow/oracle.json')
const issueNumber = '648'
const repository = 'synthetic/fixture-648'
const baseBranch = 'main'
const topicBranch = 'test/648-synthetic-context-adapter'
const githubOrigin = `https://github.com/${repository}.git`
const evidenceRoot = mkdtempSync(join(tmpdir(), 'bemoat-648-synthetic-evidence-'))
const workspace = join(evidenceRoot, 'owned-workspace')
const fixturePath = join(evidenceRoot, 'github-evidence.json')
const poisonDirectory = join(evidenceRoot, 'bin')
const poisonLog = join(evidenceRoot, 'poison-gh.log')
const tracePath = join(evidenceRoot, 'trace.json')
const evidenceRootOwnerMarker = `verify-harness-flow:${evidenceRoot.split('/').at(-1)}:evidence-root`
const workspaceOwnerMarker = `verify-harness-flow:${evidenceRoot.split('/').at(-1)}:workspace`
writeFileSync(join(evidenceRoot, '.owner-marker'), `${evidenceRootOwnerMarker}\n`)

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function gitOptional(args, cwd) {
  try {
    return git(args, cwd)
  } catch {
    return null
  }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function canonicalSourceValue(scenario, reference) {
  const match = /^(expected_exclusions|prohibited_effects)\[(\d+)\]$/.exec(reference)
  if (!match) return null
  const values = scenario[match[1]]
  const index = Number(match[2])
  return Array.isArray(values) && Number.isSafeInteger(index) ? values[index] ?? null : null
}

function loadOracle() {
  const canonical = readJson(canonicalOraclePath)
  const normalized = readJson(normalizedOraclePath)
  if (canonical.record_type !== 'verification_only_oracle' || canonical.artifact_status !== 'DESCRIPTIVE_ONLY' ||
      !Array.isArray(canonical.scenarios)) {
    throw new Error('canonical flow oracle failed validation')
  }
  const happyPaths = {}
  for (const id of ['HP-01', 'HP-02', 'HP-03', 'HP-04']) {
    const scenario = canonical.scenarios.find((candidate) => candidate.id === id)
    if (!scenario || scenario.status !== 'UNIQUE' || scenario.expected_observation?.status !== 'SPEC_GAP' ||
        typeof scenario.expected_observation.native_route !== 'string' ||
        scenario.expected_observation.native_next_action_type !== null ||
        scenario.expected_behavior?.native_route !== scenario.expected_observation.native_route) {
      throw new Error(`canonical flow oracle scenario ${id} failed validation`)
    }
    happyPaths[id] = {
      route: scenario.expected_observation.native_route,
      action: scenario.expected_observation.native_next_action_type,
    }
  }
  const canonicalFailureIds = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06']
  const canonicalFailures = Object.fromEntries(canonicalFailureIds.map((id) => {
    const scenario = canonical.scenarios.find((candidate) => candidate.id === id)
    if (!scenario || scenario.status !== 'SPEC_GAP' || !Array.isArray(scenario.expected_exclusions) ||
        scenario.expected_exclusions.length === 0 || !Array.isArray(scenario.prohibited_effects) ||
        scenario.prohibited_effects.length === 0 || Object.hasOwn(scenario, 'expected_observation') ||
        Object.hasOwn(scenario, 'expected_behavior')) {
      throw new Error(`canonical flow oracle negative scenario ${id} failed validation`)
    }
    return [id, {
      id,
      status: scenario.status,
      expected_route: null,
      expected_action: null,
      canonical_expected_exclusions: scenario.expected_exclusions,
      canonical_prohibited_effects: scenario.prohibited_effects,
    }]
  }))
  const canonicalTier2 = canonical.scenarios.find((candidate) => candidate.id === 'UNREACHABLE-TIER2-SPAWNED-HOST')
  if (!canonicalTier2 || canonicalTier2.status !== 'UNREACHABLE' || !Array.isArray(canonicalTier2.expected_exclusions) ||
      canonicalTier2.expected_exclusions.length === 0 || !Array.isArray(canonicalTier2.prohibited_effects) ||
      canonicalTier2.prohibited_effects.length === 0 || Object.hasOwn(canonicalTier2, 'expected_observation') ||
      Object.hasOwn(canonicalTier2, 'expected_behavior')) {
    throw new Error('canonical flow oracle Tier-2 capability boundary failed validation')
  }
  if (normalized.record_type !== 'independent_harness_flow_oracle' || !Array.isArray(normalized.failure_labels) ||
      !normalized.capability_boundary || normalized.capability_boundary.status !== 'UNREACHABLE') {
    throw new Error('normalized harness-flow oracle failed validation')
  }
  if (normalized.failure_labels.length !== canonicalFailureIds.length ||
      normalized.failure_labels.some((entry) => {
        const canonicalEntry = canonicalFailures[entry.id]
        const scenario = canonical.scenarios.find((candidate) => candidate.id === entry.id)
        return !canonicalEntry || !scenario || !Array.isArray(entry.exclude) || entry.exclude.length === 0 ||
          !Array.isArray(entry.canonical_exclusion_refs) || entry.canonical_exclusion_refs.length !== entry.exclude.length ||
          !Array.isArray(entry.canonical_exclusion_values) || entry.canonical_exclusion_values.length !== entry.exclude.length ||
          entry.canonical_exclusion_refs.some((reference, index) =>
            typeof reference !== 'string' || entry.canonical_exclusion_values[index] !== canonicalSourceValue(scenario, reference)) ||
          entry.status !== canonicalEntry.status || entry.expected_route !== canonicalEntry.expected_route ||
          entry.expected_action !== canonicalEntry.expected_action
      }) ||
      normalized.capability_boundary.id !== canonicalTier2.id || normalized.capability_boundary.status !== canonicalTier2.status ||
      normalized.capability_boundary.expected_route !== null || normalized.capability_boundary.expected_action !== null ||
      !Array.isArray(normalized.capability_boundary.canonical_exclusion_refs) ||
      normalized.capability_boundary.canonical_exclusion_refs.length !== normalized.capability_boundary.exclude.length ||
      !Array.isArray(normalized.capability_boundary.canonical_exclusion_values) ||
      normalized.capability_boundary.canonical_exclusion_values.length !== normalized.capability_boundary.exclude.length ||
      normalized.capability_boundary.canonical_exclusion_refs.some((reference, index) =>
        typeof reference !== 'string' || normalized.capability_boundary.canonical_exclusion_values[index] !== canonicalSourceValue(canonicalTier2, reference))) {
    throw new Error('normalized harness-flow oracle disagrees with canonical flow oracle')
  }
  const failureLabels = Object.fromEntries(normalized.failure_labels.map((entry) => [entry.id, {
    status: entry.status,
    expected_route: entry.expected_route,
    expected_action: entry.expected_action,
    blocker: [...canonicalFailures[entry.id].canonical_expected_exclusions, ...canonicalFailures[entry.id].canonical_prohibited_effects].join('; '),
    normalized_exclusions: entry.exclude,
    canonical_exclusion_refs: entry.canonical_exclusion_refs,
    canonical_exclusion_values: entry.canonical_exclusion_values,
    owner: 'native Context authority',
  }]))
  return {
    happyPaths,
    failureLabels,
    tier2: {
      id: normalized.capability_boundary.id,
      status: normalized.capability_boundary.status,
      expected_route: normalized.capability_boundary.expected_route,
      expected_action: normalized.capability_boundary.expected_action,
      blocker: normalized.capability_boundary.exclude.join('; '),
      owner: 'native spawned-host capability owner',
    },
    provenance: {
      provenance_verified: true,
      canonical_source_path: 'docs/mission-control/flow-oracle.json',
      normalized_source_path: 'tests/fixtures/verify-harness-flow/oracle.json',
      negative_entries: canonicalFailureIds.map((id) => ({
        ...canonicalFailures[id],
        normalized_exclusions: normalized.failure_labels.find((entry) => entry.id === id)?.exclude ?? [],
        canonical_exclusion_refs: normalized.failure_labels.find((entry) => entry.id === id)?.canonical_exclusion_refs ?? [],
        canonical_exclusion_values: normalized.failure_labels.find((entry) => entry.id === id)?.canonical_exclusion_values ?? [],
      })),
      tier2: {
        id: normalized.capability_boundary.id,
        status: normalized.capability_boundary.status,
        expected_route: null,
        expected_action: null,
        canonical_exclusion_refs: normalized.capability_boundary.canonical_exclusion_refs,
        canonical_exclusion_values: normalized.capability_boundary.canonical_exclusion_values,
      },
    },
  }
}

function responseKey(args) {
  return JSON.stringify(args)
}

function enforceNegativeExclusions({ negative, expected, negativeRoute, negativeAction, dirtyFileExistedBeforeContext, dirtyFileExistedAfterContext, dirtyFileContent, dirtyFileCleanupVerified, contextMutationPerformed, fixtureUnchanged, originalCheckoutUnchanged, poisonDelta }) {
  const forbidden = []
  const reject = (message) => forbidden.push(message)
  const noMutation = contextMutationPerformed === false && fixtureUnchanged && originalCheckoutUnchanged && poisonDelta.length === 0
  const enforced = {
    F01: ['COMMAND', 'PASS from label alone'],
    F02: ['WIP loss', 'invented fallback', 'destructive cleanup', 'silent sync', 'mutation at STOP'],
    F03: ['timestamp-based selection', 'route invention', 'competing-record mutation'],
    F04: ['worker mutation', 'generic STOP-to-gate conversion'],
    F05: ['stale proof reuse', 'merge', 'completion claim'],
    F06: ['dynamic scheduling', 'sibling-Child execution', 'recovery from prose'],
  }

  if (negative === 'F01' && (negativeRoute === 'PASS' || negativeAction === 'PASS' || negativeAction === 'COMMAND')) {
    reject('F01 assumed recovery, COMMAND, or PASS from label')
  }
  if (negative === 'F02') {
    if (!dirtyFileExistedBeforeContext || !dirtyFileExistedAfterContext || dirtyFileContent !== 'owned dirty fixture\n') {
      reject('F02 WIP was lost or changed during Context')
    }
    if (negativeRoute === 'COMMAND' || negativeAction === 'COMMAND') reject('F02 invented a fallback COMMAND')
    if (!dirtyFileCleanupVerified || !noMutation) reject('F02 destructive cleanup, silent sync, or mutation at STOP')
  }
  if (negative === 'F03') {
    if (negativeRoute !== 'STOP' || negativeAction !== 'STOP') reject('F03 selected a route/action from competing evidence')
    if (!noMutation) reject('F03 selected or mutated competing evidence')
  }
  if (negative === 'F04') {
    if (negativeRoute === 'FOUNDER_GATE' || negativeAction === 'FOUNDER_GATE') reject('F04 converted STOP to FOUNDER_GATE from the label')
    if (negativeAction === 'COMMAND' || negativeAction === 'COMPLETE') reject('F04 assumed Founder authority or worker continuation')
    if (!noMutation) reject('F04 worker mutation or Founder-decision assumption')
  }
  if (negative === 'F05' && (negativeRoute === 'FOUNDER_GATE' || negativeAction === 'FOUNDER_GATE')) {
    reject('F05 reused incomplete review proof for a Founder gate')
  }
  if (negative === 'F05' && (negativeRoute === 'COMPLETE' || negativeAction === 'COMPLETE')) {
    reject('F05 reused incomplete review proof for completion')
  }
  if (negative === 'F06' && negativeAction === 'COMMAND') {
    reject('F06 invented a next-objective COMMAND')
  }
  if (forbidden.length > 0) throw new Error(forbidden.join('; '))
  return enforced[negative].filter((exclusion) => expected.normalized_exclusions.includes(exclusion))
}

function setResponse(profile, args, value) {
  profile.responses[responseKey(args)] = value
}

function resultValue(value) {
  return { value }
}

function responseFailure(stderr = 'Not Found') {
  return { status: 1, stderr }
}

function issueBody() {
  return [
    'Task size: core',
    'Mission Control mode: required',
    'Workflow profile: STANDARD',
    '',
    '## Objective',
    'Run one controlled synthetic evidence rehearsal.',
    '',
    '## Scope',
    '- Use only disposable synthetic evidence.',
    '',
    '## Acceptance Criteria',
    '- [ ] Record the native route and action observations.',
  ].join('\n')
}

function prCandidate(number, headSha) {
  return {
    number: String(number),
    url: `https://github.com/${repository}/pull/${number}`,
    headRefName: topicBranch,
    body: `Synthetic PR closes #${issueNumber}`,
    title: `Synthetic PR ${number}`,
    closingIssuesReferences: [{ number: Number(issueNumber) }],
    state: 'OPEN',
    baseRefName: baseBranch,
    baseRefOid: null,
    headRefOid: headSha,
  }
}

function addGitHubResponses(profile, { baseSha, headSha, activePr = null, checkState = 'PENDING', reviewVerdict = null }) {
  const baseRef = ['api', `repos/${repository}/git/ref/heads/${baseBranch}`]
  const devRef = ['api', `repos/${repository}/git/ref/heads/dev`]
  const policyPath = `repos/${repository}/contents/docs/mission-control/mission-control-guide.md?ref=${baseSha}`
  const policy = [
    '---',
    'policy_id: bemoat-mission-control',
    'version: 1.7.0',
    `canonical_repository: ${repository}`,
    'trusted_founder_login: bemoat',
    'allow_historical_no_pr_founder_gate_replay: true',
    '---',
  ].join('\n')
  setResponse(profile, devRef, responseFailure())
  setResponse(profile, baseRef, resultValue({ object: { sha: baseSha } }))
  setResponse(profile, ['api', policyPath], resultValue({
    sha: baseSha,
    encoding: 'base64',
    content: Buffer.from(policy, 'utf8').toString('base64'),
  }))
  setResponse(profile, ['api', `repos/${repository}/branches/${baseBranch}/protection`], resultValue({
    required_status_checks: { contexts: ['synthetic-check'] },
    required_pull_request_reviews: { required_approving_review_count: 0 },
  }))

  const searchList = ['pr', 'list', '--repo', repository, '--state', 'all', '--search', `repo:${repository} #${issueNumber}`, '--json', 'number,url,headRefName,body,title,closingIssuesReferences', '--limit', '100']
  const allList = ['pr', 'list', '--repo', repository, '--state', 'all', '--json', 'number,url,headRefName,body,title,closingIssuesReferences', '--limit', '100']
  const branchList = ['pr', 'list', '--repo', repository, '--state', 'open', '--head', topicBranch, '--json', 'number,url,headRefName,body,title,closingIssuesReferences', '--limit', '1000']
  const handoffNoPrList = ['pr', 'list', '--repo', repository, '--state', 'open', '--search', `repo:${repository} #${issueNumber}`, '--json', 'number,state,title,body,closingIssuesReferences']
  const candidates = activePr ? [prCandidate(activePr.number, headSha)] : []
  for (const args of [searchList, allList, branchList]) setResponse(profile, args, resultValue(candidates))
  setResponse(profile, handoffNoPrList, resultValue(candidates))

  if (activePr) {
    const pr = {
      ...prCandidate(activePr.number, headSha),
      isDraft: false,
      baseRefOid: baseSha,
      headRefOid: headSha,
      mergeCommit: null,
      statusCheckRollup: checkState === 'PENDING'
        ? [{ name: 'synthetic-check', state: 'PENDING', conclusion: null }]
        : [{ name: 'synthetic-check', state: checkState, conclusion: checkState }],
    }
    setResponse(profile, ['pr', 'view', String(activePr.number), '--repo', repository, '--json', 'number,state,isDraft,url,baseRefName,baseRefOid,headRefName,headRefOid,mergeCommit,statusCheckRollup'], resultValue(pr))
    setResponse(profile, ['pr', 'view', String(activePr.number), '--repo', repository, '--json', 'number,url,baseRefName,baseRefOid,headRefName,headRefOid,state,title,body,closingIssuesReferences'], resultValue(pr))
    setResponse(profile, ['api', '--paginate', '--slurp', `repos/${repository}/pulls/${activePr.number}/reviews?per_page=100`], resultValue([reviewVerdict ? [reviewVerdict] : []]))
    setResponse(profile, ['api', '--paginate', '--slurp', `repos/${repository}/pulls/${activePr.number}/files`], resultValue([[{ filename: 'README.md', status: 'modified' }]]))
  }
}

function makeProfile({ baseSha, headSha, activePr = null, checkState = 'PENDING', issueState = 'OPEN', reviewVerdict = null }) {
  const profile = {
    issue: {
      number: issueNumber,
      title: 'Synthetic Issue 648',
      state: issueState,
      url: `https://github.com/${repository}/issues/${issueNumber}`,
      body: issueBody(),
    },
    responses: {},
  }
  addGitHubResponses(profile, { baseSha, headSha, activePr, checkState, reviewVerdict })
  return profile
}

function createSyntheticRepository() {
  mkdirSync(workspace)
  writeFileSync(join(workspace, '.owner-marker'), `${workspaceOwnerMarker}\n`)
  const remote = join(workspace, 'origin.git')
  const source = join(workspace, 'source')
  const cloneRoot = join(workspace, 'clone')
  const packageJson = {
    name: 'bemoat-648-synthetic-fixture',
    private: true,
    scripts: {
      'bemoat:context': `node ${contextEntrypoint}`,
      'bemoat:handoff': `node ${handoffEntrypoint}`,
      'bemoat:guard:safety': 'node -e "process.exit(0)"',
    },
  }

  git(['init', '--bare', '--initial-branch=main', remote], workspace)
  git(['init', '--initial-branch=main', source], workspace)
  git(['config', 'user.name', 'Bemoat Synthetic Tester'], source)
  git(['config', 'user.email', 'synthetic-tester@example.invalid'], source)
  writeJson(join(source, 'package.json'), packageJson)
  writeFileSync(join(source, 'README.md'), '# Synthetic Context fixture\n')
  git(['add', 'package.json', 'README.md'], source)
  git(['commit', '-m', 'synthetic base'], source)
  const baseSha = git(['rev-parse', 'HEAD'], source)
  git(['remote', 'add', 'origin', remote], source)
  git(['push', '--set-upstream', 'origin', 'main'], source)
  git(['switch', '-c', topicBranch], source)
  writeFileSync(join(source, 'README.md'), '# Synthetic Context fixture\n\nTopic evidence.\n')
  git(['add', 'README.md'], source)
  git(['commit', '-m', 'synthetic topic'], source)
  const headSha = git(['rev-parse', 'HEAD'], source)
  git(['push', '--set-upstream', 'origin', topicBranch], source)
  git(['clone', '--branch', topicBranch, remote, cloneRoot], workspace)
  git(['config', 'user.name', 'Bemoat Synthetic Tester'], cloneRoot)
  git(['config', 'user.email', 'synthetic-tester@example.invalid'], cloneRoot)
  return { cloneRoot, baseSha, headSha }
}

function advanceSyntheticStage(cloneRoot, stage) {
  if (git(['branch', '--show-current'], cloneRoot) !== topicBranch ||
      git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], cloneRoot) !== `origin/${topicBranch}`) {
    throw new Error(`synthetic clone branch/upstream binding failed before stage ${stage}`)
  }
  const readmePath = join(cloneRoot, 'README.md')
  writeFileSync(readmePath, `${readFileSync(readmePath, 'utf8')}Stage ${stage} exact-head marker.\n`)
  git(['add', 'README.md'], cloneRoot)
  git(['commit', '-m', `synthetic ${stage} stage`], cloneRoot)
  git(['push'], cloneRoot)
  const headSha = git(['rev-parse', 'HEAD'], cloneRoot)
  const remoteHead = git(['ls-remote', '--heads', 'origin', topicBranch], cloneRoot).split(/\s+/)[0]
  if (remoteHead !== headSha) throw new Error(`synthetic stage ${stage} was not pushed at its exact head`)
  return headSha
}

function configureAmbiguousActivePr(profile, { baseSha, headSha }) {
  const negativeCandidateTwo = prCandidate(2, headSha)
  for (const args of [
    ['pr', 'list', '--repo', repository, '--state', 'all', '--search', `repo:${repository} #${issueNumber}`, '--json', 'number,url,headRefName,body,title,closingIssuesReferences', '--limit', '100'],
    ['pr', 'list', '--repo', repository, '--state', 'all', '--json', 'number,url,headRefName,body,title,closingIssuesReferences', '--limit', '100'],
    ['pr', 'list', '--repo', repository, '--state', 'open', '--head', topicBranch, '--json', 'number,url,headRefName,body,title,closingIssuesReferences', '--limit', '1000'],
  ]) setResponse(profile, args, resultValue([prCandidate(1, headSha), negativeCandidateTwo]))
  setResponse(profile, ['pr', 'view', '2', '--repo', repository, '--json', 'number,state,isDraft,url,baseRefName,baseRefOid,headRefName,headRefOid,mergeCommit,statusCheckRollup'], resultValue({
    ...negativeCandidateTwo,
    isDraft: false,
    baseRefOid: baseSha,
    headRefOid: headSha,
    mergeCommit: null,
    statusCheckRollup: [{ name: 'synthetic-check', state: 'PENDING', conclusion: null }],
  }))
  return profile
}

function createFixture({ baseSha, headSha }) {
  const stageA = makeProfile({ baseSha, headSha })
  const stageB = makeProfile({ baseSha, headSha, activePr: { number: 1 }, checkState: 'PENDING' })
  const stageC = makeProfile({ baseSha, headSha, activePr: { number: 1 }, checkState: 'FAILURE' })
  const stageD = makeProfile({ baseSha, headSha, activePr: { number: 1 }, checkState: 'SUCCESS' })
  const negativeF01 = clone(stageA)
  delete negativeF01.responses[responseKey(['api', `repos/${repository}/git/ref/heads/${baseBranch}`])]
  const negativeF02 = clone(stageA)
  const negativeF03 = configureAmbiguousActivePr(makeProfile({ baseSha, headSha, activePr: { number: 1 }, checkState: 'PENDING' }), { baseSha, headSha })
  const negativeF04 = clone(stageD)
  const negativeF05 = clone(stageD)
  const negativeF06 = clone(stageA)
  negativeF06.issue.state = 'CLOSED'

  writeJson(fixturePath, {
    schema_version: 1,
    fixture_type: 'BEMOAT_TEST_GITHUB_EVIDENCE',
    owner_marker: `verify-harness-flow:${evidenceRoot.split('/').at(-1)}`,
    repository,
    active_profile: 'A',
    comments: [],
    next_comment_id: 1,
    profiles: {
      A: stageA, B: stageB, C: stageC, D: stageD,
      F01: negativeF01, F02: negativeF02, F03: negativeF03,
      F04: negativeF04, F05: negativeF05, F06: negativeF06,
    },
  })
}

function refreshNegativeProfiles({ baseSha, headSha }) {
  const fixture = readJson(fixturePath)
  const negativeF01 = makeProfile({ baseSha, headSha })
  delete negativeF01.responses[responseKey(['api', `repos/${repository}/git/ref/heads/${baseBranch}`])]
  const negativeF02 = makeProfile({ baseSha, headSha })
  const negativeF03 = configureAmbiguousActivePr(makeProfile({ baseSha, headSha, activePr: { number: 1 }, checkState: 'PENDING' }), { baseSha, headSha })
  const negativeF04 = makeProfile({ baseSha, headSha, activePr: { number: 1 }, checkState: 'SUCCESS' })
  const negativeF05 = makeProfile({ baseSha, headSha, activePr: { number: 1 }, checkState: 'SUCCESS' })
  const negativeF06 = makeProfile({ baseSha, headSha, issueState: 'CLOSED' })
  fixture.profiles.F01 = negativeF01
  fixture.profiles.F02 = negativeF02
  fixture.profiles.F03 = negativeF03
  fixture.profiles.F04 = negativeF04
  fixture.profiles.F05 = negativeF05
  fixture.profiles.F06 = negativeF06
  writeJson(fixturePath, fixture)
}

function negativeFixturePreconditions(fixture, negative) {
  const profile = fixture.profiles[negative]
  const activePrList = profile.responses[responseKey([
    'pr', 'list', '--repo', repository, '--state', 'open', '--head', topicBranch,
    '--json', 'number,url,headRefName,body,title,closingIssuesReferences', '--limit', '1000',
  ])]?.value ?? []
  const firstPr = activePrList[0]
  const reviewResponse = firstPr
    ? profile.responses[responseKey(['api', '--paginate', '--slurp', `repos/${repository}/pulls/${firstPr.number}/reviews?per_page=100`])]?.value ?? [[]]
    : [[]]
  const checkState = firstPr
    ? profile.responses[responseKey(['pr', 'view', String(firstPr.number), '--repo', repository, '--json', 'number,state,isDraft,url,baseRefName,baseRefOid,headRefName,headRefOid,mergeCommit,statusCheckRollup'])]?.value?.statusCheckRollup?.[0]?.state ?? null
    : null
  return {
    issue_state: fixture.profiles[negative].issue.state,
    comment_ids: fixture.comments.map(({ id }) => id),
    next_comment_id: fixture.next_comment_id,
    active_pr_numbers: activePrList.map(({ number }) => String(number)),
    check_state: checkState,
    review_count: Array.isArray(reviewResponse[0]) ? reviewResponse[0].length : 0,
    protected_base_ref_present: Boolean(profile.responses[responseKey(['api', `repos/${repository}/git/ref/heads/${baseBranch}`])]),
  }
}

function assertNegativeFixturePreconditions(fixture, negative) {
  const expected = {
    F01: { issue_state: 'OPEN', comment_ids: [], next_comment_id: 1, active_pr_numbers: [], check_state: null, review_count: 0, protected_base_ref_present: false },
    F02: { issue_state: 'OPEN', comment_ids: [], next_comment_id: 1, active_pr_numbers: [], check_state: null, review_count: 0, protected_base_ref_present: true },
    F03: { issue_state: 'OPEN', comment_ids: [], next_comment_id: 1, active_pr_numbers: ['1', '2'], check_state: 'PENDING', review_count: 0, protected_base_ref_present: true },
    F04: { issue_state: 'OPEN', comment_ids: ['90'], next_comment_id: 91, active_pr_numbers: ['1'], check_state: 'SUCCESS', review_count: 0, protected_base_ref_present: true },
    F05: { issue_state: 'OPEN', comment_ids: [], next_comment_id: 1, active_pr_numbers: ['1'], check_state: 'SUCCESS', review_count: 0, protected_base_ref_present: true },
    F06: { issue_state: 'CLOSED', comment_ids: [], next_comment_id: 1, active_pr_numbers: [], check_state: null, review_count: 0, protected_base_ref_present: true },
  }[negative]
  const actual = negativeFixturePreconditions(fixture, negative)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`negative ${negative} fixture preconditions mismatch: ${JSON.stringify(actual)}`)
  }
  return actual
}

function makePoisonGh() {
  mkdirSync(poisonDirectory)
  const poison = join(poisonDirectory, 'gh')
  writeFileSync(poison, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$BEMOAT_GH_POISON_LOG"\nexit 97\n')
  chmodSync(poison, 0o755)
}

function makeSyntheticGitShim() {
  const nativeGit = execFileSync('/usr/bin/which', ['git'], { encoding: 'utf8' }).trim()
  const shim = join(poisonDirectory, 'git')
  writeFileSync(shim, `#!/bin/sh
if [ "$1" = "remote" ] && [ "$2" = "get-url" ] && [ "$3" = "origin" ]; then
  printf '%s\\n' '${githubOrigin}'
  exit 0
fi
exec '${nativeGit}' "$@"
`)
  chmodSync(shim, 0o755)
}

function snapshotOriginalCheckout() {
  // Preserve the complete status snapshot: no path class is exempt from the
  // original checkout/WIP preservation proof.
  const branch = git(['branch', '--show-current'], repoRoot) || '<detached>'
  const wip = git(['status', '--porcelain=v1', '--untracked-files=all'], repoRoot)
    .split('\n')
    .filter(Boolean)

  return {
    head: git(['rev-parse', 'HEAD'], repoRoot),
    branch,
    upstream: branch === '<detached>' ? null : gitOptional(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], repoRoot),
    refs: git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes'], repoRoot).split('\n').filter(Boolean),
    wip,
  }
}

function runJsonCommand(command, args, cwd, env) {
  const result = spawnSync('pnpm', ['--silent', 'run', command, '--', ...args], {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
  })
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean)
  let value = null
  for (const line of [...lines].reverse()) {
    try {
      value = JSON.parse(line)
      break
    } catch {
      // pnpm may emit lifecycle text; the CLI JSON envelope is the final JSON line.
    }
  }
  if (!value) throw new Error(`${command} did not return a JSON envelope: ${result.stderr.trim() || result.stdout.trim()}`)
  return { status: result.status ?? 1, value }
}

function requireCommandSuccess(result, label) {
  if (result.status !== 0) throw new Error(`${label} failed: ${JSON.stringify(result.value)}`)
  return result.value
}

function assertOwnedWorkspace() {
  if (!existsSync(workspace) || lstatSync(workspace).isSymbolicLink() ||
      readFileSync(join(workspace, '.owner-marker'), 'utf8') !== `${workspaceOwnerMarker}\n`) {
    throw new Error('synthetic workspace ownership validation failed')
  }
}

function cleanupOwnedWorkspace() {
  assertOwnedWorkspace()
  rmSync(workspace, { recursive: true, force: true })
  if (existsSync(workspace)) throw new Error('synthetic workspace cleanup readback failed')
}

function syntheticReviewVerdict(headSha, baseSha) {
  const id = 9001
  return {
    id,
    html_url: `https://github.com/${repository}/pull/1#pullrequestreview-${id}`,
    state: 'CHANGES_REQUESTED',
    commit_id: headSha,
    user: { login: 'synthetic-reviewer' },
    body: [
      '## REVIEW_VERDICT',
      '',
      `Repository: \`${repository}\``,
      `Task: Issue #${issueNumber}`,
      '**Verdict:** CORRECTION REQUIRED',
      `**PR / base / head:** PR #1 · \`${baseBranch}\` · \`${headSha}\``,
      `**Approved base:** \`${baseBranch}@${baseSha}\``,
      '',
      '### Immutable finding disposition',
      '```json',
      JSON.stringify({
        schema_version: 1,
        mode: 'implementation_pr',
        reviewed_head: headSha,
        findings: [{
          id: 'REVIEW-648-001',
          canonical_summary: 'Synthetic exact-head correction evidence for the bounded harness rehearsal.',
          source_thread: `https://github.com/${repository}/pull/1#discussion_r9001`,
          required_evidence: ['Publish the bounded correction at a fresh exact head.'],
        }],
      }, null, 2),
      '```',
    ].join('\n'),
  }
}

function handoffRecord({ route, exactHead, baseSha, pr, reviewVerdict = null }) {
  const verifiedEvidence = [{ kind: 'synthetic-stage-observation', value: `route=${route}`, url: null }]
  if (reviewVerdict) {
    verifiedEvidence.push({
      kind: 'review-verdict',
      value: 'Synthetic native review evidence bound to the exact correction head.',
      url: reviewVerdict.html_url,
    })
  }
  return {
    schema_version: 2,
    record_type: 'HANDOFF',
    objective_mode: 'implementation',
    repository,
    issue_number: issueNumber,
    objective: `Synthetic Issue #648 stage ${route}`,
    permitted_scope: ['owned synthetic GitHub evidence fixture', 'real registered Context and HANDOFF CLI observation'],
    prohibited_scope: ['production GitHub mutation', 'mock router replacement', 'Tier-2 spawned-host work'],
    executing_agent: 'bemoat-synthetic-tester',
    provider: 'synthetic-test-fixture',
    branch: topicBranch,
    exact_head: exactHead,
    protected_base: { branch: baseBranch, sha: baseSha },
    pr,
    verified_evidence: verifiedEvidence,
    route,
    next_action: { route, description: `Continue only through the fresh synthetic Context boundary for ${route}.` },
    stop_conditions: ['Stop on any evidence conflict or unsupported native boundary.'],
    local_durability: { required: true, durable: true, reason: null },
  }
}

function transitionProfile(profile, oracle) {
  const index = ['A', 'B', 'C', 'D'].indexOf(profile)
  const oracleProfile = `HP-0${index + 1}`
  const expectation = oracle.happyPaths[oracleProfile]
  if (!expectation) throw new Error(`missing canonical oracle expectation for ${oracleProfile}`)
  return {
    oracle_profile: oracleProfile,
    expected_route: expectation.route,
    expected_action: expectation.action,
    pr: index === 0
      ? null
      : { number: '1', url: `https://github.com/${repository}/pull/1`, base: baseBranch, head: topicBranch }
  }
}

function main() {
  const oracle = loadOracle()
  const originalBefore = snapshotOriginalCheckout()
  const transitions = []
  const negatives = []
  let cleanupVerified = false
  try {
    makePoisonGh()
    makeSyntheticGitShim()
    const synthetic = createSyntheticRepository()
    createFixture(synthetic)
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      BEMOAT_TEST_EVIDENCE_ENABLE: '1',
      BEMOAT_TEST_EVIDENCE_ROOT: evidenceRoot,
      BEMOAT_TEST_EVIDENCE_FIXTURE: fixturePath,
      BEMOAT_GH_POISON_LOG: poisonLog,
      PATH: `${poisonDirectory}${delimiter}${process.env.PATH ?? ''}`,
    }

    const contextHelp = runJsonCommand('bemoat:context', ['--help', '--json'], repoRoot, env).value
    const handoffHelp = runJsonCommand('bemoat:handoff', ['--help', '--json'], repoRoot, env).value
    if (contextHelp.classification !== 'HELP' || handoffHelp.classification !== 'HELP') throw new Error('registered CLI help boundary failed')

    const stageHeads = { A: synthetic.headSha }
    let currentHead = synthetic.headSha
    for (const profile of ['A', 'B', 'C', 'D']) {
      const expected = transitionProfile(profile, oracle)
      let preAuthorization = null
      if (profile !== 'A') {
        const checkState = profile === 'C' ? 'FAILURE' : profile === 'D' ? 'SUCCESS' : 'PENDING'
        const correctionReview = profile === 'C' || profile === 'D' ? syntheticReviewVerdict(currentHead, synthetic.baseSha) : null
        const preAuthorizationFixture = readJson(fixturePath)
        preAuthorizationFixture.profiles[profile] = makeProfile({
          baseSha: synthetic.baseSha,
          headSha: currentHead,
          activePr: { number: 1 },
          checkState,
          reviewVerdict: correctionReview,
        })
        preAuthorizationFixture.active_profile = profile
        writeJson(fixturePath, preAuthorizationFixture)
        const preContext = requireCommandSuccess(
          runJsonCommand('bemoat:context', [issueNumber, '--json'], synthetic.cloneRoot, env),
          `fresh Context before stage ${profile}`,
        )
        const preObservedRoute = preContext.route ?? null
        if (preContext.next_action?.type !== 'COMMAND' || preContext.next_action.command !== null) {
          throw new Error(`fresh Context before stage ${profile} did not return the expected native action`)
        }
        const preOracleProfile = profile === 'B' ? 'HP-02' : profile === 'C' ? 'HP-03' : null
        const preExpectedRoute = preOracleProfile ? oracle.happyPaths[preOracleProfile]?.route ?? null : null
        if (preObservedRoute !== (profile === 'B' ? 'VERIFY' : 'FIX') ||
            (preExpectedRoute !== null && preObservedRoute !== preExpectedRoute)) {
          throw new Error(`fresh Context before stage ${profile} returned ${preObservedRoute}, expected ${preExpectedRoute}`)
        }
        const mayCommit = preObservedRoute === 'FIX'
        preAuthorization = {
          oracle_profile: preOracleProfile,
          expected_route: preExpectedRoute,
          observed_route: preObservedRoute,
          observed_action: preContext.next_action?.type ?? null,
          exact_head: currentHead,
          stage_advance_authorized_before_commit: mayCommit,
          oracle_backed: preOracleProfile !== null,
        }
        if (mayCommit) currentHead = advanceSyntheticStage(synthetic.cloneRoot, profile)
        stageHeads[profile] = currentHead
        const stagedFixture = readJson(fixturePath)
        const currentReview = profile === 'C'
          ? syntheticReviewVerdict(currentHead, synthetic.baseSha)
          : profile === 'D'
            ? syntheticReviewVerdict(stageHeads.C, synthetic.baseSha)
            : null
        stagedFixture.profiles[profile] = makeProfile({
          baseSha: synthetic.baseSha,
          headSha: currentHead,
          activePr: { number: 1 },
          checkState,
          reviewVerdict: currentReview,
        })
        writeJson(fixturePath, stagedFixture)
      }
      const stageHead = stageHeads[profile]
      const fixture = readJson(fixturePath)
      const priorCommentIds = fixture.comments.map(({ id }) => id)
      const profileBeforeSwitch = clone(fixture)
      fixture.active_profile = profile
      writeJson(fixturePath, fixture)
      const profileAfterSwitch = readJson(fixturePath)
      const context = runJsonCommand('bemoat:context', [issueNumber, '--json'], synthetic.cloneRoot, env)
      const contextValue = requireCommandSuccess(context, `Context ${profile}`)
      const observedRoute = contextValue.route ?? null
      if (typeof observedRoute !== 'string') throw new Error(`Context ${profile} did not expose a native route`)
      if (contextValue.next_action?.type !== 'COMMAND') {
        throw new Error(`Context ${profile} did not grant the COMMAND action required for HANDOFF`)
      }
      const bodyPath = join(workspace, `handoff-${profile}.json`)
      const pr = expected.pr ? { ...expected.pr, head_sha: stageHead } : null
      const handoffRoute = observedRoute
      const handoffPr = pr
      writeJson(bodyPath, handoffRecord({
        route: handoffRoute,
        exactHead: stageHead,
        baseSha: synthetic.baseSha,
        pr: handoffPr,
        reviewVerdict: profile === 'C' ? syntheticReviewVerdict(stageHead, synthetic.baseSha) : null,
      }))
      const handoff = runJsonCommand('bemoat:handoff', [issueNumber, '--body-file', bodyPath, '--json'], synthetic.cloneRoot, env)
      const handoffValue = requireCommandSuccess(handoff, `HANDOFF ${profile} observed=${observedRoute}`)
      const afterHandoff = readJson(fixturePath)
      if (afterHandoff.comments.length !== priorCommentIds.length + 1 || afterHandoff.next_comment_id !== fixture.next_comment_id + 1) {
        throw new Error(`HANDOFF ${profile} did not persist exactly one owned comment`)
      }
      const lastComment = afterHandoff.comments.at(-1)
      if (!lastComment || !new RegExp(`"route"\\s*:\\s*"${handoffRoute}"`).test(lastComment.body)) {
        throw new Error(`HANDOFF ${profile} comment readback did not contain its durable route`)
      }
      transitions.push({
        id: profile,
        oracle_profile: expected.oracle_profile,
        expected_route: expected.expected_route,
        expected_action: expected.expected_action,
        observed_route: observedRoute,
        observed_action: contextValue.next_action?.type ?? null,
        context_status: observedRoute === expected.expected_route ? 'PASS' : 'DEFECT',
        handoff_status: handoffValue.classification === 'SUCCESS' ? 'PASS' : 'DEFECT',
        pre_authorization: preAuthorization,
        handoff: {
          classification: handoffValue.classification,
          mutation_performed: handoffValue.mutation_performed,
          record_route: handoffRoute,
          record_exact_head: stageHead,
          record_pr: handoffPr,
        },
        fixture_readback: {
          profile_switch_only: JSON.stringify(profileAfterSwitch) === JSON.stringify({ ...profileBeforeSwitch, active_profile: profile }),
          prior_comment_ids: priorCommentIds,
          after_handoff_comment_ids: afterHandoff.comments.map(({ id }) => id),
        },
        identity: {
          repository,
          issue_number: issueNumber,
          branch: topicBranch,
            exact_head: stageHead,
          protected_base: { branch: baseBranch, sha: synthetic.baseSha },
          pr: pr ? { number: pr.number, url: pr.url, base: pr.base, head: pr.head, head_sha: pr.head_sha } : null,
        },
      })
    }

    const finalHead = currentHead
    refreshNegativeProfiles({ baseSha: synthetic.baseSha, headSha: finalHead })

    const finalContext = requireCommandSuccess(
      runJsonCommand('bemoat:context', [issueNumber, '--json'], synthetic.cloneRoot, env),
      'final Context',
    )

    for (const negative of ['F01', 'F02', 'F03', 'F04', 'F05', 'F06']) {
      const fixture = readJson(fixturePath)
      fixture.active_profile = negative
      fixture.comments = []
      fixture.next_comment_id = 1
      if (negative === 'F04') {
        const stopRecord = handoffRecord({
          route: 'STOP', exactHead: finalHead, baseSha: synthetic.baseSha,
          pr: { number: '1', url: `https://github.com/${repository}/pull/1`, base: baseBranch, head: topicBranch, head_sha: finalHead },
        })
        stopRecord.schema_version = 3
        stopRecord.verified_evidence.push({ kind: 'stop-blocker', value: 'SYNTHETIC-F04-UNRESOLVED', url: null })
        fixture.comments = [{
          id: '90',
          body: `## HANDOFF\n\n\`\`\`json\n${JSON.stringify(stopRecord, null, 2)}\n\`\`\`\n`,
          url: `https://github.com/${repository}/issues/${issueNumber}#issuecomment-90`,
        }]
        fixture.next_comment_id = 91
      }
      writeJson(fixturePath, fixture)
      const fixturePreconditions = assertNegativeFixturePreconditions(readJson(fixturePath), negative)
      const dirtyFile = join(synthetic.cloneRoot, `negative-${negative}.tmp`)
      if (negative === 'F02') writeFileSync(dirtyFile, 'owned dirty fixture\n')
      const dirtyFileExistedBeforeContext = existsSync(dirtyFile)
      const expected = oracle.failureLabels[negative]
      if (!expected) throw new Error(`missing canonical oracle expectation for ${negative}`)
      const fixtureBefore = readJson(fixturePath)
      const checkoutBefore = snapshotOriginalCheckout()
      const poisonBefore = existsSync(poisonLog) ? readFileSync(poisonLog, 'utf8').split(/\r?\n/).filter(Boolean) : []
      const contextResult = runJsonCommand('bemoat:context', [issueNumber, '--json'], synthetic.cloneRoot, env)
      const context = requireCommandSuccess(contextResult, `Context ${negative}`)
      const dirtyFileExistedAfterContext = existsSync(dirtyFile)
      const dirtyFileContent = dirtyFileExistedAfterContext ? readFileSync(dirtyFile, 'utf8') : null
      if (negative === 'F02' && dirtyFileExistedAfterContext) rmSync(dirtyFile)
      const dirtyFileCleanupVerified = negative === 'F02' ? !existsSync(dirtyFile) : !existsSync(dirtyFile)
      const fixtureAfter = readJson(fixturePath)
      const checkoutAfter = snapshotOriginalCheckout()
      const poisonAfter = existsSync(poisonLog) ? readFileSync(poisonLog, 'utf8').split(/\r?\n/).filter(Boolean) : []
      const poisonDelta = poisonAfter.slice(poisonBefore.length)
      const fixtureBeforeFingerprint = fingerprint(fixtureBefore)
      const fixtureAfterFingerprint = fingerprint(fixtureAfter)
      const fixtureUnchanged = fixtureBeforeFingerprint === fixtureAfterFingerprint
      const originalCheckoutUnchangedForNegative = JSON.stringify(checkoutBefore) === JSON.stringify(checkoutAfter)
      const observedForbiddenEffects = []
      if (context.mutation_performed !== false) observedForbiddenEffects.push('Context reported mutation_performed=true')
      if (!fixtureUnchanged) observedForbiddenEffects.push('synthetic fixture changed during read-only Context')
      if (!originalCheckoutUnchangedForNegative) observedForbiddenEffects.push('original checkout changed during negative Context')
      if (poisonDelta.length > 0) observedForbiddenEffects.push('native gh invocation occurred during negative Context')
      const negativeRoute = context.route ?? null
      const negativeAction = context.next_action?.type ?? null
      const enforcedExclusions = enforceNegativeExclusions({
        negative,
        expected,
        negativeRoute,
        negativeAction,
        dirtyFileExistedBeforeContext,
        dirtyFileExistedAfterContext,
        dirtyFileContent,
        dirtyFileCleanupVerified,
        contextMutationPerformed: context.mutation_performed,
        fixtureUnchanged,
        originalCheckoutUnchanged: originalCheckoutUnchangedForNegative,
        poisonDelta,
      })
      if (observedForbiddenEffects.length > 0) throw new Error(`negative ${negative} forbidden side effect: ${observedForbiddenEffects.join('; ')}`)
      negatives.push({
        id: negative,
        status: expected.status,
        expected_route: expected.expected_route,
        expected_action: expected.expected_action,
        observed_route: context.route ?? null,
        observed_action: context.next_action?.type ?? null,
        blocker: expected.blocker,
        owner: expected.owner,
        side_effect_proof: {
          fixture_before: { sha256: fixtureBeforeFingerprint, comment_ids: fixtureBefore.comments.map(({ id }) => id), next_comment_id: fixtureBefore.next_comment_id },
          fixture_after: { sha256: fixtureAfterFingerprint, comment_ids: fixtureAfter.comments.map(({ id }) => id), next_comment_id: fixtureAfter.next_comment_id },
          context_mutation_performed: context.mutation_performed,
          fixture_unchanged: fixtureUnchanged,
          original_checkout_unchanged: originalCheckoutUnchangedForNegative,
          poison_gh_delta: poisonDelta,
          poison_gh_delta_empty: poisonDelta.length === 0,
          observed_forbidden_effects: observedForbiddenEffects,
        },
        allowed_harness_effects: negative === 'F02' ? ['runner-owned F02 dirty file cleanup'] : [],
        enforced_exclusions: enforcedExclusions,
        fixture_preconditions: fixturePreconditions,
        dirty_file_cleanup: {
          required: negative === 'F02',
          existed_before_context: dirtyFileExistedBeforeContext,
          existed_after_context: dirtyFileExistedAfterContext,
          cleanup_verified: dirtyFileCleanupVerified,
        },
      })
    }

    const originalAfter = snapshotOriginalCheckout()
    const poisonInvocations = existsSync(poisonLog) ? readFileSync(poisonLog, 'utf8').split(/\r?\n/).filter(Boolean) : []
    const originalCheckoutUnchanged = JSON.stringify(originalBefore) === JSON.stringify(originalAfter)
    if (!originalCheckoutUnchanged) throw new Error('original checkout preservation proof failed')
    if (poisonInvocations.length > 0) throw new Error('poison-gh proof failed')
    const trace = {
      record_type: 'verify_harness_flow_synthetic_trace',
      issue_number: issueNumber,
      overall: 'SUPPORTED',
      capability: { status: 'SUPPORTED', owner: 'bemoat:context CLI adapter owner' },
      public_cli: { context_help: 'PASS', handoff_help: 'PASS', writes: [] },
      oracle: oracle.provenance,
      bindings: {
        repository,
        issue_number: issueNumber,
        branch: topicBranch,
        exact_head: finalHead,
        protected_base: { branch: baseBranch, sha: synthetic.baseSha },
        fixture: {
          relative_path: 'github-evidence.json',
          owner_marker: `verify-harness-flow:${evidenceRoot.split('/').at(-1)}`,
        },
        workspace: { relative_path: 'owned-workspace', owner_marker: workspaceOwnerMarker },
      },
      allowed_effects: [
        'create and mutate the run-owned synthetic GitHub evidence fixture',
        'create and delete the run-owned synthetic workspace',
        'write and retain this sanitized trace beneath the run-owned evidence root',
      ],
      forbidden_effects: [
        'production GitHub mutation',
        'writes outside the run-owned evidence root',
        'mutation of the original checkout or unrelated refs/WIP',
        'invented F01-F06 routes/actions or spawned-host capability claims',
      ],
      transitions,
      exit_context: { observed_route: finalContext.route ?? null, observed_action: finalContext.next_action?.type ?? null },
      negatives,
      tier2: oracle.tier2,
      trace_retained: false,
      isolation: {
        original_checkout_unchanged: originalCheckoutUnchanged,
        original_checkout_before: originalBefore,
        original_checkout_after: originalAfter,
        poison_gh_invocations: poisonInvocations,
        cleanup_verified: false,
        cleanup_target: { relative_path: 'owned-workspace', owner_marker: workspaceOwnerMarker },
      },
    }
    writeJson(tracePath, trace)
    const traceReadback = readJson(tracePath)
    if (traceReadback.record_type !== trace.record_type || JSON.stringify(traceReadback.bindings) !== JSON.stringify(trace.bindings)) {
      throw new Error('sanitized trace write/readback failed before cleanup')
    }
    trace.trace_retained = true
    writeJson(tracePath, trace)
    cleanupOwnedWorkspace()
    cleanupVerified = !existsSync(workspace) && existsSync(tracePath)
    trace.isolation.cleanup_verified = cleanupVerified
    writeJson(tracePath, trace)
    const finalTrace = readJson(tracePath)
    if (!finalTrace.trace_retained || !finalTrace.isolation.cleanup_verified) throw new Error('trace retention or cleanup readback failed')
    process.stdout.write(`${JSON.stringify({ ...finalTrace, trace_path: tracePath })}\n`)
  } finally {
    if (existsSync(workspace)) cleanupOwnedWorkspace()
  }
}

main()
