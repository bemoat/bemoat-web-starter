import { describe, expect, it } from 'vitest'

import type { NormalizedContextEvidence, RoleEvidence } from '../../scripts/context/model.ts'
import { routeContext } from '../../scripts/context/router.ts'
import { renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'

const policyPath = 'docs/mission-control/mission-control-guide.md'
const policyId = 'bemoat-mission-control'

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

const gateIdentity: Identity = {
  repository: 'bemoat/bemoat-web-starter',
  issue: '582',
  branch: 'fix/582-repository-transfer-identity',
  head: '8889e1898d5d20833143bc568f325175ee46956b',
  baseBranch: 'main',
  baseSha: '8889e1898d5d20833143bc568f325175ee46956b',
  policySha: 'ad392ec782b63042261d51cd98939318b22c053d',
  policyVersion: '1.4.0',
}

const currentIdentity: Identity = {
  ...gateIdentity,
  baseSha: 'd'.repeat(40),
  policySha: 'e'.repeat(40),
  policyVersion: '1.5.0',
}

/**
 * Story authority: merged Mission Control policy v1.4.0 says an unresolved
 * exact-current-head read-only no-PR FOUNDER_GATE is a human decision boundary,
 * bound to canonical repository, Issue, branch, and head, with no timestamp or
 * comment-order selection. Issue #587 requires one strict durable Founder
 * decision bound to that exact source gate and the current protected-base and
 * policy identities; one valid decision must make Context recompute its normal
 * route, while malformed, duplicate, stale, wrong-identity, or wrong-author
 * evidence remains fail-closed. Issue #587 also fixes the live repository and
 * Founder identity to bemoat/bemoat-web-starter and bemoat. BLOCKER_RESOLUTION
 * remains specific to STOP blockers and is not reinterpreted here.
 */

function handoff(
  identity: Identity,
  options: { id: number; route?: HandoffRecord['route'] },
): RoleEvidence {
  const route = options.route ?? 'FOUNDER_GATE'
  const record: HandoffRecord = {
    schema_version: route === 'STOP' ? 3 : 2,
    record_type: 'HANDOFF',
    objective_mode: 'read_only',
    repository: identity.repository,
    issue_number: identity.issue,
    objective: 'Reconstruct the exact human decision boundary.',
    permitted_scope: ['Record the bounded decision outcome.'],
    prohibited_scope: ['Do not infer a decision from prose or order.'],
    executing_agent: 'Codex test fixture',
    provider: 'OpenAI',
    branch: identity.branch,
    exact_head: identity.head,
    protected_base: { branch: identity.baseBranch, sha: identity.baseSha },
    pr: null,
    verified_evidence: [{ kind: 'authority', value: 'This is the exact read-only Founder gate.', url: null }],
    route,
    next_action: { route, description: 'Founder decision required before recomputation.' },
    stop_conditions: ['Stop on conflicting or stale evidence.'],
    local_durability: { required: true, durable: true, reason: null },
  }

  return {
    id: options.id,
    body: renderHandoffComment(record),
    createdAt: '2026-10-04T18:00:00Z',
    url: 'https://github.com/' + identity.repository + '/issues/' + identity.issue + '#issuecomment-' + options.id,
  }
}

function founderDecision(
  identity: Identity,
  sourceGate: RoleEvidence,
  options: {
    id?: number
    mutate?: (record: Record<string, unknown>) => void
    authorLogin?: string | null
    authorAssociation?: string | null
    authorIdentityConflict?: boolean
    createdAt?: string
    body?: string
    url?: string
  } = {},
): RoleEvidence {
  const record: Record<string, unknown> = {
    schema_version: 1,
    record_type: 'FOUNDER_DECISION',
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
    source_founder_gate: { comment_id: String(sourceGate.id), url: sourceGate.url },
    decision: 'PROCEED',
    authority: { role: 'FOUNDER', login: 'bemoat' },
  }
  options.mutate?.(record)

  const commentId = options.id ?? 6019147001
  const fence = String.fromCharCode(96).repeat(3)
  const body = options.body ?? [
    '## FOUNDER_DECISION',
    '',
    fence + 'json',
    JSON.stringify(record, null, 2),
    fence,
    '',
  ].join('\n')
  return {
    id: commentId,
    body,
    createdAt: options.createdAt ?? '2026-10-05T00:00:00Z',
    url: options.url ?? 'https://github.com/' + identity.repository + '/issues/' + identity.issue + '#issuecomment-' + commentId,
    authorLogin: options.authorLogin === undefined ? 'bemoat' : options.authorLogin,
    authorAssociation: options.authorAssociation === undefined ? 'OWNER' : options.authorAssociation,
    ...(options.authorIdentityConflict === undefined ? {} : { authorIdentityConflict: options.authorIdentityConflict }),
  }
}

function mutateDecision(
  source: RoleEvidence,
  mutate: (record: Record<string, unknown>) => void,
): RoleEvidence {
  const fence = String.fromCharCode(96).repeat(3)
  const marker = fence + 'json\n'
  const start = source.body.indexOf(marker)
  const end = source.body.lastIndexOf('\n' + fence)
  if (start < 0 || end <= start) throw new Error('Expected canonical FOUNDER_DECISION JSON envelope')
  const record = JSON.parse(source.body.slice(start + marker.length, end)) as Record<string, unknown>
  mutate(record)
  const body = [
    '## FOUNDER_DECISION',
    '',
    marker.trimEnd(),
    JSON.stringify(record, null, 2),
    fence,
    '',
  ].join('\n')
  return { ...source, body }
}

function contextFor(identity: Identity, handoffs: RoleEvidence[]): NormalizedContextEvidence {
  const evidence: NormalizedContextEvidence = {
    repository: {
      owner: identity.repository.split('/')[0]!,
      name: identity.repository.split('/')[1]!,
      nameWithOwner: identity.repository,
      url: 'https://github.com/' + identity.repository,
    },
    protectedBase: {
      branch: identity.baseBranch,
      sha: identity.baseSha,
      source: 'live GitHub ref',
      url: 'https://github.com/' + identity.repository + '/tree/' + identity.baseBranch,
    },
    policy: {
      path: policyPath,
      policyId,
      version: identity.policyVersion,
      sourceSha: identity.policySha,
      trustedFounderLogin: identity.repository === 'bemoat/bemoat-web-starter' ? 'bemoat' : null,
      url: 'https://github.com/' + identity.repository + '/blob/' + identity.policySha + '/' + policyPath,
    },
    issue: {
      number: identity.issue,
      title: 'No-PR Founder decision consumption',
      state: 'OPEN',
      url: 'https://github.com/' + identity.repository + '/issues/' + identity.issue,
      objective: 'Consume one exact Founder decision without replaying its gate.',
      scope: 'Exact no-PR Founder-gate decision evidence.',
      acceptanceCriteria: [],
      dependencies: [],
      taskSize: 'core',
      missionControlMode: 'required',
      workflowProfile: 'STANDARD',
    },
    localGit: {
      branch: identity.branch,
      head: identity.head,
      upstream: 'origin/' + identity.branch,
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
    },
    evidenceErrors: [],
  }
  Object.assign(evidence.durableContext, { founderDecisions: [], invalidFounderDecisions: [] })
  return evidence
}

function routeNoPr(
  identity: Identity,
  handoffs: RoleEvidence[],
  decisions: RoleEvidence[] = [],
) {
  const evidence = contextFor(identity, handoffs)
  Object.assign(evidence.durableContext, {
    founderDecisions: decisions,
    invalidFounderDecisions: [],
  })
  return routeContext(evidence)
}

describe('exact no-PR FOUNDER_GATE decision consumption', () => {
  it('keeps an unresolved exact #582 gate at FOUNDER_GATE', () => {
    const gate = handoff(gateIdentity, { id: 6014391169 })

    expect(routeNoPr(gateIdentity, [gate])).toMatchObject({
      route: 'FOUNDER_GATE',
      nextAction: { type: 'FOUNDER_GATE', command: null },
    })
  })

  it('consumes one exact #582 Founder decision and recomputes the ordinary route deterministically', () => {
    const gate = handoff(gateIdentity, { id: 6014391169 })
    const decision = founderDecision(currentIdentity, gate, { createdAt: '' })
    const gateBefore = structuredClone(gate)
    const decisionBefore = structuredClone(decision)

    const first = routeNoPr(currentIdentity, [gate], [decision])
    const replay = routeNoPr(currentIdentity, [gate], [decision])

    expect(first).toMatchObject({
      route: 'IMPLEMENT',
      nextAction: { type: 'COMMAND', command: null },
    })
    expect(replay).toEqual(first)
    expect(gate).toEqual(gateBefore)
    expect(decision).toEqual(decisionBefore)
  })

  it.each([
    ['schema version', (record: Record<string, unknown>) => { record.schema_version = 2 }],
    ['repository', (record: Record<string, unknown>) => { record.repository = 'other/repository' }],
    ['Issue', (record: Record<string, unknown>) => { record.issue_number = '999' }],
    ['non-null PR', (record: Record<string, unknown>) => { record.pr_number = '455' }],
    ['branch', (record: Record<string, unknown>) => { record.branch = 'fix/582-other' }],
    ['exact gate head', (record: Record<string, unknown>) => { record.exact_head = 'f'.repeat(40) }],
    ['protected-base branch', (record: Record<string, unknown>) => {
      (record.protected_base as Record<string, unknown>).branch = 'dev'
    }],
    ['protected-base SHA', (record: Record<string, unknown>) => {
      (record.protected_base as Record<string, unknown>).sha = 'f'.repeat(40)
    }],
    ['policy path', (record: Record<string, unknown>) => {
      (record.policy as Record<string, unknown>).path = 'other-policy.md'
    }],
    ['policy ID', (record: Record<string, unknown>) => {
      (record.policy as Record<string, unknown>).policy_id = 'other-policy'
    }],
    ['policy version', (record: Record<string, unknown>) => {
      (record.policy as Record<string, unknown>).version = '9.9.9'
    }],
    ['policy source SHA', (record: Record<string, unknown>) => {
      (record.policy as Record<string, unknown>).source_sha = 'f'.repeat(40)
    }],
    ['source gate comment ID', (record: Record<string, unknown>) => {
      (record.source_founder_gate as Record<string, unknown>).comment_id = '6014391170'
    }],
    ['source gate URL', (record: Record<string, unknown>) => {
      (record.source_founder_gate as Record<string, unknown>).url =
        'https://github.com/bemoat/bemoat-web-starter/issues/582#issuecomment-6014391170'
    }],
    ['decision value', (record: Record<string, unknown>) => { record.decision = 'DECLINE' }],
    ['declared Founder login', (record: Record<string, unknown>) => {
      (record.authority as Record<string, unknown>).login = 'different-founder'
    }],
    ['declared role', (record: Record<string, unknown>) => {
      (record.authority as Record<string, unknown>).role = 'OWNER'
    }],
  ])('fails closed when the decision has the wrong %s binding', (_label, mutate) => {
    const gate = handoff(gateIdentity, { id: 6014391169 })
    const wrong = mutateDecision(founderDecision(currentIdentity, gate), mutate)

    expect(routeNoPr(currentIdentity, [gate], [wrong]).route).toBe('STOP')
  })

  it('fails closed for a wrong native author even when the record claims OWNER', () => {
    const gate = handoff(gateIdentity, { id: 6014391169 })
    const wrong = founderDecision(currentIdentity, gate, {
      authorLogin: 'not-the-founder',
      authorAssociation: 'OWNER',
    })

    expect(routeNoPr(currentIdentity, [gate], [wrong]).route).toBe('STOP')
  })

  /** Canonical FOUNDER_DECISION requires the native comment URL and database ID to identify the same Issue comment; mismatch fails closed. */
  it('fails closed when the decision comment URL does not identify its native comment ID', () => {
    const gate = handoff(gateIdentity, { id: 6014391169 })
    const decision = founderDecision(currentIdentity, gate, {
      id: 6019147001,
      url: 'https://github.com/bemoat/bemoat-web-starter/issues/582#issuecomment-6019147002',
    })

    expect(routeNoPr(currentIdentity, [gate], [decision]).route).toBe('STOP')
  })

  it('fails closed when explicit and native Founder author identities conflict', () => {
    const gate = handoff(gateIdentity, { id: 6014391169 })
    const conflicting = founderDecision(currentIdentity, gate, {
      authorLogin: 'bemoat',
      authorIdentityConflict: true,
    })

    expect(routeNoPr(currentIdentity, [gate], [conflicting]).route).toBe('STOP')
  })

  it('does not require or infer authority from the OWNER association', () => {
    const gate = handoff(gateIdentity, { id: 6014391169 })
    const decision = founderDecision(currentIdentity, gate, { authorAssociation: 'MEMBER' })

    expect(routeNoPr(currentIdentity, [gate], [decision]).route).toBe('IMPLEMENT')
  })

  it('fails closed for duplicate or conflicting decisions regardless of order or timestamps', () => {
    const gate = handoff(gateIdentity, { id: 6014391169 })
    const first = founderDecision(currentIdentity, gate, { id: 6019147001, createdAt: '2100-01-01T00:00:00Z' })
    const duplicate = founderDecision(currentIdentity, gate, { id: 6019147002, createdAt: '1900-01-01T00:00:00Z' })

    expect(routeNoPr(currentIdentity, [gate], [first, duplicate]).route).toBe('STOP')
    expect(routeNoPr(currentIdentity, [gate], [duplicate, first]).route).toBe('STOP')
  })

  it.each([
    ['malformed JSON', '## FOUNDER_DECISION\n\nThis prose is not a decision record.\n'],
    ['extra unknown key', null],
  ])('fails closed for %s decision evidence', (_label, explicitBody) => {
    const gate = handoff(gateIdentity, { id: 6014391169 })
    const base = founderDecision(currentIdentity, gate)
    const invalid = explicitBody === null
      ? mutateDecision(base, (record) => { record.unexpected = true })
      : { ...base, body: explicitBody }

    expect(routeNoPr(currentIdentity, [gate], [invalid]).route).toBe('STOP')
  })

  it('fails closed when a decision has no unique exact source gate', () => {
    const decision = founderDecision(currentIdentity, handoff(gateIdentity, { id: 6014391168 }))

    expect(routeNoPr(currentIdentity, [handoff(gateIdentity, { id: 6014391169 })], [decision]).route).toBe('STOP')
    expect(routeNoPr(currentIdentity, [], [decision]).route).toBe('STOP')
  })

  it('does not let a valid decision bypass incompatible current-head HANDOFF history', () => {
    const gate = handoff(gateIdentity, { id: 6014391169 })
    const review = handoff(currentIdentity, { id: 6014391170, route: 'REVIEW' })
    const decision = founderDecision(currentIdentity, gate)

    expect(routeNoPr(currentIdentity, [gate, review], [decision]).route).toBe('STOP')
  })

  it('recomputes a terminal route only after consuming the exact gate', () => {
    const gate = handoff(gateIdentity, { id: 6014391169 })
    const complete = handoff(currentIdentity, { id: 6014391170, route: 'COMPLETE' })
    const decision = founderDecision(currentIdentity, gate)

    expect(routeNoPr(currentIdentity, [gate, complete], [decision])).toMatchObject({
      route: 'COMPLETE',
      nextAction: { type: 'COMPLETE', command: null },
    })
  })
})
