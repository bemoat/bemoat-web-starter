import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { collectContextEvidence } from '../../scripts/context/evidence.ts'
import type { ContextCommandResult, ContextCommandRunner } from '../../scripts/context/runtime.ts'
import { resolveApplicableHandoffs, runContextCommand } from '../../scripts/context/runtime.ts'
import { authorizeContextSync } from '../../scripts/context/sync.ts'
import { routeContext } from '../../scripts/context/router.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'

// The immutable pre-merge Issue #578 / PR #579 bindings are recorded in
// Issue #582 HANDOFF 6014391169. The live Issue is now closed and PR merged.
const currentRepo = 'bemoat/bemoat-web-starter'
const historicalRepo = 'boat1994/bemoat-web-starter'
const repositoryId = 1267006707
const issueNumber = '578'
const nativeIssueId = 5723632641
const commentId = 6010840947
const prNumber = '579'
const branch = 'docs/578-execution-response-ux'
const head = '67b08e3505139da886d22b79a36a0bed31861195'
const oldBase = 'd8cf45d21829b6bde78411f07c335031701003a7'
const liveBase = '46fe5363697cb24f0db5a6d4338a5540665bb697'
const policyBlob = '35f3ab438724a79c377a964747cb5bd5d9d040c5'
const currentIssueUrl = `https://github.com/${currentRepo}/issues/${issueNumber}`
const currentCommentUrl = `https://github.com/${currentRepo}/issues/${issueNumber}#issuecomment-${commentId}`
const currentIssueApi = `https://api.github.com/repos/${currentRepo}/issues/${issueNumber}`
const currentRepositoryApi = `https://api.github.com/repos/${currentRepo}`
const policy = `---\npolicy_id: bemoat-mission-control\nversion: 1.6.0\ncanonical_repository: ${currentRepo}\ntrusted_founder_login: bemoat\n---\n# Mission Control\n`
const preservedIssueBody = "Task size: bounded\nMission Control mode: required\n\nParent migration epic: #542\nRelated handoff UX owner: #512\n\n## Goal\n\nStandardize the **operator-facing Execution MC response UX** so the Founder can read one response and immediately know:\n\n1. what state the objective is in;\n2. whether any human action is required;\n3. exactly **where** that action must happen;\n4. whether to stay in the same Execution session, open a new Execution session, return to Global MC, approve a Founder gate, open a prepared workspace, or do nothing;\n5. what copy-ready artifact, if any, should be used.\n\nThis is a **Harness docs-only presentation contract**.\n\nIt must not add runtime machinery, scripts, parser/state logic, a renderer, new Context vocabulary, or new workflow authority.\n\n## Reproduced UX problem\n\nCurrent Bemoat authority semantics are mostly defined, but operator-facing response presentation is scattered across:\n\n- `AGENTS.md` final response fields;\n- the Global MC six-field operator summary;\n- `docs/mission-control/execution-handoff-contract.md` continuation/return rules;\n- loader prose for COMMAND / FOUNDER_GATE / STOP / COMPLETE.\n\nAs a result, an Execution response can be semantically correct while still forcing the Founder to infer:\n\n- \"Do I paste this back into the same Execution session?\"\n- \"Does this go to Global MC?\"\n- \"Am I supposed to approve something?\"\n- \"Should I open a prepared workspace?\"\n- \"Is this only status, or is there an action?\"\n- \"Why did it give me prose instead of a copy-ready prompt?\"\n\nThe #573 \u2192 #512 live flow reproduced this operator tax.\n\n## Architectural boundary\n\n**Workflow semantics stay where they already live. This Issue standardizes only how Execution MC presents the already-selected next action to the human.**\n\nThe response template must never decide or manufacture:\n\n- Context routes;\n- Founder authority;\n- implementation permission;\n- merge permission;\n- workspace recovery authority;\n- handoff/session classification;\n- STOP recovery;\n- future objectives.\n\nIt only presents an already-authorized state/action clearly.\n\n## Canonical response shape\n\nExecution responses should have two conceptual layers:\n\n### 1. Result summary\n\nA concise status block suitable for understanding what just happened.\n\nUse only fields that are actually relevant, for example:\n\n- objective / Issue;\n- current route/status;\n- branch / exact head / PR when relevant;\n- validation/review state when relevant;\n- durable result;\n- remaining blocker or gate.\n\nDo not bury the operator action inside this summary.\n\n### 2. Operator action panel\n\nEnd with exactly one clear operator-facing action classification when human transfer/action is required, or an explicit no-action classification when useful.\n\nThe heading must make **destination and responsibility obvious without reading surrounding prose**.\n\n## Required operator-action classes\n\nDefine canonical docs wording and examples for at least these classes.\n\n### A. NO ACTION REQUIRED\n\nUse when the current Execution controller can and should continue automatically.\n\nThe response must make clear that the Founder should not paste anything elsewhere or grant redundant approval.\n\nExample semantics:\n\n`NO ACTION REQUIRED \u2014 Execution continues automatically.`\n\n### B. ACTION REQUIRED \u2014 SAME EXECUTION SESSION\n\nUse for a real human trigger/action that must be pasted back into the **same valid Execution session**, such as the one-time first-edit trigger.\n\nThe response must state:\n\n- this goes to the same Execution session;\n- do not send it to Global MC;\n- provide the compact copy-ready artifact in the same response.\n\n### C. ACTION REQUIRED \u2014 NEW EXECUTION SESSION\n\nUse when a new Execution session is actually required.\n\nThe response must state:\n\n- open/start a new Execution session;\n- use the complete canonical handoff;\n- provide that handoff in the same response;\n- do not use same-session compact continuation.\n\n### D. ACTION REQUIRED \u2014 OPEN PREPARED WORKSPACE\n\nUse only for the canonical host-rebind boundary after a safe workspace has already been prepared and verified.\n\nThe response must state:\n\n- the exact verified path;\n- the exact open/rebind action;\n- no manual Founder Git clone/fetch/checkout commands;\n- fresh Context remains required after rebinding.\n\n### E. FOUNDER APPROVAL REQUIRED\n\nUse at a genuine `FOUNDER_GATE`.\n\nThe response must state:\n\n- the exact decision required;\n- the exact PR/head/scope identity when relevant;\n- permitted answer shape such as approve / reject / choose bounded alternative;\n- do not emit a mutation-capable continuation that assumes approval;\n- do not say \"back to Global MC\" when the actual next owner is the Founder decision.\n\n### F. BLOCKED \u2014 OPERATOR ACTION REQUIRED\n\nUse for a real `STOP` or host/evidence boundary where one concrete operator action is required.\n\nThe response must distinguish this from Founder approval.\n\nNever imply that every STOP can be solved by Founder approval.\n\n### G. BACK TO GLOBAL MC\n\nUse only when Execution ownership for the current Issue/objective is genuinely finished and orchestration must return to Global MC for fresh reconstruction / next-Issue selection.\n\nThe response must state:\n\n- why Execution is done;\n- durable terminal evidence / route;\n- what Global MC should reconstruct next, if already specified by canonical queue;\n- provide the smallest copy-ready Global MC seed when one is required.\n\nDo not use this merely to relay a fresh COMMAND, deterministic recovery, verification result, or same-Issue continuation.\n\n### H. COMPLETE \u2014 NO ACTION REQUIRED\n\nUse when the objective/Issue is terminal and there is no required operator transfer.\n\nDo not manufacture a Global MC round-trip if no further orchestration is requested.\n\n## Destination must be explicit\n\nWhenever an operator action exists, the response must explicitly name the destination:\n\n- `same Execution session`;\n- `new Execution session`;\n- `Global MC`;\n- `Founder decision in this chat`;\n- `open/rebind to <exact path>`;\n- another canonical destination if already defined by policy.\n\nAvoid ambiguous phrases such as:\n\n- \"continue\";\n- \"proceed\";\n- \"send this\";\n- \"go next\";\n- \"return\";\n- \"approve process\";\n\nunless the destination/action is explicitly stated.\n\n## Copy-ready rule\n\nWhen the operator must transfer text to another session/runtime:\n\n- include the complete copy-ready artifact in the same response;\n- keep it in one copyable container;\n- keep substantive destination instructions inside or immediately attached to the action panel;\n- do not force the Founder to ask \"where do I paste this?\" or \"where is the prompt?\";\n- do not make the artifact depend on surrounding prose for repository / Issue / required next action.\n\nThis Issue documents presentation only; #512 remains the owner of the bounded Ready-to-paste continuation semantics already under correction.\n\n## Docs-only implementation boundary\n\nThis Issue is intentionally **documentation-only**.\n\nPermitted files should be the smallest applicable Markdown/prompt-doc surface, expected to be among:\n\n- `AGENTS.md`;\n- `prompts/mission-control/chatgpt-project-loader.md`;\n- `docs/mission-control/execution-handoff-contract.md`;\n- a small dedicated Mission Control response-UX Markdown contract if characterization proves that clearer than duplicating prose;\n- directly coupled Markdown indexes/references only when needed.\n\n### Explicitly prohibited\n\nDo **not** add or modify:\n\n- `scripts/**`;\n- `tests/**`;\n- `src/**`;\n- `package.json` or lockfiles;\n- Context/Handoff runtime code;\n- parsers, schemas, route/state/evidence types;\n- GitHub workflows;\n- a response renderer/generator;\n- autonomous orchestration;\n- pstack integration;\n- product code.\n\nDo not add a script merely to validate presentation wording.\n\nIf enforcing this UX would require runtime/script implementation, stop and record that as a separate future defect rather than expanding this Issue.\n\n## Required documentation examples\n\nThe docs must include concise canonical examples showing at least:\n\n1. fresh `COMMAND` with direct continuation \u2192 **NO ACTION REQUIRED**;\n2. first-edit trigger \u2192 **ACTION REQUIRED \u2014 SAME EXECUTION SESSION** + copy-ready trigger;\n3. genuinely new Execution handoff \u2192 **ACTION REQUIRED \u2014 NEW EXECUTION SESSION** + full handoff;\n4. prepared sibling workspace/host rebind \u2192 **ACTION REQUIRED \u2014 OPEN PREPARED WORKSPACE** + exact path;\n5. merge/scope gate \u2192 **FOUNDER APPROVAL REQUIRED** + exact decision;\n6. fail-closed STOP requiring operator resolution \u2192 **BLOCKED \u2014 OPERATOR ACTION REQUIRED**;\n7. terminal Issue where next orchestration belongs to Global MC \u2192 **BACK TO GLOBAL MC**;\n8. terminal objective with nothing else required \u2192 **COMPLETE \u2014 NO ACTION REQUIRED**.\n\nExamples are illustrative presentation contracts only and must not become an alternate authority source.\n\n## Relationship to #512\n\n#512 fixes the bounded semantic defect:\n\n`cross-session next action known \u2192 copy-ready artifact appears in the same response`.\n\nThis Issue complements it by making the **human-readable Execution response state obvious and consistent**.\n\nDo not reopen #512's broad builder/validator/renderer program here.\n\n## Acceptance criteria\n\n- [ ] One canonical docs-only Execution response presentation contract exists.\n- [ ] Result summary and operator action are visually/semantically separated.\n- [ ] The required action class is obvious from the heading.\n- [ ] The destination is explicit whenever human action is required.\n- [ ] Same-session versus new-session versus Global-MC transfer cannot be confused from the documented template.\n- [ ] `FOUNDER_GATE` is presented as an exact Founder decision, not generic continuation.\n- [ ] `STOP` is not mislabeled as Founder approval.\n- [ ] Prepared-workspace recovery presents exact path/open action without Founder Git commands.\n- [ ] Directly executable continuation clearly says no operator action is needed.\n- [ ] Terminal work distinguishes `BACK TO GLOBAL MC` from `COMPLETE \u2014 NO ACTION REQUIRED`.\n- [ ] Any text transfer includes the copy-ready artifact in that same response.\n- [ ] Eight canonical examples cover the required action classes.\n- [ ] No scripts/tests/runtime/code/workflow files are added or modified.\n- [ ] No Context/Handoff/Founder authority semantics change.\n- [ ] Docs-only validation passes.\n- [ ] Live manual dogfood shows the Founder can identify \"what do I do, and where?\" without interpreting surrounding prose.\n\n## Validation\n\nDocs-only validation only:\n\n- repository-required docs/safety guard;\n- Markdown/reference consistency where already provided by existing repository tooling;\n- live/manual response dogfood against the eight documented examples.\n\nDo not create new scripts or TypeScript tests for this Issue.\n\n## Completion boundary\n\nComplete when Execution response presentation is standardized enough that a Founder can scan the final action panel and know, without inference:\n\n> **Do I need to do anything? If yes, exactly what, and in which session/runtime?**\n\nNo runtime enforcement project follows automatically.\n\nAfter acceptance, return to the current migration queue.\n"

// Exact UTF-8 bodies and creation times read from native comments 6010840947 and 6010924707.
const preservedVerify = { id: 6010840947, createdAt: "2026-10-06T06:38:40Z", body: "## HANDOFF\n\n```json\n{\n  \"schema_version\": 2,\n  \"record_type\": \"HANDOFF\",\n  \"objective_mode\": \"implementation\",\n  \"repository\": \"boat1994/bemoat-web-starter\",\n  \"issue_number\": \"578\",\n  \"objective\": \"Standardize Execution response UX with a canonical result summary and operator-action panel plus eight documented action-class examples.\",\n  \"permitted_scope\": [\n    \"docs/mission-control/execution-handoff-contract.md\"\n  ],\n  \"prohibited_scope\": [\n    \"scripts/**\",\n    \"tests/**\",\n    \"src/**\",\n    \"workflows\",\n    \"package and lock files\",\n    \"Context or Handoff semantics\",\n    \"Founder authority\",\n    \"parsers, schemas, routes, state, evidence types, or renderer/generator code\",\n    \"Issue #571\"\n  ],\n  \"executing_agent\": \"Luna XHigh\",\n  \"provider\": \"Codex\",\n  \"branch\": \"docs/578-execution-response-ux\",\n  \"exact_head\": \"67b08e3505139da886d22b79a36a0bed31861195\",\n  \"protected_base\": {\n    \"branch\": \"main\",\n    \"sha\": \"d8cf45d21829b6bde78411f07c335031701003a7\"\n  },\n  \"pr\": {\n    \"number\": \"579\",\n    \"url\": \"https://github.com/boat1994/bemoat-web-starter/pull/579\",\n    \"base\": \"main\",\n    \"head\": \"docs/578-execution-response-ux\",\n    \"head_sha\": \"67b08e3505139da886d22b79a36a0bed31861195\"\n  },\n  \"verified_evidence\": [\n    {\n      \"kind\": \"focused-tests\",\n      \"value\": \"Docs-only validation passed: pnpm run guard:safety and git diff --check. Exact-head GitHub checks are pending; live Founder dogfood remains for human review.\",\n      \"url\": \"https://github.com/boat1994/bemoat-web-starter/pull/579\"\n    },\n    {\n      \"kind\": \"validation-proof\",\n      \"value\": \"{\\\"status\\\":\\\"PASS\\\",\\\"tier\\\":\\\"docs-only\\\",\\\"command\\\":\\\"pnpm run bemoat:guard:safety\\\",\\\"exact_head\\\":\\\"67b08e3505139da886d22b79a36a0bed31861195\\\"}\",\n      \"url\": null\n    }\n  ],\n  \"route\": \"VERIFY\",\n  \"next_action\": {\n    \"route\": \"VERIFY\",\n    \"description\": \"Wait for or verify the exact-head checks on PR #579 at 67b08e3505139da886d22b79a36a0bed31861195, then reconstruct fresh Context before selecting any next objective.\"\n  },\n  \"stop_conditions\": [\n    \"Do not merge; only a human may merge.\",\n    \"Do not begin Issue #571.\",\n    \"Stop if PR, branch, exact head, protected base, or CI evidence drifts or conflicts.\"\n  ],\n  \"local_durability\": {\n    \"required\": true,\n    \"durable\": true,\n    \"reason\": null\n  }\n}\n```\n" }
const preservedStop = { id: 6010924707, createdAt: "2026-10-06T06:45:01Z", body: "## HANDOFF\n\n```json\n{\n  \"schema_version\": 3,\n  \"record_type\": \"HANDOFF\",\n  \"objective_mode\": \"implementation\",\n  \"repository\": \"boat1994/bemoat-web-starter\",\n  \"issue_number\": \"578\",\n  \"objective\": \"Complete the exact-head semantic review handoff for the Execution response UX docs change.\",\n  \"permitted_scope\": [\n    \"docs/mission-control/execution-handoff-contract.md\",\n    \"Issue #578 workflow evidence for PR #579\"\n  ],\n  \"prohibited_scope\": [\n    \"scripts/**\",\n    \"tests/**\",\n    \"runtime code\",\n    \"workflows\",\n    \"package and lock files\",\n    \"Context or Handoff semantics\",\n    \"Founder authority\",\n    \"parsers, schemas, routes, or renderer/generator code\",\n    \"Issue #571\"\n  ],\n  \"executing_agent\": \"Luna XHigh\",\n  \"provider\": \"Codex\",\n  \"branch\": \"docs/578-execution-response-ux\",\n  \"exact_head\": \"67b08e3505139da886d22b79a36a0bed31861195\",\n  \"protected_base\": {\n    \"branch\": \"main\",\n    \"sha\": \"d8cf45d21829b6bde78411f07c335031701003a7\"\n  },\n  \"pr\": {\n    \"number\": \"579\",\n    \"url\": \"https://github.com/boat1994/bemoat-web-starter/pull/579\",\n    \"base\": \"main\",\n    \"head\": \"docs/578-execution-response-ux\",\n    \"head_sha\": \"67b08e3505139da886d22b79a36a0bed31861195\"\n  },\n  \"verified_evidence\": [\n    {\n      \"kind\": \"focused-tests\",\n      \"value\": \"Docs-only validation passed with pnpm run guard:safety and git diff --check; exact-head GitHub checks passed. Independent semantic review found no findings. Native REVIEW_VERDICT publication is blocked because the repository requires production-parser validation but exposes no public validation route.\",\n      \"url\": \"https://github.com/boat1994/bemoat-web-starter/pull/579\"\n    },\n    {\n      \"kind\": \"stop-blocker\",\n      \"value\": \"missing-public-review-verdict-validator\",\n      \"url\": null\n    },\n    {\n      \"kind\": \"validation-proof\",\n      \"value\": \"{\\\"status\\\":\\\"PASS\\\",\\\"tier\\\":\\\"docs-only\\\",\\\"command\\\":\\\"pnpm run bemoat:guard:safety\\\",\\\"exact_head\\\":\\\"67b08e3505139da886d22b79a36a0bed31861195\\\"}\",\n      \"url\": null\n    }\n  ],\n  \"route\": \"STOP\",\n  \"next_action\": {\n    \"route\": \"STOP\",\n    \"description\": \"Provide a supported public route to validate the completed native REVIEW_VERDICT body with the production parser, or publish another canonical resolution; then reconstruct fresh Context before continuing.\"\n  },\n  \"stop_conditions\": [\n    \"Do not merge; only a human may merge.\",\n    \"Do not begin Issue #571.\",\n    \"Do not publish an unvalidated REVIEW_VERDICT.\"\n  ],\n  \"local_durability\": {\n    \"required\": true,\n    \"durable\": true,\n    \"reason\": null\n  }\n}\n```\n" }

function ok(value: unknown): ContextCommandResult {
  return { status: 0, stdout: typeof value === 'string' ? value : JSON.stringify(value), stderr: '', error: null }
}

function verifyRecord(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  const json = preservedVerify.body.match(/^## HANDOFF\n\n```json\n([\s\S]+)\n```\n$/)?.[1]
  if (!json) throw new Error('Preserved native VERIFY body has no strict HANDOFF JSON block')
  return { ...parseHandoffBody(json), ...overrides }
}

type ProofVariant = 'same' | 'missing' | 'ambiguous' | 'conflicting' | 'duplicate-conflicting' | 'malformed' | 'different' | 'both-different' | 'redirect-only' |
  'historical-missing' | 'historical-malformed' | 'historical-different'

function story(variant: ProofVariant = 'same', options: { origin?: string; prUrl?: string; record?: HandoffRecord; policy?: string; chronology?: boolean } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'bemoat-578-transfer-'))
  const git = (args: string[]) => {
    const result = runContextCommand('git', args, { cwd })
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`)
    return result.stdout.trim()
  }
  git(['init', '-b', 'main'])
  git(['config', 'user.email', 'context-test@example.invalid'])
  git(['config', 'user.name', 'Context test'])
  writeFileSync(join(cwd, 'baseline.txt'), 'baseline\n')
  git(['add', 'baseline.txt'])
  git(['commit', '-m', 'baseline'])
  git(['switch', '-c', branch])
  git(['remote', 'add', 'origin', `https://github.com/${options.origin ?? currentRepo}.git`])
  git(['config', `branch.${branch}.remote`, 'origin'])
  git(['config', `branch.${branch}.merge`, `refs/heads/${branch}`])
  git(['update-ref', `refs/remotes/origin/${branch}`, git(['rev-parse', 'HEAD'])])
  const localHead = head
  const commentBody = options.record ? renderHandoffComment(options.record) : preservedVerify.body
  const calls: string[] = []
  const roleComments = options.chronology ? [preservedVerify, preservedStop] : [{ id: commentId, createdAt: preservedVerify.createdAt, body: commentBody }]
  const nativeComment = {
    id: commentId,
    html_url: currentCommentUrl,
    issue_url: currentIssueApi,
    body: commentBody,
    user: { login: 'bemoat', id: 36528988 },
    author_association: 'OWNER',
  }
  const nativeIssue = { id: nativeIssueId, number: Number(issueNumber), repository_url: currentRepositoryApi, url: currentIssueApi, html_url: currentIssueUrl }
  const repoPayload = { id: variant === 'different' || variant === 'both-different' ? repositoryId + 1 : repositoryId, full_name: currentRepo, url: currentRepositoryApi }
  const runner: ContextCommandRunner = (command, args, runOptions) => {
    const key = args.join(' ')
    calls.push(`${command} ${key}`)
    if (command === 'git') {
      if (args[0] === 'ls-remote') return ok(`${localHead}\trefs/heads/${branch}\n`)
      if (args[0] === 'worktree' && args[1] === 'list') return ok(`worktree ${cwd}\nHEAD ${localHead}\nbranch refs/heads/${branch}\n`)
      if (key === 'rev-parse HEAD' || key === `rev-parse refs/remotes/origin/${branch}` ||
          key === `rev-parse --verify --quiet refs/remotes/origin/${branch}`) return ok(`${localHead}\n`)
      return runContextCommand(command, args, { ...runOptions, cwd })
    }
    if (command !== 'gh') return ok('')
    if (key.includes('git/ref/heads/dev')) return { status: 1, stdout: '', stderr: 'Not Found', error: null }
    if (key.includes('git/ref/heads/main')) return ok({ object: { sha: liveBase } })
    if (key.includes('contents/docs/mission-control/mission-control-guide.md')) return ok({ sha: policyBlob, content: Buffer.from(options.policy ?? policy).toString('base64'), encoding: 'base64' })
    if (args[0] === 'issue' && args[1] === 'view') return ok({
      number: Number(issueNumber), title: 'Execution response UX docs', state: 'OPEN', url: currentIssueUrl,
      body: preservedIssueBody,
      comments: roleComments.map((comment) => ({
        id: String(comment.id),
        url: `https://github.com/${currentRepo}/issues/${issueNumber}#issuecomment-${comment.id}`,
        body: comment.body,
        createdAt: comment.createdAt,
        author: { login: 'bemoat' },
      })),
    })
    if (args[0] === 'pr' && args[1] === 'list') return ok([{
      number: Number(prNumber), url: `https://github.com/${currentRepo}/pull/${prNumber}`,
      headRefName: branch, closingIssuesReferences: [{ number: Number(issueNumber) }],
    }])
    if (args[0] === 'pr' && args[1] === 'view') return ok({
      number: Number(prNumber), state: 'OPEN', isDraft: false, url: options.prUrl ?? `https://github.com/${currentRepo}/pull/${prNumber}`,
      baseRefName: 'main', baseRefOid: oldBase, headRefName: branch, headRefOid: localHead,
      mergeCommit: null, statusCheckRollup: [],
    })
    if (key.includes(`/pulls/${prNumber}/reviews`)) return ok([[]])
    if (key.includes('/branches/main/protection')) return ok({})
    if (args[0] === 'api') {
      const endpoint = args.find((arg) => arg.startsWith('repos/'))?.replace(/\?.*$/, '')
      if (endpoint === `repos/${currentRepo}/issues/comments/${commentId}`) {
        if (variant === 'missing' || variant === 'redirect-only') return { status: 1, stdout: '', stderr: 'Not Found', error: null }
        return ok(variant === 'conflicting' ? { ...nativeComment, issue_url: `https://api.github.com/repos/other/repo/issues/${issueNumber}` } : nativeComment)
      }
      if (options.chronology && endpoint === `repos/${currentRepo}/issues/comments/${preservedStop.id}`) {
        return ok({ ...nativeComment, id: preservedStop.id, html_url: `https://github.com/${currentRepo}/issues/${issueNumber}#issuecomment-${preservedStop.id}`, body: preservedStop.body })
      }
      if (endpoint === `repos/${currentRepo}/issues/${issueNumber}`) {
        if (variant === 'redirect-only') return { status: 1, stdout: '', stderr: 'Not Found', error: null }
        return ok(variant === 'malformed' ? { ...nativeIssue, repository_url: 'invalid' } : nativeIssue)
      }
      if (endpoint === `repos/${currentRepo}/issues/${issueNumber}/comments`) {
        if (variant === 'missing' || variant === 'redirect-only') return ok([[]])
        const native = variant === 'conflicting' ? { ...nativeComment, issue_url: `https://api.github.com/repos/other/repo/issues/${issueNumber}` } : nativeComment
        const comments = options.chronology
          ? [native, { ...native, id: preservedStop.id, html_url: `https://github.com/${currentRepo}/issues/${issueNumber}#issuecomment-${preservedStop.id}`, body: preservedStop.body }]
          : [native]
        if (variant === 'ambiguous') return ok([[...comments, native]])
        if (variant === 'duplicate-conflicting') return ok([[...comments, { ...native, body: `${native.body} conflicting duplicate` }]])
        return ok([comments])
      }
      if (endpoint === `repos/${currentRepo}`) return ok(repoPayload)
      if (endpoint === `repos/${historicalRepo}`) {
        if (variant === 'historical-missing') return { status: 1, stdout: '', stderr: 'Not Found', error: null }
        if (variant === 'historical-malformed') return ok({ id: 'invalid', full_name: currentRepo, url: currentRepositoryApi })
        if (variant === 'historical-different' || variant === 'both-different') return ok({ id: repositoryId + 1, full_name: currentRepo, url: currentRepositoryApi })
        return ok({ id: repositoryId, full_name: currentRepo, url: currentRepositoryApi })
      }
    }
    return ok('')
  }
  try {
    const evidence = collectContextEvidence({ cwd, issueNumber, env: { GH_REPO: currentRepo, NODE_ENV: 'test', PAYLOAD_SECRET: 'test-only-secret' }, run: runner })
    return { evidence, calls, localHead }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

describe('Issue #582 historical repository identity proof', () => {
  it('reconstructs the immutable pre-merge #578 VERIFY then schema-v3 STOP chronology', () => {
    const { evidence, calls } = story('same', { chronology: true })
    const activePr = evidence.activePr
    expect(activePr && !Array.isArray(activePr)).toBe(true)
    if (!activePr || Array.isArray(activePr)) return
    const verify = parseHandoffBody(preservedVerify.body.match(/^## HANDOFF\n\n```json\n([\s\S]+)\n```\n$/)![1]!)
    const stop = parseHandoffBody(preservedStop.body.match(/^## HANDOFF\n\n```json\n([\s\S]+)\n```\n$/)![1]!)
    expect(verify).toMatchObject({ schema_version: 2, repository: historicalRepo, issue_number: issueNumber, route: 'VERIFY', exact_head: head, protected_base: { branch: 'main', sha: oldBase }, pr: { number: prNumber, head_sha: head } })
    expect(stop).toMatchObject({ schema_version: 3, repository: historicalRepo, issue_number: issueNumber, route: 'STOP', exact_head: head, protected_base: { branch: 'main', sha: oldBase }, pr: { number: prNumber, head_sha: head } })
    expect(stop.verified_evidence).toContainEqual(expect.objectContaining({ kind: 'stop-blocker', value: 'missing-public-review-verdict-validator' }))
    expect(evidence.issue).toMatchObject({ number: issueNumber, state: 'OPEN', scope: null })
    expect(activePr).toMatchObject({ number: prNumber, baseSha: oldBase, headSha: head, merged: false })
    expect(evidence.protectedBase.sha).toBe(liveBase)
    expect(evidence.durableContext.handoffs?.map((item) => String(item.id))).toEqual([String(preservedVerify.id), String(preservedStop.id)])
    expect(calls.some((call) => call.includes(`repos/${currentRepo}/issues/comments/${preservedVerify.id}`))).toBe(true)
    expect(calls.some((call) => call.includes(`repos/${currentRepo}/issues/comments/${preservedStop.id}`))).toBe(true)
    expect(calls.some((call) => call.includes(`repos/${historicalRepo}`))).toBe(true)
    const resolution = resolveApplicableHandoffs(evidence, activePr)
    expect(resolution.applicable.map(({ evidence: item }) => String(item.id))).toEqual([String(preservedVerify.id), String(preservedStop.id)])
    expect(String(resolution.superseding?.evidence.id)).toBe(String(preservedStop.id))
    expect(routeContext(evidence).route).toBe('STOP')
  })

  it('isolates immutable VERIFY comment 6010840947 before the later STOP and proves its live repository-ID chain', () => {
    const currentControl = story('same', {
      record: verifyRecord({ repository: currentRepo, pr: { ...verifyRecord().pr!, url: `https://github.com/${currentRepo}/pull/${prNumber}` } }),
    }).evidence
    expect(authorizeContextSync(currentControl)).toMatchObject({ allowed: true, route: 'REVIEW' })
    const { evidence, calls, localHead } = story()
    const activePr = evidence.activePr
    expect(activePr && !Array.isArray(activePr)).toBe(true)
    if (!activePr || Array.isArray(activePr)) return
    expect(evidence.issue).toMatchObject({ number: issueNumber, state: 'OPEN', scope: null })
    expect(activePr).toMatchObject({ number: prNumber, baseSha: oldBase, headBranch: branch, headSha: localHead })
    expect(evidence.protectedBase.sha).toBe(liveBase)
    expect(evidence.policy).toMatchObject({ policyId: 'bemoat-mission-control', version: '1.6.0', sourceSha: policyBlob })
    expect(evidence.durableContext.handoffs?.map(({ id }) => String(id))).toEqual([String(preservedVerify.id)])
    expect(evidence.durableContext.latestHandoff?.body).toBe(preservedVerify.body)
    expect(evidence.durableContext.latestHandoff?.url).toBe(currentCommentUrl)
    expect(evidence.durableContext.latestHandoff?.createdAt).toBe(preservedVerify.createdAt)
    expect(evidence.evidenceErrors).toEqual([`EVIDENCE_CONFLICT: PR #${prNumber} base does not match live protected main@${liveBase}`])
    expect(calls.some((call) => call.includes(`repos/${currentRepo}/issues/comments/${commentId}`))).toBe(true)
    expect(calls.some((call) => call.includes(`repos/${currentRepo}/issues/${issueNumber}`))).toBe(true)
    expect(calls.some((call) => call.includes(`repos/${currentRepo}`))).toBe(true)
    expect(calls.some((call) => call.includes(`repos/${historicalRepo}`))).toBe(true)
    expect(resolveApplicableHandoffs(evidence, activePr).applicable).toHaveLength(1)
    expect(routeContext(evidence).route).toBe('STOP')
    expect(authorizeContextSync(evidence)).toMatchObject({ allowed: true, route: 'REVIEW', recovery: { type: 'SYNC_BASE' } })
  })

  it.each<ProofVariant>(['missing', 'ambiguous', 'conflicting', 'duplicate-conflicting', 'malformed', 'different', 'both-different', 'redirect-only', 'historical-missing', 'historical-malformed', 'historical-different'])(
    'keeps %s proof fail-closed even when the historical name redirects', (variant) => {
      const { evidence } = story(variant)
      expect(authorizeContextSync(evidence)).toMatchObject({ allowed: false, route: 'STOP' })
      expect(authorizeContextSync(evidence)).not.toHaveProperty('recovery')
    },
  )

  it.each<ProofVariant>(['missing', 'ambiguous', 'conflicting', 'duplicate-conflicting', 'malformed', 'different', 'both-different', 'redirect-only', 'historical-missing', 'historical-malformed', 'historical-different'])(
    'keeps the full immutable VERIFY and STOP pair fail-closed for %s proof', (variant) => {
      const { evidence } = story(variant, { chronology: true })
      const activePr = evidence.activePr
      expect(activePr && !Array.isArray(activePr)).toBe(true)
      if (!activePr || Array.isArray(activePr)) return
      const resolution = resolveApplicableHandoffs(evidence, activePr)
      expect(resolution.applicable).toEqual([])
      expect(resolution.superseding).toBeNull()
      expect(routeContext(evidence).route).toBe('STOP')
      expect(authorizeContextSync(evidence)).not.toHaveProperty('recovery')
    },
  )

  it('keeps canonical current origin and active PR ownership exact', () => {
    const wrongOrigin = story('same', { origin: historicalRepo }).evidence
    expect(authorizeContextSync(wrongOrigin)).not.toHaveProperty('recovery')
    const wrongPr = story('same', { prUrl: `https://github.com/${historicalRepo}/pull/${prNumber}` }).evidence
    expect(wrongPr.evidenceErrors.some((reason) => reason.includes('PR #579 identity'))).toBe(true)
    expect(authorizeContextSync(wrongPr)).not.toHaveProperty('recovery')
  })

  it('preserves an independent exact-head gate after same-repository proof', () => {
    const wrongHead = verifyRecord({ exact_head: 'f'.repeat(40), pr: { ...verifyRecord().pr!, head_sha: 'f'.repeat(40) } })
    const { evidence } = story('same', { record: wrongHead })
    expect(authorizeContextSync(evidence)).not.toHaveProperty('recovery')
  })

  it('keeps a copied child policy fail-closed', () => {
    const copiedPolicy = policy.replace(`canonical_repository: ${currentRepo}`, 'canonical_repository: other/child')
    const { evidence } = story('same', { policy: copiedPolicy })
    expect(authorizeContextSync(evidence)).not.toHaveProperty('recovery')
  })
})

describe('Issue #582 current repository identity surfaces', () => {
  it('runs the starter strict CI guard only for the current canonical repository', () => {
    const workflow = readFileSync(join(process.cwd(), '.github/workflows/ci-starter.yml'), 'utf8')
    expect(workflow).toMatch(/if:\s*github\.repository == 'bemoat\/bemoat-web-starter'/)
  })

  it.each([
    'scripts/boilerplate/package.ts',
    'scripts/boilerplate/filesystem.ts',
    'scripts/boilerplate/workflows/check-boilerplate-drift.ts',
    'scripts/sync-boilerplate.ts',
    'scripts/check-boilerplate-drift.ts',
  ])('defaults %s to the current canonical starter source', (path) => {
    const source = readFileSync(join(process.cwd(), path), 'utf8')
    expect(source).toContain("process.env.BEMOAT_BOILERPLATE_REPO || 'bemoat/bemoat-web-starter'")
  })

  it('records the current canonical source in the starter boilerplate sync manifest', () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), '.bemoat-boilerplate-sync.json'), 'utf8')) as { repo: string }
    expect(config.repo).toBe(currentRepo)
  })

  it('uses the current repository in each copyable REVIEW_VERDICT publication example', () => {
    const template = readFileSync(join(process.cwd(), 'docs/mission-control/review-verdict-template.md'), 'utf8')
    const examples = [...template.matchAll(/<!-- review-verdict:[^:]+:start -->([\s\S]+?)<!-- review-verdict:[^:]+:end -->/g)]
    expect(examples).toHaveLength(3)
    for (const [, body] of examples) {
      expect(body).toContain(`Repository: \`${currentRepo}\``)
      expect(body).not.toContain(`Repository: \`${historicalRepo}\``)
      expect(body).not.toContain(`https://github.com/${historicalRepo}/`)
    }
  })

  it('keeps the protected policy bound to the current repository and Founder login', () => {
    const guide = readFileSync(join(process.cwd(), 'docs/mission-control/mission-control-guide.md'), 'utf8')
    expect(guide).toMatch(/^canonical_repository: bemoat\/bemoat-web-starter$/m)
    expect(guide).toMatch(/^trusted_founder_login: bemoat$/m)
  })
})
