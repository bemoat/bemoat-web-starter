import { describe, expect, it } from 'vitest'

import { stringifyCapturedGitOutput } from '../../scripts/install-git-hooks.ts'

type NodeTypedCapturedOutput = {
  toString(): string
}

describe('install-git-hooks captured output typing boundary', () => {
  it('formats Node-typed output without requiring an encoding argument', () => {
    const capturedOutput = {
      toString: () => 'fake git config stdout',
    } satisfies NodeTypedCapturedOutput

    expect(stringifyCapturedGitOutput(capturedOutput)).toBe('fake git config stdout')
    expect(stringifyCapturedGitOutput(Buffer.from('utf8 output'))).toBe('utf8 output')
    expect(stringifyCapturedGitOutput('string output')).toBe('string output')
  })
})
