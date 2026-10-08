import { describe, expect, it } from 'vitest'

import { routeContext } from '../../scripts/context/router.ts'
import type { NormalizedContextEvidence } from '../../scripts/context/model.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'
import { createContextOutput } from '../../scripts/agent-context.ts'

const repository = 'boat1994/bemoat-web-starter'
const issueNumber = '618'
const branch = 'fix/618-same-issue-clean-acquisition'
const head = 'c8067fcea49488e778fa2d997d742e8c8b4b47b3'
const base = '2e8c85c7310ce3967d9638f8740a212e87b8c7be'
const commentId = 6061118688
const issueUrl = `https://github.com/${repository}/issues/${issueNumber}`

function implementationHandoff(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    schema_version: 2,
    record_type: 'HANDOFF',
    objective_mode: 'implementation',
    repository,
    issue_number: issueNumber,
    objective: 'Deliver the already pushed Issue #618 implementation through its PR workflow.',
    permitted_scope: ['Open one pull request for the verified pushed branch.'],
    prohibited_scope: ['Do not edit source, stage, commit, push, merge, or create extra HANDOFFs.'],
    executing_agent: 'Issue #618 implementation worker',
    provider: 'OpenAI Codex',
    branch,
    exact_head: head,
    protected_base: { branch: 'main', sha: base },
    pr: null,
    verified_evidence: [{
      kind: 'validation-proof',
      value: JSON.stringify({
        status: 'PASS',
        tier: 'code',
        command: 'pnpm run bemoat:check',
        exact_head: head,
      }),
      url: null,
    }],
    route: 'IMPLEMENT',
    next_action: { route: 'IMPLEMENT', description: 'Continue the bounded implementation objective.' },
    stop_conditions: ['Stop if any GitHub, identity, durability, or policy evidence is ambiguous.'],
    local_durability: { required: true, durable: true, reason: null },
    ...overrides,
  }
}

function handoffComment(record: HandoffRecord, id = commentId) {
  return {
    id,
    body: renderHandoffComment(record),
    createdAt: '2026-10-06T12:00:00Z',
    url: `${issueUrl}#issuecomment-${id}`,
  }
}

function evidence(
  comments: ReturnType<typeof handoffComment>[] = [handoffComment(implementationHandoff())],
  overrides: Partial<NormalizedContextEvidence> = {},
): NormalizedContextEvidence {
  const mainUrl = `https://github.com/${repository}/tree/main`
  return {
    repository: {
      owner: 'boat1994',
      name: 'bemoat-web-starter',
      nameWithOwner: repository,
      url: `https://github.com/${repository}`,
    },
    protectedBase: { branch: 'main', sha: base, source: 'live GitHub ref', url: mainUrl },
    policy: {
      path: 'docs/mission-control/mission-control-guide.md',
      policyId: 'bemoat-mission-control',
      version: '1.7.0',
      sourceSha: 'd587ff2c6ac4a314b193e321613c3299c83b6da5',
      trustedFounderLogin: 'bemoat',
      legacyStopHandoffs: [],
      url: `https://github.com/${repository}/blob/main/docs/mission-control/mission-control-guide.md`,
    },
    issue: {
      number: issueNumber,
      title: 'fix(context): reconcile durable no-PR implementation HANDOFF before PR',
      state: 'OPEN',
      url: issueUrl,
      objective: 'Resolve the producer/consumer protocol inconsistency.',
      scope: 'One uniquely verified no-PR implementation HANDOFF may progress to PR creation only.',
      acceptanceCriteria: ['Open a PR without granting source-edit authority.'],
      dependencies: [],
      taskSize: 'small/medium',
      missionControlMode: 'required',
      workflowProfile: 'STANDARD',
    },
    localGit: {
      branch,
      head,
      upstream: `origin/${branch}`,
      originRepository: repository,
      clean: true,
      detached: false,
      pushed: true,
      durable: true,
      reasons: [],
    },
    activePr: null,
    currentHeadVerification: null,
    durableContext: {
      latestHandoff: comments[0] ?? null,
      handoffs: comments,
      historicalResults: [],
      blockerResolutions: [],
      invalidBlockerResolutions: [],
    },
    evidenceErrors: [],
    ...overrides,
  }
}

describe('no-PR implementation HANDOFF to PR-only Context transition', () => {
  it('reconstructs the exact #618 schema-v2 implementation HANDOFF as PR_READY / OPEN_PR only', () => {
    const decision = routeContext(evidence())

    expect(decision).toMatchObject({
      route: 'PR_READY',
      nextAction: {
        type: 'OPEN_PR',
        command: 'gh pr create',
        description: 'Open exactly one PR from the uniquely verified, already-pushed canonical Issue branch to the approved protected base. No source edits or other Git mutations are authorized.',
      },
    })
  })

  it('requires strict compatible ancestry when protected main advanced after HANDOFF publication', () => {
    const advancedBase = 'd'.repeat(40)
    const decision = routeContext(evidence(undefined, {
      protectedBase: {
        branch: 'main',
        sha: advancedBase,
        source: 'live GitHub ref',
        url: `https://github.com/${repository}/tree/main`,
      },
    }))

    // Authority requires compatible ancestry proof before PR_READY. No such proof is present here.
    expect(decision.route).toBe('STOP')
    expect(decision.nextAction.type).toBe('STOP')
  })

  it.each([
    ['duplicate native comment identity', [handoffComment(implementationHandoff(), commentId), handoffComment(implementationHandoff(), commentId)]],
    ['two distinct matching current-head HANDOFFs', [handoffComment(implementationHandoff()), handoffComment(implementationHandoff(), commentId + 1)]],
    ['competing current-head STOP', [handoffComment(implementationHandoff()), handoffComment({
      ...implementationHandoff(),
      schema_version: 3,
      objective_mode: 'read_only',
      route: 'STOP',
      next_action: { route: 'STOP', description: 'A current-head blocker remains.' },
      verified_evidence: [{ kind: 'stop-blocker', value: 'unresolved-gate', url: null }],
    }, commentId + 1)]],
    ['competing current-head FOUNDER_GATE', [handoffComment(implementationHandoff()), handoffComment({
      ...implementationHandoff(),
      objective_mode: 'read_only',
      route: 'FOUNDER_GATE',
      next_action: { route: 'FOUNDER_GATE', description: 'Founder decision required.' },
    }, commentId + 1)]],
    ['incompatible current-head COMPLETE', [handoffComment(implementationHandoff()), handoffComment({
      ...implementationHandoff(),
      objective_mode: 'read_only',
      route: 'COMPLETE',
      next_action: { route: 'COMPLETE', description: 'The objective is complete.' },
    }, commentId + 1)]],
  ])('fails closed for %s history', (_story, comments) => {
    const decision = routeContext(evidence(comments))

    expect(decision.route).toBe('STOP')
    expect(decision.nextAction.type).toBe('STOP')
  })

  function malformedSchemaComment(record: HandoffRecord, id: number) {
    const canonical = handoffComment(record, id)
    const body = canonical.body.replace(/\n}\n```\n$/, ',\n  "unexpected_field": true\n}\n```\n')
    const json = body.match(/```json\n([\s\S]+)\n```\n$/)?.[1]
    expect(json).toBeDefined()
    expect(JSON.parse(json ?? '{}')).toHaveProperty('unexpected_field', true)
    return { ...canonical, body }
  }

  const schemaInvalidCurrentCases: Array<[string, HandoffRecord]> = [
    ['STOP', {
      ...implementationHandoff(),
      schema_version: 3 as const,
      objective_mode: 'read_only' as const,
      route: 'STOP' as const,
      next_action: { route: 'STOP' as const, description: 'A blocker remains.' },
      verified_evidence: [{ kind: 'stop-blocker' as const, value: 'unresolved-blocker', url: null }],
    }],
    ['COMPLETE', {
      ...implementationHandoff(),
      objective_mode: 'read_only' as const,
      route: 'COMPLETE' as const,
      next_action: { route: 'COMPLETE' as const, description: 'The objective is complete.' },
    }],
  ]

  it.each(schemaInvalidCurrentCases)('returns STOP for a parseable schema-invalid same-identity current-head %s HANDOFF', (_route, record) => {
    const malformed = malformedSchemaComment(record, commentId + 1)
    const decision = routeContext(evidence([
      handoffComment(implementationHandoff()),
      malformed,
    ]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  function noncanonicalValidSchemaComment(record: HandoffRecord, id: number) {
    const canonical = handoffComment(record, id)
    const json = canonical.body.match(/```json\n([\s\S]+)\n```\n$/)?.[1]
    expect(json).toBeDefined()
    const parsed = JSON.parse(json ?? '{}') as Record<string, unknown>
    const reordered = Object.fromEntries(Object.entries(parsed).reverse())
    const reorderedJson = JSON.stringify(reordered, null, 2)
    expect(parseHandoffBody(reorderedJson)).toEqual(record)
    const body = `## HANDOFF\n\n\`\`\`json\n${reorderedJson}\n\`\`\`\n`
    expect(body).not.toBe(renderHandoffComment(record))
    return { ...canonical, body }
  }

  const noncanonicalCurrentCases: Array<[string, HandoffRecord]> = [
    ['STOP', {
      ...implementationHandoff(),
      schema_version: 3,
      objective_mode: 'read_only',
      route: 'STOP',
      next_action: { route: 'STOP', description: 'A blocker remains.' },
      verified_evidence: [{ kind: 'stop-blocker', value: 'unresolved-blocker', url: null }],
    }],
    ['COMPLETE', {
      ...implementationHandoff(),
      objective_mode: 'read_only',
      route: 'COMPLETE',
      next_action: { route: 'COMPLETE', description: 'The objective is complete.' },
    }],
  ]

  it.each(noncanonicalCurrentCases)('returns STOP for a schema-valid but noncanonical same-identity current-head %s HANDOFF', (_route, record) => {
    const noncanonical = noncanonicalValidSchemaComment(record, commentId + 1)
    const decision = routeContext(evidence([
      handoffComment(implementationHandoff()),
      noncanonical,
    ]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  const wrongProtectedBranchHistoryCases: Array<[string, HandoffRecord]> = [
    ['STOP', {
      ...implementationHandoff(),
      schema_version: 3,
      objective_mode: 'read_only',
      protected_base: { branch: 'dev', sha: base },
      route: 'STOP',
      next_action: { route: 'STOP', description: 'A blocker remains.' },
      verified_evidence: [{ kind: 'stop-blocker', value: 'unresolved-blocker', url: null }],
    }],
    ['COMPLETE', {
      ...implementationHandoff(),
      objective_mode: 'read_only',
      protected_base: { branch: 'dev', sha: base },
      route: 'COMPLETE',
      next_action: { route: 'COMPLETE', description: 'The objective is complete.' },
    }],
  ]

  it.each(wrongProtectedBranchHistoryCases)('returns STOP for same-identity %s history bound to a different protected-base branch', (_route, history) => {
    const decision = routeContext(evidence([
      handoffComment(implementationHandoff()),
      handoffComment(history, commentId + 1),
    ]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it.each([
    ['dirty local worktree', { clean: false }],
    ['unpushed local branch', { pushed: false, durable: false }],
  ])('does not authorize PR_READY with %s', (_story, localGit) => {
    const decision = routeContext(evidence(undefined, {
      localGit: { ...evidence().localGit, ...localGit },
    }))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it.each([
    ['wrong repository', { repository: 'other/repository' }],
    ['wrong Issue', { issue_number: '617' }],
    ['wrong branch', { branch: 'fix/617-other-issue' }],
    ['wrong exact head', { exact_head: 'e'.repeat(40) }],
    ['wrong protected-base branch', { protected_base: { branch: 'dev', sha: base } }],
    ['non-durable HANDOFF', { local_durability: { required: true, durable: false, reason: 'Not pushed.' } }],
  ] as const)('does not return PR_READY for %s evidence', (_story, overrides) => {
    const decision = routeContext(evidence([handoffComment(implementationHandoff(overrides))]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it.each([
    ['wrong HANDOFF route', { route: 'VERIFY', next_action: { route: 'VERIFY', description: 'Verify the implementation.' } }],
    ['wrong objective mode', { objective_mode: 'read_only' }],
  ] as const)('returns STOP for %s', (_story, overrides) => {
    const decision = routeContext(evidence([handoffComment(implementationHandoff(overrides))]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('returns STOP when the current policy identity is not the canonical Mission Control policy', () => {
    const current = evidence()
    const decision = routeContext(evidence(undefined, {
      policy: { ...current.policy, policyId: 'other-policy' },
    }))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('does not return PR_READY when validation proof is missing', () => {
    const malformed = implementationHandoff({ verified_evidence: [{ kind: 'focused-tests', value: 'Tests passed.', url: null }] })
    const decision = routeContext(evidence([handoffComment(malformed)]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('returns STOP for a current-head read-only IMPLEMENT HANDOFF without validation-proof', () => {
    // Founder eligibility requires an implementation-mode HANDOFF and explicitly
    // requires validation evidence; otherwise Context must STOP.
    const malformed = implementationHandoff({
      objective_mode: 'read_only',
      verified_evidence: [{ kind: 'focused-tests', value: 'Read-only review performed.', url: null }],
    })
    const decision = routeContext(evidence([handoffComment(malformed)]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('does not treat a writer-generated read-only validation proof as PR_READY implementation proof', () => {
    // The public HANDOFF writer emits tier "read-only" with the guard:safety
    // command for objective_mode=read_only. Founder eligibility requires an
    // implementation-mode HANDOFF and passing code-tier validation; only
    // PR_READY is excluded here because ordinary read-only reconstruction is
    // separately supported by Mission Control policy.
    const readOnly = implementationHandoff({
      objective_mode: 'read_only',
      verified_evidence: [{
        kind: 'validation-proof',
        value: JSON.stringify({
          status: 'PASS',
          tier: 'read-only',
          command: 'pnpm run bemoat:guard:safety',
          exact_head: head,
        }),
        url: null,
      }],
    })
    const decision = routeContext(evidence([handoffComment(readOnly)]))

    expect(decision.route).not.toBe('PR_READY')
    expect(decision.nextAction.type).not.toBe('OPEN_PR')
  })

  it('preserves read-only no-change IMPLEMENT reconstruction with the writer-generated read-only proof', () => {
    // The HANDOFF writer emits this proof for an empty protected-base diff.
    // Mission Control's no-change read-only reconstruction remains IMPLEMENT
    // with no mutation command; the PR_READY rule still excludes it because
    // it is read_only and carries a read-only-tier proof.
    const readOnly = implementationHandoff({
      objective_mode: 'read_only',
      protected_base: { branch: 'main', sha: head },
      verified_evidence: [{
        kind: 'validation-proof',
        value: JSON.stringify({
          status: 'PASS',
          tier: 'read-only',
          command: 'pnpm run bemoat:guard:safety',
          exact_head: head,
        }),
        url: null,
      }],
    })
    const current = evidence([handoffComment(readOnly)], {
      protectedBase: {
        branch: 'main',
        sha: head,
        source: 'live GitHub ref',
        url: `https://github.com/${repository}/tree/main`,
      },
    })
    const decision = routeContext(current)

    expect(decision).toMatchObject({
      route: 'IMPLEMENT',
      nextAction: { type: 'COMMAND', command: null },
    })
  })

  const staleHistoryCases: Array<[string, HandoffRecord]> = [
    ['stale STOP', {
      ...implementationHandoff(),
      schema_version: 3,
      objective_mode: 'read_only',
      exact_head: 'f'.repeat(40),
      route: 'STOP' as const,
      next_action: { route: 'STOP' as const, description: 'Resolve the historical blocker.' },
      verified_evidence: [{ kind: 'stop-blocker' as const, value: 'historical-blocker', url: null }],
    }],
    ['stale COMPLETE', {
      ...implementationHandoff(),
      objective_mode: 'read_only',
      exact_head: 'f'.repeat(40),
      route: 'COMPLETE' as const,
      next_action: { route: 'COMPLETE' as const, description: 'Historical objective completed.' },
    }],
  ]

  it.each(staleHistoryCases)('returns STOP when an otherwise eligible candidate has %s history', (_story, stale) => {
    // Founder eligibility explicitly excludes stale STOP/COMPLETE history and
    // requires STOP when any eligibility condition is unmet.
    const decision = routeContext(evidence([
      handoffComment(implementationHandoff()),
      handoffComment(stale, commentId + 1),
    ]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it.each(staleHistoryCases)('returns STOP for parseable malformed %s HANDOFF history', (_story, stale) => {
    const canonical = handoffComment(stale, commentId + 1)
    const body = canonical.body.replace(/\n}\n```\n$/, ',\n  "unexpected_field": true\n}\n```\n')
    const malformedStale = { ...canonical, body }

    // Keep this a parseable payload whose extra field makes the strict
    // HANDOFF schema invalid, rather than a JSON syntax error.
    const json = body.match(/```json\n([\s\S]+)\n```\n$/)?.[1]
    expect(json).toBeDefined()
    expect(JSON.parse(json ?? '{}')).toHaveProperty('unexpected_field', true)

    const decision = routeContext(evidence([
      handoffComment(implementationHandoff()),
      malformedStale,
    ]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('serializes PR_READY action text under next_action.description exactly', () => {
    const current = evidence()
    const decision = routeContext(current)
    const output = JSON.parse(JSON.stringify(createContextOutput(current, decision, issueNumber))) as {
      route: string
      next_action: { type: string; command: string | null; description?: string; reason?: unknown }
    }

    expect(output).toMatchObject({
      route: 'PR_READY',
      next_action: {
        type: 'OPEN_PR',
        command: 'gh pr create',
        description: 'Open exactly one PR from the uniquely verified, already-pushed canonical Issue branch to the approved protected base. No source edits or other Git mutations are authorized.',
      },
    })
    expect(output.next_action).not.toHaveProperty('reason')
  })

  it('returns STOP when multiple validation proofs are present', () => {
    const original = implementationHandoff()
    const decision = routeContext(evidence([handoffComment({
      ...original,
      verified_evidence: [...original.verified_evidence, ...original.verified_evidence],
    })]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it.each([
    ['malformed JSON', '{not-json'],
    ['failed validation', JSON.stringify({ status: 'FAIL', tier: 'code', command: 'pnpm run bemoat:check', exact_head: head })],
    ['stale exact-head validation', JSON.stringify({ status: 'PASS', tier: 'code', command: 'pnpm run bemoat:check', exact_head: 'f'.repeat(40) })],
  ])('does not return PR_READY with %s proof', (_story, proof) => {
    const malformed = implementationHandoff({
      verified_evidence: [{ kind: 'validation-proof', value: proof, url: null }],
    })
    const decision = routeContext(evidence([handoffComment(malformed)]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it.each([
    ['native comment ID mismatch', { id: commentId + 1 }],
    ['wrong native Issue URL', { url: `https://github.com/${repository}/issues/617#issuecomment-${commentId}` }],
    ['noncanonical malformed body', { body: '## HANDOFF\n\nnot a strict schema-v2 record\n' }],
  ])('does not return PR_READY for %s', (_story, patch) => {
    const canonical = handoffComment(implementationHandoff())
    const decision = routeContext(evidence([{ ...canonical, ...patch }]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('continues ordinary exact-head Context routing after the PR is created', () => {
    const current = evidence()
    const advancedBase = 'd'.repeat(40)
    const decision = routeContext({
      ...current,
      protectedBase: { ...current.protectedBase, sha: advancedBase },
      activePr: {
        number: '620',
        state: 'OPEN',
        draft: false,
        url: `https://github.com/${repository}/pull/620`,
        baseBranch: 'main',
        baseSha: advancedBase,
        headBranch: branch,
        headSha: head,
        merged: false,
        mergeCommitSha: null,
      },
      currentHeadVerification: {
        exactHead: head,
        checks: { status: 'PENDING', complete: false, failed: false, pending: true, required: true },
        reviews: { required: true, approved: false, exactHead: false, approvedCount: 0, exactHeadApprovedCount: 0 },
        protection: { available: true, requiredChecks: ['CI'], requiredApprovals: 1 },
      },
    })

    expect(decision).toMatchObject({ route: 'VERIFY', nextAction: { type: 'COMMAND' } })
  })

  it('does not treat a malformed pre-PR HANDOFF as harmless history on an active PR', () => {
    const canonical = handoffComment(implementationHandoff())
    const malformedHandoff = { ...canonical, body: `${canonical.body} ` }
    const current = evidence([malformedHandoff])
    const decision = routeContext({
      ...current,
      activePr: {
        number: '620',
        state: 'OPEN',
        draft: false,
        url: `https://github.com/${repository}/pull/620`,
        baseBranch: 'main',
        baseSha: base,
        headBranch: branch,
        headSha: head,
        merged: false,
        mergeCommitSha: null,
      },
      currentHeadVerification: {
        exactHead: head,
        checks: { status: 'PENDING', complete: false, failed: false, pending: true, required: true },
        reviews: { required: true, approved: false, exactHead: false, approvedCount: 0, exactHeadApprovedCount: 0 },
        protection: { available: true, requiredChecks: ['CI'], requiredApprovals: 1 },
      },
    })

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })
})
