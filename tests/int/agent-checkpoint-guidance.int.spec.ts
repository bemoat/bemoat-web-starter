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
})
