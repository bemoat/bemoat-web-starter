import { describe, expect, it } from 'vitest'

import { parseIssueBody, parseRoleEvidence } from '../../scripts/context/issue-parser.ts'

describe('bemoat:context Issue parsing', () => {
  it('extracts objective, scope, acceptance criteria, and dependencies from stable headings', () => {
    const parsed = parseIssueBody(`
## Goal

Reconstruct a bounded task from native evidence.

## Scope

Only the read-only context command.

## Acceptance Criteria

- [ ] The command is deterministic.
- [x] The command performs no mutation.

## Explicit Dependencies

- Protected main policy.
- Exact-head CI evidence.
`)

    expect(parsed).toEqual({
      objective: 'Reconstruct a bounded task from native evidence.',
      scope: 'Only the read-only context command.',
      acceptanceCriteria: [
        'The command is deterministic.',
        'The command performs no mutation.',
      ],
      dependencies: [
        'Protected main policy.',
        'Exact-head CI evidence.',
      ],
      taskSize: null,
      missionControlMode: null,
      workflowProfile: null,
      objectiveSequence: { status: 'absent', objectives: [] },
    })
  })

  it('recognizes "Scope boundaries" as scope evidence', () => {
    const parsed = parseIssueBody(`
## Goal

Some goal.

## Scope boundaries

Expected implementation is narrow.
`)

    expect(parsed.scope).toBe('Expected implementation is narrow.')
  })

  it.each([
    'Objective boundary',
    'Current objective boundary',
    'Historical objective boundary',
  ])('does not treat "%s" prose as durable Issue scope authority', (heading) => {
    const parsed = parseIssueBody(`
## Goal

Some goal.

## ${heading}

This text may describe an earlier workflow checkpoint.
`)

    expect(parsed.scope).toBeNull()
  })

  it('rejects unrelated headings for scope', () => {
    const parsed = parseIssueBody(`
## Goal

Some goal.

## Scoped things
Not scope.

## My Scope
Not scope.

## Boundaries of Scope
Not scope.
`)

    expect(parsed.scope).toBeNull()
  })

  it('reconstructs both objective and scope for an Issue body shaped like live Issue #434', () => {
    const parsed = parseIssueBody(`
## Goal

Fix the retained current-context Issue parser so the public bemoat:context:sync-base command recognizes the repository's existing "## Scope boundaries" heading as valid scope evidence.

## Scope boundaries

- scripts/context/issue-parser.ts
- directly owned parser/context-sync tests
`)

    expect(parsed.objective).toBe('Fix the retained current-context Issue parser so the public bemoat:context:sync-base command recognizes the repository\'s existing "## Scope boundaries" heading as valid scope evidence.')
    expect(parsed.scope).toBe('- scripts/context/issue-parser.ts\n- directly owned parser/context-sync tests')
  })

  it('treats legacy required Mission Control declarations as STANDARD metadata', () => {
    const parsed = parseIssueBody(`
## Goal

Retire a legacy workflow surface.

**Task size**: core
Mission Control mode: required
Main Issue: #410
Implementation Plan: docs/superpowers/plans/example/implementation-plan.md
`)

    expect(parsed.missionControlMode).toBe('required')
    expect(parsed.workflowProfile).toBe('STANDARD')
  })

  it('treats role comments as evidence and never projects historical RESULT into current state', () => {
    const comments = [
      {
        id: 12,
        body: '## RESULT\n\nHistorical implementation evidence.',
        createdAt: '2026-08-22T00:00:00Z',
        url: 'https://github.com/example/repo/issues/410#issuecomment-12',
      },
      {
        id: 13,
        body: '## HANDOFF\n\nNext: run exact-head verification.',
        createdAt: '2026-08-23T00:00:00Z',
        url: 'https://github.com/example/repo/issues/410#issuecomment-13',
      },
      {
        id: 14,
        body: '## HANDOFF\n\nMalformed comment.',
        createdAt: 'not-a-date',
        url: 'https://github.com/example/repo/issues/410#issuecomment-14',
      },
    ]

    expect(parseRoleEvidence(comments)).toMatchObject({
      latestHandoff: comments[1],
      handoffs: [comments[1]],
      historicalResults: [comments[0]],
      invalid: [comments[2]],
      blockerResolutions: [],
      invalidBlockerResolutions: [],
    })
  })

  it('extracts the ordered objective declaration only from the canonical bounded-work section', () => {
    const parsed = parseIssueBody(`
## Goal

Make multiple ordered objectives in one Issue behave like one continuous Execution job.

## Bounded work sequence (each new objective requires fresh authorization)

- **Objective 1 — Read-only contract/trace:** identify the smallest gap in merged policy/loader/Execution continuation and one real observed multi-objective failure; publish a short decision-ready delta, preserve unrelated open Issue ownership.
- **Objective 2 — Worker-owned regression oracle:** write production-shaped positives for three sequential authorized objectives in one Issue/branch/session and negative controls for first-edit, dirty interruption, STOP, FOUNDER_GATE, malformed/stale evidence, changed base/head, worker independence, and merge gate.
- **Objective 3 — Minimal worker-owned correction:** apply only the demonstrated documentation/dispatch/Context-contract change, run focused proof, complete coherent lawful GREEN checkpoint, publish/read back required HANDOFF, and fresh Context.
- **Objective 4 — Validation + dogfood:** required checks, independent semantic review, exact-head CI, Founder-controlled PR merge; then read-only dogfood on one eligible real multi-objective Issue.

## Notes

- Objective 8 — this is prose outside the canonical sequence.
`)

    expect(parsed).toHaveProperty('objectiveSequence', {
      status: 'valid',
      objectives: [
        { id: '1', title: 'Read-only contract/trace' },
        { id: '2', title: 'Worker-owned regression oracle' },
        { id: '3', title: 'Minimal worker-owned correction' },
        { id: '4', title: 'Validation + dogfood' },
      ],
    })
  })

  it('preserves a legacy Issue with no explicit bounded-work sequence', () => {
    const parsed = parseIssueBody('## Goal\n\nContinue a single bounded task.\n')
    expect(parsed).toHaveProperty('objectiveSequence', { status: 'absent', objectives: [] })
  })

  it('fails closed for objective declarations under a noncanonical heading level', () => {
    const parsed = parseIssueBody(`
## Goal

This Issue explicitly attempts to declare an ordered objective sequence.

### Bounded work sequence (each new objective requires fresh authorization)

- Objective 1 — First bounded objective: perform the first bounded step.
- Objective 2 — Second bounded objective: perform the second bounded step.
`)

    expect(parsed).toHaveProperty('objectiveSequence', { status: 'invalid', objectives: [] })
  })

  it('does not recognize heading text inside a fenced Markdown code block as an objective declaration', () => {
    const parsed = parseIssueBody(`
## Goal

Continue a single bounded task.

\`\`\`markdown
## Bounded work sequence (each new objective requires fresh authorization)

- Objective 1 — Example only: this declaration is inside a code example.
- Objective 2 — Also example text: this declaration is inside a code example.
\`\`\`
`)

    expect(parsed).toHaveProperty('objectiveSequence', { status: 'absent', objectives: [] })
  })

  it('accepts an exactly-one objective declaration without treating it as a multi-objective sequence', () => {
    const parsed = parseIssueBody(`
## Bounded work sequence

- **Objective 1 — One bounded task:** complete the task.
`)
    expect(parsed).toHaveProperty('objectiveSequence', {
      status: 'valid',
      objectives: [{ id: '1', title: 'One bounded task' }],
    })
  })

  it.each([
    ['a gap in ordinals', `## Bounded work sequence\n\n- Objective 1 — First\n- Objective 3 — Third\n`],
    ['a duplicate ordinal', `## Bounded work sequence\n\n- Objective 1 — First\n- Objective 1 — Duplicate\n`],
    ['out-of-order ordinals', `## Bounded work sequence\n\n- Objective 2 — Second\n- Objective 1 — First\n`],
    ['a malformed declaration', `## Bounded work sequence\n\n- Objective one — First\n`],
    ['competing canonical sections', `## Bounded work sequence\n\n- Objective 1 — First\n\n## Bounded work sequence\n\n- Objective 1 — First\n- Objective 2 — Second\n`],
  ])('marks %s as an invalid ordered declaration', (_story, body) => {
    const parsed = parseIssueBody(body)
    expect(parsed).toHaveProperty('objectiveSequence', { status: 'invalid', objectives: [] })
  })

  it('parses structured BLOCKER_RESOLUTION records without treating prose or timestamps as authority', () => {
    const resolution = {
      id: 15,
      body: '## BLOCKER_RESOLUTION\n\n```json\n{}\n```\n',
      createdAt: 'not-a-date',
      url: 'https://github.com/example/repo/issues/410#issuecomment-15',
      author: { login: 'founder' },
      authorAssociation: 'OWNER',
    }
    const prose = {
      id: 16,
      body: '## FOUNDER_DECISION\n\nThis text is context only.',
      createdAt: '2026-08-23T00:00:00Z',
      url: 'https://github.com/example/repo/issues/410#issuecomment-16',
    }

    expect(parseRoleEvidence([resolution, prose])).toMatchObject({
      blockerResolutions: [{ id: 15, authorLogin: 'founder', authorAssociation: 'OWNER' }],
      invalidBlockerResolutions: [],
      historicalResults: [],
    })
  })

  it('retains conflicting explicit and native Founder author identities for fail-closed routing', () => {
    const resolution = {
      id: 17,
      body: '## BLOCKER_RESOLUTION\n\n```json\n{}\n```\n',
      createdAt: '2026-08-23T00:00:00Z',
      url: 'https://github.com/example/repo/issues/410#issuecomment-17',
      authorLogin: 'founder',
      author: { login: 'different-person' },
      authorAssociation: 'OWNER',
    }

    expect(parseRoleEvidence([resolution]).blockerResolutions[0]?.authorIdentityConflict).toBe(true)
  })

  it('retains native FOUNDER_DECISION evidence without timestamp or association authority', () => {
    const decision = {
      id: 18,
      body: '## FOUNDER_DECISION\n\n```json\n{}\n```\n',
      createdAt: 'not-a-date',
      url: 'https://github.com/example/repo/issues/410#issuecomment-18',
      author: { login: 'founder' },
      authorAssociation: 'OWNER',
    }

    expect(parseRoleEvidence([decision])).toMatchObject({
      founderDecisions: [{ id: 18, authorLogin: 'founder', authorAssociation: 'OWNER' }],
      invalidFounderDecisions: [],
    })
  })

  it('keeps malformed-identity FOUNDER_DECISION evidence visible for fail-closed routing', () => {
    const decision = {
      id: '',
      body: '## FOUNDER_DECISION\n\n```json\n{}\n```\n',
      createdAt: 'not-a-date',
      url: '',
      author: { login: 'founder' },
    }

    expect(parseRoleEvidence([decision])).toMatchObject({
      founderDecisions: [],
      invalidFounderDecisions: [{ id: '', authorLogin: 'founder' }],
    })
  })

  // #602's approved strict repair contract requires native identity and author
  // evidence to survive projection; timestamp and OWNER never grant authority.
  it('projects repair evidence independently and preserves author conflicts and invalid native identity', () => {
    const repair = {
      id: 19,
      body: '## FOUNDER_DECISION_REPAIR\n\n```json\n{}\n```\n',
      createdAt: 'not-a-date',
      url: 'https://github.com/example/repo/issues/410#issuecomment-19',
      authorLogin: 'founder',
      author: { login: 'other' },
      authorAssociation: 'OWNER',
    }
    expect(parseRoleEvidence([repair, { ...repair, id: '', url: '' }])).toMatchObject({
      founderDecisions: [],
      founderDecisionRepairs: [{ id: 19, authorLogin: 'founder', authorIdentityConflict: true }],
      invalidFounderDecisionRepairs: [{ id: '', authorLogin: 'founder', authorIdentityConflict: true }],
    })
  })
})
