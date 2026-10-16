import { describe, it, expect } from 'vitest'
import {
  parseYouTubeInput,
  isVideoId,
  ytMediaId,
  isYouTubeMediaId,
  youtubeErrorInfo,
  judgeYouTubePreflight,
  ytToReport,
  YT_STALL_TICKS,
  YOUTUBE_ALERT_POLICY,
  alertTargetsFor,
  youtubeDisplayName
} from '../../shared/youtube'

const ID = 'dQw4w9WgXcQ'

describe('reading a pasted YouTube link', () => {
  const ok = (s: string): string | null => {
    const r = parseYouTubeInput(s)
    return r.ok ? r.videoId : null
  }
  it('accepts every common form', () => {
    for (const s of [
      `https://www.youtube.com/watch?v=${ID}`,
      `http://youtube.com/watch?v=${ID}`,
      `youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://music.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `youtu.be/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `https://www.youtube.com/v/${ID}`,
      `  https://youtu.be/${ID}  `,
      ID
    ]) expect(ok(s), s).toBe(ID)
  })
  it('ignores start times and playlist parameters instead of failing or using them', () => {
    expect(ok(`https://www.youtube.com/watch?v=${ID}&t=90s`)).toBe(ID)
    expect(ok(`https://www.youtube.com/watch?v=${ID}&list=PLabc&index=3&start_radio=1`)).toBe(ID)
    expect(ok(`https://youtu.be/${ID}?t=12&si=xyz`)).toBe(ID)
    expect(ok(`https://www.youtube.com/watch?list=PLabc&v=${ID}`)).toBe(ID)
  })
  it('refuses things that are not one YouTube video, with a plain reason', () => {
    const why = (s: unknown): string => {
      const r = parseYouTubeInput(s)
      return r.ok ? 'ok' : r.reason
    }
    expect(why('')).toBe('empty')
    expect(why('   ')).toBe('empty')
    expect(why(undefined)).toBe('empty')
    expect(why(42)).toBe('empty')
    expect(why('https://example.com/watch?v=' + ID)).toBe('not-youtube')
    expect(why('https://youtube.com.evil.example/watch?v=' + ID)).toBe('not-youtube')
    expect(why('https://evilyoutube.com/watch?v=' + ID)).toBe('not-youtube')
    expect(why('javascript:alert(1)')).toBe('not-youtube')
    expect(why('ftp://youtu.be/' + ID)).toBe('not-youtube')
    expect(why('https://www.youtube.com/')).toBe('no-video')
    expect(why('https://www.youtube.com/watch')).toBe('no-video')
    expect(why('https://www.youtube.com/@somechannel')).toBe('no-video')
    expect(why('https://www.youtube.com/playlist?list=PLabc')).toBe('playlist-only')
    expect(why('https://www.youtube.com/watch?v=short')).toBe('bad-id')
    expect(why('https://youtu.be/' + ID + 'X')).toBe('bad-id')
    expect(why('https://youtu.be/<script>12')).toBe('bad-id')
  })
  it('gives every refusal a message a person can read', () => {
    for (const s of ['', 'x y z', 'https://www.youtube.com/watch?v=bad', 'https://www.youtube.com/playlist?list=a']) {
      const r = parseYouTubeInput(s)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message.length).toBeGreaterThan(8)
    }
  })
  it('never throws, whatever it is given', () => {
    for (const v of [null, {}, [], 'http://', '://', 'https://[', '\u0000', 'a'.repeat(100000), Symbol.iterator as never]) expect(() => parseYouTubeInput(v)).not.toThrow()
  })
})

describe('video ids', () => {
  it('are exactly 11 characters of A-Z a-z 0-9 _ -', () => {
    expect(isVideoId(ID)).toBe(true)
    expect(isVideoId('abc_DEF-123')).toBe(true)
    for (const bad of ['', 'abc', ID + 'a', 'dQw4w9WgXc!', 'dQw4w9 WgXc', 'dQw4w9WgXc\n', null, 3]) expect(isVideoId(bad)).toBe(false)
  })
  it('the playback-record id round-trips and can never be a library id', () => {
    expect(ytMediaId(ID)).toBe('yt-' + ID)
    expect(isYouTubeMediaId(ytMediaId(ID))).toBe(true)
    expect(isYouTubeMediaId('m_0123456789ab')).toBe(false)
    expect(isYouTubeMediaId('yt-short')).toBe(false)
  })
})

describe("the player's error codes, in plain words", () => {
  it('maps the documented codes', () => {
    expect(youtubeErrorInfo(2).problem).toBe('invalid')
    expect(youtubeErrorInfo(5).problem).toBe('player')
    expect(youtubeErrorInfo(100).problem).toBe('not-found')
    expect(youtubeErrorInfo(101).problem).toBe('not-embeddable')
    expect(youtubeErrorInfo(150).problem).toBe('not-embeddable')
    expect(youtubeErrorInfo(153).problem).toBe('identity')
  })
  it('every code (even an unknown one) has a sentence and a way out', () => {
    for (const c of [2, 5, 100, 101, 150, 153, 7, -1, NaN]) {
      const i = youtubeErrorInfo(c)
      expect(i.short.length).toBeGreaterThan(10)
      expect(i.fix.length).toBeGreaterThan(10)
    }
  })
  it('says an embedding refusal is the owner of the video, not the church', () => {
    expect(youtubeErrorInfo(101).short).toMatch(/owner of this video/)
  })
})

describe('the online check ("Is tonight ready?")', () => {
  it('offline: a warning, not a failure, and the item stays', () => {
    const v = judgeYouTubePreflight({ internet: false, probe: null, hasFallback: false })
    expect(v.status).toBe('unreachable')
    expect(v.level).toBe('warn')
    expect(v.detail).toMatch(/stays in the queue/)
    expect(v.detail).toMatch(/no backup/)
    expect(v.fixes).toContain('replace-local')
  })
  it('YouTube did not answer: unreachable, fail', () => {
    const v = judgeYouTubePreflight({ internet: true, probe: { kind: 'timeout' }, hasFallback: true })
    expect(v.status).toBe('unreachable')
    expect(v.level).toBe('fail')
  })
  it('removed / private: blocked', () => {
    const v = judgeYouTubePreflight({ internet: true, probe: { kind: 'error', code: 100 }, hasFallback: false })
    expect(v.status).toBe('blocked')
    expect(v.level).toBe('fail')
    expect(v.fixes).toContain('replace-local')
  })
  it('embedding turned off: not-embeddable', () => {
    for (const code of [101, 150]) expect(judgeYouTubePreflight({ internet: true, probe: { kind: 'error', code }, hasFallback: true }).status).toBe('not-embeddable')
  })
  it('error 153 is reported as BORN\'s problem', () => {
    const v = judgeYouTubePreflight({ internet: true, probe: { kind: 'error', code: 153 }, hasFallback: true })
    expect(v.status).toBe('blocked')
    expect(v.title).toMatch(/identify BORN/)
  })
  it('ready with a backup passes; ready without one warns, and always mentions ads', () => {
    const a = judgeYouTubePreflight({ internet: true, probe: { kind: 'ready', duration: 200 }, hasFallback: true })
    expect([a.status, a.level]).toEqual(['ready', 'pass'])
    const b = judgeYouTubePreflight({ internet: true, probe: { kind: 'ready', duration: 200 }, hasFallback: false })
    expect([b.status, b.level]).toEqual(['ready', 'warn'])
    for (const v of [a, b]) expect(v.detail).toMatch(/Ads may appear/)
  })
  it('a live or upcoming video cannot be tested ahead of time', () => {
    const v = judgeYouTubePreflight({ internet: true, probe: { kind: 'ready', duration: null, live: true }, hasFallback: true })
    expect(v.status).toBe('unknown')
    expect(v.level).toBe('warn')
  })
})

describe("turning the player's numbers into a playback report", () => {
  const step = (raw: Parameters<typeof ytToReport>[0], prev = { time: -1, stillTicks: 0 }) => ytToReport(raw, prev)
  it('playing / paused / ended / buffering / cued', () => {
    expect(step({ state: 1, time: 3, duration: 100 }).report).toMatchObject({ playing: true, ended: false, position: 3, duration: 100, error: null })
    expect(step({ state: 2, time: 3, duration: 100 }).report.playing).toBe(false)
    expect(step({ state: 0, time: 100, duration: 100 }).report.ended).toBe(true)
    expect(step({ state: 3, time: 3, duration: 100 }).report.playing).toBe(false)
    expect(step({ state: 5, time: 0, duration: 100 }).report.playing).toBe(false)
  })
  it('an unknown duration stays unknown (a live video has no end)', () => {
    expect(step({ state: 1, time: 3, duration: 0 }).report.duration).toBeNull()
    expect(step({ state: 1, time: 3, duration: NaN }).report.duration).toBeNull()
  })
  it('garbage numbers cannot produce a bad position', () => {
    expect(step({ state: 1, time: NaN, duration: 10 }).report.position).toBe(0)
    expect(step({ state: 1, time: -5, duration: 10 }).report.position).toBe(0)
  })
  it('a clock that does not move while playing (or buffering) becomes "stalled" after a few seconds — and never earlier', () => {
    let prev = { time: 10, stillTicks: 0 }
    let report = step({ state: 1, time: 10, duration: 100 }, prev)
    for (let i = 1; i < YT_STALL_TICKS; i++) {
      expect(report.report.stalled).toBe(false)
      prev = { time: 10, stillTicks: report.stillTicks }
      report = step({ state: 1, time: 10, duration: 100 }, prev)
    }
    expect(report.report.stalled).toBe(true)
    // moving again clears it
    expect(step({ state: 1, time: 11, duration: 100 }, { time: 10, stillTicks: report.stillTicks }).report.stalled).toBe(false)
  })
  it('a paused video that is not moving is NOT stalled', () => {
    expect(step({ state: 2, time: 10, duration: 100 }, { time: 10, stillTicks: 50 }).report.stalled).toBe(false)
  })
  it('an error code becomes the plain sentence', () => {
    expect(step({ state: -1, time: 0, duration: 0, error: 101 }).report.error).toMatch(/does not allow/)
    expect(step({ state: -1, time: 0, duration: 0, error: 153 }).report.error).toMatch(/identify BORN/)
  })
})

describe('alerts and YouTube', () => {
  it('the policy is the single switch, and it ships as stage-only', () => {
    expect(YOUTUBE_ALERT_POLICY).toBe('stage-only')
  })
  it('with a YouTube video live, nothing is ever sent to the congregation screen; the stage still gets it', () => {
    for (const asked of ['congregation', 'both'] as const) {
      expect(alertTargetsFor(asked, true)).toEqual({ congregation: false, stage: true, withheld: true })
    }
    expect(alertTargetsFor('stage', true)).toEqual({ congregation: false, stage: true, withheld: false })
  })
  it('with anything else live, alerts behave exactly as before', () => {
    expect(alertTargetsFor('congregation', false)).toEqual({ congregation: true, stage: false, withheld: false })
    expect(alertTargetsFor('both', false)).toEqual({ congregation: true, stage: true, withheld: false })
    expect(alertTargetsFor('stage', false)).toEqual({ congregation: false, stage: true, withheld: false })
  })
})

describe('the name shown for a video', () => {
  it("prefers the operator's own name, then YouTube's title, then the id", () => {
    expect(youtubeDisplayName({ videoId: ID, title: 'T', label: 'Mine' })).toBe('Mine')
    expect(youtubeDisplayName({ videoId: ID, title: 'T' })).toBe('T')
    expect(youtubeDisplayName({ videoId: ID, title: '  ', label: ' ' })).toBe('YouTube video ' + ID)
  })
})
