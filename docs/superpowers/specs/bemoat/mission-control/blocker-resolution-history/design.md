# Issue #520 historical resolution carry-forward

<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: null
task_key: "issue-520-blocker-resolution-history"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#520"
branch_template: "fix/520-blocker-resolution-lifecycle"
transition_target: "FOUNDER_GATE"
planning_base_sha: "eccb36837c7e0c2fdda0aa2871999364507aa937"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: "docs/superpowers/specs/bemoat/mission-control/blocker-resolution-history/design.md"
paired_plan: "docs/superpowers/plans/bemoat/mission-control/blocker-resolution-history/plan.md"
```
<!-- bemoat-task-identity:end -->

The Founder supplied and approved this contract on 2026-10-01 after the baseline characterization stopped at a protocol gap. It authorizes this bounded implementation; it does not bypass native Context, CI, review, or merge gates.

An existing immutable BLOCKER_RESOLUTION may continue to resolve only its named blocker when it replays successfully against the canonical snapshot at its recorded protected-base SHA. Strict schema, repository, Issue, active PR, exact PR head, source STOP, blocker, native Founder author, declared Founder login, and recorded historical policy identity remain mandatory.

The recorded branch must equal the current approved-base branch. The historical SHA must be a proven ancestor of the exact current approved-base SHA. Unrelated, diverged, unavailable, malformed, or ambiguous ancestry fails closed. Timestamps and comment ordering prove nothing.

Historical and current snapshots must have identical blobs for both `docs/mission-control/mission-control-guide.md` and `docs/mission-control/command-reference.md`. Matching versions or prose do not establish compatibility. Either changed blob fails closed. Preserve both files in this correction so the existing #513 resolution remains eligible after merge.

All current repository/Issue/PR/head/source STOP/blocker/approved-branch bindings remain exact. Duplicate, genuinely competing, ambiguous, invalid, or wrong evidence remains STOP. When a changed head makes the original STOP inapplicable, reconstruct current evidence normally; old resolution evidence does not control that head.

This resolves only the already-authorized named blocker. Independently recompute routes from current native/durable evidence. It grants no implementation, verification, review, Founder-gate, merge, deployment, migration, or synchronization authority. Existing sync-base ancestry, conflict, identity, durability, drift, scope, and readback gates remain unchanged.

Do not rewrite/delete the source STOP or resolution, append a replacement resolution, or invent a new durable evidence type. Historical snapshot facts are freshly collected in memory by the existing Context evidence pipeline and consumed by its pure evaluator. No new transport, command, or workflow route is added.

The implementation scope is resolution evaluation, necessary historical snapshot collection, focused tests, and required managed-path updates. Preserve #509 lineage and #518 sync behavior. Real #513/PR #514 recovery waits for correction validation, exact-head CI, independent review, Founder-approved merge, and fresh authorization. Keep #520/#518 open until that dogfood and fresh #513 Context succeed. No autonomous merge.
