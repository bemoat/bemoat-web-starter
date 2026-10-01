# Issue #520 historical resolution implementation plan

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

> **For agentic workers:** Use subagent-driven execution within the controller's bounded #520 objective. Workers receive no workflow authority.

**Goal:** Carry an existing immutable resolution forward only with reproducible historical validity, approved-base ancestry, unchanged contract blobs, and invariant current identities.

**Architecture:** Extend the existing normalized Context evidence with fresh in-memory historical proof, collected through read-only canonical GitHub snapshot/compare APIs. Keep the strict current-base evaluator and replay it against the proven historical snapshot for eligible old-base records. Do not modify the two compatibility-anchor contract files.

**Tech stack:** Node >=24.15.0, TypeScript, gh read-only APIs, Vitest, existing Context/Handoff public commands.

Required input: `docs/superpowers/specs/bemoat/mission-control/blocker-resolution-history/design.md` and the 14-story #520 matrix in `docs/agent-loop/characterizations/issue-520-blocker-resolution-lifecycle.md`.

## One bounded correction

- [ ] Luna Med adds red stories before production changes. Cover valid current base; B1→B2 with verified unchanged contracts; each contract blob mismatch; unprovable/diverged ancestry; wrong repository/Issue/PR/head/source/blocker/Founder; invalid historical policy; absent/malformed/duplicate proof; competing resolutions; ordering; immutable inputs; independent CI/review recomputation; #509/#518 anchors. Record baseline red classifications under the approved contract. Real story 12 remains post-merge.
- [ ] Controller reviews those results and fixes the normalized proof interface before delegation. Proof must bind exact resolution bytes/comment identity, canonical repository and historical/current base pair; it must not be caller-provided durable evidence or a boolean waiver.
- [ ] Luna High implements the smallest correction in `scripts/context/blocker-resolution.ts`, `scripts/context/model.ts`, `scripts/context/evidence.ts`, and a focused historical acquisition module if needed. Export/reuse strict parsing rather than weakening schema. Verify immutable contents at exact SHAs and deterministic compare status/merge-base; reject unavailable/malformed reads. The historical policy must reproduce the record's path/id/version/source and trusted Founder. Both contract blobs must match the live canonical snapshots. Invalid/inapplicable resolutions do not create authority.
- [ ] Update only required entries in `scripts/boilerplate/inventory.ts` and `.bemoat/boilerplate-sync-manifest.json` for any new runtime/test module. Preserve both contract anchors and all existing sync gates.
- [ ] Luna Med runs focused stale-base/router/sync/approved-base/corrections/evidence/parser/acquisition/CLI suites, `git diff --check`, `pnpm run check`, and discovered `pnpm run bemoat:check`; controller audits the diff and all 16 acceptance criteria.
- [ ] Controller commits one focused correction (preserve published characterization commit), pushes, opens a PR with `Refs #520` because post-merge recovery is required, publishes required HANDOFF, and reconstructs fresh Context. Native Git/PR mutation is used only where no registered Bemoat command owns the operation.
- [ ] Continue deterministic VERIFY/REVIEW routes. A separate Sol Med reviewer audits exact-head historical validity, both blob comparisons, ancestry, current identities, no ordering/rewrites/new authority, and #509/#518 regressions; publishes/readbacks native review evidence under current public-command contracts.
- [ ] Stop at FOUNDER_GATE or canonical STOP. Do not merge or run real #513 recovery before the required human gate.

Validation commands use the canonical root and Node v24.16.0 with the pnpm10 launcher from `/tmp/bemoat-520-bin`. CLI Discovery resolves registered contracts before Context, Handoff, canonical checks, or any other registered operation. Code/tests require the full starter tier; successful fixtures alone do not establish recovery.
