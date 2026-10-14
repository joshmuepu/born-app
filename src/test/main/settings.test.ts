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
