---
policy_id: bemoat-mission-control
version: 1.7.0
trusted_founder_login: bemoat
legacy_stop_handoffs: 513:5913355141:f8af039bad10c0bc3c98fa69fc2c7ab9fe782180:edf8134ef9892ba7f8ada31365babb3b22bc7a085f480fa2a5a2ff99f8189ed7,509:5906598686:86c0ec49311a1b356ff96be087bb335ea6dc992f:3bffd4a681a4ac1d2c5db5ddc375713565a5905c4886c9c5082eea8b250d8dd2
scope: repository-development
canonical_repository: bemoat/bemoat-web-starter
max_review_cycles: 3
allow_historical_no_pr_founder_gate_replay: true
---

# Stateless coordination policy

This guide is the canonical policy source for Bemoat's stateless
cross-agent workflow. It is read from the approved protected base, never from
an unmerged task branch. Chat history and copied handoffs are context only;
fresh repository and GitHub evidence is authoritative.

## Current protocol

The public coordination protocol has exactly two commands:

    pnpm run bemoat:context <issue-number> --json
    → one bounded objective
    → pnpm run bemoat:handoff <issue-number> --body-file <strict-handoff.json>
    → fresh context

bemoat:context is read-only. It reconstructs repository, protected-base,
Issue, PR, exact-head CI, review, policy, and local-durability evidence and
returns one route. bemoat:handoff appends one validated, read-back-verified
HANDOFF record. Its body file must contain exactly one strict JSON HANDOFF
object.

## Bounded objective execution

Assign exactly one accountable controller per bounded objective. In a
worker-capable Execution, the controller is orchestration-only: it reconstructs
authority, selects only the Context-authorized objective, defines and assigns
bounded worker scopes, synthesizes evidence, resolves contradictions,
independently verifies durable state, audits acceptance criteria, publishes or
verifies required Handoff, reruns fresh Context, and enforces workflow gates.
The controller retains responsibility for the objective contract, authority,
routing, evidence synthesis against live durable state, acceptance criteria,
durable delivery, and fresh Context after durable completion.
The controller must not perform substantive objective execution, including
repository characterization, test/oracle authoring, implementation, focused
testing, deterministic verification, or implementation correction. The
accountable controller role is non-delegable: a worker cannot replace, shadow,
nest, or recursively instantiate an accountable controller for the active
objective.
An outer chat layer that spawns this controller may exist only as a pure
transport/relay shell. Before spawning, it must not interpret Context, select
the objective or worker roles, make STOP / FOUNDER_GATE / COMPLETE decisions,
synthesize evidence into next-action authority, mutate repository state, or
perform implementation, verification, or semantic review. If it performs any
of those actions, it is acting as a controller and cannot spawn another
controller.

Workers own objective execution. Assign a read-only characterization worker for
substantive inspection; assign worker-owned test/oracle work when applicable;
assign exactly one implementation worker as the sole mutation owner for each
bounded mutation scope; and assign worker-owned deterministic verification.
Delegated bounded internal work includes read-only characterization,
non-overlapping role assignments, and deterministic verification.
State each role, scope, and mutation effect explicitly. The implementation
worker must be a different identity from the controller. The independent
semantic/Delta reviewer must be a different identity from both controller and
implementer. No overlapping mutation workers are allowed. Model or provider
substitution never changes this topology.
Mutation ownership must be unambiguous before workers write; overlapping
mutation is prohibited.

If a worker cannot be created or fails, retry or reassign that bounded worker
role when safe, or STOP and report the execution limitation. The controller
must not silently take over the worker's objective work. Where the host truly
lacks worker capability, state that compatibility limitation and do not claim
this worker-capable topology is satisfied; this policy defines no alternative
execution route.

Canonical pre-COMMAND wrong-Issue workspace acquisition and zero-delta branch
bootstrap are setup authority only, not substantive objective execution. They
grant no objective-work authority. After routing, any authorized objective or
recovery mutation remains worker-owned; the controller verifies the durable
result.
Continuation follows only independently reconstructed Context command routes.

Workers receive no new authority. They must stay within assigned scope and cannot
broaden it, start dependent or future objectives, merge, cross production,
destructive, migration, or secret gates, bypass Context/Handoff/public-command
contracts, treat worker-local state as durable workflow authority, or make gate
decisions.

Multiple read-only, non-overlapping workers may contribute evidence or
deterministic findings to the same objective; they do not create a bundle of
independent objectives. The controller remains accountable for combining the
results and completing the objective's authorized delivery steps, but never
becomes an objective execution or mutation fallback.

Policy semantics remain agnostic to provider and model identity. Provider or
model identity never grants authority or changes routing. Model substitution
does not change role topology. Independent review
remains independent; a worker implementing or controlling the objective does
not perform its review.

Global MC authorizes one bounded objective at a time. If semantics and
authority are clear, choose the lowest-cost sufficient model and keep one
accountable controller for the objective. Model recommendations remain
advisory: changing the selected model does not change role ownership or permit
controller self-execution. Assign non-overlapping workers to the required
execution roles; do not turn role ownership into optional delegation. Run the
required full validation tier on the final candidate; do not repeat it after
each small edit unless a failure or specific risk warrants it. Completing a
substep alone does not require replacing the controller, a return to Global MC,
or fresh Context.

Split only at a real boundary: unresolved authority or protocol decision;
destructive, production, migration, or secret gate; independent review required
by policy; required validation that needs a separately scoped correction;
scope expansion; conflicting or stale durable evidence; unsupported command
or policy. A correction that remains in scope can stay with the same worker.

That worker may carry out only that objective. Do not combine independent
objectives or start dependent future work before fresh Context and authorization.
Once the objective has a durable result, publish required Handoff and reconstruct
Context before choosing or starting the next objective. Independent review
remains separate.

Example: `Global MC → one worker (one objective) → durable result/Handoff → fresh Context → next route`

bemoat:context:sync-base remains a separately bounded protected-main
synchronization utility. Run CLI Discovery before invoking any retained
bemoat command. Follow the repository's
[Bemoat CLI Discovery](../../AGENTS.md#bemoat-cli-discovery) rule, use the
registry-declared contract, and use its safe help invocation.
Help is read-only and must not mutate GitHub, branches, or local workflow
state.

## Approved protected base

The canonical generic approved-base rule is:

1. If live remote `refs/heads/dev` exists:
      approved base = `dev`

2. Otherwise, if live remote `refs/heads/main` exists:
      approved base = `main`

3. Otherwise:
      STOP with precise approved-base-unresolved classification.

`main` and `dev` both existing is NOT contradictory.
`dev` deterministically wins.

These are NOT approved-base authority:

- GitHub default branch
- GitHub protection status
- hidden/local git config
- environment variables or undocumented caller overrides
- Issue metadata
- provider identity
- chat/session state

A repository requiring a different integration/protected base is unsupported
by this generic resolver until merged repository authority explicitly extends
the supported branch-role contract.

Do not guess another branch.

Context and Handoff must consume the same resolved approved base.

## Review and correction boundaries

STANDARD work receives one independent, risk-adjusted semantic review when a
review gate applies. A bounded correction is evaluated with a focused Delta Review
against the changed scope and the original acceptance criteria.
Independent review evidence must remain independent; a correction must not
silently broaden scope or restart unrelated review.

Exact-head CI, repository/base identity, policy binding, required checks,
authority, and durable evidence remain mandatory. Ambiguous or unavailable
evidence stops fail-closed as STOP, including BLOCKED_EXTERNAL,
STATE_CONFLICT, or CLI_DISCOVERY_DEFECT as applicable.

## Safety and durability

`trusted_founder_login` in merged protected-base policy supplies Founder
identity for `BLOCKER_RESOLUTION`. The native GitHub comment author and the
record's declared login must both match it. A role claim or GitHub `OWNER`
association cannot supply missing authority. An unmerged policy change cannot
authorize evidence for its own PR. This value applies only when
`canonical_repository` matches the live repository; a copied starter guide
cannot grant Founder authority in a child repository.

`BLOCKER_RESOLUTION` schema-v1 is bound to an active PR and remains unchanged.
Schema-v2 is the no-PR variant: it requires `pr_number: null` and binds the
exact topic branch, durable head, live protected-base branch and SHA, merged
policy identity, exact source schema-v3 STOP comment, blocker ID, and trusted
Founder. The source STOP may retain a historical protected-base snapshot; its
exact comment identity binds that immutable record while the resolution binds
the current live base and policy. A no-PR STOP remains unresolved unless each
explicit blocker has exactly one valid schema-v2 resolution. Resolved STOP
HANDOFFs stay in immutable history; Context recomputes from the remaining
current-head evidence.

For no-PR terminal reconstruction, one unique applicable `COMPLETE` HANDOFF
may coexist only with prior `objective_mode: read_only` `IMPLEMENT` HANDOFFs
and schema-v3 STOP HANDOFFs whose blockers are all uniquely resolved. Multiple
COMPLETE records, unresolved or conflicting STOPs, malformed resolution
evidence, mutation-capable nonterminal HANDOFFs, incompatible FIX, REVIEW, or
FOUNDER_GATE evidence, and identity conflicts remain STOP. The unique COMPLETE
must bind the current live protected-base SHA; all coexisting historical
HANDOFFs must agree on one protected-base SHA among themselves. Without a
COMPLETE, all recomputable current-head HANDOFFs must likewise agree on one
protected-base SHA. Context never uses timestamps or comment ordering to
select authority. A blocker resolution removes only its named blocker and
grants no implementation, review, merge, deployment, migration, or
terminal-completion authority.

For no-PR reconstruction without a `COMPLETE`, exactly one uniquely applicable
exact-current-head `objective_mode: read_only` `FOUNDER_GATE` HANDOFF may route
Context to `FOUNDER_GATE`. It must have `pr: null`, canonical durable native
comment identity, and exact repository, Issue, branch, and topic head. Its
`protected_base.branch` must still match the live protected branch. Its
`protected_base.sha` is the immutable snapshot recorded when the HANDOFF was
canonically published; it need not equal a later live protected-base SHA.
The gate may coexist only with read-only `IMPLEMENT` HANDOFFs and schema-v3
STOP HANDOFFs whose blockers are all uniquely resolved. The gate and all such
compatible current-head history must agree on exactly one recorded
protected-base SHA. Multiple gates, malformed, stale, or wrong-identity gate
evidence, mutation-capable `IMPLEMENT`, incompatible FIX or REVIEW, other
non-recomputable history, unresolved STOPs, and differing recorded base SHAs
remain STOP. The gate records only the human decision boundary and grants no
implementation or mutation authority. After the Founder decision is consumed,
fresh Context against current merged authority is required before a
mutation-capable objective. Context does not use timestamps or comment order to
select a gate or resolve competing evidence. A no-PR `COMPLETE` must still bind
the current live protected-base SHA; an unconsumed competing gate keeps it at
STOP.

No existing record safely captures this decision. `BLOCKER_RESOLUTION` remains
specific to named STOP blockers and cannot be repurposed without changing its
meaning. HANDOFF and review records describe workflow state, not this Founder
choice, and later prose is not an authority source. The protocol therefore
uses one dedicated strict record with exact gate, current identity, and native
Founder bindings.

An authorized Founder may consume one no-PR gate with one strict schema-v1
`FOUNDER_DECISION` comment. It must be bound to the exact source gate comment
ID and URL, live repository, Issue, `pr_number: null`, topic branch and head,
current protected-base branch and SHA, and current merged policy path, ID,
version, and source blob SHA. The record's declared `FOUNDER` login and the
native GitHub comment author must both match `trusted_founder_login`; owner
association and role prose are not authority. Only `decision: "PROCEED"` is
supported. The canonical JSON body and field set are strict; malformed,
stale, duplicate, conflicting, wrong-gate, wrong-identity, or wrong-author
decisions keep Context at STOP. A missing trusted Founder identity also fails
closed.

Exactly one valid decision filters only its bound source gate from no-PR route
folding. Both native comments remain immutable. Context recomputes from all
remaining current evidence, so unresolved STOPs, incompatible HANDOFFs,
protected-base conflicts, and normal COMPLETE requirements still apply. This
decision does not create generic mutation authority, resolve STOP blockers,
change active-PR Founder gates, or select evidence by timestamps, comment
order, or association.

## Historical consumed no-PR Founder gates

This policy explicitly permits a narrowly proven consumed read-only no-PR
`FOUNDER_GATE` at historical head A to remain immutable evidence after the same
Issue branch advances to head B. Older policy snapshots do not inherit this
permission unless their own frontmatter explicitly enables it. Historical
policy and protected-base snapshots prove that the original decision or
canonical repair was valid at A; the current merged policy controls whether
the old consumed bundle may be excluded from fresh routing.

Context may exclude only one exact gate whose ordinary decision or canonical
repair uniquely consumed it at A, after exact repository, Issue, and canonical
branch identity; strict durable `A != B` ancestry with merge-base(A, B) = A;
and compatible historical-to-current protected-base ancestry are proven.
Current head B must be published on the same canonical topic branch. Missing,
divergent, rewritten, ambiguous, malformed, duplicate, conflicting,
wrong-author, wrong-identity, or unconsumed evidence stays STOP. Competing
current gates and current STOP/HANDOFF/COMPLETE conflicts remain authoritative.
No timestamp or comment order selects evidence. This exclusion satisfies no
current Founder gate and grants no authority at B; fresh Context recomputes
ordinary routing from all remaining current evidence.

Use the canonical [FOUNDER_DECISION template](founder-decision-template.md)
only with exact values from the live gate, current protected base, and merged
policy. Never publish the sample values.

The only malformed-decision recovery is one strict schema-v1
`FOUNDER_DECISION_REPAIR`, authored by the trusted Founder. It requires exactly
one syntactically malformed ordinary `FOUNDER_DECISION` with valid native
Issue-comment identity and trusted native Founder author, exactly one repair,
and exactly one applicable no-PR gate. The repair supplies its own complete
`PROCEED` decision with every ordinary decision's current repository, Issue,
null PR, branch, head, live protected-base, merged-policy, source-gate, and
native/declared Founder binding. Its `source_founder_decision` binds the
predecessor's exact native comment ID, URL, and SHA-256 digest of the untouched
UTF-8 body. Gate, predecessor, and repair must be distinct native comments.
The malformed body supplies no decision authority and is never normalized or
parsed permissively. This cannot supersede a syntactically valid ordinary
decision, including one rejected for staleness or wrong identity.

All three comments remain immutable. A valid repair removes only its bound
gate from no-PR folding, and the malformed predecessor ceases to block only
through that unique bound repair. Context recomputes every remaining STOP,
HANDOFF, historical-base, and COMPLETE requirement. Missing, malformed,
orphan, duplicate, competing, stale, wrong-identity, changed-body, or
wrong-author repair evidence remains STOP. Multiple ordinary decisions remain
STOP even when a repair exists. No time, comment ordering, prose, or OWNER
association selects authority. The repair provides no generic authority to
implement, merge, resolve blockers, complete an objective, deploy, or migrate,
and has no active-PR gate effect. Copied starter policy cannot authorize a
Founder in a different repository. Use the
[repair template and syntax validator](founder-decision-repair-template.md)
with fresh current evidence before Founder publication.

Only schema-v2 STOP HANDOFFs identified by `legacy_stop_handoffs` in merged
protected-base policy retain one legacy blocker derived from immutable
`next_action.description`. Each entry binds Issue number, native comment ID,
exact head, and description SHA-256. `stop_conditions` remain guardrails.
Unlisted schema-v2 STOPs fail closed. New STOP HANDOFFs use schema-v3 and require unique explicit
`stop-blocker` evidence. The public HANDOFF writer rejects schema-v2 STOP
publication; Context may still read historical schema-v2 STOPs.

Each objective has one authority scope, explicit in/out-of-scope boundaries,
acceptance-criteria audit, required checks, and one terminal outcome.
Normal-path progress uses durable semantic checkpoints: commit each coherent,
independently understandable unit once its focused proof is available, push it
promptly, and verify the exact SHA on the remote task ref. See the
[checkpoint rules](../agent-loop/checklist.md#durable-semantic-checkpoints).
Dirty, uncommitted, unpublished, or non-durable required state cannot be
treated as complete evidence. Interruption/WIP recovery composes with #261;
these checkpoint rules do not create a second recovery protocol. Final CI and
review remain bound to the one PR head. Destructive, production, secret,
migration, and merge operations require their normal repository gates.

No agent may autonomously merge, approve its own review, invent authority,
repair conflicting Issue state, or treat a handoff as permission for a new
objective. FOUNDER_GATE and STOP remain human-owned boundaries. A handoff at a
gate records the evidence and next permitted action; it does not grant the
approval.

## Child synchronization

Child projects receive the managed harness through
bemoat:boilerplate:sync -- --harness-only. Sync must preserve child-owned
infrastructure, secrets, overrides, and project-specific resources. Generic
branch, repository, toolchain, environment, and child-sync guards remain
required and must fail closed on drift or unsafe inputs.

## Historical evidence

Older Issues and comments may contain RESULT, REVIEW_VERDICT, or managed-state
vocabulary. Context may read those records as bounded, migration-only
evidence when reconstructing history. They do not create a current route,
review counter, state machine, write permission, or alternate transport. New
work uses only Context and Handoff.

For the exact field and command contracts, see command-reference.md and
handoff-template.md.
