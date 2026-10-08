import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8')

describe('durable semantic checkpoint guidance', () => {
  it('covers the issue-defined semantic checkpoint classes and boundaries', () => {
    const checklist = read('docs/agent-loop/checklist.md')
    const guidance = `${checklist} ${read('.agents/skills/development-agent.md')}`.replace(/\s+/g, ' ')

    expect(guidance).toMatch(/coherent.*(?:independently understandable|self-contained).*semantic unit/i)
    expect(guidance).toMatch(/directly coupled.*(?:test|proof)/i)
    for (const checkpointClass of [
      'Documentation/specification',
      'valid characterization',
      'implementation',
      'separable refactoring',
      'integration/registration',
      'forward corrections',
      'WIP recovery checkpoint',
    ]) {
      expect(guidance).toContain(checkpointClass)
    }
    expect(guidance).toMatch(/not by file, function, assertion, line count, or elapsed time/i)
    expect(guidance).toMatch(/standalone characterization.*only when.*independently valuable.*branch.*valid/i)
    expect(guidance).toMatch(/bug fix.*regression and smallest passing fix.*same green commit/i)
    expect(guidance).toMatch(/intermediate commits valid, buildable, and testable when practical/i)
    expect(guidance).not.toMatch(/Keep checkpoint commits local and do not push them by default/i)
    expect(guidance).not.toMatch(/Squash all local checkpoints into one focused final commit/i)
  })

  it('requires exact remote checkpoint proof and retains the final PR review boundary', () => {
    const checklist = read('docs/agent-loop/checklist.md')
    const execution = read('docs/mission-control/execution-handoff-contract.md')
    const guide = read('docs/mission-control/mission-control-guide.md')
    const handoff = read('.agents/skills/handoff.md')
    const guidance = `${checklist} ${execution} ${guide} ${handoff}`.replace(/\s+/g, ' ')

    expect(guidance).toMatch(/after every semantic.*checkpoint.*push/i)
    expect(guidance).toMatch(/remote task ref.*exact commit SHA/i)
    expect(guidance).toMatch(/before waiting.*human\/Founder gate.*handoff.*planned shutdown.*STOP\/BLOCKED\/RESULT\/COMPLETE/i)
    expect(guidance).toMatch(/multiple semantic checkpoint commits.*one active implementation PR/i)
    expect(guidance).toMatch(/full CI and review.*final PR head/i)
    expect(guidance).toMatch(/Handoff exit.hygiene gate/i)
    expect(guidance).toMatch(/no second WIP protocol/i)
    expect(guidance).toMatch(/WIP recovery commit.*durable evidence rather than completed delivery, review eligibility, or merge authority/i)
  })

  it('separates focused checkpoint proof from full pre-PR validation across active workflow entrypoints', () => {
    const agents = read('AGENTS.md')
    const readme = read('docs/agent-loop/README.md')
    const checklist = read('docs/agent-loop/checklist.md')
    const manual = read('docs/agent-loop/operating-manual.md')
    const issueWorkflow = read('.agents/skills/issue-workflow.md')
    const composerPrompt = read('docs/agent-loop/composer-issue-workflow-prompt.md')
    const sources = [
      ['AGENTS.md', agents],
      ['agent-loop README', readme],
      ['agent-loop checklist', checklist],
      ['operating manual', manual],
      ['issue workflow skill', issueWorkflow],
      ['Composer issue workflow prompt', composerPrompt],
    ] as const
    const activeGuidance = sources.join(' ').replace(/\s+/g, ' ')

    expect(activeGuidance).toMatch(/focused proof.*semantic unit/i)
    expect(activeGuidance).toMatch(/commit.*(?:semantic|coherent).*unit/i)
    expect(activeGuidance).toMatch(/push.*exact.*(?:remote|task ref).*(?:SHA|commit)/i)
    expect(activeGuidance).toMatch(/full.*(?:required )?validation.*before PR/i)
    expect(activeGuidance).toMatch(/one active implementation PR|one PR/i)
    for (const [sourceName, source] of sources) {
      const semanticSource = source.replace(/\s+/g, ' ')
      expect(`${sourceName}: ${semanticSource}`).not.toMatch(/Commit exactly one focused change only if checks pass/i)
      expect(`${sourceName}: ${semanticSource}`).not.toMatch(/Use exactly one focused commit unless the task explicitly requires more/i)
      expect(`${sourceName}: ${semanticSource}`).not.toMatch(/One issue → one PR → one focused commit/i)
      expect(`${sourceName}: ${semanticSource}`).not.toMatch(/Exactly one focused commit \(unless issue requires more\)/i)
    }

    expect(agents.replace(/\s+/g, ' ')).toMatch(/focused proof for each proposed semantic checkpoint/i)
    expect(agents.replace(/\s+/g, ' ')).toMatch(/exact commit SHA from the remote task branch/i)
    expect(readme.replace(/\s+/g, ' ')).toMatch(/one coherent, independently understandable semantic unit/i)
    expect(readme.replace(/\s+/g, ' ')).toMatch(/read back the exact commit SHA from the remote task branch/i)
    expect(manual.replace(/\s+/g, ' ')).toMatch(/each commit contains one coherent, proven semantic unit/i)
    expect(issueWorkflow.replace(/\s+/g, ' ')).toMatch(/each proven coherent semantic unit/i)
    expect(composerPrompt.replace(/\s+/g, ' ')).toMatch(/each proven semantic unit/i)

    const beforeCommit = checklist.split('## Before PR')[0]
    const beforePr = checklist.split('## Before PR')[1]
    expect(beforeCommit).toMatch(/focused proof/i)
    expect(beforeCommit).not.toContain('pnpm run check')
    expect(beforePr).toContain('pnpm run check')
  })
})
