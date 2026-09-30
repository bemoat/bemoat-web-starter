# Stateless command reference

Run repository-defined CLI Discovery before invoking a retained command. Use
the registry-declared inputs, safe help invocation, and live evidence returned
by the command.

## Context

    pnpm run bemoat:context <issue-number> --json

This command is read-only. It binds the Issue to the repository, protected
base, policy path/SHA, PR, exact-head CI, review, and local durability
evidence, then returns one route. Help must not create or modify any state.

## Handoff

    pnpm run bemoat:handoff <issue-number> --body-file <strict-handoff.json>

The body file must contain exactly one strict JSON HANDOFF object. The command
validates scope, authority, evidence, acceptance criteria, required checks,
stop conditions, and next permitted action, then appends and verifies one
durable record.

## Semantic review evidence

HANDOFF remains the append-only cross-agent transport. Its single
`verified_evidence` entry of kind `review-verdict` may reference a native PR
review at `https://github.com/<repository>/pull/<pr>#pullrequestreview-<database-id>`.
Context reads the existing structured `## REVIEW_VERDICT` review body from
native PR evidence; agents need not publish a legacy Issue comment. The body
must bind repository, Issue, PR, approved base branch, and exact reviewed head.
The native commit must agree with that head, the database ID must resolve
uniquely, and the review must be submitted (`COMMENTED`, `APPROVED`, or
`CHANGES_REQUESTED`). Dismissed or pending reviews cannot satisfy lineage.

`CORRECTION REQUIRED` native evidence also requires the existing immutable
finding disposition: schema version 1, the same reviewed head, nonempty
findings with unique IDs, canonical summaries, source threads, and required
evidence. HANDOFF prose cannot replace this finding contract. Historical
Issue-comment REVIEW_VERDICT lineage remains readable for migration.

A REVIEW HANDOFF and its identity-bound FIX or FOUNDER_GATE outcome can coexist;
Context resolves their evidence without rewriting either record or using
comment order or timestamps. Missing or stale referenced FIX evidence,
malformed current evidence, and conflicting exact-head verdicts route STOP.
An absent semantic review routes REVIEW. A correction head requires its own
exact-head Delta Review before FOUNDER_GATE; old-head review cannot satisfy it.

## Protected-base synchronization

    pnpm run bemoat:context:sync-base

This is a separately bounded synchronization utility. It does not authorize
implementation, review, approval, or merge.

## Stop conditions

Stop and return STOP when repository/base/head/CI/policy evidence is ambiguous,
unavailable, conflicting, noncanonical, or not durable. Use BLOCKED_EXTERNAL,
STATE_CONFLICT, or CLI_DISCOVERY_DEFECT when that classification is supported
by the command contract. FOUNDER_GATE remains a human authorization boundary.
No agent may autonomously merge or repair conflicting Issue state.

Historical RESULT and REVIEW_VERDICT comments may be read by Context as
bounded migration evidence only. They do not expose a writer, create a review
route, or grant authority.
