import { describe, it, expect } from 'vitest'
import { cleanSourceText } from '../../shared/sourceText'

describe('cleanSourceText', () => {
  it('removes the private-use symbol that has no glyph (it showed as an empty box on every screen)', () => {
    expect(cleanSourceText(' Let us bow our heads.')).toBe('Let us bow our heads.')
    expect(cleanSourceText('Let us')).toBe('Let us')
    expect(cleanSourceText('before  after')).toBe('before after')
  })
  it('leaves ordinary text, scripts and emoji exactly as they are', () => {
    for (const t of ['Plain text.', 'ترنيمة الرب', '主啊，我们赞美你', 'Gloria 🎶', "“Quoted” — dash…", '']) expect(cleanSourceText(t)).toBe(t)
  })
})
