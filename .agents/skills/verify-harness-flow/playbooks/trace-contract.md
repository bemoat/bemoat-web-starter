# Sanitized trace contract

The runner writes one JSON record after its synthetic workspace cleanup.

- `overall`: `PASS` only means the bounded synthetic checks and cleanup passed.
- `evidence_classes`: labels CLI/Git data `SYNTHETIC`; native host evidence is
  recorded separately as `UNREACHABLE` when absent.
- `oracle`: preserves the F01–F06 `SPEC_GAP` classifications and
  `UNREACHABLE-TIER2-SPAWNED-HOST` without route/action fallbacks.
- `checks`: stable check names and classifications only.
- `cleanup`: confirms owned workspace absence and retained trace presence.

Do not include raw CLI output, command environment, secrets, usernames,
absolute machine paths, or the original checkout's Git status in the trace.
