import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

import { getCommandContract } from '../../scripts/cli/command-contract.ts'
import { renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'
import { recoverCommittedWip, COMMITTED_WIP_BINDING } from '../../scripts/context/committed-wip-recovery.ts'
import type { ContextCommandResult, ContextCommandRunner } from '../../scripts/context/runtime.ts'

const COMMAND = 'bemoat:context:recover-committed-wip'
const REPOSITORY = 'bemoat/bemoat-web-starter'
const ISSUE = COMMITTED_WIP_BINDING.issueNumber
const BRANCH = COMMITTED_WIP_BINDING.branch
const BASE_A = COMMITTED_WIP_BINDING.baseSha
const HEAD_B = COMMITTED_WIP_BINDING.wipHead
const TREE_B = COMMITTED_WIP_BINDING.wipTree
const HANDOFF_COMMENT = COMMITTED_WIP_BINDING.handoffCommentId
const AUTHOR_ID = '36528988'
const WIP_SUBJECT = 'wip(#627): preserve incomplete multi-objective routing candidate'
const WIP_AUTHOR = 'Bemoat'
const WIP_PATHS = [
  'docs/agent-loop/role-handoff-contract.md',
  'docs/mission-control/mission-control-guide.md',
  'scripts/context/evidence.ts',
  'scripts/context/github.ts',
  'scripts/context/issue-parser.ts',
  'scripts/context/model.ts',
  'scripts/context/native-review-lineage.ts',
  'scripts/context/no-pr-routing.ts',
  'scripts/context/objective-sequence-routing.ts',
  'scripts/context/pr-issue-ownership.ts',
  'scripts/context/router.ts',
  'scripts/context/setup-base-recovery-routing.ts',
  'scripts/context/setup-recovery.ts',
  'tests/int/context-evidence.int.spec.ts',
  'tests/int/context-no-pr-pr-ready.int.spec.ts',
  'tests/int/context-parser.int.spec.ts',
] as const

const ok = (stdout: string): ContextCommandResult => ({ status: 0, stdout, stderr: '', error: null })
const fail = (stderr: string): ContextCommandResult => ({ status: 1, stdout: '', stderr, error: null })

function canonicalHandoffBody(): string {
  const record: HandoffRecord = {
    schema_version: 2,
    record_type: 'HANDOFF',
    objective_mode: 'read_only',
    repository: REPOSITORY,
    issue_number: ISSUE,
    objective: 'Objective 1 — Preserve incomplete multi-objective routing candidate.',
    permitted_scope: ['read-only characterization', 'durable evidence reconstruction'],
    prohibited_scope: ['source mutation', 'Objective 2', 'merge'],
    executing_agent: 'Codex',
    provider: 'OpenAI',
    branch: BRANCH,
    exact_head: BASE_A,
    protected_base: { branch: 'main', sha: BASE_A },
    pr: null,
    verified_evidence: [{ kind: 'historical-context', value: 'Objective 1 HANDOFF at immutable head A.', url: null }],
    route: 'IMPLEMENT',
    next_action: { route: 'IMPLEMENT', description: 'Continue only under fresh Context authority.' },
    stop_conditions: ['Stop on missing, conflicting, or non-durable evidence.'],
    local_durability: { required: true, durable: true, reason: null },
  }
  return renderHandoffComment(record)
}

type FixtureOverrides = {
  sourceOrigin?: string
  targetOrigin?: string
  sourceHead?: string
  targetHead?: string
  sourceStatus?: string
  targetStatus?: string
  sourceBranch?: string | null
  targetBranch?: string | null
  targetUpstream?: string
  sourceTracking?: string
  targetTracking?: string
  sourceLiveRefs?: string[]
  targetLiveRefs?: string[]
  tree?: string
  parent?: string
  commitIdentity?: string
  paths?: readonly string[]
  forwardAncestryStatus?: number
  reverseAncestryStatus?: number
  handoffBody?: string
  comments?: unknown
  exactCommentResult?: ContextCommandResult
}

type Fixture = {
  source: string
  target: string
  calls: Array<{ command: string; args: string[]; cwd: string }>
  unhandled: string[]
  run: ContextCommandRunner
}

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function bindingFor(target: string, overrides: Partial<Parameters<typeof recoverCommittedWip>[0]['binding']> = {}) {
  return {
    issueNumber: ISSUE,
    expectedRepository: REPOSITORY,
    expectedBranch: BRANCH,
    expectedBaseBranch: 'main',
    expectedBaseSha: BASE_A,
    expectedHandoffCommentId: HANDOFF_COMMENT,
    expectedHandoffHead: BASE_A,
    expectedWipHead: HEAD_B,
    expectedWipTree: TREE_B,
    targetWorktree: target,
    ...overrides,
  }
}

function fixture(overrides: FixtureOverrides = {}): Fixture {
  const source = realpathSync(mkdtempSync(join(tmpdir(), 'bemoat-628-source-')))
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'bemoat-628-target-')))
  temporaryRoots.push(source, target)
  const calls: Fixture['calls'] = []
  const unhandled: string[] = []
  const handoffBody = canonicalHandoffBody()
  const exactComment = {
    id: HANDOFF_COMMENT,
    html_url: `https://github.com/${REPOSITORY}/issues/${ISSUE}#issuecomment-${HANDOFF_COMMENT}`,
    issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${ISSUE}`,
    user: { id: AUTHOR_ID, login: 'bemoat' },
    body: overrides.handoffBody ?? handoffBody,
  }
  const comments = overrides.comments ?? [[exactComment].filter(Boolean)]
  const sourceRefs = overrides.sourceLiveRefs ?? [BASE_A, BASE_A]
  const targetRefs = overrides.targetLiveRefs ?? [HEAD_B, HEAD_B, HEAD_B]
  let sourceRefRead = 0
  let targetRefRead = 0
  let currentSourceRef = sourceRefs[0] ?? BASE_A
  let currentTargetRef = targetRefs[0] ?? HEAD_B
  const run: ContextCommandRunner = (command, args, options = {}) => {
    const cwd = options.cwd ?? ''
    calls.push({ command, args: [...args], cwd })
    const key = args.join(' ')
    const isSource = cwd === source
    const isTarget = cwd === target
    const root = isSource ? source : isTarget ? target : cwd
    if (command === 'git' && key === 'rev-parse --show-toplevel') return ok(`${root}\n`)
    if (command === 'git' && key === 'status --porcelain=v1 --untracked-files=all') return ok(`${isTarget ? overrides.targetStatus ?? '' : overrides.sourceStatus ?? ''}\n`)
    if (command === 'git' && key === 'remote get-url origin') return ok(`${isTarget ? overrides.targetOrigin ?? `https://github.com/${REPOSITORY}.git` : overrides.sourceOrigin ?? `https://github.com/${REPOSITORY}.git`}\n`)
    if (command === 'git' && key === 'rev-parse HEAD') {
      const head = isTarget ? overrides.targetHead ?? HEAD_B : overrides.sourceHead ?? BASE_A
      return ok(`${head}\n`)
    }
    if (command === 'git' && key === 'symbolic-ref --quiet --short HEAD') {
      const branch = isTarget ? overrides.targetBranch ?? BRANCH : overrides.sourceBranch === undefined ? 'main' : overrides.sourceBranch
      return branch === null ? fail('detached') : ok(`${branch}\n`)
    }
    if (command === 'git' && key === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') return ok(`${overrides.targetUpstream ?? `origin/${BRANCH}`}\n`)
    if (command === 'git' && key === 'rev-parse --verify --quiet refs/remotes/origin/main') return ok(`${overrides.sourceTracking ?? BASE_A}\n`)
    if (command === 'git' && key === `rev-parse --verify --quiet refs/remotes/origin/${BRANCH}`) return ok(`${overrides.targetTracking ?? HEAD_B}\n`)
    if (command === 'gh' && key === `api repos/${REPOSITORY}/git/ref/heads/main`) {
      currentSourceRef = sourceRefs[Math.min(sourceRefRead++, sourceRefs.length - 1)] ?? BASE_A
      return ok(JSON.stringify({ object: { sha: currentSourceRef } }))
    }
    if (command === 'gh' && key === `api repos/${REPOSITORY}/git/ref/heads/${encodeURIComponent(BRANCH)}`) {
      currentTargetRef = targetRefs[Math.min(targetRefRead++, targetRefs.length - 1)] ?? HEAD_B
      return ok(JSON.stringify({ object: { sha: currentTargetRef } }))
    }
    if (command === 'git' && key === 'ls-remote --heads origin refs/heads/main') return ok(`${currentSourceRef}\trefs/heads/main\n`)
    if (command === 'git' && key === `ls-remote --heads origin refs/heads/${BRANCH}`) return ok(`${currentTargetRef}\trefs/heads/${BRANCH}\n`)
    if (command === 'git' && key === `rev-parse ${HEAD_B}^{tree}`) return ok(`${overrides.tree ?? TREE_B}\n`)
    if (command === 'git' && key === `merge-base --is-ancestor ${BASE_A} ${HEAD_B}`) return { status: overrides.forwardAncestryStatus ?? 0, stdout: '', stderr: '', error: null }
    if (command === 'git' && key === `merge-base --is-ancestor ${HEAD_B} ${BASE_A}`) return { status: overrides.reverseAncestryStatus ?? 1, stdout: '', stderr: '', error: null }
    if (command === 'git' && key === `rev-parse ${HEAD_B}^`) return ok(`${overrides.parent ?? BASE_A}\n`)
    if (command === 'git' && key === `show -s --format=%an%n%s ${HEAD_B}`) return ok(`${overrides.commitIdentity ?? `${WIP_AUTHOR}\n${WIP_SUBJECT}`}\n`)
    if (command === 'git' && key === `diff --name-only -z ${BASE_A} ${HEAD_B}`) return ok(`${(overrides.paths ?? WIP_PATHS).join('\0')}\0`)
    if (command === 'gh' && key === `api repos/${REPOSITORY}/issues/comments/${HANDOFF_COMMENT}`) return overrides.exactCommentResult ?? ok(JSON.stringify(exactComment))
    if (command === 'gh' && key === `api --paginate --slurp repos/${REPOSITORY}/issues/${ISSUE}/comments`) return ok(JSON.stringify(comments))
    unhandled.push(`${command} ${key}`)
    return fail(`unhandled fixture command: ${command} ${key}`)
  }
  return { source, target, calls, unhandled, run }
}

function expectNoMutation(fixtureState: Fixture) {
  expect(fixtureState.unhandled).toEqual([])
  expect(fixtureState.calls.every(({ command }) => command === 'git' || command === 'gh')).toBe(true)
  expect(fixtureState.calls.some(({ command, args }) => command === 'git' && ['fetch', 'merge', 'reset', 'stash', 'update-ref', 'push'].includes(args[0]!))).toBe(false)
}

function commandContract() {
  return getCommandContract(COMMAND)
}

describe('Architecture A committed RED-WIP reentry command contract', () => {
  // Canonical authority: Founder decision #628 comment 6096110966 and
  // immutable #627 Objective 1 HANDOFF comment 6088681412. The only allowed
  // command is a registered read-only proof operation; success cannot grant
  // objective-edit authority.
  it('registers one Tier-A read-only command and routes success only to fresh Context', () => {
    const contract = commandContract()
    expect(contract, 'the narrowly scoped recovery command must be registered').toBeTruthy()
    if (!contract) return

    expect(contract).toMatchObject({ command: COMMAND, tier: 'A', help_meaningful: true })
    expect(contract.purpose).toMatch(/committed.*WIP|WIP.*reentry/i)
    expect(contract.operation).toMatch(/read.only|proof|reconcil/i)
    expect(contract.writes).toEqual([])
    expect(contract.next_action_rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'SUCCESS',
        next_action: expect.objectContaining({ type: 'COMMAND', command: 'bemoat:context' }),
      }),
      expect.objectContaining({
        classification: 'NO_OP_IDENTICAL_RETRY',
        next_action: expect.objectContaining({ type: 'COMMAND', command: 'bemoat:context' }),
      }),
    ]))
    expect(contract.next_action_rules).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ next_action: expect.objectContaining({ type: 'COMMAND', command: expect.not.stringMatching(/^bemoat:context$/) }) }),
    ]))
    expect(JSON.stringify(contract.role_contracts)).toMatch(/objective.edit authority.*false|does not grant.*objective.edit/i)
  })

  // Positive proof oracle: the live fixture binds exact source A, historical
  // read-only HANDOFF identity, and committed target B/tree. It remains RED
  // and incomplete; this evidence is not a replacement HANDOFF.
  it('requires the exact #627 A-to-B evidence and preserves incomplete RED status', () => {
    const contract = commandContract()
    expect(contract, 'the recovery command contract must exist').toBeTruthy()
    if (!contract) return
    const evidence = contract.required_evidence.join('\n')
    const inputs = contract.required_inputs.map((input) => `${input.name} ${input.syntax} ${input.description}`).join('\n')
    const preStates = contract.accepted_pre_states.join('\n')
    const trusted = contract.trusted_derived_values.join('\n')

    for (const value of [REPOSITORY, ISSUE, BRANCH, BASE_A, HEAD_B, TREE_B, HANDOFF_COMMENT]) {
      expect(`${evidence}\n${inputs}\n${preStates}\n${trusted}`).toContain(value)
    }
    expect(evidence).toMatch(/strict.*ancestr|A.*B.*ancestr/i)
    expect(evidence).toMatch(/objective_mode.*read_only|read_only.*objective_mode/i)
    expect(evidence).toMatch(/Objective 1|objective begins Objective 1/i)
    expect(evidence).toMatch(/RED|incomplete/i)
    expect(evidence).toMatch(/not.*GREEN|never.*GREEN|no.*GREEN/i)
    expect(evidence).toMatch(/not.*Objective N\+1|no.*Objective N\+1|N\+1.*not authorized/i)
    expect(evidence).toMatch(/exact.*tree|tree.*exact/i)
  })

  // Negative oracle: each identity and provenance conflict is a STOP. The
  // command must not guess a route or accept a different HANDOFF/workspace.
  it('fails closed on identity, ancestry, HANDOFF, tree, workspace, and provenance conflicts', () => {
    const contract = commandContract()
    expect(contract, 'the recovery command contract must exist').toBeTruthy()
    if (!contract) return
    const stop = contract.stop_conditions.join('\n')
    const evidence = contract.required_evidence.join('\n')
    const all = `${stop}\n${evidence}`

    for (const rejectedCase of [
      /wrong.*(Issue|repository|branch|origin|upstream|base|head|tree)/i,
      /missing.*HANDOFF|HANDOFF.*missing/i,
      /malformed.*HANDOFF|HANDOFF.*malformed/i,
      /forged|modified.*(HANDOFF|body)|body.*digest/i,
      /duplicate|competing.*HANDOFF|HANDOFF.*competing/i,
      /reverse.*ancestr|divergent.*ancestr|stale.*(head|B)/i,
      /dirty.*target|target.*dirty/i,
      /detached.*target|target.*detached/i,
      /inaccessible.*workspace|workspace.*inaccessible/i,
      /unsupported.*(target|topology|workspace)/i,
      /source.*(drift|not.*clean|not.*live)|live.*source/i,
      /unowned|unrelated|forbidden.*path|provenance/i,
      /remote.*drift|moved.*B|readback.*mismatch/i,
    ]) expect(all).toMatch(rejectedCase)
    expect(contract.stop_classifications).toContain('EVIDENCE_CONFLICT')
    expect(contract.stop_classifications).toContain('HEAD_DRIFT')
    expect(contract.stop_classifications).toContain('AMBIGUOUS_RESULT')
  })

  // Retry oracle: this operation is read-only, so identical retries are
  // deterministic re-reads. Any uncertain or changed binding remains STOP.
  it('defines deterministic identical retry and fail-closed readback', () => {
    const contract = commandContract()
    expect(contract, 'the recovery command contract must exist').toBeTruthy()
    if (!contract) return

    expect(contract.retry_contract).toMatchObject({
      identical_retry: 'allowed',
      classification: 'NO_OP_IDENTICAL_RETRY',
    })
    expect(contract.retry_contract.condition).toMatch(/exact|same|identical/i)
    expect(contract.retry_contract.condition).toMatch(/readback|re-read|proof|binding/i)
    expect(contract.reads.join(' ')).toMatch(/GitHub|HANDOFF/i)
    expect(contract.reads.join(' ')).toMatch(/source.*target|target.*source/i)
    expect(contract.post_write_readback).toMatch(/readback|re.read|proof/i)
    expect(contract.post_write_readback).toMatch(/STOP|fail.closed|mismatch/i)
  })

  // CLI discovery is the public authority for Tier-A commands. Help must be
  // machine-readable and explicitly describe the no-write/Context boundary.
  it('publishes safe JSON help and declares the command read-only', () => {
    const contract = commandContract()
    expect(contract, 'the recovery command must be discoverable in the registry').toBeTruthy()
    if (!contract) return

    expect(contract.safe_help_invocation).toBe(`pnpm run ${COMMAND} -- --help --json`)
    expect(contract.operation).toMatch(/read.only|no mutation|no writes/i)
    expect(contract.writes).toEqual([])
    expect(contract.examples.some((example) => example.argv.includes('--help') || example.description.match(/read.only|proof/i))).toBe(true)
  })
})

describe('Architecture A committed RED-WIP reentry runtime proof', () => {
  it('proves the exact #627 fixture without mutation or new authority', () => {
    const state = fixture()
    const result = recoverCommittedWip({
      sourceCwd: state.source,
      binding: bindingFor(state.target),
      run: state.run,
    })

    expect(result).toMatchObject({
      classification: 'SUCCESS',
      route: 'STOP',
      mutationPerformed: false,
      currentHead: HEAD_B,
      nextAction: { type: 'COMMAND', command: 'bemoat:context' },
      details: {
        objective_edit_authority_granted: false,
        wip_state: 'RED_INCOMPLETE',
        green: false,
        objective_2_complete: false,
        objective_n_plus_1_authorized: false,
        handoff_accepted_as_new: false,
        immutable_A: BASE_A,
        immutable_B: HEAD_B,
        exact_tree: TREE_B,
        ancestry: { A_to_B: 'STRICT_ANCESTOR', B_to_A: 'NOT_ANCESTOR' },
      },
    })
    expect(result.details.changed_paths).toEqual([...WIP_PATHS].sort())
    expect(result.details.canonical_source_root).toBe(state.source)
    expect(result.details.canonical_target_root).toBe(state.target)
    expect(state.calls.some(({ command, args }) => command === 'git' && args[0] === 'show' && args.includes(HEAD_B))).toBe(true)
    expect(state.calls.some(({ command, args }) => command === 'git' && args[0] === 'diff' && args.includes(BASE_A) && args.includes(HEAD_B))).toBe(true)
    expectNoMutation(state)
  })

  it.each([
    ['wrong repository binding', { expectedRepository: 'other/repository' }, undefined, undefined],
    ['modified HANDOFF body', {}, { handoffBody: canonicalHandoffBody().replace('Objective 1 —', 'Objective 9 —') }, undefined],
    ['missing HANDOFF', {}, { exactCommentResult: fail('404 Not Found') }, undefined],
    ['reverse ancestry', {}, { reverseAncestryStatus: 0 }, undefined],
    ['divergent ancestry', {}, { forwardAncestryStatus: 1 }, undefined],
    ['dirty target', {}, { targetStatus: ' M src/dirty.ts' }, undefined],
    ['tree mismatch', {}, { tree: '1'.repeat(40) }, undefined],
    ['path provenance mismatch', {}, { paths: [...WIP_PATHS.slice(0, -1), 'src/unowned.ts'] }, undefined],
    ['commit provenance mismatch', {}, { parent: '2'.repeat(40) }, undefined],
  ] as Array<[string, Partial<Parameters<typeof recoverCommittedWip>[0]['binding']>, FixtureOverrides | undefined, string | undefined]>)('%s fails closed without mutation', (_name, bindingOverrides, fixtureOverrides) => {
    const state = fixture(fixtureOverrides)
    const result = recoverCommittedWip({
      sourceCwd: state.source,
      binding: bindingFor(state.target, bindingOverrides),
      run: state.run,
    })

    expect(result.route).toBe('STOP')
    expect(result.classification).not.toBe('SUCCESS')
    expect(result.mutationPerformed).toBe(false)
    expectNoMutation(state)
  })

  it('classifies a target live-ref change during final readback as AMBIGUOUS_RESULT', () => {
    const state = fixture({ targetLiveRefs: [HEAD_B, 'a'.repeat(40)] })
    const result = recoverCommittedWip({
      sourceCwd: state.source,
      binding: bindingFor(state.target),
      run: state.run,
    })

    expect(result).toMatchObject({
      classification: 'AMBIGUOUS_RESULT',
      route: 'STOP',
      mutationPerformed: false,
      nextAction: { type: 'STOP', command: null },
    })
    expectNoMutation(state)
  })
})
