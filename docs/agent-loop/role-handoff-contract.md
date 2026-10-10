# Stateless handoff contract

The only supported cross-agent transport is the append-only strict `HANDOFF`
record published by `bemoat:handoff` after fresh `bemoat:context`
reconstruction.

```text
bemoat:context <issue-number> --json
→ one bounded objective
→ bemoat:handoff <issue-number> --body-file <strict-handoff.json>
→ fresh GitHub reconstruction
```

Context is read-only. Handoff validates one exact schema-v2 JSON object,
appends one Issue comment, and verifies exact readback.

The required `objective_mode` is `implementation` or `read_only`. Read-only
HANDOFFs require `pr: null`, prove an empty protected-base-to-HEAD diff, and
run `pnpm run bemoat:guard:safety` before publication. Neither command creates
managed state, review counters, merge permission, or hidden workflow state.

## Required binding

Every HANDOFF binds:

- repository and Issue identity;
- bounded permitted and prohibited scope;
- executing agent and provider;
- branch, exact head, protected base, and PR when applicable;
- non-empty verified evidence;
- one route and compatible next action;
- explicit stop conditions; and
- local durability requirements and result.

The closed route vocabulary is `IMPLEMENT`, `VERIFY`, `FIX`, `REVIEW`,
`FOUNDER_GATE`, `COMPLETE`, and `STOP`. The canonical field shape and
publication example are in
[handoff-template.md](../mission-control/handoff-template.md). Runtime schema
validation remains authoritative.

## Ordered no-PR objective checkpoints

For an Issue with one exact H2 `## Bounded work sequence` or
`## Bounded work sequence (each new objective requires fresh authorization)`,
and more than one valid, contiguously numbered objective, publish one durable
schema-v2 `IMPLEMENT` HANDOFF after each completed objective. A matching
sequence heading at another level or in setext form fails closed; matching text
inside a fenced Markdown code example is ignored. The Objective 1 HANDOFF may
be an existing read-only record whose objective begins `Objective 1 —`; preserve
its native comment ID, URL, body, and timestamp. Later HANDOFFs use the exact
declared title, `objective_mode: "implementation"`, and one current-head
writer-generated `validation-proof`. The Handoff workflow emits `code` with
`pnpm run bemoat:check` for code-bearing changes, or `docs-only` with
`pnpm run bemoat:guard:safety` for documentation-only changes.

Each HANDOFF from Objective 2 onward includes exactly one checkpoint evidence
entry. Its `value` is a JSON string with exactly these fields:

```json
{
  "kind": "objective-checkpoint",
  "value": "{\"objective_id\":\"2\",\"sequence\":2,\"predecessor_comment_id\":\"6088681412\",\"predecessor_head\":\"<40-character-lowercase-SHA>\"}",
  "url": null
}
```

`objective_id` is the canonical decimal string for the declared ordinal;
`sequence` is the same ordinal as a JSON number. `predecessor_comment_id` is the
native GitHub comment ID of the immediately preceding objective HANDOFF, and
`predecessor_head` is that HANDOFF's exact commit SHA. The new HANDOFF's own
native ID is bound by its exact Issue-comment URL and readback after publication.
Context independently checks the identity and exact-head bindings, then
reconstructs remote Git ancestry from predecessor head to checkpoint head. It
requires the checkpoint to be ahead, with no commits behind and the predecessor
head as merge base; operators do not supply or select that ancestry result.

Fresh Context routes only the immediate next declared objective after a valid
intermediate checkpoint. It routes `PR_READY` / `OPEN_PR` only after the final
declared checkpoint passes the existing validation and durability rules. The
one-objective and no-sequence paths retain their existing behavior. Context
returns `STOP` if a `COMPLETE` HANDOFF would leave declared objectives pending.
It uses declared ordinals and native evidence, never comment timestamps or
hidden Execution-session state.

## Evidence rules

- Reconstruct live GitHub and native Git evidence before acting. A HANDOFF is a
  bound snapshot, not permission to trust stale state.
- The PR current head and exact-head CI/review evidence are authoritative for
  code state.
- Required local changes must be committed and pushed before a durable HANDOFF.
- Missing, stale, partial, conflicting, or ambiguous authority/evidence fails
  closed.
- Historical RESULT, REVIEW_VERDICT, and managed-state comments are read-only
  migration inputs where Context still needs them. They are not supported
  publication formats or alternate routing authority.
- Never merge autonomously.

## Review and correction

Run an independent STANDARD semantic review against the exact candidate head
when policy requires it. A blocking finding routes to bounded correction,
focused and full verification, a new durable exact head, and Delta Review.
Implementation workers do not review their own work. Only the clean final exact
head may route to `FOUNDER_GATE`.

Before publishing native `## REVIEW_VERDICT` evidence, the reviewer must use
the [canonical REVIEW_VERDICT template](../mission-control/review-verdict-template.md)
and validate its exact repository, Issue, PR, approved base, and reviewed head
with the production parser. Keep the immutable finding disposition and
supported supersession syntax from that template unchanged.

## Pre-merge checklist reconciliation gate

Immediately before the final Founder gate, the independent reviewer verifies
the exact candidate head and the agent preparing the gate compares every
source-Issue acceptance criterion with live evidence. The audit records each as
`Done`, `Not done`, `Not applicable`, or `Waiting for CI / human review` and
includes concise evidence for completed items. The gate-preparing agent may
reconcile the Issue checklist only when live evidence uniquely supports the
edit; otherwise it records the mapped audit without changing the Issue body.
The Founder makes the final decision. This gate does not authorize merge.

## Manual validation checklist

- Fresh Context reconstruction used the registered public CLI contract.
- Repository, Issue, protected base, PR, branch, and exact head agree.
- Required CI and independent review bind to the exact head.
- Scope, evidence, stop conditions, next action, and local durability are
  complete and non-ambiguous.
- The HANDOFF body contains exactly one strict JSON record and its readback is
  exact.
- The receiver must reconstruct fresh Context before continuing.
