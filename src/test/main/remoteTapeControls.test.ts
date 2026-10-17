import { describe, it, expect } from 'vitest'
import { APP_JS, APP_CSS } from '../../main/remoteAssets'

/** The phone page is a plain script in a string; run the tape controls function on its own, as the video controls are tested. */
describe("the phone remote's tape controls", () => {
  it('the whole page script is still valid JavaScript, and the new styles exist', () => {
    expect(() => new Function(APP_JS)).not.toThrow()
    expect(APP_CSS).toContain('.tape-ctl')
  })
  const src = APP_JS.slice(APP_JS.indexOf('function mmss('), APP_JS.indexOf('function nowNextPerfHtml'))
  const html = (qs: Record<string, unknown>, tapeList?: unknown): string => {
    // eslint-disable-next-line no-new-func
    return new Function('state', 'cmd', 'esc', `${src}; return tapeControlsHtml()`)({ qs, tapeList }, () => {}, (x: string) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;')) as string
  }
  const tape = (o: Record<string, unknown> = {}) => ({ recordingId: 'r_1', sermonId: 1, status: 'paused', position: 150, duration: 1000, speed: 1, volume: 0.5, canPlay: true, stalled: false, error: null, note: null, hasTiming: true, timingVersion: 'v1', paragraph: 2, nextParagraph: 3, nextInSec: 50, sync: 'in-sync', ...o })
  const list = { recordingId: 'r_1', items: Array.from({ length: 30 }, (_, i) => ({ n: i + 1, t: i * 10, snippet: `Words of ${i + 1} <b>` })) }

  it('shows nothing when no tape is loaded', () => {
    expect(html({ tape: null })).toBe('')
    expect(html({})).toBe('')
  })
  it('a tape the operator has started offers Play; a playing one offers Pause; time and time left are shown', () => {
    expect(html({ tape: tape() })).toContain("cmd('tape-play')")
    const playing = html({ tape: tape({ status: 'playing' }) })
    expect(playing).toContain("cmd('tape-pause')")
    expect(playing).not.toContain("cmd('tape-play')")
    expect(playing).toContain('2:30')
    expect(playing).toContain('−14:10')
    expect(html({ tape: tape({ status: 'ended' }) })).toContain('Play again')
  })
  it('a tape the operator has NOT started cannot be started from the phone, and the page says so', () => {
    const h = html({ tape: tape({ canPlay: false }) })
    expect(h).toContain('<button class="tp-main" disabled>Play</button>')
    expect(h).not.toContain("cmd('tape-play')")
    expect(h).toContain('Start it on the main computer first')
  })
  it('has back/forward 10 s, previous/next paragraph, volume steps — and NO seek bar, slider, or range input', () => {
    const h = html({ tape: tape() })
    for (const a of ['tape-back', 'tape-fwd', 'tape-prev', 'tape-next', 'tape-vol-down', 'tape-vol-up']) expect(h).toContain(`cmd('${a}')`)
    expect(h).not.toMatch(/type="range"|slider|<input|seek/i)
    expect(h).toContain('Volume 50%')
  })
  it('without timing: paragraph buttons are off, the pill says so, and no paragraph list is offered', () => {
    const h = html({ tape: tape({ hasTiming: false, paragraph: null, sync: 'no-timing' }) }, list)
    expect(h).toContain('No timing for this tape')
    expect(h).toContain('aria-label="Previous paragraph" disabled')
    expect(h).toContain('aria-label="Next paragraph" disabled')
    expect(h).not.toContain('tp-list')
  })
  it('the paragraph list follows the tape: a window around the current paragraph, which is marked', () => {
    const h = html({ tape: tape({ paragraph: 20 }) }, list)
    expect(h).toContain('class="tp-cur" aria-current="true"')
    expect(h).toContain('tapeJump(20)')
    expect(h).toContain('tapeJump(18)')
    expect(h).not.toContain('tapeJump(5)')
    expect(h.match(/tapeJump\(/g)!.length).toBeLessThanOrEqual(12)
  })
  it('tapping a paragraph never jumps by itself: it goes through tapeJump, which asks first and sends confirm', () => {
    expect(APP_JS).toContain("window.confirm(from + 'Jump to")
    expect(APP_JS).toContain("cmd('tape-jump', { n: n, confirm: true })")
  })
  it('text from the list is escaped, and a list for another recording is ignored', () => {
    expect(html({ tape: tape({ paragraph: 1 }) }, list)).toContain('Words of 1 &lt;b>')
    expect(html({ tape: tape({ paragraph: 1 }) }, { ...list, recordingId: 'other' })).not.toContain('tp-list')
  })
  it('says plainly when the tape failed, froze, or is in a stretch with no text', () => {
    expect(html({ tape: tape({ status: 'error', error: 'x', note: 'The sound device was lost.' }) })).toContain('The sound device was lost.')
    expect(html({ tape: tape({ stalled: true }) })).toContain('stopped moving')
    expect(html({ tape: tape({ sync: 'in-gap' }) })).toContain('No text here')
    expect(html({ tape: tape({ sync: 'differs' }) })).toContain('The tape differs here')
  })
})

describe('where the tape controls appear on the phone page', () => {
  it('with nothing on the screen as well as with something (a tape can play with the screens empty)', () => {
    const noOn = APP_JS.slice(APP_JS.indexOf('function nowNextPerfHtml'), APP_JS.indexOf('function compactQueueStripHtml'))
    expect(noOn.match(/Nothing on screen yet\.[^;]*tapeControlsHtml\(\)/g)).toHaveLength(2)
    expect(noOn.match(/tapeControlsHtml\(\)/g)!.length).toBeGreaterThanOrEqual(4)
  })
})
