import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { COMMAND_CONTRACT_REGISTRY } from '../../scripts/cli/command-contract-registry.ts'

const root = process.cwd()

const OFFICIAL_PSTACK_HOW_CAPABILITIES = [
  'poteto-mode',
  'poteto-agent',
  'tdd',
  'principle-prove-it-works',
  'interrogate',
] as const

const readText = (path: string) =>
  readFileSync(resolve(root, path), 'utf8').replace(/\s+/g, ' ').trim()

const section = (source: string, heading: string, nextHeading: string) => {
  const start = source.indexOf(heading)
  if (start === -1) throw new Error(`missing canonical section: ${heading}`)
  const end = source.indexOf(nextHeading, start + heading.length)
  if (end === -1) throw new Error(`missing canonical section boundary: ${nextHeading}`)
  return source.slice(start, end === -1 ? undefined : end)
}

describe('Bemoat PStack execution cutover contract', () => {
  it('keeps bemoat:pstack limited to cache operations without routing activation', () => {
    const registered = COMMAND_CONTRACT_REGISTRY.commands['bemoat:pstack']
    const operationInput = registered.required_inputs.find(
      (input: { name: string }) => input.name === 'operation',
    )

    expect(registered).toMatchObject({
      command: 'bemoat:pstack',
      entrypoint: 'scripts/pstack.ts',
      accepted_pre_states: ['NOT_STATEFUL'],
      writes: ['task-local PStack Git cache during explicit install only'],
    })
    expect(operationInput?.values).toEqual(['install', 'check', 'discover'])
    expect(operationInput?.values).not.toEqual(expect.arrayContaining(['execute', 'route']))
    expect(registered.stop_conditions).toContain(
      'Never copy PStack skills or agents into .agents, change Cursor settings, execute PStack, or change Bemoat routing authority.',
    )
  })

  it('binds only the official worker capabilities and denies autonomous shipping actions', () => {
    expect(existsSync(resolve(root, '.cursor/rules/bemoat-pstack-execution.mdc'))).toBe(true)
    const rule = readText('.cursor/rules/bemoat-pstack-execution.mdc')
    const allowlist = section(rule, '## Explicit PStack allowlist', '## Explicit PStack denylist')
    const denylist = section(rule, '## Explicit PStack denylist', 'If Cursor cannot provide')

    for (const name of OFFICIAL_PSTACK_HOW_CAPABILITIES) {
      expect(allowlist).toContain(`\`${name}\``)
    }

    expect(allowlist).toContain(
      '`poteto-mode` in the receiving Cursor chat for generic HOW/playbook orchestration.',
    )
    expect(allowlist).toContain('`poteto-agent` for distinct bounded workers.')
    expect(allowlist).toContain(
      'The relevant worker skills, including `tdd`, `principle-prove-it-works`, and `interrogate`',
    )
    expect(allowlist).toContain('`principle-prove-it-works`')
    expect(allowlist).toContain('`interrogate`, only within the roles and gates above.')
    expect(rule).toMatch(
      /Bemoat controller.*orchestration-only.*no source.*test.*verification mutation/i,
    )
    expect(rule).toMatch(
      /controller.*does not characterize the repository or perform deterministic verification/i,
    )
    expect(rule).toMatch(/`poteto-agent`.*distinct worker/i)
    expect(rule).toMatch(/worker failure.*controller fallback.*forbidden/i)
    expect(rule).toMatch(/`interrogate`.*distinct independent semantic\/Delta reviewer identity/i)

    for (const forbidden of [
      '`shipping`',
      '`autonomous-run`',
      '`autopilot-full`',
      '`autopilot-stack`',
      '`/autopilot`',
      '`worktree-cleanup`',
      '`orchestrate`',
      '`opening-a-pr`',
      'direct merge',
      'PR/push/merge mutation',
      'deployment',
      'migration',
      'destructive cleanup',
    ]) {
      expect(denylist).toContain(forbidden)
      expect(allowlist).not.toContain(forbidden)
    }
  })

  it('uses the checked-in PStack pin as the cache-independent provenance oracle', () => {
    const pin = JSON.parse(readFileSync(resolve(root, '.bemoat/pstack-pin.json'), 'utf8')) as {
      repository: string
      subtree: string
      commit: string
      version: string
      automatic_routing: boolean
    }
    const contract = readText('docs/mission-control/pstack-execution-contract.md')
    const pstackDocs = readText('docs/pstack.md')

    expect(pin).toMatchObject({
      repository: 'cursor/plugins',
      subtree: 'pstack',
      commit: '88d47514b82e7c44f00f2b2a72ff6dd12158038c',
      version: '0.15.29',
      automatic_routing: false,
    })
    expect(contract).toContain(`cursor/plugins@${pin.commit}`)
    expect(contract).toContain(`PStack version \`${pin.version}\``)
    expect(contract).toContain('`automatic_routing: false`')
    expect(pstackDocs).toContain(`exact commit: \`${pin.commit}\``)
    expect(pstackDocs).toContain(`plugin version: \`${pin.version}\``)
    expect(pstackDocs).toContain('`automatic_routing` remains `false`')
  })

  it('keeps release and cleanup fail-closed under Bemoat ownership', () => {
    const contract = readText('docs/mission-control/pstack-execution-contract.md')
    const rule = readText('.cursor/rules/bemoat-pstack-execution.mdc')
    const pstackDocs = readText('docs/pstack.md')

    for (const source of [contract, rule]) {
      expect(source).toMatch(
        /direct\/single checkout.*clean verified protected base.*durable exact.head readback.*sole ownership.*no active writer.*no unpushed work/i,
      )
      expect(source).toMatch(
        /task worktree.*released or removed.*exact branch\/head durability.*unique ownership.*clean state.*primary checkout preservation/i,
      )
      expect(source).toMatch(/missing proof is `STOP`/i)
      expect(source).toMatch(/must not perform destructive cleanup/i)
    }

    expect(contract).toMatch(/later commit, push, and PR gates outside the PStack HOW layer/i)
    expect(contract).toMatch(/merge remains subject to the existing no-autonomous-merge policy/i)
    expect(pstackDocs).toMatch(
      /opening-a-pr.*PR\/push\/merge mutation.*outside the PStack HOW layer/i,
    )
  })

  // Oracle: Issue #562's required authority precedence and acceptance criteria.
  // These source checks guard the published contract, not Context runtime behavior.
  it('preserves Bemoat authority, route boundaries, and the first-edit Context seam', () => {
    const contract = readText('docs/mission-control/pstack-execution-contract.md')
    const rule = readText('.cursor/rules/bemoat-pstack-execution.mdc')
    const loader = readText('prompts/mission-control/chatgpt-project-loader.md')
    const handoff = readText('docs/mission-control/execution-handoff-contract.md')
    const modelRouting = section(
      handoff,
      '## 7. Model routing',
      '## 8. Execution / delegation rules',
    )

    expect(contract).toContain('Bemoat decides WHETHER / WHAT is authorized.')
    expect(contract).toContain('PStack decides HOW to execute the already-authorized objective.')
    expect(contract).toMatch(/`poteto-mode` remains generic orchestration\/HOW machinery/i)
    expect(contract).toContain('STOP and FOUNDER_GATE are absolute no-PStack-execution boundaries')
    const routeBoundary = section(
      contract,
      'STOP and FOUNDER_GATE are absolute no-PStack-execution boundaries',
      '## Worker topology',
    )
    // Bug: a blanket STOP mutation ban erases the exact §12 recovery allowed by protected-main f6530197de0c0811b5d58c42350a1f4f30ab5926 §13.
    expect(routeBoundary).toMatch(
      /PStack must not execute an objective at `STOP` or `FOUNDER_GATE`/i,
    )
    expect(routeBoundary).not.toMatch(/No mutation may run at either route\./i)
    expect(routeBoundary).toMatch(
      /only (?:the )?exact Bemoat-prescribed bounded recover(?:y|ies).*?(?:§|section )12.*?(?:§|section )13.*?execution-handoff-contract/i,
    )
    expect(contract).toMatch(/`COMPLETE` remains a Bemoat terminal result/i)
    expect(contract).toMatch(
      /cannot select or rename a Bemoat route, add workflow state or evidence vocabulary/i,
    )
    expect(contract).toContain(
      'The model/effort criterion remains advisory and deferred pending Host configuration proof.',
    )
    expect(rule).toMatch(
      /`STOP` and `FOUNDER_GATE` are no-mutation boundaries.*`COMPLETE` is a Bemoat terminal result/i,
    )
    expect(loader).toMatch(
      /Context-authorized PStack routes load: `docs\/mission-control\/pstack-execution-contract\.md`, `\.cursor\/rules\/bemoat-pstack-execution\.mdc`, `docs\/mission-control\/pstack-codex-adapter\.md`\./,
    )
    expect(loader).toContain(
      'Source mutation requires `COMMAND` + first-edit; read-only `VERIFY`/`REVIEW` need no first-edit.',
    )
    expect(loader).toContain('`FOUNDER_GATE`: no mutation/PStack; `STOP`: no PStack.')
    expect(loader).toContain('External Surgery is not native activation.')
    expect(loader).toMatch(/`STOP`.*stop fail-closed/i)
    expect(loader).toMatch(/Terminal `COMPLETE` ends this Issue's Execution session/i)
    expect(handoff).toMatch(
      /one-time post-preflight implementation trigger remains required.*first source-file edit/i,
    )
    expect(handoff).toMatch(/A fresh `COMMAND` does not satisfy or waive that trigger/i)
    expect(handoff).toMatch(/fresh Context returns `next_action\.type` as `COMMAND`/i)
    expect(handoff).toMatch(/`next_action\.type: COMMAND` before objective mutation/i)
    expect(modelRouting).toMatch(
      /Model Routing Profile is advisory only; model identity grants no workflow authority/i,
    )
    expect(modelRouting).toMatch(/For every applicable role.*all five fields/i)
  })

  // Oracle: merged guide v1.7.0 §§Current protocol and Bounded objective
  // execution; merged execution-handoff-contract §§2–4 and 11–12; #562 acceptance;
  // Founder-relayed decision comment 6295209442. Context authorizes each objective;
  // the one-time trigger gates first source mutation, not read-only VERIFY/REVIEW.
  it('authorizes each PStack objective from fresh Context and gates only source mutation', () => {
    const contract = readText('docs/mission-control/pstack-execution-contract.md')

    expect(contract).toContain(
      'Fresh Bemoat Context authorizes each `IMPLEMENT`, `VERIFY`, `FIX`, and `REVIEW` objective.',
    )
    expect(contract).toContain(
      'Context-authorized read-only `VERIFY` and `REVIEW` objectives may use PStack HOW without the one-time post-preflight first-edit trigger.',
    )
    expect(contract).toContain(
      'The one-time post-preflight first-edit trigger remains mandatory before the first source-file mutation',
    )
    expect(contract).toContain('STOP and FOUNDER_GATE are absolute no-PStack-execution boundaries')
    expect(contract).toContain('External PStack surgery does not count as native PStack activation')
  })

  // Oracle: merged guide v1.7.0 makes fresh repository/GitHub evidence
  // authoritative; merged execution-handoff-contract §§11–12 require fresh
  // reconstruction and a new Execution handoff for another Issue; #562
  // acceptance and Founder-relayed comment 6295209442 permit one live Global MC
  // across campaign Issues without making chat identity/background work authority.
  it('reuses an active Global MC across Issues without carrying Execution authority forward', () => {
    const loader = readText('prompts/mission-control/chatgpt-project-loader.md')
    const contract = readText('docs/mission-control/pstack-execution-contract.md')
    const lifecycle = section(
      contract,
      '### Campaign control plane and Issue Execution lifecycle',
      '### Live execution handoff identity',
    )

    expect(lifecycle).toContain(
      'Keep one long-lived Global MC control plane per active campaign or work queue.',
    )
    expect(lifecycle).toContain(
      'The same active Global MC session may coordinate sequential Issues; an Issue change alone does not require a new Global MC chat/session.',
    )
    expect(lifecycle).toContain('Each Issue has its own Execution lineage.')
    expect(lifecycle).toContain(
      'Before each objective and Issue transition, reconstruct fresh live repository, merged policy, GitHub, and native Context authority; each new Issue requires a new Execution handoff.',
    )
    expect(lifecycle).toContain(
      'Terminal completion ends that Issue\'s Execution session, and its prior terminal state is not reusable authority for another Issue.',
    )
    expect(lifecycle).toContain('Chat/session identity is not durable authority.')
    expect(lifecycle).toContain('No autonomous background or post-turn continuation is implied.')
    expect(loader).toContain(
      'One Global MC coordinates sequential Issues. For each, fresh live authority reconstruction within the same active Global MC session when it remains valid; a new Global MC session is not required solely because the Issue changed. A different Issue requires a new Execution handoff and lineage.',
    )
  })

  // Oracle: Issue #562's execution topology and #587's controller-self-execution
  // finding, reinforced by the merged execution-handoff delegation rules.
  it('keeps controller orchestration and worker/reviewer identities distinct', () => {
    const contract = readText('docs/mission-control/pstack-execution-contract.md')
    const rule = readText('.cursor/rules/bemoat-pstack-execution.mdc')

    expect(contract).toMatch(/exactly one accountable Bemoat controller.*orchestration-only/i)
    expect(contract).toMatch(
      /does not characterize the repository, author tests or oracles, mutate source, run focused tests, perform deterministic verification, or correct the implementation/i,
    )
    expect(contract).toMatch(/`poteto-agent`.*distinct worker.*sole mutation owner/i)
    expect(contract).toMatch(
      /independent semantic\/Delta reviewer.*`interrogate`.*reviewer identity differs from controller and implementer/i,
    )
    expect(contract).toMatch(
      /controller may not silently take over.*use a model name as an identity substitute/i,
    )
    expect(contract).toMatch(
      /characterization and deterministic verification workers are distinct `poteto-agent` workers with read-only scopes/i,
    )
    // Oracle: AGENTS.md and .agents/skills/regression.md require an intermediate tester
    // distinct from the implementation owner.
    expect(contract).toMatch(
      /intermediate tester must be a different worker\/session from the implementation owner/i,
    )
    expect(rule).toMatch(/`poteto-agent` is a distinct worker/i)
    expect(rule).toMatch(
      /characterization and deterministic verification.*distinct `poteto-agent` workers with read-only scopes/i,
    )
    expect(rule).toMatch(/implementation worker is the sole mutation owner/i)
    expect(rule).toMatch(
      /`interrogate` capability is a distinct independent semantic\/Delta reviewer identity/i,
    )
    expect(rule).toMatch(/must not be the controller or implementation worker/i)
    expect(rule).toMatch(/controller fallback is forbidden/i)
  })

  // Oracle: Issue #562's Global MC and workspace lifecycle invariants, plus its
  // acceptance criteria for same-Issue lineage, HANDOFF, and fresh Context.
  it('binds PStack execution to exact Issue and branch lineage and preserves handoff readback', () => {
    const contract = readText('docs/mission-control/pstack-execution-contract.md')
    const lineage = section(
      contract,
      '### Live execution handoff identity',
      '## Terminal workspace release',
    )
    const handoff = readText('docs/mission-control/execution-handoff-contract.md')

    expect(contract).toMatch(
      /verified Issue, branch, exact head, upstream, protected base, and local durability evidence/i,
    )
    expect(contract).toMatch(
      /local checkout, clone, or worktree is disposable transport beneath the canonical repository, Issue, remote topic branch, exact head, upstream, and durability evidence/i,
    )
    expect(contract).toMatch(
      /cannot invent branch\/worktree ownership.*create a competing Issue branch/i,
    )
    expect(contract).toMatch(
      /existing `bemoat:handoff` contract exactly once when required, reads back the native record, and reconstructs fresh Context/i,
    )
    expect(handoff).toContain(
      'State repository, Issue, applicable PR, branch and exact head, approved protected base, and merged policy identity.',
    )
    expect(handoff).toMatch(/same Issue\/PR\/base\/head.*canonical origin\/upstream/i)
    expect(handoff).toMatch(
      /After each durable objective and applicable HANDOFF\/readback: fresh GitHub.*fresh Context.*recompute route/i,
    )
    expect(handoff).toMatch(/durable result and HANDOFF\/readback; fresh Context after the result/i)
    expect(handoff).toMatch(/Publish one strict HANDOFF and verify its exact fresh readback/i)
    expect(handoff).toMatch(
      /After the durable objective result and applicable HANDOFF\/readback.*fresh Context before selecting the next objective/i,
    )
    expect(lineage).toMatch(
      /At each authorized objective, resolve the Issue, branch, exact topic HEAD, upstream, approved protected base and exact base HEAD, and PR state from fresh Bemoat Context and canonical GitHub\/native Git evidence/i,
    )
    expect(lineage).toMatch(/Issue: resolve from fresh Bemoat Context/i)
    expect(lineage).toMatch(
      /Branch and canonical upstream: resolve from fresh Bemoat Context and native Git/i,
    )
    expect(lineage).toMatch(
      /Exact topic HEAD: resolve from fresh Bemoat Context and verify against native Git/i,
    )
    expect(lineage).toMatch(
      /approved protected base branch and exact HEAD: resolve from live policy and GitHub/i,
    )
    expect(lineage).toContain('- PR: resolve its live identity or verify that none exists.')
    expect(lineage).toContain('- Merge: prohibited for this adapter.')
    expect(lineage).not.toMatch(/#562|feat\/562-pstack-execution-cutover/i)
    expect(contract).toMatch(/Same-Issue restarts reattach to that durable branch lineage/i)
    expect(contract).toMatch(/cannot invent branch\/worktree ownership.*create a competing Issue branch/i)
  })

  it('preserves the canonical section 12 dependency recovery ordering and Context gate', () => {
    const handoff = readText('docs/mission-control/execution-handoff-contract.md')
    const continuation = section(handoff, '## 12. Continuation rule', '## 13. Stop conditions')
    const p2Clause = section(
      continuation,
      '**P2 — fresh preparation.**',
      '**P3 — exact failed-setup identity.**',
    )
    const p3Clause = section(
      continuation,
      '**P3 — exact failed-setup identity.**',
      'Arbitrary pnpm failures are excluded.',
    )
    const r2Clause = section(
      continuation,
      '**R2 — isolated checkout only when R1 cannot prove reuse.**',
      'No in-place retry of `pnpm install` in the failed checkout is permitted;',
    )
    const p1 = continuation.indexOf('**P1 — read-only reuse.**')
    const p2 = continuation.indexOf('**P2 — fresh preparation.**')
    const p3 = continuation.indexOf('**P3 — exact failed-setup identity.**')
    const exactInstall = continuation.indexOf(
      'run at most this exact install: `pnpm install --frozen-lockfile --ignore-scripts --store-dir <task-local-store>`',
    )
    const r1 = continuation.indexOf('**R1 — read-only reuse first.**')
    const r2 = continuation.indexOf('**R2 — isolated checkout only when R1 cannot prove reuse.**')

    expect(p1).toBeGreaterThan(-1)
    expect(p1).toBeLessThan(p2)
    expect(p2).toBeLessThan(p3)
    expect(exactInstall).toBeGreaterThan(p2)
    expect(exactInstall).toBeLessThan(p3)
    expect(continuation).toMatch(
      /\*\*P1 — read-only reuse\.\*\*.*Skip installation only when a read-only preflight positively proves every item below/i,
    )
    expect(continuation).toMatch(
      /\*\*P3 — exact failed-setup identity\.\*\*.*literal attempted install command\/flags and store path.*ownership\/no-concurrent-writer/i,
    )
    expect(r1).toBeGreaterThan(p3)
    expect(r1).toBeLessThan(r2)
    expect(continuation).toMatch(/apply the two outcomes in this order and at most once/i)
    expect(continuation).toMatch(
      /\*\*R1 — read-only reuse first\.\*\*.*Re-run P1 against the unchanged failed checkout.*no installation or write/i,
    )
    expect(r2Clause).toMatch(
      /Acquire at most one new isolated same-Issue checkout \(one replacement physical checkout\) bound to the one existing canonical remote topic branch and its exact live head/i,
    )
    expect(r2Clause).toMatch(
      /unique ownership, absence of any competing writer\/workspace, and Host capability/i,
    )
    expect(r2Clause).toMatch(
      /The replacement must be clean and empty, with no prior `node_modules` or virtual-store metadata; require clean\/empty target `node_modules` and use its own initially empty, uniquely Issue\/checkout-owned task-local store within verified write scope/i,
    )
    expect(r2Clause).toMatch(
      /Verify exact repository\/Issue\/upstream\/head\/base, Node\/pnpm, manifest\/lock, attempted command\/flags\/store, original artifact fingerprints and failure identity again immediately before setup, including proof that no prior replacement\/recovery attempt occurred/i,
    )
    expect(r2Clause).toMatch(
      /Preserve the failed physical checkout byte-for-byte, including ignored setup artifacts/i,
    )
    expect(p3Clause).toMatch(
      /Preserve the original failed physical checkout and task-local store byte-for-byte; neither may be in the replacement's write scope/i,
    )
    expect(r2Clause).toMatch(
      /Any drift or identity, runtime, command, or store mismatch; dirty, nonempty replacement; missing or uncertain Host write scope; or destructive cleanup requirement is `STOP`/i,
    )
    expect(p2Clause).toMatch(
      /initially empty,\s*uniquely Issue\/checkout-owned task-local pnpm store inside independently proven Host write scope/i,
    )
    expect(r2Clause).toMatch(
      /The one exact frozen\/ignore-scripts install is permitted in that new checkout only, followed by registered Discovery and fresh Context/i,
    )
    expect(r2Clause).toMatch(
      /A second failed setup or any second replacement attempt is `STOP`; there is no loop/i,
    )
    expect(continuation).toMatch(
      /No in-place retry of `pnpm install` in the failed checkout is permitted; do not change its store/i,
    )
    expect(continuation).toMatch(
      /The only pre-COMMAND exceptions are an exact existing-branch recovery prescribed by fresh Context, canonical wrong-Issue workspace acquisition below, and the single pre-Context dependency preparation in section 12/i,
    )
    expect(continuation).toMatch(
      /dependency preparation is setup-only and occurs before CLI Discovery, followed only by registered CLI Discovery and fresh Context; it grants no objective-work authority.*Successful setup grants no `COMMAND` or first-edit authority; fresh Context must independently authorize `COMMAND` through `next_action\.type: COMMAND` before objective mutation, and the separately required first-edit trigger remains a separate one-time gate/i,
    )
    expect(continuation).toMatch(/Neither recovery exception authorizes objective work/i)
    expect(continuation).toMatch(
      /Successful setup permits only registered CLI Discovery followed by fresh Context/i,
    )
    expect(continuation).toMatch(/Successful setup grants no `COMMAND` or first-edit authority/i)
    expect(continuation).toMatch(
      /fresh Context must independently authorize `COMMAND` through `next_action\.type: COMMAND` before objective mutation/i,
    )
    expect(continuation).toMatch(
      /the separately required first-edit trigger remains a separate one-time gate/i,
    )
  })

  it('preserves terminal workspace release and later Bemoat workflow gates', () => {
    const contract = readText('docs/mission-control/pstack-execution-contract.md')
    const rule = readText('.cursor/rules/bemoat-pstack-execution.mdc')
    const handoff = readText('docs/mission-control/execution-handoff-contract.md')
    const pstackDocs = readText('docs/pstack.md')
    const inventory = readText('scripts/boilerplate/inventory.ts')
    const manifest = readText('.bemoat/boilerplate-sync-manifest.json')

    expect(contract).toMatch(
      /direct\/single checkout.*clean verified protected base.*durable exact.head readback.*sole ownership.*no active writer.*no unpushed work/i,
    )
    expect(contract).toMatch(
      /task worktree.*released|removed.*exact branch\/head durability.*unique ownership.*clean state.*primary checkout preservation/i,
    )
    expect(contract).toMatch(/missing proof.*STOP|STOP.*missing proof/i)
    expect(contract).toMatch(
      /commit.*push.*PR.*outside.*PStack|Bemoat.*commit.*push.*PR.*outside.*PStack/i,
    )
    expect(rule).toMatch(
      /direct\/single checkout.*clean verified protected base.*durable exact.head readback.*sole ownership.*no active writer.*no unpushed work/i,
    )
    expect(rule).toMatch(
      /task worktree.*released|removed.*exact branch\/head durability.*unique ownership.*clean state.*primary checkout preservation/i,
    )
    expect(rule).toMatch(/missing proof.*STOP|STOP.*missing proof/i)
    expect(rule).toMatch(/PStack.*destructive cleanup.*not|must not.*destructive cleanup/i)
    expect(pstackDocs).toContain('bare Cursor `/autopilot`')
    expect(contract).toContain(
      'The managed Cursor rule is `.cursor/rules/bemoat-pstack-execution.mdc`.',
    )
    expect(contract).toMatch(/STOP.*FOUNDER_GATE.*COMPLETE.*Bemoat/i)
    expect(handoff).toMatch(
      /docs\/mission-control\/pstack-execution-contract\.md.*\.cursor\/rules\/bemoat-pstack-execution\.mdc/i,
    )
    expect(handoff).toContain('State repository, Issue, applicable PR, branch and exact head')
    expect(handoff).toMatch(/same Issue\/PR\/base\/head.*canonical origin\/upstream/i)
    expect(handoff).toMatch(/HANDOFF.*fresh Context/i)
    expect(handoff).toMatch(/independent reviewer.*distinct.*controller.*implementer/i)
    expect(pstackDocs).toMatch(/opening-a-pr.*PR\/push\/merge.*outside.*PStack HOW/i)
    expect(inventory).toContain("'.cursor/rules'")
    expect(manifest).toContain('".cursor/rules"')
  })

  it('preserves canonical Section 12 continuation and transfer boundaries', () => {
    const handoff = readText('docs/mission-control/execution-handoff-contract.md')
    const continuation = handoff.slice(handoff.indexOf('## 12. Continuation rule'))

    expect(continuation).toMatch(
      /New Execution\/IDE session.*complete canonical Ready-to-paste Execution artifact.*all 15 ordered sections/i,
    )
    expect(continuation).toMatch(
      /MUST NOT substitute a short bootstrap, `continue`, summary, or surrounding prose/i,
    )
    expect(continuation).toMatch(
      /Existing active Execution\/IDE session for the same Issue.*smallest canonical compact operator action/i,
    )
    expect(continuation).toMatch(/`continue` by itself or in surrounding prose is incomplete/i)
    expect(continuation).toMatch(
      /New Global MC reconstruction.*bare Issue number remains sufficient.*does not apply to a new Execution\/IDE handoff/i,
    )
    expect(continuation).toMatch(
      /Ambiguous destination.*MUST NOT choose the shortened form.*full canonical Execution artifact/i,
    )
    expect(continuation).toMatch(
      /same-response transfer invariant.*self-contained copy-ready operator artifact/i,
    )
    expect(continuation).toMatch(/repository, Issue, and exact next action/i)
    expect(continuation).toMatch(
      /new or changed execution destination.*complete canonical 15-section handoff/i,
    )
    expect(continuation).toMatch(
      /`FOUNDER_GATE` is decision-first.*no mutation-capable continuation/i,
    )
    expect(continuation).toMatch(/Terminal `COMPLETE` ends this Issue's active Execution session/i)
    expect(continuation).toMatch(
      /For `STOP`, unsupported state, or evidence conflict.*stop fail-closed/i,
    )
    expect(continuation).toMatch(
      /After each durable objective and applicable HANDOFF\/readback.*fresh GitHub.*fresh Context.*recompute route/i,
    )
  })

  it('keeps unsupported host capability as a fail-closed boundary', () => {
    const contract = readText('docs/mission-control/pstack-execution-contract.md')
    const rule = readText('.cursor/rules/bemoat-pstack-execution.mdc')
    const pstackDocs = readText('docs/pstack.md')

    expect(contract).toMatch(/`bemoat:pstack` check and discovery prove provenance and inventory only/i)
    expect(contract).toMatch(
      /do not prove that the active host can spawn workers or execute a Cursor-only feature/i,
    )
    expect(contract).toMatch(/When the Controller cannot provide the worker topology required above, stop at the execution boundary/i)
    expect(contract).toMatch(/No prompt-only wording, local shim, or controller self-execution may claim successful PStack execution/i)
    expect(rule).toContain(
      'If Cursor cannot provide the required distinct `poteto-agent` worker or reviewer capability, report the exact host limitation and stop.',
    )
    expect(rule).toContain(
      'Do not simulate PStack, run the objective in the controller, or claim native Cursor execution from a read-only pin/discovery result.',
    )
    expect(pstackDocs).toMatch(/does not verify behavior inside a native Cursor runtime/i)
  })

  // Oracle: Issue #562's controller topology and official pinned poteto-mode
  // rule that the receiving chat owns Task spawns while poteto-agent is a delegate.
  // This checks the declared mapping only; live Host dispatch and returned worker
  // identities require separate runtime evidence.
  it('declares Codex Controller-level dispatch without claiming native runtime execution', () => {
    const adapterPath = 'docs/mission-control/pstack-codex-adapter.md'
    const licensePath = 'docs/mission-control/third-party/pstack-codex-adapter-MIT.txt'

    expect(existsSync(resolve(root, adapterPath))).toBe(true)
    expect(existsSync(resolve(root, licensePath))).toBe(true)

    const adapter = readText(adapterPath)
    const license = readText(licensePath)
    const contract = readText('docs/mission-control/pstack-execution-contract.md')
    const handoff = readText('docs/mission-control/execution-handoff-contract.md')
    const inventory = readText('scripts/boilerplate/inventory.ts')
    const manifest = readText('.bemoat/boilerplate-sync-manifest.json')

    expect(adapter).toContain('michael-denyer/pstack-claude')
    expect(adapter).toContain('88f6d39f228c4f9210d93bbf7e5e40a5c671fd5e')
    expect(adapter).toContain('c078c939b74e17a42d08f63d5cbe6db79784b248')
    expect(adapter).toContain('multi_agent_v1__spawn_agent')
    expect(adapter).toContain('multi_agent_v1__wait_agent')
    expect(adapter).toContain('multi_agent_v1__close_agent')
    expect(adapter).toMatch(/only the accountable Bemoat Controller dispatches workers/i)
    expect(adapter).toMatch(/workers do not dispatch nested workers/i)
    expect(adapter).toMatch(/read the complete official pinned PStack skill file/i)
    expect(adapter).toMatch(/distinct implementation worker[\s\S]*?distinct independent reviewer/i)
    expect(adapter).toMatch(
      /PStack cannot authorize work, choose a Bemoat route, or change STOP, FOUNDER_GATE, or COMPLETE/i,
    )
    expect(adapter).toMatch(/STOP and FOUNDER_GATE prohibit mutation/i)
    expect(adapter).toMatch(/The Controller owns route and gate decisions\. Worker results are evidence only/i)
    expect(adapter).toMatch(
      /fresh Bemoat Context authorizes the exact bounded `IMPLEMENT`, `VERIFY`, `FIX`, or `REVIEW` objective/i,
    )
    expect(adapter).toMatch(
      /Context-authorized read-only `VERIFY`\/`REVIEW` needs no first-edit trigger/i,
    )
    expect(adapter).toMatch(
      /one-time trigger is required before the first source-file mutation/i,
    )
    expect(adapter).toMatch(/Do not install a plugin or add automatic routing, Host configuration, session hooks/i)
    expect(adapter).toMatch(/second controller, a shim, or a new checkout or worktree/i)
    expect(adapter).toMatch(
      /Resolve the Issue, branch, exact topic HEAD[\s\S]*?approved protected base[\s\S]*?PR state from live Bemoat authority/i,
    )
    expect(license).toContain('Copyright (c) 2026 Lauren Tan')
    expect(license).toContain('Copyright (c) 2026 Michael Denyer')
    expect(license).toContain('The above copyright notice and this permission notice shall be included')
    expect(contract).toMatch(
      /On Codex hosts, load the Codex mapping in\s+`docs\/mission-control\/pstack-codex-adapter\.md`\./i,
    )
    expect(handoff).toMatch(
      /on Codex, load\s+`docs\/mission-control\/pstack-codex-adapter\.md`\./i,
    )
    expect(inventory).toContain(`'${adapterPath}'`)
    expect(inventory).toContain(`'${licensePath}'`)
    expect(manifest).toContain(`"${adapterPath}"`)
    expect(manifest).toContain(`"${licensePath}"`)
  })
})
