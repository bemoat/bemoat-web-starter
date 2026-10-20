# Pinned PStack Consumption Design

<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: null
task_key: "issue-561"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#561"
branch_template: "chore/561-pstack-pinned-consumption"
transition_target: "AWAITING_REVIEW_1"
planning_base_sha: "572630df1776138a052d4290bdc2d42a41792899"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: "docs/superpowers/specs/bemoat-web-starter/pstack/pinned-consumption/design.md"
paired_plan: "docs/superpowers/plans/bemoat-web-starter/pstack/pinned-consumption/plan.md"
```
<!-- bemoat-task-identity:end -->

## Goal

Make the official Cursor PStack tree available to Bemoat through a deterministic, task-local, integrity-verified cache while keeping installation non-activating and leaving Bemoat Context/Handoff as the only workflow authority.

## Source of truth

- Repository: `cursor/plugins`
- Subtree: `pstack/`
- Commit: `88d47514b82e7c44f00f2b2a72ff6dd12158038c`
- Plugin version: `0.15.29`
- PStack tree: `34a0b817e5ea92375bb10f20b15cf750d4e8095a`
- `pstack/plugin.json`: `2b28f689ca144500269499dd0d4ca5ab01891bf4`
- `pstack/.cursor-plugin/plugin.json`: `fe3321bdc728fe8dbd74c925e9913c4954450ecc`

## Design

`.bemoat/pstack-pin.json` records the immutable upstream identity, expected manifest/tree hashes, task-local cache path, and `automatic_routing: false`. `scripts/pstack.ts` exposes three explicit operations:

- `install`: clone/fetch the exact upstream commit into the ignored task-local cache; refuse to overwrite a non-matching cache.
- `check`: read-only validation of pin schema, cache commit, clean cache state, subtree hash, manifest hashes, and declared plugin version.
- `discover`: read-only JSON inventory of pinned skills and agents from the verified cache, explicitly reporting routing disabled.

The utility uses only Node built-ins and existing Git, so it does not add an orchestration or authority layer. It never copies PStack skills into `.agents`, changes Cursor configuration, invokes a skill, or changes Bemoat routing. The command is registered as a read-only/non-stateful utility through the existing CLI contract and architecture registries. Child compatibility is limited to syncing the pin, utility, documentation, focused test, and namespaced command metadata; no child repositories are changed in this Issue.

## Verification

Focused tests cover exact provenance, clean-checkout installation, cache mismatch/drift rejection, read-only check/discover behavior, and routing-off output. Repository validation remains the existing starter `pnpm run check` tier.

## Update and rollback

Updates require a new exact upstream commit, regenerated hashes, compatibility review, focused tests, and a normal PR. Rollback restores the previous pin file and utility/doc state; no production resource or migration is involved.
