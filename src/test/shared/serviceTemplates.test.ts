import { describe, it, expect } from 'vitest'
import { SERVICE_TEMPLATES, templateById } from '../../shared/serviceTemplates'
import { parseReference, isRefError } from '../../shared/bibleRef'

describe('quick-start services (P-12)', () => {
  it('offers Sunday morning, Midweek and a funeral/memorial plan', () => {
    expect(SERVICE_TEMPLATES.map((t) => t.id)).toEqual(['sunday', 'midweek', 'funeral'])
    expect(templateById('funeral')?.name).toBe('Funeral or memorial')
    expect(templateById('nope')).toBeUndefined()
  })
  it('every reading is a reference the Bible lookup understands, and each plan says what to add next', () => {
    for (const t of SERVICE_TEMPLATES) {
      expect(t.readings.length).toBeGreaterThan(1)
      expect(t.addNext.length).toBeGreaterThan(5)
      for (const r of t.readings) {
        const p = parseReference(r.reference)
        expect(isRefError(p), `${t.id}: ${r.reference}`).toBe(false)
      }
    }
  })
  it('holds public-domain text only (readings are references, not text)', () => {
    for (const t of SERVICE_TEMPLATES) for (const r of t.readings) expect(r.reference).toMatch(/^[1-3]? ?[A-Za-z ]+ \d+:\d+(-\d+)?$/)
  })
})
