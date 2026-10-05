import { describe, expect, it } from 'vitest'

import type { NormalizedContextEvidence, RoleEvidence } from '../../scripts/context/model.ts'
import { routeContext } from '../../scripts/context/router.ts'
import { renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'

const repository = 'boat1994/bemoat-web-starter'
const policyPath = 'docs/mission-control/mission-control-guide.md'
const policyId = 'bemoat-mission-control'
const policyVersion = '1.4.0'
const testBaseSha = 'a'.repeat(40)
const testPolicySha = 'b'.repeat(40)
const testHeadSha = 'c'.repeat(40)

type Identity = {
  repository: string
  issue: string
  branch: string
  head: string
  baseBranch: string
  baseSha: string
  policySha: string
  policyVersion: string
}

const issue532: Identity = {
  repository,
  issue: '532',
  branch: 'fix/532-run-to-human-gate-continuation',
  head: '04c26793522fac5349e2ee79de38d94ed9ea917f',
  baseBranch: 'main',
  baseSha: 'fc543f3f92b74cb492498c2ffdebfc845bbd3d6a',
  policySha: 'ecc49947022953ee87a82aefbc3b69888f70a59d',
  policyVersion: '1.3.0',
}

const issue532AfterMerge: Identity = {
  ...issue532,
  baseSha: 'd'.repeat(40),
  policySha: 'e'.repeat(40),
  policyVersion: '1.4.0',
}

const ordinaryIdentity: Identity = {
  repository,
  issue: '410',
  branch: 'feature/410-context',
  head: testHeadSha,
  baseBranch: 'main',
  baseSha: testBaseSha,
  policySha: testPolicySha,
  policyVersion,
}

/**
 * Story authority: protected-main policy at fc543f3 binds STOP resolution to
 * one exact blocker, current policy, and trusted native Founder identity;
 * schema-v2 STOP compatibility is restricted to its explicit allowlist.
 * Founder direction on #554, comment 5987043428, selects a versioned no-PR
 * variant and permits terminal COMPLETE only alongside prior read-only
 * IMPLEMENT records and fully resolved schema-v3 STOPs. The #532 history
 * retains its original base snapshot while new resolution and COMPLETE
 * evidence bind current post-merge base/policy. Conflicting history identities
 * remain STOP. No comment ordering or timestamp selects authority.
 */

function handoff(
  identity: Identity,
  options: {
    id: number
    route?: HandoffRecord['route']
    objectiveMode?: HandoffRecord['objective_mode']
    blockerIds?: string[]
    createdAt?: string
  },
): RoleEvidence {
  const route = options.route ?? 'IMPLEMENT'
  const record: HandoffRecord = {
    schema_version: route === 'STOP' ? 3 : 2,
    record_type: 'HANDOFF',
    objective_mode: options.objectiveMode ?? 'read_only',
    repository: identity.repository,
    issue_number: identity.issue,
    objective: `Bounded ${route} evidence for Issue #${identity.issue}.`,
    permitted_scope: ['Read the current objective evidence.'],
    prohibited_scope: ['Do not begin another objective.'],
    executing_agent: 'Codex test fixture',
    provider: 'OpenAI',
    branch: identity.branch,
    exact_head: identity.head,
    protected_base: { branch: identity.baseBranch, sha: identity.baseSha },
    pr: null,
    verified_evidence: route === 'STOP'
      ? (options.blockerIds ?? ['no-pr-complete-competes-with-existing-current-head-handoffs'])
        .map((value): HandoffRecord['verified_evidence'][number] => ({ kind: 'stop-blocker', value, url: null }))
      : [{ kind: 'authority', value: `The bounded ${route} result is durable.`, url: null }],
    route,
    next_action: { route, description: `Record the ${route} result for this bounded objective.` },
    stop_conditions: ['Stop on conflicting or stale evidence.'],
    local_durability: { required: true, durable: true, reason: null },
  }

  return {
    id: options.id,
    body: renderHandoffComment(record),
    createdAt: options.createdAt ?? '2026-10-04T18:00:00Z',
    url: `https://github.com/${identity.repository}/issues/${identity.issue}#issuecomment-${options.id}`,
  }
}

function resolution(
  source: RoleEvidence,
  identity: Identity,
  blockerId = 'no-pr-complete-competes-with-existing-current-head-handoffs',
  options: {
    id?: number
    mutate?: (record: Record<string, unknown>) => void
    authorLogin?: string | null
    authorAssociation?: string | null
    url?: string
    malformed?: boolean
  } = {},
): RoleEvidence {
  const record: Record<string, unknown> = {
    schema_version: 2,
    record_type: 'BLOCKER_RESOLUTION',
    repository: identity.repository,
    issue_number: identity.issue,
    pr_number: null,
    branch: identity.branch,
    exact_head: identity.head,
    protected_base: { branch: identity.baseBranch, sha: identity.baseSha },
    policy: {
      path: policyPath,
      policy_id: policyId,
      version: identity.policyVersion,
      source_sha: identity.policySha,
    },
    source_stop_handoff: { comment_id: String(source.id), url: source.url },
    blocker_id: blockerId,
    authority: { role: 'FOUNDER', login: 'boat1994' },
  }
  options.mutate?.(record)

  const commentId = options.id ?? 5987049999
  const body = `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`
  return {
    id: commentId,
    body: options.malformed ? `${body}extra` : body,
    createdAt: '2026-10-05T00:00:00Z',
    url: options.url ?? `https://github.com/${identity.repository}/issues/${identity.issue}#issuecomment-${commentId}`,
    authorLogin: options.authorLogin === undefined ? 'boat1994' : options.authorLogin,
    authorAssociation: options.authorAssociation === undefined ? 'OWNER' : options.authorAssociation,
  }
}

function contextFor(
  identity: Identity,
  handoffs: RoleEvidence[],
  blockerResolutions: RoleEvidence[] = [],
  invalidBlockerResolutions: RoleEvidence[] = [],
): NormalizedContextEvidence {
  return {
    repository: {
      owner: identity.repository.split('/')[0]!,
      name: identity.repository.split('/')[1]!,
      nameWithOwner: identity.repository,
      url: `https://github.com/${identity.repository}`,
    },
    protectedBase: {
      branch: identity.baseBranch,
      sha: identity.baseSha,
      source: 'live GitHub ref',
      url: `https://github.com/${identity.repository}/tree/${identity.baseBranch}`,
    },
    policy: {
      path: policyPath,
      policyId,
      version: identity.policyVersion,
      sourceSha: identity.policySha,
      trustedFounderLogin: 'boat1994',
      url: `https://github.com/${identity.repository}/blob/${identity.policySha}/${policyPath}`,
    },
    issue: {
      number: identity.issue,
      title: 'No-PR STOP resolution characterization',
      state: 'OPEN',
      url: `https://github.com/${identity.repository}/issues/${identity.issue}`,
      objective: 'Resolve a current no-PR STOP through exact Founder evidence.',
      scope: 'No-PR schema-v3 STOP routing.',
      acceptanceCriteria: [],
      dependencies: [],
      taskSize: 'core',
      missionControlMode: 'required',
      workflowProfile: 'STANDARD',
    },
    localGit: {
      branch: identity.branch,
      head: identity.head,
      upstream: `origin/${identity.branch}`,
      originRepository: identity.repository,
      clean: true,
      detached: false,
      pushed: true,
      durable: true,
      reasons: [],
    },
    activePr: null,
    currentHeadVerification: null,
    durableContext: {
      latestHandoff: handoffs.at(-1) ?? null,
      handoffs,
      historicalResults: [],
      blockerResolutions,
      invalidBlockerResolutions,
    },
    evidenceErrors: [],
  }
}

function routeNoPr(
  identity: Identity,
  handoffs: RoleEvidence[],
  resolutions: RoleEvidence[] = [],
  invalidResolutions: RoleEvidence[] = [],
) {
  return routeContext(contextFor(identity, handoffs, resolutions, invalidResolutions))
}

describe('no-PR schema-v3 STOP resolution and terminal folding', () => {
  it('reconstructs the durable #532 STOP lifecycle without rewriting its two prior IMPLEMENT HANDOFFs', () => {
    const earlier = handoff(issue532, { id: 5982945098, createdAt: '2026-10-04T18:14:00Z' })
    const later = handoff(issue532, { id: 5983056944, createdAt: '2026-10-04T18:27:44Z' })
    const stop = handoff(issue532, {
      id: 5983158918,
      route: 'STOP',
      blockerIds: ['no-pr-complete-competes-with-existing-current-head-handoffs'],
      createdAt: '2026-10-04T18:40:04Z',
    })
    const staleResolution = resolution(stop, issue532)
    const resolutionRecord = resolution(stop, issue532AfterMerge)

    expect(routeNoPr(issue532AfterMerge, [earlier, later, stop]).route).toBe('STOP')
    expect(routeNoPr(issue532AfterMerge, [earlier, later, stop], [staleResolution]).route).toBe('STOP')
    expect(routeNoPr(issue532AfterMerge, [earlier, later, stop], [resolutionRecord]).route).toBe('IMPLEMENT')

    const complete = handoff(issue532AfterMerge, {
      id: 5983158999,
      route: 'COMPLETE',
      createdAt: '2026-10-04T18:10:00Z',
    })
    expect(routeNoPr(issue532AfterMerge, [earlier, later, stop, complete], [resolutionRecord])).toMatchObject({
      route: 'COMPLETE',
      nextAction: { type: 'COMPLETE', command: null },
    })
  })

  it('removes only the explicitly resolved blocker and recomputes after every blocker is uniquely resolved', () => {
    const stop = handoff(ordinaryIdentity, {
      id: 900,
      route: 'STOP',
      blockerIds: ['first-blocker', 'second-blocker'],
    })
    const first = resolution(stop, ordinaryIdentity, 'first-blocker', { id: 901 })
    const second = resolution(stop, ordinaryIdentity, 'second-blocker', { id: 902 })

    expect(routeNoPr(ordinaryIdentity, [stop], [first]).route).toBe('STOP')
    expect(routeNoPr(ordinaryIdentity, [stop], [first, second]).route).toBe('IMPLEMENT')
  })

  it.each([
    ['schema version', (record: Record<string, unknown>) => { record.schema_version = 1 }],
    ['repository', (record: Record<string, unknown>) => { record.repository = 'other/repository' }],
    ['Issue', (record: Record<string, unknown>) => { record.issue_number = '999' }],
    ['non-null PR', (record: Record<string, unknown>) => { record.pr_number = '411' }],
    ['branch', (record: Record<string, unknown>) => { record.branch = 'feature/410-other' }],
    ['exact head', (record: Record<string, unknown>) => { record.exact_head = 'd'.repeat(40) }],
    ['protected-base branch', (record: Record<string, unknown>) => { (record.protected_base as Record<string, unknown>).branch = 'dev' }],
    ['protected-base SHA', (record: Record<string, unknown>) => { (record.protected_base as Record<string, unknown>).sha = 'd'.repeat(40) }],
    ['policy path', (record: Record<string, unknown>) => { (record.policy as Record<string, unknown>).path = 'other-policy.md' }],
    ['policy ID', (record: Record<string, unknown>) => { (record.policy as Record<string, unknown>).policy_id = 'other-policy' }],
    ['policy version', (record: Record<string, unknown>) => { (record.policy as Record<string, unknown>).version = '9.9.9' }],
    ['policy source SHA', (record: Record<string, unknown>) => { (record.policy as Record<string, unknown>).source_sha = 'd'.repeat(40) }],
    ['source STOP comment ID', (record: Record<string, unknown>) => { (record.source_stop_handoff as Record<string, unknown>).comment_id = '999' }],
    ['source STOP URL', (record: Record<string, unknown>) => { (record.source_stop_handoff as Record<string, unknown>).url = 'https://github.com/boat1994/bemoat-web-starter/issues/410#issuecomment-999' }],
    ['blocker ID', (record: Record<string, unknown>) => { record.blocker_id = 'different-blocker' }],
    ['Founder identity', (record: Record<string, unknown>) => { (record.authority as Record<string, unknown>).login = 'not-the-founder' }],
  ])('keeps a no-PR STOP at STOP when a competing resolution has the wrong %s binding', (_field, mutate) => {
    const stop = handoff(ordinaryIdentity, { id: 900, route: 'STOP' })
    const valid = resolution(stop, ordinaryIdentity, undefined, { id: 901 })
    const wrong = resolution(stop, ordinaryIdentity, undefined, { id: 902, mutate })

    expect(routeNoPr(ordinaryIdentity, [stop], [valid, wrong]).route).toBe('STOP')
  })

  it.each([
    ['native author', { authorLogin: 'someone-else' }],
    ['native association', { authorAssociation: 'MEMBER' }],
    ['native resolution URL', { url: 'https://github.com/other/repository/issues/410#issuecomment-902' }],
    ['strict JSON body', { malformed: true }],
  ])('keeps a no-PR STOP fail-closed for a conflicting %s resolution', (_field, options) => {
    const stop = handoff(ordinaryIdentity, { id: 900, route: 'STOP' })
    const valid = resolution(stop, ordinaryIdentity, undefined, { id: 901 })
    const conflicting = resolution(stop, ordinaryIdentity, undefined, { id: 902, ...options })

    expect(routeNoPr(ordinaryIdentity, [stop], [valid, conflicting]).route).toBe('STOP')
  })

  it('keeps duplicate exact resolutions conflicting even when both are Founder-authored', () => {
    const stop = handoff(ordinaryIdentity, { id: 900, route: 'STOP' })
    const first = resolution(stop, ordinaryIdentity, undefined, { id: 901 })
    const duplicate = resolution(stop, ordinaryIdentity, undefined, { id: 902 })

    expect(routeNoPr(ordinaryIdentity, [stop], [first, duplicate]).route).toBe('STOP')
  })

  it('keeps malformed no-PR resolution evidence conflicting alongside an otherwise valid resolution', () => {
    const stop = handoff(ordinaryIdentity, { id: 900, route: 'STOP' })
    const valid = resolution(stop, ordinaryIdentity, undefined, { id: 901 })
    const malformed = resolution(stop, ordinaryIdentity, undefined, { id: 902, malformed: true })

    expect(routeNoPr(ordinaryIdentity, [stop], [valid, malformed]).route).toBe('STOP')
  })

  it('allows one unique COMPLETE with prior read-only IMPLEMENTs and fully resolved schema-v3 STOPs regardless of comment order', () => {
    const first = handoff(issue532, { id: 5982945098, createdAt: '2026-10-04T18:14:00Z' })
    const second = handoff(issue532, { id: 5983056944, createdAt: '2026-10-04T18:27:44Z' })
    const stop = handoff(issue532, { id: 5983158918, route: 'STOP' })
    const resolutionRecord = resolution(stop, issue532AfterMerge)
    const complete = handoff(issue532AfterMerge, { id: 5983158999, route: 'COMPLETE', createdAt: '2026-10-04T18:10:00Z' })
    const latestComplete = { ...complete, createdAt: '2026-10-04T19:10:00Z' }

    expect(routeNoPr(issue532AfterMerge, [first, second, stop, complete], [resolutionRecord]).route).toBe('COMPLETE')
    expect(routeNoPr(issue532AfterMerge, [latestComplete, stop, second, first], [resolutionRecord]).route).toBe('COMPLETE')
  })

  it('keeps a unique COMPLETE at STOP while any schema-v3 blocker remains unresolved', () => {
    const stop = handoff(issue532, { id: 5983158918, route: 'STOP', blockerIds: ['first', 'second'] })
    const oneResolution = resolution(stop, issue532, 'first')
    const complete = handoff(issue532, { id: 5983158999, route: 'COMPLETE' })

    expect(routeNoPr(issue532, [stop, complete], [oneResolution]).route).toBe('STOP')
  })

  // Authority: command-reference.md says malformed resolution evidence keeps
  // Context at STOP and terminal folding explicitly forbids malformed
  // resolution evidence; mission-control-guide.md repeats that no-PR terminal
  // reconstruction rule. The oracle is therefore STOP even when no STOP
  // HANDOFF invokes the per-blocker resolver.
  it('keeps a unique COMPLETE at STOP when malformed no-PR resolution evidence exists without an applicable STOP', () => {
    const complete = handoff(ordinaryIdentity, { id: 5983158999, route: 'COMPLETE' })
    const malformed = resolution(complete, ordinaryIdentity, undefined, { id: 901, malformed: true })

    expect(routeNoPr(ordinaryIdentity, [complete], [malformed]).route).toBe('STOP')
  })

  it('keeps a unique COMPLETE at STOP when the issue parser classified resolution identity as invalid without an applicable STOP', () => {
    const complete = handoff(ordinaryIdentity, { id: 5983158999, route: 'COMPLETE' })
    const invalid = { ...resolution(complete, ordinaryIdentity, undefined, { id: 901 }), id: '', url: '' }

    expect(routeNoPr(ordinaryIdentity, [complete], [], [invalid]).route).toBe('STOP')
  })

  it('keeps malformed and invalid resolution evidence at STOP independent of HANDOFF and resolution array order', () => {
    const complete = handoff(ordinaryIdentity, { id: 5983158999, route: 'COMPLETE' })
    const prior = handoff(ordinaryIdentity, { id: 5983158998 })
    const validResolution = resolution(complete, ordinaryIdentity, undefined, { id: 901 })
    const malformed = resolution(complete, ordinaryIdentity, undefined, { id: 902, malformed: true })
    const alsoMalformed = resolution(complete, ordinaryIdentity, undefined, { id: 904, malformed: true })
    const invalid = { ...resolution(complete, ordinaryIdentity, undefined, { id: 903 }), id: '', url: '' }
    const alsoInvalid = { ...resolution(complete, ordinaryIdentity, undefined, { id: 905 }), url: '' }

    expect(routeNoPr(ordinaryIdentity, [prior, complete], [validResolution, malformed, alsoMalformed], [invalid, alsoInvalid]).route).toBe('STOP')
    expect(routeNoPr(ordinaryIdentity, [complete, prior], [alsoMalformed, malformed, validResolution], [alsoInvalid, invalid]).route).toBe('STOP')
    expect(routeNoPr(ordinaryIdentity, [complete, prior], [validResolution], [invalid]).route).toBe('STOP')
  })

  it('keeps multiple applicable COMPLETE records at STOP', () => {
    const first = handoff(issue532, { id: 5983158998, route: 'COMPLETE' })
    const second = handoff(issue532, { id: 5983158999, route: 'COMPLETE' })

    expect(routeNoPr(issue532, [first, second]).route).toBe('STOP')
  })

  it('keeps COMPLETE at STOP when a current-head nonterminal HANDOFF is mutation-capable', () => {
    const complete = handoff(issue532, { id: 5983158999, route: 'COMPLETE' })
    const competing = handoff(issue532, {
      id: 5983159000,
      route: 'IMPLEMENT',
      objectiveMode: 'implementation',
    })

    expect(routeNoPr(issue532, [complete, competing]).route).toBe('STOP')
  })

  it.each(['FIX', 'REVIEW', 'FOUNDER_GATE'] as const)(
    'keeps COMPLETE at STOP when current-head %s evidence conflicts with terminalization',
    (route) => {
      const complete = handoff(issue532, { id: 5983158999, route: 'COMPLETE' })
      const competing = handoff(issue532, { id: 5983159000, route, objectiveMode: 'read_only' })

      expect(routeNoPr(issue532, [complete, competing]).route).toBe('STOP')
    },
  )

  it('keeps COMPLETE at STOP when historical HANDOFF identities disagree on the protected-base SHA', () => {
    const complete = handoff(issue532AfterMerge, { id: 5983158999, route: 'COMPLETE' })
    const firstHistorical = handoff(issue532, { id: 5983159000 })
    const conflictingHistorical = handoff({ ...issue532, baseSha: 'f'.repeat(40) }, { id: 5983159001 })

    expect(routeNoPr(issue532AfterMerge, [complete, firstHistorical, conflictingHistorical]).route).toBe('STOP')
  })

  it('keeps no-COMPLETE current-head history at STOP when HANDOFF identities disagree on the protected-base SHA', () => {
    const firstHistorical = handoff(issue532, { id: 5983159002 })
    const conflictingHistorical = handoff({ ...issue532, baseSha: 'f'.repeat(40) }, { id: 5983159003 })

    expect(routeNoPr(issue532AfterMerge, [firstHistorical, conflictingHistorical]).route).toBe('STOP')
  })
})
