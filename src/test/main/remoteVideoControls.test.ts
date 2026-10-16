import { describe, it, expect } from 'vitest'
import { APP_JS } from '../../main/remoteAssets'

/** The phone page is a plain script in a string; check it still parses, and run its video-controls function on its own. */
describe("the phone remote's video controls", () => {
  it('the whole page script is still valid JavaScript', () => {
    expect(() => new Function(APP_JS)).not.toThrow()
  })

  const src = APP_JS.slice(APP_JS.indexOf('function mmss('), APP_JS.indexOf('function nowNextPerfHtml'))
  const html = (qs: Record<string, unknown>): string => {
    // eslint-disable-next-line no-new-func
    return new Function('state', 'cmd', `${src}; return mediaControlsHtml()`)({ qs }, () => {}) as string
  }
  const live = (o: Record<string, unknown> = {}) => ({ mediaId: 'm_1', status: 'playing', position: 30, duration: 125, hasPlayedOnce: true, stalled: false, error: null, ...o })

  it('shows nothing when no video is live, and nothing while the screen is blanked', () => {
    expect(html({ playback: null })).toBe('')
    expect(html({ playback: live(), blanked: true })).toBe('')
  })
  it('a playing video offers Pause and shows the time left', () => {
    const h = html({ playback: live() })
    expect(h).toContain("cmd('media-pause')")
    expect(h).toContain('0:30')
    expect(h).toContain('−1:35')
    expect(h).not.toContain('media-play')
  })
  it('a paused video that has been started can be resumed', () => {
    expect(html({ playback: live({ status: 'paused' }) })).toContain("cmd('media-play')")
    expect(html({ playback: live({ status: 'ended', position: 125 }) })).toContain('Play again')
  })
  it('a video the operator has NOT started cannot be started from the phone (no first play with sound)', () => {
    const h = html({ playback: live({ status: 'paused', position: 0, hasPlayedOnce: false }) })
    expect(h).toContain('<button disabled>Play</button>')
    expect(h).not.toContain("cmd('media-play')")
    expect(h).toContain('Start it on the main computer first')
  })
  it('there is no seek and no volume anywhere in it', () => {
    const h = html({ playback: live() })
    expect(h).not.toMatch(/seek|range|volume|slider/i)
  })
  it('says plainly when the video failed or froze', () => {
    expect(html({ playback: live({ status: 'error', error: 'x' }) })).toContain('Cannot play')
    expect(html({ playback: live({ stalled: true }) })).toContain('stopped moving')
  })
})
