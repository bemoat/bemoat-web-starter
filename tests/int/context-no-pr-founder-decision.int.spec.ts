import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'

import type { NormalizedContextEvidence, RoleEvidence } from '../../scripts/context/model.ts'
import { parseRoleEvidence } from '../../scripts/context/issue-parser.ts'
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

const issue508CurrentIdentity: Identity = {
  repository: 'bemoat/bemoat-web-starter',
  issue: '508',
  branch: 'fix/508-current-head',
  head: 'a'.repeat(40),
  baseBranch: 'main',
  baseSha: 'b'.repeat(40),
  policySha: 'c'.repeat(40),
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

function historicalPrBoundFounderGate(identity: Identity): RoleEvidence {
  const record: HandoffRecord = {
    schema_version: 2,
    record_type: 'HANDOFF',
    objective_mode: 'implementation',
    repository: 'boat1994/bemoat-web-starter',
    issue_number: identity.issue,
    objective: 'Review the merged historical PR-bound Founder gate.',
    permitted_scope: ['Review historical evidence.'],
    prohibited_scope: ['Do not authorize current no-PR work.'],
    executing_agent: 'Codex independent semantic reviewer',
    provider: 'OpenAI Codex',
    branch: 'feat/508-model-routing-profile-v1',
    exact_head: '0f42af09d9197482afa6696a0f023c8c1654b17b',
    protected_base: { branch: 'main', sha: '416f85586c1761724949fb39ee09a0c052481fcc' },
    pr: {
      number: '528',
      url: 'https://github.com/boat1994/bemoat-web-starter/pull/528',
      base: 'main',
      head: 'feat/508-model-routing-profile-v1',
      head_sha: '0f42af09d9197482afa6696a0f023c8c1654b17b',
    },
    verified_evidence: [{ kind: 'review-verdict', value: 'Historical PR review completed.', url: 'https://github.com/boat1994/bemoat-web-starter/pull/528' }],
    route: 'FOUNDER_GATE',
    next_action: { route: 'FOUNDER_GATE', description: 'Historical Founder review was required for PR #528.' },
    stop_conditions: ['Do not treat this historical PR gate as current no-PR authority.'],
    local_durability: { required: true, durable: true, reason: null },
  }

  return {
    id: 5948729722,
    body: renderHandoffComment(record),
    createdAt: '2026-10-02T09:04:19Z',
    url: 'https://github.com/bemoat/bemoat-web-starter/issues/508#issuecomment-5948729722',
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
  it('ignores a historical merged-PR-bound Founder gate during current no-PR routing', () => {
    const historicalGate = historicalPrBoundFounderGate(issue508CurrentIdentity)

    expect(routeNoPr(issue508CurrentIdentity, [historicalGate])).toMatchObject({
      route: 'IMPLEMENT',
      nextAction: { type: 'COMMAND', command: null },
    })
  })

  // Oracle: Issue #599 requires the reproduced #508 state to proceed into
  // ordinary canonical wrong-Issue recovery after excluding its historical
  // PR-bound gate. Mission Control policy and execution-handoff-contract.md
  // §12 require that recovery to remain STOP, name the unique live #508 branch,
  // and grant no objective-edit authority.
  it('reaches bounded #508 wrong-Issue recovery despite the historical PR-bound Founder gate', () => {
    const sourceBranch = 'fix/590-blocker-resolution-validation'
    const sourceHead = 'a7aa5ee83799963f676b60b990a6b72b3ab1bc93'
    const targetBranch = 'feat/508-model-routing-profile-v1'
    const targetHead = '0f42af09d9197482afa6696a0f023c8c1654b17b'
    const historicalGate = historicalPrBoundFounderGate(issue508CurrentIdentity)
    const evidence = contextFor(issue508CurrentIdentity, [historicalGate])
    evidence.localGit.branch = sourceBranch
    evidence.localGit.head = sourceHead
    evidence.localGit.upstream = `origin/${sourceBranch}`
    evidence.issueBranchRecoveryCandidates = [{
      branch: targetBranch,
      liveHead: targetHead,
      localHead: null,
      remoteTrackingHead: targetHead,
      upstream: null,
      checkedOutElsewhere: false,
      eligible: true,
    }]

    expect(routeContext(evidence)).toMatchObject({
      route: 'STOP',
      nextAction: { type: 'STOP', command: null },
      recovery: {
        type: 'SWITCH_BRANCH',
        command: 'git',
        args: ['switch', '--track', `origin/${targetBranch}`],
        binding: {
          issue_number: '508',
          source: { branch: sourceBranch, head: sourceHead },
          target: { branch: targetBranch, head: targetHead },
        },
      },
    })
  })

  it.each([
    ['malformed', (gate: RoleEvidence) => ({
      ...gate,
      body: gate.body.replace('"verified_evidence": [', '"verified_evidence": ??? ['),
    })],
    ['mismatched native comment identity', (gate: RoleEvidence) => ({
      ...gate,
      url: 'https://github.com/bemoat/bemoat-web-starter/issues/508#issuecomment-9999999999',
    })],
  ])('keeps a malformed current no-PR gate at STOP alongside historical PR-bound evidence (%s)', (_label, invalidate) => {
    const historicalGate = historicalPrBoundFounderGate(issue508CurrentIdentity)
    const currentGate = handoff(issue508CurrentIdentity, { id: 6014391169 })

    expect(routeNoPr(issue508CurrentIdentity, [historicalGate, invalidate(currentGate)]).route).toBe('STOP')
  })

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

/**
 * Oracle: Issue #602's acceptance criteria and the human-approved dedicated
 * FOUNDER_DECISION_REPAIR contract authorize exactly one trusted-Founder repair
 * of exactly one malformed immutable predecessor, bound to the current identity
 * and exact gate. Merged policy §Safety and durability supplies the ordinary
 * decision bindings, strict body, uniqueness, native Founder, immutable evidence,
 * and recomputation rules. No timestamp/order authority or generic permission
 * follows from a repair. These tests catch ignoring repair evidence, trusting a
 * malformed predecessor, bypassing any binding, or skipping remaining history.
 */
describe('immutable no-PR FOUNDER_DECISION_REPAIR lifecycle (#602)', () => {
  const liveIdentity = {
    ...currentIdentity,
    baseSha: '5722b6b8bc6782d1edfea67b7648687700e42659',
    policySha: '3d7b2403b081d7b744c8b2bfecb25adae29632ce',
  }
  const gate = handoff(gateIdentity, { id: 6014391169 })

  function malformedDecision(identity: Identity = liveIdentity): RoleEvidence {
    const valid = founderDecision(identity, gate, { id: 6037687449 })
    // Exact #582 defect: only envelope line breaks are literal backslash-n;
    // the enclosed pretty-printed JSON retains its real line breaks.
    return {
      ...valid,
      body: valid.body.replace('## FOUNDER_DECISION\n\n```json\n', '## FOUNDER_DECISION\\n\\n```json\\n')
        .replace('\n```\n', '\\n```\\n'),
    }
  }

  function repair(
    predecessor: RoleEvidence,
    mutate?: (record: Record<string, unknown>) => void,
    commentId = 6040000001,
    identity: Identity = liveIdentity,
  ): RoleEvidence {
    const valid = founderDecision(identity, gate, { id: commentId })
    const json = JSON.parse(valid.body.slice(valid.body.indexOf('{'), valid.body.lastIndexOf('}') + 1))
    json.record_type = 'FOUNDER_DECISION_REPAIR'
    json.source_founder_decision = {
      comment_id: String(predecessor.id),
      url: predecessor.url,
      body_sha256: createHash('sha256').update(predecessor.body, 'utf8').digest('hex'),
    }
    mutate?.(json)
    return { ...valid, body: '## FOUNDER_DECISION_REPAIR\n\n```json\n' + JSON.stringify(json, null, 2) + '\n```\n' }
  }

  function route(comments: RoleEvidence[], extraHandoffs: RoleEvidence[] = []) {
    const evidence = contextFor(liveIdentity, [gate, ...extraHandoffs])
    Object.assign(evidence.durableContext, parseRoleEvidence([gate, ...extraHandoffs, ...comments]))
    return routeContext(evidence)
  }

  it('keeps the exact literal-newline malformed #582 predecessor at STOP', () => {
    expect(route([malformedDecision()]).route).toBe('STOP')
  })

  it('consumes one exact bound repair and recomputes without changing immutable evidence', () => {
    const predecessor = malformedDecision()
    const correction = repair(predecessor)
    const before = structuredClone([gate, predecessor, correction])
    const result = route([predecessor, correction])
    expect(result).toMatchObject({ route: 'IMPLEMENT', nextAction: { type: 'COMMAND', command: null } })
    expect(route([correction, predecessor])).toEqual(result)
    expect([gate, predecessor, correction]).toEqual(before)
  })

  it.each([
    ['repository', (r: Record<string, unknown>) => { r.repository = 'other/repository' }],
    ['Issue', (r: Record<string, unknown>) => { r.issue_number = '508' }],
    ['PR', (r: Record<string, unknown>) => { r.pr_number = '603' }],
    ['branch', (r: Record<string, unknown>) => { r.branch = 'fix/582-other' }],
    ['head', (r: Record<string, unknown>) => { r.exact_head = 'f'.repeat(40) }],
    ['base branch', (r: Record<string, unknown>) => { (r.protected_base as Record<string, unknown>).branch = 'dev' }],
    ['base SHA', (r: Record<string, unknown>) => { (r.protected_base as Record<string, unknown>).sha = 'f'.repeat(40) }],
    ['policy path', (r: Record<string, unknown>) => { (r.policy as Record<string, unknown>).path = 'other.md' }],
    ['policy ID', (r: Record<string, unknown>) => { (r.policy as Record<string, unknown>).policy_id = 'other' }],
    ['policy version', (r: Record<string, unknown>) => { (r.policy as Record<string, unknown>).version = '1.4.0' }],
    ['policy SHA', (r: Record<string, unknown>) => { (r.policy as Record<string, unknown>).source_sha = 'f'.repeat(40) }],
    ['gate ID', (r: Record<string, unknown>) => { (r.source_founder_gate as Record<string, unknown>).comment_id = '6014391170' }],
    ['gate URL', (r: Record<string, unknown>) => { (r.source_founder_gate as Record<string, unknown>).url += '/wrong' }],
    ['predecessor ID', (r: Record<string, unknown>) => { (r.source_founder_decision as Record<string, unknown>).comment_id = '6037687450' }],
    ['predecessor URL', (r: Record<string, unknown>) => { (r.source_founder_decision as Record<string, unknown>).url += '/wrong' }],
    ['predecessor digest', (r: Record<string, unknown>) => { (r.source_founder_decision as Record<string, unknown>).body_sha256 = 'f'.repeat(64) }],
    ['declared Founder', (r: Record<string, unknown>) => { (r.authority as Record<string, unknown>).login = 'other' }],
    ['declared role', (r: Record<string, unknown>) => { (r.authority as Record<string, unknown>).role = 'OWNER' }],
    ['decision', (r: Record<string, unknown>) => { r.decision = 'DECLINE' }],
    ['schema', (r: Record<string, unknown>) => { r.schema_version = 2 }],
    ['extra key', (r: Record<string, unknown>) => { r.ignore_conflict = true }],
  ])('keeps wrong %s repair evidence at STOP', (_label, mutate) => {
    const predecessor = malformedDecision()
    expect(route([predecessor, repair(predecessor, mutate)]).route).toBe('STOP')
  })

  it.each(['repair', 'predecessor'] as const)('requires trusted native Founder and exact native identity on the %s', (target) => {
    const invalidCases: Array<Partial<RoleEvidence> & { author?: { login: string } }> = [
      { authorLogin: 'other', authorAssociation: 'OWNER' },
      { authorLogin: null },
      { author: { login: 'other' } },
      { url: 'https://github.com/other/repository/issues/582#issuecomment-6037687449' },
      { id: '' },
    ]
    for (const invalid of invalidCases) {
      const predecessor = malformedDecision()
      const correction = repair(predecessor)
      const comments = target === 'repair'
        ? [predecessor, { ...correction, ...invalid }]
        : [{ ...predecessor, ...invalid }, correction]
      expect(route(comments).route).toBe('STOP')
    }
  })

  it('does not accept a changed predecessor body, even if still malformed', () => {
    const predecessor = malformedDecision()
    expect(route([{ ...predecessor, body: predecessor.body + 'changed' }, repair(predecessor)]).route).toBe('STOP')
  })

  it('does not repair syntactically valid ordinary decisions, including stale ones', () => {
    const valid = founderDecision(liveIdentity, gate)
    const stale = founderDecision(gateIdentity, gate)
    for (const predecessor of [valid, stale]) {
      expect(route([predecessor, repair(predecessor)]).route).toBe('STOP')
    }
  })

  it('keeps orphan, duplicate, and competing repairs/decisions at STOP regardless of order or time', () => {
    const predecessor = malformedDecision()
    const correction = repair(predecessor)
    const duplicate = { ...correction, id: 6040000002, url: correction.url.replace('6040000001', '6040000002'), createdAt: '2100-01-01' }
    const otherPredecessor = { ...predecessor, id: 6037687450, url: predecessor.url.replace('6037687449', '6037687450') }
    for (const comments of [
      [correction], [predecessor, correction, duplicate], [duplicate, correction, predecessor],
      [predecessor, otherPredecessor, correction],
      [predecessor, founderDecision(liveIdentity, gate), correction],
      [predecessor, founderDecision(liveIdentity, gate)],
    ]) expect(route(comments).route).toBe('STOP')
  })

  it.each([
    '## FOUNDER_DECISION_REPAIR\n\nFounder says proceed.\n',
    '## FOUNDER_DECISION_REPAIR\\n\\n```json\\n{}\\n```\\n',
  ])('retains malformed repair evidence as a blocker, even without a predecessor (%s)', (body) => {
    const malformed = { ...repair(malformedDecision()), body }
    expect(route([malformed]).route).toBe('STOP')
  })

  it('does not let a repair bypass unresolved STOP or incompatible history, or choose a gate', () => {
    const predecessor = malformedDecision()
    const correction = repair(predecessor)
    const stopped = handoff(liveIdentity, { id: 6040000010, route: 'STOP' })
    const record = JSON.parse(stopped.body.slice(stopped.body.indexOf('{'), stopped.body.lastIndexOf('}') + 1))
    record.verified_evidence = [{ kind: 'stop-blocker', value: 'still-blocked', url: null }]
    stopped.body = renderHandoffComment(record)
    for (const extra of [
      stopped,
      handoff(liveIdentity, { id: 6040000011, route: 'REVIEW' }),
      handoff(gateIdentity, { id: 6040000012 }),
    ]) expect(route([predecessor, correction], [extra]).route).toBe('STOP')
  })

  it('allows only ordinary terminal recomputation when a bound COMPLETE also exists', () => {
    const predecessor = malformedDecision()
    expect(route([predecessor, repair(predecessor)], [handoff(liveIdentity, { id: 6040000013, route: 'COMPLETE' })]))
      .toMatchObject({ route: 'COMPLETE', nextAction: { type: 'COMPLETE' } })
  })

  it('retains child repository isolation when copied starter policy supplies no trusted Founder', () => {
    const predecessor = malformedDecision()
    const evidence = contextFor({ ...liveIdentity, repository: 'child/project' }, [])
    Object.assign(evidence.durableContext, parseRoleEvidence([predecessor, repair(predecessor)]))
    expect(routeContext(evidence).route).toBe('STOP')
  })

  /**
   * Oracle: Issue #606's Founder-approved historical replay protocol §§1–7.
   * It permits only a uniquely consumed immutable gate after replay at A,
   * exact repository/Issue/branch identity, strict A→B ancestry, compatible
   * protected-base ancestry, and current-policy permission. Conflicts and
   * absent proof remain STOP; successful replay removes only that gate and
   * recomputes the ordinary current route. These fixtures model candidate
   * current-policy permission and freshly collected ancestry facts without
   * changing the protected-baseline production evidence contract.
   */
  describe('historical replay of the exact #582 consumed gate at an advanced head (#606)', () => {
    const headB = '963b2e9a91bf3c5b9b1d3e641e42233ba1b4d0f2'
    const repairIdentity: Identity = {
      ...liveIdentity,
      baseSha: '46fe5363697cb24f0db5a6d4338a5540665bb697',
    }
    const currentBase = 'f'.repeat(40)
    const currentPolicySha = 'e'.repeat(40)
    const candidatePermission = 'allowHistoricalNoPrFounderGateReplay'

    function historicalReplayEvidence(options: {
      permission?: boolean
      includeDecision?: boolean
      includeRepair?: boolean
      predecessor?: RoleEvidence
      sourceRepair?: RoleEvidence
      gate?: RoleEvidence
      gateBase?: string
      gateDurable?: boolean
      extraHandoffs?: RoleEvidence[]
      extraDecisions?: RoleEvidence[]
      extraRepairs?: RoleEvidence[]
      currentRepository?: string
      currentIssue?: string
      currentBranch?: string
      headAncestry?: { status: string; mergeBaseSha: string; aheadBy: number; behindBy: number } | null
      baseAncestry?: { status: string; mergeBaseSha: string; aheadBy: number; behindBy: number } | null
      gateBaseAncestry?: { status: string; mergeBaseSha: string; aheadBy: number; behindBy: number } | null
      historicalBase?: string
      currentBase?: string
    } = {}) {
      let sourceGate = options.gate ?? gate
      if (options.gateBase || options.gateDurable !== undefined) {
        const start = sourceGate.body.indexOf('{')
        const end = sourceGate.body.lastIndexOf('}')
        const record = JSON.parse(sourceGate.body.slice(start, end + 1)) as Record<string, unknown>
        if (options.gateBase) (record.protected_base as Record<string, unknown>).sha = options.gateBase
        if (options.gateDurable !== undefined) {
          (record.local_durability as Record<string, unknown>).durable = options.gateDurable
        }
        sourceGate = { ...sourceGate, body: renderHandoffComment(record as unknown as HandoffRecord) }
      }
      const predecessor = options.predecessor ?? malformedDecision(repairIdentity)
      const correction = options.sourceRepair ?? repair(predecessor, undefined, 6039589978, repairIdentity)
      const currentIdentity = {
        ...repairIdentity,
        repository: options.currentRepository ?? repairIdentity.repository,
        issue: options.currentIssue ?? repairIdentity.issue,
        branch: options.currentBranch ?? repairIdentity.branch,
        head: headB,
        baseSha: options.currentBase ?? currentBase,
        policySha: currentPolicySha,
        policyVersion: '1.6.0',
      }
      const evidence = contextFor(currentIdentity, [sourceGate, ...(options.extraHandoffs ?? [])])
      const comments = [sourceGate, ...(options.extraHandoffs ?? []),
        ...(options.includeDecision === false ? [] : [predecessor]),
        ...(options.includeRepair === false ? [] : [correction]),
        ...(options.extraDecisions ?? []), ...(options.extraRepairs ?? []),
      ]
      Object.assign(evidence.durableContext, parseRoleEvidence(comments))

      // Candidate policy snapshot marker: enabled in the positive fixture;
      // disabled is an independent STOP case. Implementer may rename this
      // narrow property while preserving both behaviors.
      Object.assign(evidence.policy, { [candidatePermission]: options.permission ?? true })

      // Candidate transient proof shape records historical replay inputs and
      // exact ancestry readbacks. It deliberately carries no route authority.
      Object.assign(evidence, {
        historicalNoPrFounderGateReplayProofs: [{
          repository: repairIdentity.repository,
          issue_number: repairIdentity.issue,
          branch: repairIdentity.branch,
          source_gate: { comment_id: String(sourceGate.id), url: sourceGate.url },
          source_decision: { comment_id: String(predecessor.id), url: predecessor.url,
            body_sha256: createHash('sha256').update(predecessor.body, 'utf8').digest('hex') },
          source_repair: { comment_id: String(correction.id), url: correction.url,
            body_sha256: createHash('sha256').update(correction.body, 'utf8').digest('hex') },
          historical_head: repairIdentity.head,
          current_head: headB,
          ...(options.headAncestry === null ? {} : { head_ancestry: options.headAncestry ?? {
            status: 'ahead', mergeBaseSha: repairIdentity.head, aheadBy: 2, behindBy: 0,
          } }),
          historical_protected_base: { branch: repairIdentity.baseBranch, sha: options.historicalBase ?? repairIdentity.baseSha },
          historical_gate_protected_base: { branch: gateIdentity.baseBranch, sha: options.gateBase ?? gateIdentity.baseSha },
          current_protected_base: { branch: currentIdentity.baseBranch, sha: currentIdentity.baseSha },
          ...(options.baseAncestry === null ? {} : { protected_base_ancestry: options.baseAncestry ?? {
            status: 'ahead', mergeBaseSha: options.historicalBase ?? repairIdentity.baseSha,
            aheadBy: 1, behindBy: 0,
          } }),
          ...(options.gateBaseAncestry === null ? {} : { gate_base_ancestry: options.gateBaseAncestry ?? {
            status: 'ahead', mergeBaseSha: options.gateBase ?? gateIdentity.baseSha,
            aheadBy: 1, behindBy: 0,
          } }),
          historical_policy: {
            path: policyPath, policy_id: policyId, version: repairIdentity.policyVersion,
            source_sha: repairIdentity.policySha,
          },
          current_policy: {
            path: policyPath, policy_id: policyId, version: currentIdentity.policyVersion,
            source_sha: currentIdentity.policySha,
          },
        }],
      })
      return routeContext(evidence)
    }

    it('replays the exact immutable #582 gate, malformed predecessor, and repair from A and recomputes at B', () => {
      const sourceGate = handoff(gateIdentity, { id: 6014391169 })
      const predecessor = malformedDecision(repairIdentity)
      const correction = repair(predecessor, undefined, 6039589978, repairIdentity)
      const before = structuredClone([sourceGate, predecessor, correction])
      const result = historicalReplayEvidence({ gate: sourceGate, predecessor, sourceRepair: correction })

      // Authority fixes the exclusion (the old gate/decision/repair must not
      // block or re-open a human gate); it leaves the ordinary route to fresh
      // current evidence rather than selecting a fallback here.
      expect(result.route, JSON.stringify(result)).not.toBe('STOP')
      expect(result.route).not.toBe('FOUNDER_GATE')
      expect([sourceGate, predecessor, correction]).toEqual(before)
    })

    it('does not let the consumed gate base conflict with the remaining authorized IMPLEMENT handoff at A', () => {
      const remainingImplementation = handoff(repairIdentity, { id: 6060000003, route: 'IMPLEMENT' })
      const result = historicalReplayEvidence({ extraHandoffs: [remainingImplementation] })

      // #606 §§1 and 7 require replay of A's ordinary authorized continuation,
      // then removal of only the consumed gate before current routing is recomputed.
      // The gate's older compatible base is historical metadata, not a competing
      // base claim for the remaining IMPLEMENT handoff after gate consumption.
      expect(result.route, JSON.stringify(result)).not.toBe('STOP')
      expect(result.route).not.toBe('FOUNDER_GATE')
    })

    it('keeps an unconsumed stale gate and incomplete or malformed repair replay at STOP', () => {
      expect(historicalReplayEvidence({ includeDecision: false, includeRepair: false }).route).toBe('STOP')
      expect(historicalReplayEvidence({ includeRepair: false }).route).toBe('STOP')
      const predecessor = malformedDecision(repairIdentity)
      const correction = repair(predecessor, undefined, 6039589978, repairIdentity)
      expect(historicalReplayEvidence({
        predecessor: { ...predecessor, body: predecessor.body + 'tampered' },
        sourceRepair: correction,
      }).route).toBe('STOP')
      expect(historicalReplayEvidence({ gate: { ...gate, body: gate.body.replace('"exact_head":', '"exact_head_invalid":') } }).route)
        .toBe('STOP')
    })

    it('requires full historical Context at A to authorize replay', () => {
      const unresolvedStop = handoff(gateIdentity, { id: 6060000002, route: 'STOP' })
      const record = JSON.parse(unresolvedStop.body.slice(unresolvedStop.body.indexOf('{'), unresolvedStop.body.lastIndexOf('}') + 1))
      record.verified_evidence = [{ kind: 'stop-blocker', value: 'still-blocked-at-A', url: null }]
      const source = { ...unresolvedStop, body: renderHandoffComment(record) }

      expect(historicalReplayEvidence({ extraHandoffs: [source] }).route).toBe('STOP')
    })

    it('requires the source gate approved-base snapshot to be compatible with the repair and current base', () => {
      expect(historicalReplayEvidence({
        gateBase: 'c'.repeat(40),
        gateBaseAncestry: { status: 'diverged', mergeBaseSha: 'd'.repeat(40), aheadBy: 1, behindBy: 1 },
      }).route).toBe('STOP')
    })

    it('requires the source gate to be durably published', () => {
      expect(historicalReplayEvidence({ gateDurable: false }).route).toBe('STOP')
    })

    it('accepts an unchanged approved base when the source gate base is its proven ancestor', () => {
      const result = historicalReplayEvidence({
        currentBase: repairIdentity.baseSha,
        baseAncestry: { status: 'identical', mergeBaseSha: repairIdentity.baseSha, aheadBy: 0, behindBy: 0 },
        gateBaseAncestry: { status: 'ahead', mergeBaseSha: gateIdentity.baseSha, aheadBy: 1, behindBy: 0 },
      })

      expect(result.route).not.toBe('STOP')
      expect(result.route).not.toBe('FOUNDER_GATE')
    })

    it('does not let historical consumption satisfy an exact current-head Founder gate', () => {
      const currentGateIdentity = {
        ...liveIdentity,
        head: headB,
        baseSha: currentBase,
        policySha: currentPolicySha,
        policyVersion: '1.6.0',
      }
      const currentGate = handoff(currentGateIdentity, { id: 6060000001 })
      expect(historicalReplayEvidence({ extraHandoffs: [currentGate] }).route).toBe('FOUNDER_GATE')
    })

    it.each([
      ['repository', { currentRepository: 'other/repository' }],
      ['Issue', { currentIssue: '583' }],
      ['branch', { currentBranch: 'fix/583-other-branch' }],
    ] as const)('does not carry a consumed gate across wrong %s identity', (_label, options) => {
      expect(historicalReplayEvidence(options).route).toBe('STOP')
    })

    it.each([
      ['non-ancestral', { status: 'diverged', mergeBaseSha: 'a'.repeat(40), aheadBy: 2, behindBy: 1 }],
      ['wrong merge base', { status: 'ahead', mergeBaseSha: 'a'.repeat(40), aheadBy: 2, behindBy: 0 }],
      ['same head', { status: 'ahead', mergeBaseSha: liveIdentity.head, aheadBy: 0, behindBy: 0 }],
      ['missing proof', null],
    ])('keeps %s branch history at STOP', (_label, headAncestry) => {
      expect(historicalReplayEvidence({ headAncestry }).route).toBe('STOP')
    })

    it.each([
      ['divergent', { status: 'diverged', mergeBaseSha: 'b'.repeat(40), aheadBy: 1, behindBy: 1 }],
      ['wrong merge base', { status: 'ahead', mergeBaseSha: 'b'.repeat(40), aheadBy: 1, behindBy: 0 }],
      ['missing proof', null],
    ])('keeps %s protected-base lineage at STOP', (_label, baseAncestry) => {
      expect(historicalReplayEvidence({ baseAncestry }).route).toBe('STOP')
    })

    it('requires explicit permission in the current merged policy', () => {
      expect(historicalReplayEvidence({ permission: false }).route).toBe('STOP')
    })

    it('keeps duplicate gate/decision/repair evidence at STOP', () => {
      const predecessor = malformedDecision()
      const correction = repair(predecessor, undefined, 6039589978)
      const duplicateGate = { ...gate, id: 6014391170, url: gate.url.replace('6014391169', '6014391170') }
      const duplicateDecision = { ...predecessor, id: 6037687450, url: predecessor.url.replace('6037687449', '6037687450') }
      const duplicateRepair = { ...correction, id: 6039589980, url: correction.url.replace(String(correction.id), '6039589980') }
      expect(historicalReplayEvidence({ extraHandoffs: [duplicateGate] }).route).toBe('STOP')
      expect(historicalReplayEvidence({ extraDecisions: [duplicateDecision] }).route).toBe('STOP')
      expect(historicalReplayEvidence({ extraRepairs: [duplicateRepair] }).route).toBe('STOP')
    })
  })
})
