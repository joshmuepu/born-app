import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Before any song import a dated copy of the song library is taken (data folder/backups), the last three are kept, and the import says where.

let dir: string, files: string
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'born-songbackup-'))
  files = mkdtempSync(join(tmpdir(), 'born-songbackup-files-'))
  vi.resetModules()
  const { app } = await import('electron')
  vi.mocked(app.getPath).mockReturnValue(dir)
  ;(app as unknown as { getAppPath: () => string }).getAppPath = () => files // no bundled library: an empty one is made
})
afterEach(async () => {
  const lib = await import('../../main/libraryDb')
  lib.closeLibraryDb()
  rmSync(dir, { recursive: true, force: true }); rmSync(files, { recursive: true, force: true })
})
const backups = (): string[] => readdirSync(join(dir, 'backups')).sort()

describe('a dated copy of the song library before an import', () => {
  it('an import of song files takes one first, says where it is, and the copy has the songs from before only', async () => {
    const lib = await import('../../main/libraryDb')
    lib.getLibraryDb().prepare("INSERT INTO songs (title) VALUES ('Invented Song Before')").run()
    const songs = await import('../../main/songs')
    writeFileSync(join(files, 'invented.cho'), '{title: Invented Morning Song}\n\n[Verse 1]\nPlaceholder line one\nPlaceholder line two\n')
    const r = await songs.importSongs([join(files, 'invented.cho')])
    expect(r.added).toHaveLength(1)
    expect(r.backup).toMatch(/backups[\\/]library-\d{4}-\d{2}-\d{2}-\d{6}\.db$/)
    const copy = new Database(r.backup!, { readonly: true })
    const titles = (copy.prepare('SELECT title FROM songs').all() as Array<{ title: string }>).map((x) => x.title)
    copy.close()
    expect(titles).toEqual(['Invented Song Before'])
  })
  it('keeps the last three', async () => {
    const lib = await import('../../main/libraryDb')
    lib.getLibraryDb()
    const t0 = Date.now() + 3600_000
    for (let i = 0; i < 5; i++) expect(lib.backupLibraryBeforeImport(new Date(t0 + i * 3600_000))).not.toBeNull()
    expect(backups()).toHaveLength(3)
  })
  it('a reviewed song and a song added from a service file take one too', async () => {
    const songs = await import('../../main/songs')
    songs.commitReviewedSong({ title: 'Invented Pasted Song', slides: [{ text: 'Placeholder line' }] })
    expect(backups()).toHaveLength(1)
    rmSync(join(dir, 'backups'), { recursive: true, force: true })
    const q = await import('../../main/queueSongImport')
    q.commitSongImportDecisions([{ groupId: 'g', title: 'Invented Service Song', author: null, songKey: null, slides: [{ text: 'Placeholder line' }] } as never])
    expect(backups()).toHaveLength(1)
  })
})
