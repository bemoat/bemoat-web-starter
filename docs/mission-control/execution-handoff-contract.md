# Execution handoff contract

Use this contract to prepare a Ready-to-paste Execution/IDE artifact and to
apply its session/recovery rules during authorized continuation. The always-
loaded router points here for both. Copy the complete ordered 15-section
contract into the artifact only when preparing it; resolve every field from
fresh evidence. For an artifact, also load `model-routing-profile.md` and include
complete resolved recommendations for each applicable role.

## Ready-to-paste execution artifact contract

Every Execution/IDE Ready-to-paste prompt must include the complete ordered
contract below **inside the Ready-to-paste artifact itself**. Surrounding Global
MC analysis, a Suggested Model block, or a message describing what the prompt
will contain does not satisfy this requirement. Copy the headings and their
applicable instructions into the artifact, then fill every applicable value
from fresh evidence and current authority.

Before emitting the artifact, inspect the artifact itself against all 15
sections. Only the fresh Context route may remain unresolved, and only when
Global MC has verified repository, merged loader, merged policy, Issue, and
relevant GitHub identity/state but cannot execute repository-local CLI. This
limitation alone does not make the preflight handoff a `CONTRACT VIOLATION`.
Any missing or contradictory section, or any other unresolved field or guessed
route remains a `CONTRACT VIOLATION`; withhold the usable prompt and report the
section and evidence needed to resolve it. Do not rely on surrounding prose.
Mark a role or conditional requirement `NOT_APPLICABLE` only with a specific
reason grounded in the current route, objective, or workflow profile.

```ready-to-paste
# Ready-to-paste execution handoff

This ordered contract is inside this Ready-to-paste artifact itself.
Before returning this artifact, withhold the usable prompt and report `CONTRACT VIOLATION` if any applicable section is missing or contradictory, or unresolved except for the fresh Context route when it is unavailable solely because Global MC cannot run repository-local CLI and required live authority is verified.
If the only defect is a deterministic omission, correct it from available evidence and do not return to Founder for this deterministic correction. Any other unresolved live authority or evidence, scope expansion, a policy/spec boundary, or another applicable repository-defined stop remains a real boundary.

## 1. Repository / Issue / PR identity
State repository, Issue, applicable PR, branch and exact head, approved protected base, and merged policy identity.

## 2. Current bounded objective
State the one objective authorized by fresh Context, its acceptance criteria, and its in-scope boundary. If Global MC cannot run repository-local CLI, identify the objective candidate from the verified Issue as pending fresh Execution/IDE Context authorization; only a fresh Context result with `next_action.type: COMMAND` authorizes mutation for that objective.

## 3. Verified live authority / route
State the fresh Context route and its evidence. If Global MC cannot execute repository-local CLI, state that the route remains unresolved until Execution/IDE MC runs fresh Context; this reason alone is not a `CONTRACT VIOLATION` when required live repository, loader, policy, Issue, and GitHub evidence is verified. Do not guess the route. Execution/IDE MC must run fresh Context and inspect `next_action.type` before mutation. Only an exact deterministic recovery prescribed by that Context or canonical wrong-Issue workspace acquisition under section 12 may precede a later `COMMAND`, and then only within that recovery's scope. The other exception is the exact Bridge B recovery prescribed in section 12 for a stale target whose local Context predates recovery emission. None authorizes objective mutation. An artifact that guesses or omits this pre-mutation Context step, lacks required live authority, or permits objective mutation before Context returns `COMMAND` or an explicitly authorized pre-COMMAND recovery is fully satisfied, is a `CONTRACT VIOLATION`. Context and policy determine authority; this artifact and model identity create none.

## 4. Startup / reconstruction instructions
Global MC verifies live GitHub repository/base/Issue/PR/head evidence and the merged loader/policy. In Execution/IDE MC, verify live GitHub state again, load the merged policy, perform registered CLI Discovery with its declared safe help, and run fresh `pnpm run bemoat:context <issue-number> --json`. Inspect its route and `next_action.type` before mutation. If evidence changes before execution, reconstruct again. The preflight handoff grants no mutation authority.

## 5. Permitted scope
List only the current objective's bounded work. The list does not authorize a new objective, future Issue, or action beyond the live Context route.

## 6. Prohibited scope
List objective exclusions and applicable production, migration, secret, deploy, merge, child-resource, and unrelated-work boundaries.

## 7. Model routing
Resolve the actual selected controller for this Execution separately from the advisory baseline/recommendation in Model Routing Profile v1. When an operator/Founder explicitly selects the current Execution controller, identify that selection first as the actual controller in both the six-field operator summary and this section, even if it differs from the profile. Label a different profile value separately as an advisory baseline/reference only. For example, Sol Medium advisory baseline plus explicitly selected Luna XHigh means identify Luna XHigh as the actual controller and Sol Medium only as the advisory baseline. Without an explicit current-execution controller selection, the advisory profile's controller default may be presented as the recommendation. A future target policy applies only when the active Issue changes the advisory defaults; otherwise mark it `NOT_APPLICABLE`.

Never describe an advisory profile recommendation as workflow or model-execution authority. Do not say or imply that it governs, binds, or prevents a different explicitly selected controller. Execution must not downgrade or replace the explicit selection because the advisory baseline differs. An explicit controller selection does not change Context authority, routes, gates, repository policy, or acceptance criteria, and cannot bypass any workflow gate.

For every applicable role—`controller`, `read_only_characterization`, `implementation`, `deterministic_verification`, and `independent_semantic_delta_review`—include the matching Model Routing Profile v1 advisory recommendation with resolved values for all five fields: `role`, `model_class`, `effort`, `rationale`, and `escalation_trigger`. Keep the controller's profile recommendation separately labeled from an explicit current-execution selection. Mark an unused role `NOT_APPLICABLE` with a specific reason. Also resolve escalation guidance with `model_class`, `effort`, and `triggers`, or mark escalation `NOT_APPLICABLE` with a specific reason. Self-check that each role and escalation has resolved values; role names, field names, or a profile reference alone are incomplete and must fail this artifact check. The independent semantic/Delta reviewer must remain separate from the actual controller and implementer; state that the independent reviewer differs from both the controller and implementer. The Model Routing Profile is advisory only; model identity grants no workflow authority.
If Global MC cannot run repository-local CLI, any implementation recommendation remains conditional on fresh Context returning `next_action.type: COMMAND`; model routing grants no authority.

## 8. Execution / delegation rules
Identify one accountable controller and the mutation owner. State permitted bounded delegation, its read-only or mutation effect, and how delegated work stays within this objective. No controller or worker may mutate the authorized objective before fresh Context independently returns `next_action.type: COMMAND`. A pre-COMMAND recovery is permitted only when fresh Context explicitly prescribes that exact bounded recovery under section 12, the canonical wrong-Issue workspace acquisition conditions under section 12 are met, or every condition of the Bridge B recovery in section 12 is satisfied. Workspace acquisition is limited to the clean, isolated preparation described there and grants no objective-work authority. Workers receive no new authority and cannot decide gates, expand scope, or start future work. Keep independent review separate.

## 9. Validation requirements
Discover public commands before use. Run focused regressions and the repository-required validation tier for the changed files; report exact commands and results. Require exact-head CI and independent review when current policy requires them. Do not invent a validation tier or claim checks that were not run.

## 10. Durable result / HANDOFF / readback
State the required durable result. Publish one strict HANDOFF and verify its exact fresh readback when current policy/workflow requires it. If HANDOFF is not applicable, state why from fresh authority; never use this artifact to waive a required HANDOFF.

## 11. Fresh Context requirement
After the durable objective result and applicable HANDOFF/readback, resolve fresh GitHub evidence, read the merged policy, perform applicable CLI Discovery, and run fresh Context before selecting the next objective.

## 12. Continuation rule

Classify the destination session before choosing a cross-session action:

- **New Execution/IDE session:** MUST emit the complete canonical Ready-to-paste
  Execution artifact with all 15 ordered sections inside the artifact itself.
  MUST NOT substitute a short bootstrap, `continue`, summary, or surrounding
  prose for that artifact. The same full artifact is required when objective
  execution is transferred to a changed workspace or changed authority context.
- **Existing active Execution/IDE session for the same Issue:** when the session,
  workspace, and authority are still valid and a cross-session operator action
  is actually required, MUST use the smallest canonical compact operator action,
  such as `continue`, in the same response. MUST NOT use this compact
  continuation form to start a new Issue, a new Execution session, a changed
  execution workspace, or a changed authority context. Emitting the full
  15-section handoff for this valid same-session case is avoidable operator
  overhead and MUST NOT be used when the compact continuation is sufficient.
- **New Global MC reconstruction:** a bare Issue number remains sufficient
  because Global MC reconstructs live GitHub, loader, and policy state itself.
  This bare-Issue shortcut does not apply to a new Execution/IDE handoff.
- **Ambiguous destination:** if Global MC cannot prove whether the destination
  is a new Execution session or an existing valid same-Issue session, it MUST
  NOT choose the shortened form. Fail closed toward the full canonical
  Execution artifact or resolve the session identity first.

### Same-response transfer invariant

Whenever the selected next action requires another session or runtime to act,
the current response MUST contain the required self-contained copy-ready
operator artifact itself. Status, explanation, or wording such as "continue
there" without that artifact is incomplete; do not make the Founder ask a
second time for the prompt. The artifact itself MUST identify the repository,
Issue, and exact next action needed by the destination so it remains usable
without substantive surrounding prose.

After REVIEW or another durable result, if the same valid Execution session,
workspace, and authority remain the destination and operator transfer is
actually required, emit the compact continuation in that same response. If the
current agent/runtime can execute the authorized next action directly, perform
it directly instead; do not manufacture a handoff merely to relay deterministic
work.

When the next action is objective execution in a new session, changed execution
workspace, or changed authority context, emit the complete canonical
15-section handoff in that same response. A compact continuation in any of
those cases is invalid.

Canonical recovery actions remain narrower than objective handoffs. When the
wrong-Issue workspace-acquisition rule has already prepared and verified a
sibling workspace but the host cannot rebind itself, the same response must
give the exact verified path and exact operator rebind/open action. Do not ask
the Founder to run Git clone/fetch/checkout commands, and do not manufacture
objective authority or a full Execution handoff before fresh Context permits
objective execution.

`FOUNDER_GATE` is decision-first: ask for the actual Founder decision and do
not emit a mutation-capable continuation that assumes the answer. After the
Founder decision exists, if another session or runtime must carry it out, emit
the appropriate copy-ready continuation in that same response.

A transfer response that omits its required artifact, splits repository/Issue/
next-action identity into surrounding prose, uses a compact continuation for a
new or changed execution destination, or emits the full canonical handoff when
the valid same-session compact continuation is sufficient violates this
response contract.

Progressive disclosure means load the full Execution contract when the
Execution-handoff phase is triggered; it does not mean omitting the triggered
contract.

For any complete copy-ready operator artifact intended for transfer, keep the
entire artifact in one dedicated copyable container supported by the active
client. In ChatGPT, use a writing block with the native Copy affordance. Keep
analysis and explanation outside the artifact. Do not place substantive parts
of one artifact partly in prose and partly inside the copyable container.
Rendering in a copyable container
grants no workflow authority and must not alter Context, STOP, FOUNDER_GATE,
first-edit, CI, review, HANDOFF, or merge semantics.

The one-time post-preflight implementation trigger remains required before the
first source-file edit after issue preflight, as described in `AGENTS.md` and
`docs/agent-loop/issue-driven-branch-workflow.md`. A fresh `COMMAND` does not
satisfy or waive that trigger; if it has not yet been given, return the bounded
intent summary and wait for that trigger before editing. After that trigger has
been satisfied, when fresh Context returns `next_action.type` as `COMMAND`,
continue automatically with the authorized next separately bounded objective
in the same controller session; do not return to Global MC solely to relay this
result. Do not end the active controller turn with a status-only response,
return to Founder to relay the route, or ask for confirmation again after
`COMMAND`. Start the next separately bounded objective immediately, only after
it is authorized by that fresh Context result. Apply this rule again after
every durable objective.
After each durable objective and applicable HANDOFF/readback: fresh GitHub →
merged policy → applicable CLI Discovery → fresh Context → recompute route.
Under `COMMAND`, continue automatically with the next separately bounded
objective in this Issue's same controller session. If two successive fresh
Context results are `COMMAND`, start each newly authorized objective in the
same session after its own result. Objective completion alone is not a Founder
gate. Terminal `COMPLETE` ends this Issue's active Execution session; return.
A different Issue requires fresh Global MC reconstruction and a newly
appropriate Execution handoff.
For `FOUNDER_GATE`, do not mutate and return to Founder once for the required
decision, then stop at the gate. For `STOP`, unsupported state, or evidence
conflict, do not mutate the authorized objective; stop fail-closed and report
the exact blocker. The only pre-COMMAND exceptions are an exact existing-branch
recovery prescribed by fresh Context or the canonical wrong-Issue workspace
acquisition below. Neither exception authorizes objective work. Missing,
ambiguous, conflicting, or unsupported recovery remains STOP. If evidence
changes before execution, reconstruct again. Do not pre-authorize
future objectives; a separate real gate still controls when required. On
terminal completion, return.
CLI Discovery, zero-delta branch bootstrap, Context rerun, HANDOFF readback, and deterministic inventory are internal substeps when applicable, not a mandatory extra sequence. None of these internal steps alone requires a Founder return.

### Exact bounded recovery

When an explicit bounded recovery decision has been satisfied, perform only its
named recovery. Do not invent a new comment, HANDOFF, or persistence requirement
unless an applicable canonical contract requires it. Preserve
`BLOCKER_RESOLUTION`, `HANDOFF`, review, merge, destructive, production,
migration, secret, `STOP`, and `FOUNDER_GATE` boundaries.

A generic handoff caution cannot override an exact deterministic recovery
prescribed by fresh Context. If Context prescribes switching to the correctly
owned existing Issue branch and live repository evidence identifies exactly one
candidate, perform only that switch, then immediately rerun registered CLI
Discovery and fresh Context without a Founder/Global MC relay. Missing, multiple,
ambiguous, or conflicting candidates remain `STOP`; do not guess. The switch
must remain bound to the canonical repository, queried Issue, source and target
branch/head identities, exact protected-base branch/SHA, and source durability
recorded by Context. Recheck that binding immediately before the switch; if any
evidence changed, stop and reconstruct fresh Context. The switch grants no
synchronization, rebase, reset, merge, implementation, edit, or future-objective
authority. No general recovery authority or gate waiver is implied.

An unmerged active PR does not make an unrelated local Issue branch a valid
workspace for PR-gated work. When the numbered local branch belongs to another
Issue, the local branch and `HEAD` must match the active PR's exact head branch
and SHA before any non-terminal active-PR route can apply. If they do not,
Context remains `STOP`; it may prescribe a switch only when the active PR's
unique branch is independently verified at the exact live canonical-origin
head and matching local `origin/<branch>` tracking ref. Bind that recovery to
the PR number, URL, base branch/SHA, and head branch/SHA as well as the ordinary
repository, Issue, source, target, and protected-base evidence. If the exact PR
target is unavailable or conflicting, use the canonical workspace-acquisition
rule below or stop. A local branch whose name has another Issue number remains
eligible for ordinary PR routing when its branch and exact `HEAD` match the
active PR. A valid merged PR remains terminal despite an irrelevant local
checkout.

### Wrong-Issue workspace acquisition

When a new or resumed Execution session starts in a wrong-Issue workspace, apply
this order before returning to Founder for Git setup. Context remains read-only;
this rule authorizes only safe workspace acquisition followed by fresh Context.

1. **Reuse exact existing Issue workspace.** If exactly one clean, durable,
   canonical workspace/branch owned by the queried Issue, with its exact
   `origin/<branch>` upstream, is independently proven, use the existing exact
   bounded recovery path. When fresh Context
   emits an exact switch recovery, perform only that switch. If the one
   verified workspace is already available at another known path, use it only
   when this Execution host can operate from that path. Immediately rerun
   registered CLI Discovery and fresh Context. Multiple plausible workspaces
   or branches, a dirty or non-durable target, stale tracking state, conflicting
   ownership, or an unverified path remains `STOP`.

2. **Provision an isolated canonical workspace when none is usable.** If no
   usable queried-Issue workspace exists, provision a separate isolated
   checkout from the exact live approved-base SHA only when the current
   wrong-Issue checkout is clean, attached, durable, has canonical origin, and
   tracks its branch at `origin/<branch>`;
   the live canonical repository, approved-base branch and
   exact approved-base SHA are uniquely verified from fresh GitHub/Context
   evidence; and the host has network and filesystem access to a new sibling
   path that does not already exist. Use the canonical repository URL from
   that evidence. Clone the approved-base branch into a separate checkout.
   Provisioning must not mutate, reset, rebase, merge, stash, delete, force, or
   otherwise alter the currently bound wrong-Issue checkout. If the clone or
   any verification fails, stop and preserve both the original checkout and
   any partial clone.

   Before selecting an Issue branch, verify canonical origin, exact live-base
   SHA, attached/clean state, and absence/conflict status of the queried-Issue
   topic branch. In particular, verify the new clone's canonical `origin`,
   attached branch, clean status, `HEAD` equal to the exact live approved-base
   SHA, and live approved-base ref still equal to that SHA. Inspect the local
   and live remote queried-Issue branch names. Multiple candidates, an
   existing but stale or conflicting branch, ambiguous ownership, or an
   unavailable exact base remains `STOP`. If exactly one existing remote
   queried-Issue branch is proven, fetch and check out only that branch at its
   exact live SHA, then verify its canonical upstream and clean/durable state.
   If the queried-Issue branch does not yet exist, use the topic-branch name
   already established by the Issue handoff; only when its identity is unique
   and normal zero-delta bootstrap eligibility is uniquely satisfied may
   Execution use the canonical durable zero-delta branch bootstrap from the
   exact approved-base SHA. Follow the ordinary
   [durable zero-delta bootstrap](../agent-loop/issue-driven-branch-workflow.md#durable-zero-delta-branch-bootstrap)
   checks, then read back the pushed branch. Never invent ownership or
   overwrite an existing branch.

   After either checkout path completes, immediately rerun registered CLI
   Discovery and fresh Context by running
   `pnpm run bemoat:context <issue-number> --json` in the acquired workspace.
   Registered
   CLI Discovery is still required; fresh Context is still required; and
   source/test/doc edits still require an authorized Context route and the
   normal one-time first-edit trigger. Do not begin objective work unless that
   fresh Context authorizes it. Workspace acquisition adds no route, state,
   evidence vocabulary, implementation authority, or future objective
   authorization. It introduces no new general scheduler or worktree manager.

3. **Stop only at a real boundary.** Return to the operator when there are
   multiple plausible Issue workspaces/branches; dirty or non-durable state;
   wrong/noncanonical repository or origin; a source or target upstream other
   than the canonical `origin/<branch>`; conflicting/stale live-base evidence;
   conflicting existing target branch ownership; no unique
   established branch name; filesystem/network/host capability prevents
   isolated safe provisioning; or recovery would require destructive change
   or loss/movement of unrelated Issue work. Do not disguise missing evidence
   as an implementation or Founder gate.

If the agent can create and verify the isolated sibling checkout but the host
cannot switch/rebind its effective workspace/root, prepare the workspace
completely first, report the exact verified path as the single operator action,
and do not ask the Founder to run Git clone/fetch/checkout commands manually.
Do not alter the original wrong-Issue checkout. This does not change #571 Bridge
B, which owns protected-main command-source reachability for evaluating an
unchanged stale target.

### Bridge B: stale target predates recovery emission

Ordinary stale Context remains `STOP`. This single bounded exception makes the
existing protected-main-source synchronization lifecycle reachable when the
stale target branch predates the recovery-emitting Context implementation. It
does not add a Context mode or let Execution infer a fallback from
prose. Proceed only when all of the following are established from fresh live
evidence:

- The current objective has a fresh Context result for the exact Issue, local
  branch, PR number, PR head, and PR base. Its route is `STOP` solely because
  the PR's recorded base differs from the live protected-main SHA; there are no
  additional Context conflicts or blockers.
- The target worktree is the unique existing worktree whose canonical
  repository root, branch, and exact head match that Context and the active PR.
  Its local Context implementation predates the recovery-emitting
  implementation, as verified from the target and source revisions. Missing,
  multiple, ambiguous, or conflicting target evidence remains `STOP`.
- Registered CLI Discovery has confirmed the current `bemoat:context:sync-base`
  command contract and its safe help invocation. Invoke only that existing
  command from the unique clean checkout of the canonical protected-main
  branch at the exact live protected-main SHA, with exactly one explicit
  `--target-worktree` naming the verified target, and require its canonical
  machine-readable result with `--json`. Do not copy command files or invoke
  internal workflow code. Run exactly `pnpm --dir
  <absolute-protected-main-worktree> run bemoat:context:sync-base --
  <issue-number> --target-worktree <absolute-path> --json`.
- The registered command independently passes every source and target
  identity, same Issue/PR/base/head, canonical origin/upstream, clean attached
  and pushed target durability, old-base ancestry, stale-base-only eligibility,
  merge-tree conflict preflight, head-drift, exact post-write head, push, and
  remote-readback check in its current contract. A failed preflight, changed
  head, command failure, or incomplete readback stops the recovery; do not
  retry after a target-head change.

This exception authorizes only that command invocation and its prescribed
push. It does not authorize direct Git synchronization, unrelated edits,
metadata changes, PR merge, or bypassing any branch-protection, CI, review, or
no-autonomous-merge gate. After a successful synchronization, immediately run
applicable CLI Discovery and fresh `bemoat:context` in the target. The new exact
PR head requires fresh exact-head CI and independent semantic/Delta review
before its next route can be selected. Every other `STOP`, including a stale Context with
any additional conflict, remains `STOP`.

## 13. Stop conditions
Stop on missing, stale, conflicting, ambiguous, or unsupported evidence; failed required checks that cannot be corrected in scope; or any repository-defined stop condition. At `FOUNDER_GATE`, include no mutation-capable instructions or delegated mutation. At `STOP`, no objective mutation or delegation is allowed except the exact bounded recovery fresh Context prescribes under section 12, canonical wrong-Issue workspace acquisition under section 12, or the fully qualified Bridge B recovery in section 12; otherwise report the blocker and stop. Workspace acquisition permits only the exact isolated setup in section 12 and never objective work. Missing, stale, conflicting, ambiguous, or unsupported recovery stays fail-closed. Mark implementation `NOT_APPLICABLE` with the route-based reason. A `STOP` reports its blocker and does not itself assert that Founder approval is required.

## 14. Founder decision status
State `required`, `pending`, or `not_required` only when supported by fresh Context and evidence. While the route is unresolved because Global MC cannot run repository-local CLI, state `pending`; Execution/IDE MC must resolve it before mutation. `FOUNDER_GATE` requires a human decision from the Founder; no worker may cross or satisfy that gate. `STOP` may report a blocker without implying Founder approval. A handoff records a gate and never grants its approval.

## 15. Required return contract
Report repository/protected-base/policy identity; initial and final fresh Context route; objective and acceptance audit; branch/exact head; changed files and diff size; focused regressions and full required validation; PR and exact-head CI; independent review; durable result and HANDOFF/readback; fresh Context after the result; risks; and the exact Founder decision required (or explicitly none).
```

Do not pre-authorize future objectives. Each next objective must be selected
from the newly reconstructed Context route; a paste-ready artifact cannot
replace that reconstruction or require a separate chat round-trip for
deterministic internal work.

Static repository tests cover this artifact contract. They do not prove that a
live Global MC session fetched or followed the router and phase contracts.
## Response shape

Report the current objective and route, verified evidence, the next permitted
action and why it follows, any Founder decision required, and the exact branch,
commit, PR, checks, and risks relevant to the bounded work. Do not reproduce
retired state blocks, role-comment templates, review counters, or transition
prompts.
