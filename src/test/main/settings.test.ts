import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let dir: string

// vi.resetModules() clears the 'electron' mock along with everything else,
// so a dynamic re-import of it after reset gets a fresh app.getPath() back
// at its default (':memory:') — a top-level `import { app }` taken before
// the reset would be a stale reference the re-imported settings.ts never
// actually uses. Re-import electron itself, in the same reset cycle, before
// pointing its mock at this test's real tmp directory.
async function freshSettingsModule(): Promise<typeof import('../../main/settings')> {
  vi.resetModules()
  const { app } = await import('electron')
  vi.mocked(app.getPath).mockReturnValue(dir)
  return import('../../main/settings')
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'born-settings-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('getSettings — legacy fontSize realignment', () => {
  it('persists the realigned 4.5 back to disk, not just in memory', async () => {
    const settingsPath = join(dir, 'settings.json')
    writeFileSync(
      settingsPath,
      JSON.stringify({
        namedDisplays: [],
        projectionDisplayName: null,
        stageDisplayName: null,
        fontSize: 3,
        recentServices: [],
        theme: 'dark'
      })
    )

    const { getSettings } = await freshSettingsModule()
    const settings = getSettings()

    expect(settings.fontSize).toBe(4.5)
    const onDisk = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    expect(onDisk.fontSize).toBe(4.5)
  })

  it('does not rewrite the file when fontSize is already correct', async () => {
    const settingsPath = join(dir, 'settings.json')
    const original = JSON.stringify({
      namedDisplays: [],
      projectionDisplayName: null,
      stageDisplayName: null,
      fontSize: 4.5,
      recentServices: [],
      theme: 'dark'
    })
    writeFileSync(settingsPath, original)

    const { getSettings } = await freshSettingsModule()
    getSettings()

    expect(readFileSync(settingsPath, 'utf-8')).toBe(original)
  })

  it('leaves a genuinely custom fontSize of exactly 3 alone on every later read — only the on-disk legacy default gets realigned once', async () => {
    // Guards against a too-broad fix: the realignment is a one-time
    // migration for the OLD stored default, not a ban on the operator ever
    // setting 3 again deliberately later.
    const settingsPath = join(dir, 'settings.json')
    writeFileSync(
      settingsPath,
      JSON.stringify({
        namedDisplays: [],
        projectionDisplayName: null,
        stageDisplayName: null,
        fontSize: 3,
        recentServices: [],
        theme: 'dark'
      })
    )

    const { getSettings, updateSettings } = await freshSettingsModule()
    getSettings() // realigns to 4.5 and persists
    updateSettings({ fontSize: 3 }) // operator deliberately sets it back to 3

    const onDisk = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    expect(onDisk.fontSize).toBe(3)
  })
})

describe('getSettings — a damaged settings.json is kept, not overwritten', () => {
  it('starts from defaults but moves the damaged file aside, so a later save cannot destroy it', async () => {
    const { readdirSync } = await import('fs')
    const settingsPath = join(dir, 'settings.json')
    const damaged = '{"fontSize": 4.5, "namedDisplays": [ {"name": "Sanctuary Proj'
    writeFileSync(settingsPath, damaged)

    const { getSettings, updateSettings } = await freshSettingsModule()
    expect(getSettings().fontSize).toBe(4.5) // defaults
    updateSettings({ theme: 'light' }) // the next save writes a fresh settings.json

    const kept = readdirSync(dir).filter((f) => /^settings\.corrupt-.*\.json$/.test(f))
    expect(kept).toHaveLength(1)
    expect(readFileSync(join(dir, kept[0]), 'utf-8')).toBe(damaged)
    expect(JSON.parse(readFileSync(settingsPath, 'utf-8')).theme).toBe('light')
  })

  it('a first launch with no settings.json leaves no corrupt-file behind', async () => {
    const { readdirSync } = await import('fs')
    const { getSettings } = await freshSettingsModule()
    getSettings()
    expect(readdirSync(dir)).toEqual([])
  })
})

describe('getSettings — values of the wrong kind', () => {
  // A settings.json that reads but holds the wrong kind of value (edited by hand, or written by something else) stopped the window
  // from appearing at all: e.g. a theme of 42 failed in the main process, a list that is null failed in the window. Each wrong value
  // now falls back to its default, the right ones are kept.
  it('each wrong value falls back to its default; the right ones are kept', async () => {
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({
      namedDisplays: 'x', projectionDisplayName: 5, stageDisplayName: 'Stage TV', fontSize: 'big', recentServices: null, theme: 42,
      recentSongIds: {}, recentQuotes: 'q', recentBibleRefs: null, recentKeys: [7, 'G'], remoteLastPhoneNetwork: 'wifi'
    }))
    const { getSettings } = await freshSettingsModule()
    const s = getSettings()
    expect(s).toMatchObject({
      namedDisplays: [], projectionDisplayName: null, stageDisplayName: 'Stage TV', fontSize: 4.5, recentServices: [], theme: 'dark',
      recentSongIds: [], recentQuotes: [], recentBibleRefs: [], recentKeys: ['G'], remoteLastPhoneNetwork: null
    })
  })
  it('a font size outside 1.5–8 falls back too', async () => {
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ fontSize: 900 }))
    const { getSettings } = await freshSettingsModule()
    expect(getSettings().fontSize).toBe(4.5)
  })
})

describe('getSettings — keys this version does not know', () => {
  it('are kept, so they survive the next save', async () => {
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ theme: 'light', someLaterSetting: { on: true } }))
    const { getSettings, updateSettings } = await freshSettingsModule()
    expect(getSettings().theme).toBe('light')
    updateSettings({ fontSize: 5 })
    expect(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf-8')).someLaterSetting).toEqual({ on: true })
  })
})
