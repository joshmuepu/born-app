import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Help page sentences that no longer matched the app (each checked against the code): the sermons come with BORN (no internet needed
// on first start or after a repair), the sermon count is in the footer's popover, the back button from a search reads ‹ Results,
// Bible Browse opens on All Books / Recently Looked Up, New asks whenever the queue is not empty, the recent files are on the empty
// queue's start screen, and the text size setting does not change the stage monitor.
const m = (f: string): string => readFileSync(join(__dirname, '../../../docs/manual/v1', f), 'utf8')

describe('the Help pages say what the app does', () => {
  it('no claim that the first sermon search, or a repair, needs the internet', () => {
    expect(m('setup/installing.md')).not.toMatch(/very first sermon search needs/)
    expect(m('setup/installing.md')).not.toMatch(/the very first time, this needs an internet/)
    expect(m('troubleshooting/data-recovery.md')).not.toMatch(/which needs an internet connection/)
  })
  it('cheat sheet: the sermon count is behind the footer', () => expect(m('operators/cheat-sheet.md')).toMatch(/Click the footer/))
  it('content types: ‹ Results and All Books', () => {
    expect(m('operators/content-types.md')).toMatch(/‹ Results/)
    expect(m('operators/content-types.md')).toMatch(/All Books/)
  })
  it('New asks whenever the queue has something in it', () => expect(m('operators/blank-clear.md')).not.toMatch(/hasn't been saved/))
  it('recent files are on the start screen, not under Open', () => expect(m('operators/sharing-queues.md')).not.toMatch(/Under \*\*Open\*\*, \*\*Open a saved service/))
  it('text size is for the Congregation screen only', () => expect(m('setup/displays.md')).not.toMatch(/Congregation\/Stage screens up or down/))
  it('there is no Help menu', () => expect(m('README.md')).not.toMatch(/Help menu/))
})
