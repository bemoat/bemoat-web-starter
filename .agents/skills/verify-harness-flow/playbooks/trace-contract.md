# Sanitized trace contract

The contract below describes the legacy Issue #643 `run-verification.mjs`
trace. Issue #648 uses the separate `run-synthetic-context.mjs` trace for the
explicitly opted-in Tier-1 adapter; that trace records `SUPPORTED` for the
owned adapter boundary, native A→B→C→D observations, per-negative side-effect
proof, and the separate Tier-2 `UNREACHABLE` boundary.

The runner writes one JSON record after its synthetic workspace cleanup.

- `overall`: `UNREACHABLE` for this runner because registered Context has no
  controlled synthetic GitHub evidence adapter. Individual setup checks may be
  `PASS`; the A/B/C/D scenario is not a `PASS`.
- `evidence_classes`: labels CLI/Git data `SYNTHETIC`; native host evidence is
  recorded separately as `UNREACHABLE` when absent.
- `context_adapter_boundary`: records the inspected registered Context support
  (`--target-worktree` and live GitHub reads), the missing synthetic adapter,
  null route/action, blocker, and owner.
- `trials` and `criteria`: A/B/C/D and C02–C05 records, all
  `UNREACHABLE` at that boundary with null route/action, blocker, and owner.
- `original_checkout`: exact sanitized before/after head, branch, upstream,
  refs, and WIP snapshots plus an unchanged comparison.
- `oracle`: preserves the F01–F06 `SPEC_GAP` classifications and
  `UNREACHABLE-TIER2-SPAWNED-HOST` without route/action fallbacks.
- `checks`: stable check names and classifications only.
- `cleanup`: confirms owned workspace absence and sets `trace_retained` only
  after durable trace write and readback.

Do not include raw CLI output, command environment, secrets, usernames, or
absolute machine paths in the trace. The exact `original_checkout.wip` arrays
are the approved sanitized before/after WIP snapshot and must remain paired
with the ref snapshot comparison.
