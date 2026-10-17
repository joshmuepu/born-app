import { describe, it, expect } from 'vitest'
import { TapeHub, type TapeHubDeps } from '../../main/tapeHub'
import { phoneTapeCommand, tapeSummary, phoneParagraphList, isPhoneTapeAction, PHONE_TAPE_ACTIONS, type PhoneTapeDeps } from '../../main/tapePhone'
import type { SyncMark, TapeRecording } from '../../shared/tape'

const file = { id: 't_aaaaaaaaaaaa', hash: 'h', name: 'x', origFilename: 'x.m4a', ext: 'm4a', container: 'm4a', codec: 'mp4a', bytes: 1, durationSec: 1000, bitrate: 1, vbr: null, seekTableOk: true, storage: 'managed' as const, linkPath: null, addedAt: '' }
const rec: TapeRecording = { id: 'r_1', sermonId: 1115, language: 'en', label: '', createdAt: '', file, synced: true }
const MARKS: SyncMark[] = [{ n: 1, t: 10, kind: 'start' }, { n: 2, t: 100, kind: 'start' }, { n: 3, t: 200, kind: 'start' }, { n: 9, t: 500, kind: 'start' }]

function setup(o: { map?: boolean; regions?: Array<{ kind: 'gap' | 'differs'; start: number; end: number }> } = {}) {
  let t = 1_000_000
  const d: TapeHubDeps = {
    now: () => t, emit: () => {}, engine: () => {}, savePosition: () => {}, loadRecording: () => ({ recording: rec, resume: null }),
    settings: () => ({ outputDeviceId: '', outputDeviceLabel: '', volume: 0.5 }), videoPlaying: () => false, pauseVideo: () => {}
  }
  const hub = new TapeHub(d)
  const jumps: unknown[] = []
  const deps: PhoneTapeDeps = {
    hub,
    map: () => (o.map === false ? null : { marks: MARKS, regions: o.regions ?? [], updatedAt: 'v1' }),
    onJump: (j) => jumps.push(j)
  }
  const ready = (pos = 0): void => hub.report({ position: pos, playing: false, duration: 1000, ready: true })
  const at = (sec: number): void => { hub.command({ type: 'seek', to: sec }) }
  return { hub, deps, jumps, ready, at, advance: (ms: number) => { t += ms } }
}
const cmd = (d: PhoneTapeDeps, action: string, extra: Record<string, unknown> = {}) => phoneTapeCommand(d, { action, ...extra })

describe('what the phone may do — the rules table', () => {
  it('nothing is possible with no tape loaded', () => {
    const { deps } = setup()
    for (const a of PHONE_TAPE_ACTIONS) expect(cmd(deps, a, { n: 2, confirm: true })).toMatchObject({ ok: false, reason: 'nothing-loaded' })
  })
  it('Play is REFUSED until the operator has started the tape once on the computer', () => {
    const { hub, deps, ready } = setup()
    hub.load('r_1'); ready()
    expect(cmd(deps, 'tape-play')).toMatchObject({ ok: false, reason: 'not-started', message: expect.stringMatching(/Start the tape on the main computer first/) })
    expect(hub.record?.status).toBe('paused')
    hub.command({ type: 'play' }) // the operator
    hub.command({ type: 'pause' })
    expect(cmd(deps, 'tape-play')).toEqual({ ok: true })
    expect(hub.record?.status).toBe('playing')
  })
  it('Pause is always allowed and is recorded as the phone\'s; ±10 s moves the tape and nothing else', () => {
    const { hub, deps, ready, at } = setup()
    hub.load('r_1'); ready(); hub.command({ type: 'play' }); at(100)
    expect(cmd(deps, 'tape-fwd')).toEqual({ ok: true })
    expect(hub.get()!.position).toBeGreaterThanOrEqual(109.5)
    expect(cmd(deps, 'tape-back')).toEqual({ ok: true })
    expect(cmd(deps, 'tape-pause')).toEqual({ ok: true })
    expect(hub.record).toMatchObject({ status: 'paused', pausedBy: 'phone' })
  })
  it('there is no seek-to-a-time, no speed and no unknown command: they are all refused as "not something the phone can do"', () => {
    const { hub, deps, ready } = setup()
    hub.load('r_1'); ready()
    for (const a of ['tape-seek', 'tape-speed', 'tape-load', 'tape-volume', 'seek', '', 'drop table']) {
      expect(cmd(deps, a, { to: 500 })).toMatchObject({ ok: false, reason: 'bad-command' })
      expect(isPhoneTapeAction(a)).toBe(false)
    }
    expect(hub.get()!.position).toBe(0)
  })
})

describe('paragraphs', () => {
  it('next paragraph seeks to the next timed paragraph; on the last one it does nothing', () => {
    const { hub, deps, ready, at } = setup()
    hub.load('r_1'); ready(); at(50)
    cmd(deps, 'tape-next'); expect(hub.get()!.position).toBeCloseTo(100, 0)
    cmd(deps, 'tape-next'); expect(hub.get()!.position).toBeCloseTo(200, 0)
    at(600)
    expect(cmd(deps, 'tape-next')).toEqual({ ok: true })
    expect(hub.get()!.position).toBeCloseTo(600, 0)
  })
  it('previous paragraph: more than 3 s in goes to the start of this one, else to the one before', () => {
    const { hub, deps, ready, at } = setup()
    hub.load('r_1'); ready(); at(150)
    cmd(deps, 'tape-prev'); expect(hub.get()!.position).toBeCloseTo(100, 0)
    at(101.5)
    cmd(deps, 'tape-prev'); expect(hub.get()!.position).toBeCloseTo(10, 0)
    at(5)
    cmd(deps, 'tape-prev'); expect(hub.get()!.position).toBeCloseTo(0, 0)
  })
  it('without timing, paragraph skipping is refused in plain words (the tape itself still plays)', () => {
    const { hub, deps, ready } = setup({ map: false })
    hub.load('r_1'); ready()
    expect(cmd(deps, 'tape-next')).toMatchObject({ ok: false, reason: 'no-timing' })
    expect(cmd(deps, 'tape-jump', { n: 2, confirm: true })).toMatchObject({ ok: false, reason: 'no-timing' })
  })
  it('jumping needs an explicit confirm, a paragraph that has a time, and tells the computer where the tape was', () => {
    const { hub, deps, ready, at, jumps } = setup()
    hub.load('r_1'); ready(); at(150)
    expect(cmd(deps, 'tape-jump', { n: 3 })).toMatchObject({ ok: false, reason: 'confirm-needed' })
    expect(cmd(deps, 'tape-jump', { n: 3, confirm: 'yes' })).toMatchObject({ ok: false, reason: 'confirm-needed' })
    expect(cmd(deps, 'tape-jump', { n: 7, confirm: true })).toMatchObject({ ok: false, reason: 'no-such-paragraph' })
    expect(cmd(deps, 'tape-jump', { n: 'x', confirm: true })).toMatchObject({ ok: false, reason: 'bad-command' })
    expect(hub.get()!.position).toBeCloseTo(150, 0)
    expect(cmd(deps, 'tape-jump', { n: 3, confirm: true })).toEqual({ ok: true })
    expect(hub.get()!.position).toBeCloseTo(200, 0)
    expect(jumps).toEqual([{ fromSec: expect.closeTo(150, 0), fromParagraph: 2, toParagraph: 3 }])
  })
})

describe('the phone\'s volume stays within 20 % of the operator\'s', () => {
  it('steps by 5 points, never above operator × 1.2 or below × 0.8, and never above full', () => {
    const { hub, deps, ready } = setup()
    hub.load('r_1'); ready()
    hub.command({ type: 'volume', value: 0.5 }) // the operator
    for (let i = 0; i < 10; i++) cmd(deps, 'tape-vol-up')
    expect(hub.record!.volume).toBe(0.6)
    for (let i = 0; i < 20; i++) cmd(deps, 'tape-vol-down')
    expect(hub.record!.volume).toBe(0.4)
    hub.command({ type: 'volume', value: 0.95 })
    for (let i = 0; i < 10; i++) cmd(deps, 'tape-vol-up')
    expect(hub.record!.volume).toBe(1)
  })
  it('when the operator turns it up or down, the phone\'s window moves with it', () => {
    const { hub, deps, ready } = setup()
    hub.load('r_1'); ready()
    hub.command({ type: 'volume', value: 0.5 })
    for (let i = 0; i < 10; i++) cmd(deps, 'tape-vol-up')
    hub.command({ type: 'volume', value: 0.3 })
    for (let i = 0; i < 10; i++) cmd(deps, 'tape-vol-up')
    expect(hub.record!.volume).toBe(0.36)
  })
})

describe('what the phone and automation tools are told', () => {
  it('nothing when no tape is loaded', () => {
    expect(tapeSummary(setup().deps)).toBeNull()
  })
  it('position, paragraph, next paragraph and its countdown, play permission, sync word, timing version', () => {
    const { hub, deps, ready, at } = setup()
    hub.load('r_1'); ready(); at(150)
    expect(tapeSummary(deps)).toMatchObject({ recordingId: 'r_1', status: 'paused', position: 150, duration: 1000, canPlay: false, paragraph: 2, nextParagraph: 3, nextInSec: 50, hasTiming: true, timingVersion: 'v1', sync: 'in-sync', speed: 1 })
    hub.command({ type: 'play' })
    expect(tapeSummary(deps)!.canPlay).toBe(true)
  })
  it('says "no timing", "no text here" and "differs" instead of pretending to be in sync', () => {
    const a = setup({ map: false }); a.hub.load('r_1'); a.ready()
    expect(tapeSummary(a.deps)).toMatchObject({ sync: 'no-timing', paragraph: null, hasTiming: false })
    const b = setup({ regions: [{ kind: 'gap', start: 120, end: 160 }] }); b.hub.load('r_1'); b.ready(); b.at(130)
    expect(tapeSummary(b.deps)!.sync).toBe('in-gap')
    const c = setup({ regions: [{ kind: 'differs', start: 120, end: 160 }] }); c.hub.load('r_1'); c.ready(); c.at(130)
    expect(tapeSummary(c.deps)!.sync).toBe('differs')
  })
  it('the paragraph list carries number, time and only the first words — never the whole text', () => {
    const texts = new Map([[1, 'Short.'], [2, 'word '.repeat(60)], [3, 'Third paragraph text.']])
    const list = phoneParagraphList(MARKS, texts)
    expect(list.map((p) => p.n)).toEqual([1, 2, 3, 9])
    expect(list[0]).toEqual({ n: 1, t: 10, snippet: 'Short.' })
    expect(list[1].snippet.length).toBeLessThanOrEqual(92)
    expect(list[1].snippet.endsWith('…')).toBe(true)
    expect(list[3].snippet).toBe('')
  })
})
