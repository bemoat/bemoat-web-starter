# Doctor → Drive → Capture → Cleanup

## Doctor

- Read canonical policy and run registered CLI Discovery before invoking a
  Bemoat command.
- Use the discovered safe help invocation where `help_meaningful` is true.
- Do not infer a command contract from this playbook or an implementation
  entrypoint.

## Drive

- Run `node .agents/skills/verify-harness-flow/run-verification.mjs` from the
  repository root.
- The runner performs safe public Context/Handoff help, a local bare remote and
  clone, and an inert synthetic observation trial.
- Never provide synthetic evidence to Context. Never run a production
  `gh` mutation or a valid production Handoff.

## Capture

- Review the retained `trace.json` in the task-owned temporary evidence
  directory printed by the runner.
- Treat its Git/CLI observations as synthetic evidence only.
- Keep any native spawned-host continuity record separate. Without that
  evidence, report `UNREACHABLE`.
- Preserve the oracle's F01–F06 `SPEC_GAP` records and exclusions.

## Cleanup

- The runner verifies its ownership marker before removing its own synthetic
  workspace.
- It reads back workspace absence and trace presence before setting cleanup to
  verified.
- If ownership or readback fails, classify `DEFECT` and do not claim cleanup
  success. Leave outside-owned resources untouched.
