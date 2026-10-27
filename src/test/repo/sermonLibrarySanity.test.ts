import { describe, it, expect } from 'vitest'
import { checkLibrarySanity } from '../../../scripts/sermonLibrarySanity'

describe('the sermon library build refuses a library that does not look right', () => {
  const good = { sermons: 1218, paragraphs: 224937, expected: 1218, missing: 0 }
  it('a full library passes', () => expect(() => checkLibrarySanity(good)).not.toThrow())
  it('a sermon that could not be fetched stops the build', () => expect(() => checkLibrarySanity({ ...good, missing: 1, sermons: 1217 })).toThrow(/could not be fetched/))
  it('a library still in sections (about 105,000 rows) or a cut-short fetch stops it', () => {
    expect(() => checkLibrarySanity({ ...good, paragraphs: 104644 })).toThrow(/paragraph rows/)
    expect(() => checkLibrarySanity({ ...good, sermons: 300, expected: 300, paragraphs: 60000 })).toThrow(/only 300 sermons/)
  })
})
