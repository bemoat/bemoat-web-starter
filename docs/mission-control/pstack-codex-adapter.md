# Codex adapter for pinned PStack

This reference maps PStack tool actions to the Codex tools exposed to the
accountable Bemoat Controller. It does not install a plugin, add a runtime, or
change Bemoat authority.

The normative playbooks and skills remain the official pinned tree at
`cursor/plugins@88d47514b82e7c44f00f2b2a72ff6dd12158038c/pstack`, version
`0.15.29`. Read the complete official pinned PStack skill file before applying
it. A Codex mapping does not replace or modify that source.

The upstream Codex mapping uses logical action names `spawn_agent`,
`wait_agent`, and `close_agent` (only when the Host exposes close). These are
not guaranteed registered tool identifiers. The specific implementation
Host/session inspected for this candidate exposed
`multi_agent_v1__spawn_agent`, `multi_agent_v1__wait_agent`, and
`multi_agent_v1__close_agent`. This is an observation from that implementation
Host/session only, not a universal Codex guarantee or a guarantee about a
reviewer Host. Every session must inspect its actual tool schemas and map by
capability; do not assume the `multi_agent_v1__` prefix or these exact
identifiers.

## Tool mapping

| PStack action | Codex Host action | Bemoat boundary |
| --- | --- | --- |
| Read or search files | Use `functions.exec_command` with `sed` or `rg`. | Keep characterization and verification read-only. |
| Edit files | Use `apply_patch`. | Only the authorized implementation worker writes its assigned paths. |
| Run a command | Use `functions.exec_command`. | Run only the command assigned to that worker and objective. |
| Invoke a skill or slash command | Read and follow the complete official pinned `SKILL.md` or playbook file. | Do not claim native plugin activation or copy the skill into another tree. |
| Dispatch an Agent or Task (`spawn_agent` logical action) | Observed implementation Host/session: `multi_agent_v1__spawn_agent`. | Required: retain each returned worker identity. Workers do not dispatch nested workers. |
| Wait for a worker (`wait_agent` logical action) | Observed implementation Host/session: `multi_agent_v1__wait_agent`. | Required: the Controller records the result as evidence, not authority. |
| Close a worker (`close_agent`, when available) | Observed implementation Host/session: `multi_agent_v1__close_agent`. | Optional across Hosts; use only when the actual Host schema exposes it. |

`poteto-agent` is the pinned PStack worker guidance, not a native Codex worker
type. Only the accountable Bemoat Controller dispatches workers. For each
dispatched worker, the Controller supplies the absolute path to
the pinned `poteto-mode/SKILL.md`, the pinned `agents/poteto-agent.md`, the
selected official skill or playbook, and the exact Bemoat role and write
boundary. The worker follows those files through its own Codex tools. Required
Host capabilities are dispatch, wait, and distinct returned worker identities.
If any is unavailable, stop and report the capability gap. Use close only when
the actual Host schema exposes it. Do not infer worker capability from a skill
file, a prompt, or a prior Host session.

The Controller may dispatch distinct read-only characterization,
implementation, deterministic-verification, and independent-review workers.
A distinct implementation worker is the sole owner of source and test mutation
at a time. A distinct independent reviewer must have a different Host worker
identity from both the Controller and implementer. If the official
`interrogate` skill calls for multiple reviewers, the Controller dispatches
each reviewer directly. A worker never acts as a second controller or starts
nested work.

## Bemoat authority wins

Use this mapping only after fresh Bemoat Context authorizes the exact bounded
`IMPLEMENT`, `VERIFY`, `FIX`, or `REVIEW` objective. Context-authorized
read-only `VERIFY`/`REVIEW` needs no first-edit trigger; the one-time trigger is
required before the first source-file mutation. Resolve the Issue, branch,
exact topic HEAD, upstream, approved protected base and exact base HEAD, and PR
state from live Bemoat authority and current GitHub/native Git evidence for each
objective. Do not reuse an earlier SHA or PR result as current authority.

PStack cannot authorize work, choose a Bemoat route, or change STOP,
FOUNDER_GATE, or COMPLETE. STOP and FOUNDER_GATE prohibit mutation. COMPLETE
remains terminal. The Controller owns route and gate decisions. Worker results
are evidence only. Preserve the required independent review, exact-head CI,
HANDOFF readback, fresh Context, and Founder-controlled merge.

Do not install a plugin or add automatic routing, Host configuration, session
hooks, fork model settings, a second controller, a shim, or a new checkout or
worktree. Do not
use PStack to install dependencies, commit, push, open a PR, merge, deploy,
migrate, or perform destructive cleanup. Bemoat's existing workflow owns those
operations and gates.

## Source and license

The tool-name comparison is adapted from the Codex mapping in
[`michael-denyer/pstack-claude` at commit `88f6d39f228c4f9210d93bbf7e5e40a5c671fd5e`](https://github.com/michael-denyer/pstack-claude/blob/88f6d39f228c4f9210d93bbf7e5e40a5c671fd5e/plugins/pstack/skills/poteto-mode/references/codex-tools.md),
blob `c078c939b74e17a42d08f63d5cbe6db79784b248`. Only compatible tool mapping
is reused. The adapter does not adopt that fork's PStack version, playbooks,
policies, hooks, routing, models, or worktree behavior. The source is MIT
licensed. Its full copyright and permission notice is in
[`third-party/pstack-codex-adapter-MIT.txt`](third-party/pstack-codex-adapter-MIT.txt).
