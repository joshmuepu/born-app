// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react'
import { installApi } from './appHarness'
import SongsPanel from '../../renderer/src/components/SongsPanel'
import SongSlideEditor from '../../renderer/src/components/SongSlideEditor'
import SongReviewScreen from '../../renderer/src/components/SongReviewScreen'
import { songImportPickers } from '../../main/importPickers'
import { useState } from 'react'
import type { ParsedSong } from '../../renderer/src/types'

afterEach(() => cleanup())
const settle = (ms = 30): Promise<void> => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const detail = (id: number, title: string): unknown => ({ id, title, author: null, songKey: null, source: 'import', provenance: null, slides: [{ label: 'Verse 1', text: 'Placeholder line' }] })
const song: ParsedSong = { title: 'Invented Hymn', slides: [{ label: 'Verse 1', text: 'Placeholder one' }, { label: 'Verse 2', text: 'Placeholder two' }] }

describe('Songs', () => {
  it('the song opened last is the one shown, even when an earlier one answers later', async () => {
    installApi({
      getRecentSongs: vi.fn(() => Promise.resolve([])),
      getSong: vi.fn((id: number) => new Promise((r) => setTimeout(() => r(detail(id, id === 1 ? 'Invented Slow Song' : 'Invented Fast Song')), id === 1 ? 80 : 5)))
    })
    const props = { visible: true, onScreen: null, onAddSong: vi.fn(), onProjectSong: vi.fn() }
    const v = render(<SongsPanel {...props} focusSongId={1} />)
    v.rerender(<SongsPanel {...props} focusSongId={2} />)
    await settle(150)
    expect(screen.queryAllByText('Invented Fast Song').length).toBeGreaterThan(0)
    expect(screen.queryByText('Invented Slow Song')).toBeNull()
  })
  it('an import that fails ends "Importing…" and says so', async () => {
    installApi({ getRecentSongs: vi.fn(() => Promise.resolve([])), importSongs: vi.fn(() => Promise.reject(new Error('x'))) })
    render(<SongsPanel visible onScreen={null} focusSongId={null} onAddSong={vi.fn()} onProjectSong={vi.fn()} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /import/i })) })
    const file = screen.queryByRole('menuitem', { name: /file/i }) ?? screen.getByText(/song files|from a file|files/i)
    await act(async () => { fireEvent.click(file) })
    await settle()
    expect(document.body.textContent).not.toMatch(/Importing…/)
    expect(document.body.textContent).toMatch(/Could not import/)
  })
})

describe('the song editor', () => {
  function Editor(): JSX.Element {
    const [s, setS] = useState(song)
    return <SongSlideEditor song={s} onChange={setS} />
  }
  it('every field has a name for a screen reader', () => {
    render(<Editor />)
    for (const name of ['Song title', 'Author (optional)', 'CCLI Song number (optional)', 'Slide 1 label', 'Slide 1 words', 'Slide 2 words']) {
      expect(screen.getByLabelText(name)).toBeTruthy()
    }
  })
  it('a removed slide can be put back', () => {
    render(<Editor />)
    fireEvent.click(screen.getAllByTitle('Remove this slide')[0])
    expect(screen.queryByDisplayValue('Placeholder one')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect((screen.getByRole('textbox', { name: 'Slide 1 words' }) as HTMLTextAreaElement).value).toBe('Placeholder one')
  })
})

describe('the review screen', () => {
  it('always shows the confirm box when saving needs it, so Save can be used', () => {
    render(<SongReviewScreen song={song} reviewKey="k" headerTitle="Import" needsConfirmation onClose={vi.fn()} onSave={vi.fn()} />)
    const save = screen.getByRole('button', { name: 'Save song' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(save.disabled).toBe(false)
  })
  it('a refused save says why and keeps the edits', async () => {
    const onSave = vi.fn(() => Promise.reject(new Error('This hymn is not in the public domain.')))
    render(<SongReviewScreen song={song} reviewKey="k" headerTitle="Import" onClose={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Song title' }), { target: { value: 'Invented Hymn (edited)' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save song' })) })
    expect(document.body.textContent).toMatch(/not in the public domain/)
    expect((screen.getByRole('textbox', { name: 'Song title' }) as HTMLInputElement).value).toBe('Invented Hymn (edited)')
  })
})

describe('Songs > Import on Windows and Linux', () => {
  it('can choose song files, not only folders', () => {
    for (const p of ['win32', 'linux']) {
      const steps = songImportPickers(p)
      expect(steps.some((s) => s.includes('openFile') && !s.includes('openDirectory'))).toBe(true)
    }
    expect(songImportPickers('darwin')).toEqual([['openFile', 'multiSelections', 'openDirectory']])
  })
})
