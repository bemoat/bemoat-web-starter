import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { routeContext } from '../../scripts/context/router.ts'
import type { NormalizedContextEvidence } from '../../scripts/context/model.ts'
import { parseIssueBody, parseRoleEvidence } from '../../scripts/context/issue-parser.ts'
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

const multiObjectiveRepository = 'bemoat/bemoat-web-starter'
const multiObjectiveIssueNumber = '627'
const multiObjectiveBranch = 'fix/627-seamless-multi-objective-continuation'
const objectiveTitles = [
  'Read-only contract/trace',
  'Worker-owned regression oracle',
  'Minimal worker-owned correction',
  'Validation + dogfood',
]
const objectiveIssueBody = `## Goal

Make **multiple ordered objectives in one Issue** behave like **one continuous Execution job** for the Founder: **one accountable Execution controller, one canonical Issue branch/lineage, and automatic same-session continuation after each genuinely authorized durable objective**, stopping only at real human/safety gates.

Task size: core
Mission Control mode: required

## Bounded work sequence (each new objective requires fresh authorization)

- **Objective 1 — Read-only contract/trace:** identify the smallest gap in merged policy/loader/Execution continuation and one real observed multi-objective failure; publish a short decision-ready delta, preserve unrelated open Issue ownership.
- **Objective 2 — Worker-owned regression oracle:** write production-shaped positives for three sequential authorized objectives in one Issue/branch/session and negative controls for first-edit, dirty interruption, STOP, FOUNDER_GATE, malformed/stale evidence, changed base/head, worker independence, and merge gate.
- **Objective 3 — Minimal worker-owned correction:** apply only the demonstrated documentation/dispatch/Context-contract change, run focused proof, complete coherent lawful GREEN checkpoint, publish/read back required HANDOFF, and fresh Context.
- **Objective 4 — Validation + dogfood:** required checks, independent semantic review, exact-head CI, Founder-controlled PR merge; then read-only dogfood on one *eligible* real multi-objective Issue (do not mutate #624/#613/#622 histories without their separate authority), record measured Founder prompts/STOPs and terminal disposition.
`

type ObjectiveCheckpointAncestryProof = {
  handoffCommentId: string
  predecessorCommentId: string
  predecessorHead: string
  checkpointHead: string
  mergeBaseSha: string
  aheadBy: number
  behindBy: number
}

type ObjectiveComment = {
  id: string | number
  body: string
  createdAt: string
  url: string
}

const historicalObjectiveOneComment: ObjectiveComment = {
  id: 6088681412,
  body: `## HANDOFF

\`\`\`json
{
  "schema_version": 2,
  "record_type": "HANDOFF",
  "objective_mode": "read_only",
  "repository": "bemoat/bemoat-web-starter",
  "issue_number": "627",
  "objective": "Objective 1 — read-only contract and transition trace: determine whether the reported intra-Issue continuation ambiguity demonstrates a merged policy or Context gap; provide the minimal behavior specification and regression requirements.",
  "permitted_scope": [
    "Read-only inspection of the merged Mission Control guide, Execution contract, project loader, registered Context help/semantics, Issue #627, and public documentary #624 comments.",
    "Characterize Objective 1 only and report evidence, the minimum correction proposal if supported, and bounded positive/negative regression requirements."
  ],
  "prohibited_scope": [
    "No #627 Objective 2 or later work, source/test/document edits, or future-objective pre-authorization.",
    "No inspection or mutation of #624 local worktrees, branches, code, files, or historical comments.",
    "No PR, merge, deploy, production, migration, secret, or unrelated Issue operation."
  ],
  "executing_agent": "Codex #627 Execution Controller",
  "provider": "OpenAI",
  "branch": "fix/627-seamless-multi-objective-continuation",
  "exact_head": "0e99786f0b087de46a2518d5874beb999892dd6c",
  "protected_base": {
    "branch": "main",
    "sha": "0e99786f0b087de46a2518d5874beb999892dd6c"
  },
  "pr": null,
  "verified_evidence": [
    {
      "kind": "authority",
      "value": "Retained fresh #627 Context returned route IMPLEMENT and next_action.type COMMAND on this exact clean, durable branch; issue.scope was null. The Context result was not rerun after the user's instruction.",
      "url": null
    },
    {
      "kind": "authority",
      "value": "The user selected #627 Objective 1 only under the reported Issue-level COMMAND. The live Issue orders Objective 1 first and defines it as read-only contract/transition characterization; no later objective is authorized.",
      "url": "https://github.com/bemoat/bemoat-web-starter/issues/627"
    },
    {
      "kind": "authority",
      "value": "The merged policy and loader require one bounded objective at a time, automatic same-session continuation only for the newly authorized objective, and fresh Context before choosing a later objective.",
      "url": "https://github.com/bemoat/bemoat-web-starter/blob/0e99786f0b087de46a2518d5874beb999892dd6c/docs/mission-control/mission-control-guide.md"
    },
    {
      "kind": "authority",
      "value": "Public #624 evidence documents STOP and mid-objective Context friction but does not establish a fresh authorized post-checkpoint COMMAND that was ignored; Objective 1 found no demonstrated policy violation or basis for requiring objective_id/non-null scope.",
      "url": "https://github.com/bemoat/bemoat-web-starter/issues/624#issuecomment-6087620865"
    },
    {
      "kind": "validation-proof",
      "value": "{\\"status\\":\\"PASS\\",\\"tier\\":\\"read-only\\",\\"command\\":\\"pnpm run bemoat:guard:safety\\",\\"exact_head\\":\\"0e99786f0b087de46a2518d5874beb999892dd6c\\"}",
      "url": null
    }
  ],
  "route": "IMPLEMENT",
  "next_action": {
    "route": "IMPLEMENT",
    "description": "Objective 1 read-only characterization is complete. Run registered CLI Discovery and fresh Context before selecting any later objective; no future objective is pre-authorized."
  },
  "stop_conditions": [
    "Do not begin Objective 2 or later work until fresh Context independently authorizes it.",
    "Do not edit #627 source or test files without the separately required first-edit authorization and workflow prerequisites.",
    "If repository, branch, head, base, Issue, or PR identity changes, reconstruct authority before continuing."
  ],
  "local_durability": {
    "required": true,
    "durable": true,
    "reason": null
  }
}
\`\`\`
`,
  createdAt: '2026-10-09T20:26:11Z',
  url: 'https://github.com/bemoat/bemoat-web-starter/issues/627#issuecomment-6088681412',
}

function historicalObjectiveOneHandoff(): HandoffRecord {
  const json = historicalObjectiveOneComment.body.match(/^## HANDOFF\n\n```json\n([\s\S]*?)\n```\n$/)?.[1]
  if (!json) throw new Error('Native #6088681412 HANDOFF fixture is malformed')
  return parseHandoffBody(json)
}

function objectiveImplementationHandoff(
  ordinal: 2 | 3,
  exactHead: string,
  predecessor: { commentId: string; head: string },
  identity: { issueNumber?: string; branch?: string; titles?: string[]; validationTier?: 'docs-only' | 'code' } = {},
): HandoffRecord {
  const issueNumber = identity.issueNumber ?? multiObjectiveIssueNumber
  const branchName = identity.branch ?? multiObjectiveBranch
  const title = (identity.titles ?? objectiveTitles)[ordinal - 1]!
  const validationTier = identity.validationTier ?? 'code'
  const record = implementationHandoff({
    repository: multiObjectiveRepository,
    issue_number: issueNumber,
    objective: `Objective ${ordinal} — ${title}`,
    branch: branchName,
    exact_head: exactHead,
    protected_base: { branch: 'main', sha: '0e99786f0b087de46a2518d5874beb999892dd6c' },
    verified_evidence: [
      {
        kind: 'validation-proof',
        value: JSON.stringify({
          status: 'PASS',
          tier: validationTier,
          command: validationTier === 'code' ? 'pnpm run bemoat:check' : 'pnpm run bemoat:guard:safety',
          exact_head: exactHead,
        }),
        url: null,
      },
      {
        kind: 'objective-checkpoint',
        value: JSON.stringify({ objective_id: String(ordinal), sequence: ordinal, predecessor_comment_id: predecessor.commentId, predecessor_head: predecessor.head }),
        url: null,
      },
    ],
  })
  return parseHandoffBody(JSON.stringify(record))
}

function objectiveTerminalHandoff(
  route: 'STOP' | 'FOUNDER_GATE' | 'COMPLETE',
  exactHead: string,
): HandoffRecord {
  return parseHandoffBody(JSON.stringify(implementationHandoff({
    schema_version: route === 'STOP' ? 3 : 2,
    objective_mode: 'read_only',
    repository: multiObjectiveRepository,
    issue_number: multiObjectiveIssueNumber,
    objective: 'Objective 1 — Read-only contract/trace',
    branch: multiObjectiveBranch,
    exact_head: exactHead,
    protected_base: { branch: 'main', sha: '0e99786f0b087de46a2518d5874beb999892dd6c' },
    verified_evidence: route === 'STOP'
      ? [{ kind: 'stop-blocker', value: 'unresolved-objective-blocker', url: null }]
      : [{
        kind: 'validation-proof',
        value: JSON.stringify({
          status: 'PASS', tier: 'read-only', command: 'pnpm run bemoat:guard:safety', exact_head: exactHead,
        }),
        url: null,
      }],
    route,
    next_action: { route, description: `Canonical ${route} decision for this exact head.` },
  })))
}

function objectiveComment(record: HandoffRecord, id: string, createdAt: string): ObjectiveComment {
  return {
    id,
    body: renderHandoffComment(record),
    createdAt,
    url: `https://github.com/${record.repository}/issues/${record.issue_number}#issuecomment-${id}`,
  }
}

function multiObjectiveEvidence(
  comments: ObjectiveComment[],
  currentHead: string,
  ancestryProofs: ObjectiveCheckpointAncestryProof[] = [],
  options: { clean?: boolean; issueBody?: string; issueNumber?: string; branch?: string; title?: string } = {},
): NormalizedContextEvidence {
  const issueNumber = options.issueNumber ?? multiObjectiveIssueNumber
  const branch = options.branch ?? multiObjectiveBranch
  const parsedIssue = parseIssueBody(options.issueBody ?? objectiveIssueBody)
  return Object.assign(evidence([], {
    repository: {
      owner: 'bemoat',
      name: 'bemoat-web-starter',
      nameWithOwner: multiObjectiveRepository,
      url: `https://github.com/${multiObjectiveRepository}`,
    },
    protectedBase: {
      branch: 'main',
      sha: '0e99786f0b087de46a2518d5874beb999892dd6c',
      source: 'live GitHub ref',
      url: `https://github.com/${multiObjectiveRepository}/tree/main`,
    },
    policy: {
      ...evidence().policy,
      trustedFounderLogin: 'bemoat',
      url: `https://github.com/${multiObjectiveRepository}/blob/main/docs/mission-control/mission-control-guide.md`,
    },
    issue: {
      ...evidence().issue,
      ...parsedIssue,
      number: issueNumber,
      title: options.title ?? 'fix(execution): seamless multi-objective continuation within one Issue',
      url: `https://github.com/${multiObjectiveRepository}/issues/${issueNumber}`,
      scope: null,
    },
    localGit: {
      ...evidence().localGit,
      branch,
      head: currentHead,
      upstream: `origin/${branch}`,
      originRepository: multiObjectiveRepository,
      clean: options.clean ?? true,
      pushed: true,
      durable: true,
    },
    durableContext: parseRoleEvidence(comments),
  }), {
    objectiveCheckpointAncestryProofs: ancestryProofs,
  })
}

function checkpointAncestryProof(
  handoffCommentId: string,
  predecessorCommentId: string,
  predecessorHead: string,
  checkpointHead: string,
  mergeBaseSha: string,
  aheadBy = 1,
  behindBy = 0,
): ObjectiveCheckpointAncestryProof {
  return { handoffCommentId, predecessorCommentId, predecessorHead, checkpointHead, mergeBaseSha, aheadBy, behindBy }
}

function makeObjectiveCommitLineage(options: {
  initialPredecessorCommentId?: string
  commentIdPrefix?: string
} = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'bemoat-627-objective-lineage-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
  try {
    execFileSync('git', ['clone', '--quiet', '--shared', '--no-checkout', process.cwd(), cwd], { encoding: 'utf8' })
    git('checkout', '--quiet', '--detach', '0e99786f0b087de46a2518d5874beb999892dd6c')
    git('config', 'user.email', 'context-test@example.invalid')
    git('config', 'user.name', 'Context test')
    const baseHead = git('rev-parse', 'HEAD')
    const heads = [baseHead]
    const proofs: ObjectiveCheckpointAncestryProof[] = []
    let predecessorHead = baseHead
    let predecessorCommentId = options.initialPredecessorCommentId ?? String(historicalObjectiveOneComment.id)
    for (const ordinal of [2, 3] as const) {
      const commentId = `${options.commentIdPrefix ?? '700000000'}${ordinal}`
      const path = `objective-${ordinal}.txt`
      writeFileSync(join(cwd, path), `Objective ${ordinal} checkpoint\n`)
      git('add', path)
      git('-c', 'commit.gpgsign=false', 'commit', '-m', `Objective ${ordinal} checkpoint`)
      const head = git('rev-parse', 'HEAD')
      const proof = checkpointAncestryProof(
        commentId,
        predecessorCommentId,
        predecessorHead,
        head,
        git('merge-base', predecessorHead, head),
        Number(git('rev-list', '--count', `${predecessorHead}..${head}`)),
        Number(git('rev-list', '--count', `${head}..${predecessorHead}`)),
      )
      heads.push(head)
      proofs.push(proof)
      predecessorHead = head
      predecessorCommentId = commentId
    }
    return { cwd, heads, proofs }
  } catch (error) {
    rmSync(cwd, { recursive: true, force: true })
    throw error
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

describe('ordered no-PR multi-objective Context continuation', () => {
  let lineage: ReturnType<typeof makeObjectiveCommitLineage>

  beforeAll(() => { lineage = makeObjectiveCommitLineage() })
  afterAll(() => { rmSync(lineage.cwd, { recursive: true, force: true }) })

  it('uses native HANDOFF #6088681412 unchanged as Objective 1', () => {
    const record = historicalObjectiveOneHandoff()

    expect(historicalObjectiveOneComment).toMatchObject({
      id: 6088681412,
      createdAt: '2026-10-09T20:26:11Z',
      url: 'https://github.com/bemoat/bemoat-web-starter/issues/627#issuecomment-6088681412',
    })
    expect(renderHandoffComment(record)).toBe(historicalObjectiveOneComment.body)
    expect(record.repository).toBe('bemoat/bemoat-web-starter')
    expect(record.objective.startsWith('Objective 1 —')).toBe(true)
    expect(record.objective).not.toBe(`Objective 1 — ${objectiveTitles[0]}`)
    expect(record.exact_head).toBe('0e99786f0b087de46a2518d5874beb999892dd6c')
    expect(record.objective_mode).toBe('read_only')
  })

  it('dispatches live #627 Objectives 2, 3, and 4 through three fresh COMMAND transitions', () => {
    const first = historicalObjectiveOneComment
    const firstRecord = historicalObjectiveOneHandoff()
    const second = objectiveComment(objectiveImplementationHandoff(2, lineage.heads[1]!, {
      commentId: String(first.id), head: firstRecord.exact_head,
    }), '7000000002', '2026-10-10T00:00:00Z')
    const third = objectiveComment(objectiveImplementationHandoff(3, lineage.heads[2]!, {
      commentId: String(second.id), head: lineage.heads[1]!,
    }), '7000000003', '2026-10-11T00:00:00Z')
    const afterObjective1 = routeContext(multiObjectiveEvidence([first], firstRecord.exact_head))
    const afterObjective2 = routeContext(multiObjectiveEvidence([first, second], lineage.heads[1]!, [lineage.proofs[0]!]))
    const afterObjective3 = routeContext(multiObjectiveEvidence([first, second, third], lineage.heads[2]!, lineage.proofs.slice(0, 2)))

    expect([
      { route: afterObjective1.route, action: afterObjective1.nextAction.type, objective2Only: afterObjective1.nextAction.description.includes('Objective 2') && !afterObjective1.nextAction.description.includes('Objective 3') && !afterObjective1.nextAction.description.includes('Objective 4') },
      { route: afterObjective2.route, action: afterObjective2.nextAction.type, objective3Only: afterObjective2.nextAction.description.includes('Objective 3') && !afterObjective2.nextAction.description.includes('Objective 2') && !afterObjective2.nextAction.description.includes('Objective 4') },
      { route: afterObjective3.route, action: afterObjective3.nextAction.type, objective4Only: afterObjective3.nextAction.description.includes('Objective 4') && !afterObjective3.nextAction.description.includes('Objective 2') && !afterObjective3.nextAction.description.includes('Objective 3') },
    ]).toEqual([
      { route: 'IMPLEMENT', action: 'COMMAND', objective2Only: true },
      { route: 'IMPLEMENT', action: 'COMMAND', objective3Only: true },
      { route: 'IMPLEMENT', action: 'COMMAND', objective4Only: true },
    ])
  })

  it('reaches PR_READY after the final checkpoint of a synthetic three-objective all-pre-PR Issue', () => {
    const issueNumber = '900'
    const branch = 'fix/900-pre-pr-objective-sequence'
    const titles = ['Read-only characterization', 'Implementation checkpoint', 'Final implementation checkpoint']
    const issueBody = `## Goal\n\nComplete three pre-PR implementation objectives before opening a PR.\n\nTask size: core\nMission Control mode: required\n\n## Bounded work sequence (each new objective requires fresh authorization)\n\n- **Objective 1 — ${titles[0]}:** prepare the bounded change.\n- **Objective 2 — ${titles[1]}:** implement the approved change.\n- **Objective 3 — ${titles[2]}:** finish the implementation checkpoint.\n`
    const syntheticLineage = makeObjectiveCommitLineage({
      initialPredecessorCommentId: '9000000001',
      commentIdPrefix: '900000000',
    })
    try {
      const firstRecord = implementationHandoff({
        repository: multiObjectiveRepository,
        issue_number: issueNumber,
        objective_mode: 'read_only',
        objective: `Objective 1 — ${titles[0]}`,
        branch,
        exact_head: syntheticLineage.heads[0]!,
        protected_base: { branch: 'main', sha: '0e99786f0b087de46a2518d5874beb999892dd6c' },
        verified_evidence: [{
          kind: 'validation-proof',
          value: JSON.stringify({ status: 'PASS', tier: 'read-only', command: 'pnpm run bemoat:guard:safety', exact_head: syntheticLineage.heads[0] }),
          url: null,
        }],
      })
      const first = objectiveComment(firstRecord, '9000000001', '2026-10-10T00:00:00Z')
      const second = objectiveComment(objectiveImplementationHandoff(2, syntheticLineage.heads[1]!, {
        commentId: String(first.id), head: syntheticLineage.heads[0]!,
      }, { issueNumber, branch, titles }), '9000000002', '2026-10-11T00:00:00Z')
      const third = objectiveComment(objectiveImplementationHandoff(3, syntheticLineage.heads[2]!, {
        commentId: String(second.id), head: syntheticLineage.heads[1]!,
      }, { issueNumber, branch, titles }), '9000000003', '2026-10-12T00:00:00Z')
      const afterObjective1 = routeContext(multiObjectiveEvidence([first], syntheticLineage.heads[0]!, [], {
        issueBody, issueNumber, branch, title: 'Synthetic three-objective all-pre-PR Issue',
      }))
      const afterObjective2 = routeContext(multiObjectiveEvidence([first, second], syntheticLineage.heads[1]!, [syntheticLineage.proofs[0]!], {
        issueBody, issueNumber, branch, title: 'Synthetic three-objective all-pre-PR Issue',
      }))
      const afterObjective3 = routeContext(multiObjectiveEvidence([first, second, third], syntheticLineage.heads[2]!, syntheticLineage.proofs.slice(0, 2), {
        issueBody, issueNumber, branch, title: 'Synthetic three-objective all-pre-PR Issue',
      }))

      expect([
        { route: afterObjective1.route, action: afterObjective1.nextAction.type },
        { route: afterObjective2.route, action: afterObjective2.nextAction.type },
        { route: afterObjective3.route, action: afterObjective3.nextAction.type },
      ]).toEqual([
        { route: 'IMPLEMENT', action: 'COMMAND' },
        { route: 'IMPLEMENT', action: 'COMMAND' },
        { route: 'PR_READY', action: 'OPEN_PR' },
      ])
      expect(afterObjective3.nextAction).toMatchObject({
        type: 'OPEN_PR',
        command: 'gh pr create',
        description: expect.stringContaining('No source edits or other Git mutations are authorized.'),
      })
    } finally {
      rmSync(syntheticLineage.cwd, { recursive: true, force: true })
    }
  })

  it('uses declared Objective ordinals when HANDOFF timestamps are out of order', () => {
    const first = historicalObjectiveOneComment
    const firstRecord = historicalObjectiveOneHandoff()
    const second = objectiveComment(objectiveImplementationHandoff(2, lineage.heads[1]!, {
      commentId: String(first.id), head: firstRecord.exact_head,
    }), '7000000002', '2026-10-10T00:00:00Z')
    const third = objectiveComment(objectiveImplementationHandoff(3, lineage.heads[2]!, {
      commentId: String(second.id), head: lineage.heads[1]!,
    }), '7000000003', '2026-10-09T20:25:00Z')
    const decision = routeContext(multiObjectiveEvidence(
      [first, second, third],
      lineage.heads[2]!,
      lineage.proofs.slice(0, 2),
    ))

    expect(decision).toMatchObject({
      route: 'IMPLEMENT',
      nextAction: {
        type: 'COMMAND',
        description: expect.stringContaining('Objective 4'),
      },
    })
  })

  it('accepts the writer-generated docs-only validation proof for an implementation checkpoint', () => {
    const first = historicalObjectiveOneComment
    const firstRecord = historicalObjectiveOneHandoff()
    const secondRecord = objectiveImplementationHandoff(2, lineage.heads[1]!, {
      commentId: String(first.id), head: firstRecord.exact_head,
    }, { validationTier: 'docs-only' })
    const second = objectiveComment(secondRecord, '7000000002', '2026-10-10T00:00:00Z')
    const decision = routeContext(multiObjectiveEvidence([first, second], lineage.heads[1]!, [lineage.proofs[0]!]))

    expect(JSON.parse(secondRecord.verified_evidence[0]!.value)).toEqual({
      status: 'PASS',
      tier: 'docs-only',
      command: 'pnpm run bemoat:guard:safety',
      exact_head: lineage.heads[1],
    })
    expect(decision).toMatchObject({
      route: 'IMPLEMENT',
      nextAction: { type: 'COMMAND', description: expect.stringContaining('Objective 3') },
    })
  })

  it.each([
    ['repository', (current: NormalizedContextEvidence) => { current.repository.nameWithOwner = 'other/repository' }],
    ['Issue', (current: NormalizedContextEvidence) => { current.issue.number = '628' }],
    ['branch', (current: NormalizedContextEvidence) => {
      current.localGit.branch = 'fix/627-renamed-branch'
      current.localGit.upstream = 'origin/fix/627-renamed-branch'
    }],
    ['protected base', (current: NormalizedContextEvidence) => { current.protectedBase.sha = 'e'.repeat(40) }],
    ['current head', (current: NormalizedContextEvidence) => { current.localGit.head = lineage.heads[2]! }],
  ] as Array<[string, (current: NormalizedContextEvidence) => void]>)('stops sequence continuation after %s identity drift', (_story, drift) => {
    const first = historicalObjectiveOneComment
    const firstRecord = historicalObjectiveOneHandoff()
    const second = objectiveComment(objectiveImplementationHandoff(2, lineage.heads[1]!, {
      commentId: String(first.id), head: firstRecord.exact_head,
    }), '7000000002', '2026-10-10T00:00:00Z')
    const current = multiObjectiveEvidence([first, second], lineage.heads[1]!, [lineage.proofs[0]!])
    drift(current)

    const decision = routeContext(current)
    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('preserves a compatible current-head FOUNDER_GATE after read-only Objective 1', () => {
    const first = historicalObjectiveOneComment
    const gate = objectiveComment(objectiveTerminalHandoff('FOUNDER_GATE', lineage.heads[0]!),
      '8000000001', '2026-10-10T00:00:00Z')
    const decision = routeContext(multiObjectiveEvidence([first, gate], lineage.heads[0]!))

    expect(decision).toMatchObject({ route: 'FOUNDER_GATE', nextAction: { type: 'FOUNDER_GATE' } })
  })

  it('does not let Objective 1 COMPLETE terminalize a sequence with Objective 2 still pending', () => {
    const first = historicalObjectiveOneComment
    const complete = objectiveComment(objectiveTerminalHandoff('COMPLETE', lineage.heads[0]!),
      '8000000004', '2026-10-10T00:00:00Z')
    const decision = routeContext(multiObjectiveEvidence([first, complete], lineage.heads[0]!))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('keeps an unresolved current-head STOP ahead of sequence continuation', () => {
    const first = historicalObjectiveOneComment
    const firstRecord = historicalObjectiveOneHandoff()
    const second = objectiveComment(objectiveImplementationHandoff(2, lineage.heads[1]!, {
      commentId: String(first.id), head: firstRecord.exact_head,
    }), '7000000002', '2026-10-10T00:00:00Z')
    const blocker = objectiveComment(objectiveTerminalHandoff('STOP', lineage.heads[1]!),
      '8000000002', '2026-10-11T00:00:00Z')
    const decision = routeContext(multiObjectiveEvidence(
      [first, second, blocker], lineage.heads[1]!, [lineage.proofs[0]!],
    ))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('does not let COMPLETE terminalize an Issue while mutation-capable objective history remains', () => {
    const first = historicalObjectiveOneComment
    const firstRecord = historicalObjectiveOneHandoff()
    const second = objectiveComment(objectiveImplementationHandoff(2, lineage.heads[1]!, {
      commentId: String(first.id), head: firstRecord.exact_head,
    }), '7000000002', '2026-10-10T00:00:00Z')
    const complete = objectiveComment(objectiveTerminalHandoff('COMPLETE', lineage.heads[1]!),
      '8000000003', '2026-10-11T00:00:00Z')
    const decision = routeContext(multiObjectiveEvidence(
      [first, second, complete], lineage.heads[1]!, [lineage.proofs[0]!],
    ))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('fails closed when an Objective 2 checkpoint omits the verified Objective 1 ancestry proof', () => {
    const first = historicalObjectiveOneComment
    const firstRecord = historicalObjectiveOneHandoff()
    const second = objectiveComment(objectiveImplementationHandoff(2, lineage.heads[1]!, {
      commentId: String(first.id), head: firstRecord.exact_head,
    }), '7000000002', '2026-10-10T00:00:00Z')

    const decision = routeContext(multiObjectiveEvidence([first, second], lineage.heads[1]!))
    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('fails closed when the intermediate Objective 2 checkpoint is missing', () => {
    const first = historicalObjectiveOneComment
    const firstRecord = historicalObjectiveOneHandoff()
    const second = objectiveComment(objectiveImplementationHandoff(2, lineage.heads[1]!, {
      commentId: String(first.id), head: firstRecord.exact_head,
    }), '7000000002', '2026-10-10T00:00:00Z')
    const third = objectiveComment(objectiveImplementationHandoff(3, lineage.heads[2]!, {
      commentId: String(second.id), head: lineage.heads[1]!,
    }), '7000000003', '2026-10-11T00:00:00Z')

    const decision = routeContext(multiObjectiveEvidence([first, third], lineage.heads[2]!, [lineage.proofs[1]!]))
    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('fails closed when a checkpoint HANDOFF claims the wrong objective ordinal', () => {
    const first = historicalObjectiveOneComment
    const firstRecord = historicalObjectiveOneHandoff()
    const wrongOrdinal = objectiveImplementationHandoff(2, lineage.heads[1]!, {
      commentId: String(first.id), head: firstRecord.exact_head,
    })
    const wrongRecord = parseHandoffBody(JSON.stringify({
      ...wrongOrdinal,
      objective: `Objective 3 — ${objectiveTitles[2]}`,
      verified_evidence: [
        wrongOrdinal.verified_evidence[0],
        {
          kind: 'objective-checkpoint',
          value: JSON.stringify({ objective_id: '3', sequence: 3, predecessor_comment_id: String(first.id), predecessor_head: firstRecord.exact_head }),
          url: null,
        },
      ],
    }))
    const second = objectiveComment(wrongRecord, '7000000002', '2026-10-10T00:00:00Z')
    const proof = checkpointAncestryProof('7000000002', String(first.id), firstRecord.exact_head, lineage.heads[1]!, lineage.proofs[0]!.mergeBaseSha)
    const decision = routeContext(multiObjectiveEvidence([first, second], lineage.heads[1]!, [proof]))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('keeps an interrupted dirty worktree at STOP after an intermediate checkpoint', () => {
    const first = historicalObjectiveOneComment
    const firstRecord = historicalObjectiveOneHandoff()
    const second = objectiveComment(objectiveImplementationHandoff(2, lineage.heads[1]!, {
      commentId: String(first.id), head: firstRecord.exact_head,
    }), '7000000002', '2026-10-10T00:00:00Z')
    const interrupted = routeContext(multiObjectiveEvidence([first, second], lineage.heads[1]!, [lineage.proofs[0]!], { clean: false }))

    expect(interrupted).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('preserves PR_READY for an exactly-one declared objective', () => {
    const issueNumber = '901'
    const branch = 'fix/901-single-objective'
    const issueBody = '## Goal\n\nComplete one bounded task.\n\nTask size: core\nMission Control mode: required\n\n## Bounded work sequence (each new objective requires fresh authorization)\n\n- **Objective 1 — One bounded task:** complete the task.\n'
    const record = implementationHandoff({
      repository: multiObjectiveRepository,
      issue_number: issueNumber,
      objective: 'Objective 1 — One bounded task',
      branch,
      exact_head: lineage.heads[0]!,
      protected_base: { branch: 'main', sha: '0e99786f0b087de46a2518d5874beb999892dd6c' },
      verified_evidence: [{
        kind: 'validation-proof',
        value: JSON.stringify({ status: 'PASS', tier: 'code', command: 'pnpm run bemoat:check', exact_head: lineage.heads[0] }),
        url: null,
      }],
    })
    const comment = objectiveComment(record, '9010000001', '2026-10-10T00:00:00Z')
    const decision = routeContext(multiObjectiveEvidence([comment], lineage.heads[0]!, [], {
      issueBody, issueNumber, branch, title: 'Synthetic one-objective Issue',
    }))

    expect(decision).toMatchObject({ route: 'PR_READY', nextAction: { type: 'OPEN_PR' } })
  })

  it('fails closed for docs-only validation on an exactly-one declared objective', () => {
    const issueNumber = '902'
    const branch = 'fix/902-single-objective-docs-proof'
    const issueBody = '## Goal\n\nComplete one bounded task.\n\nTask size: core\nMission Control mode: required\n\n## Bounded work sequence (each new objective requires fresh authorization)\n\n- **Objective 1 — One bounded task:** complete the task.\n'
    const record = implementationHandoff({
      repository: multiObjectiveRepository,
      issue_number: issueNumber,
      objective: 'Objective 1 — One bounded task',
      branch,
      exact_head: lineage.heads[0]!,
      protected_base: { branch: 'main', sha: '0e99786f0b087de46a2518d5874beb999892dd6c' },
      verified_evidence: [{
        kind: 'validation-proof',
        value: JSON.stringify({ status: 'PASS', tier: 'docs-only', command: 'pnpm run bemoat:guard:safety', exact_head: lineage.heads[0] }),
        url: null,
      }],
    })
    const comment = objectiveComment(record, '9020000001', '2026-10-10T00:00:00Z')
    const decision = routeContext(multiObjectiveEvidence([comment], lineage.heads[0]!, [], {
      issueBody, issueNumber, branch, title: 'Synthetic one-objective Issue with docs-only proof',
    }))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it('fails closed for malformed live objective declarations', () => {
    const issueBody = `## Goal\n\nInvalid ordered objectives.\n\nTask size: core\nMission Control mode: required\n\n## Bounded work sequence (each new objective requires fresh authorization)\n\n- Objective 1 — First.\n- Objective 3 — Third.\n`
    const decision = routeContext(multiObjectiveEvidence([], lineage.heads[0]!, [], { issueBody }))

    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it.each(['COMPLETE', 'FOUNDER_GATE'] as const)(
    'does not let current-head %s bypass a malformed live objective sequence',
    (route) => {
      const issueBody = `## Goal\n\nInvalid ordered objectives.\n\nTask size: core\nMission Control mode: required\n\n## Bounded work sequence (each new objective requires fresh authorization)\n\n- Objective 1 — First.\n- Objective 3 — Third.\n`
      const first = historicalObjectiveOneComment
      const terminal = objectiveComment(objectiveTerminalHandoff(route, lineage.heads[0]!),
        route === 'COMPLETE' ? '8000000005' : '8000000006', '2026-10-10T00:00:00Z')
      const decision = routeContext(multiObjectiveEvidence([first, terminal], lineage.heads[0]!, [], { issueBody }))

      expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
    },
  )
})
