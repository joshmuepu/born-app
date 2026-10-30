import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { isOpenableFromRemote } from '../../main/remoteServicePath'

// The phone remote's Open saved / Import saved sent a file path the computer opened as it was: any path on this computer (or, on
// Windows, a \\server\share path that makes the PC sign in to that server). Only the files the phone is shown are accepted now.
const saveDir = join('/tmp', 'born-profile', 'saved-services')
const recents = [join('/Users', 'op', 'Documents', 'Sunday service.born')]

describe('service files the phone remote may open', () => {
  it('a recent service file', () => expect(isOpenableFromRemote(recents[0], recents, saveDir)).toBe(true))
  it('a file the phone saved', () => expect(isOpenableFromRemote(join(saveDir, 'Evening.born'), recents, saveDir)).toBe(true))
  it('not any other file', () => {
    expect(isOpenableFromRemote('/etc/passwd', recents, saveDir)).toBe(false)
    expect(isOpenableFromRemote(join('/Users', 'op', 'Documents', 'other.born'), recents, saveDir)).toBe(false)
  })
  it('not a way out of the save folder', () => expect(isOpenableFromRemote(join(saveDir, '..', '..', 'x.born'), recents, saveDir)).toBe(false))
  it('not a network share', () => {
    expect(isOpenableFromRemote('\\\\attacker\\share\\x.born', recents, saveDir)).toBe(false)
    expect(isOpenableFromRemote('//attacker/share/x.born', recents, saveDir)).toBe(false)
  })
  it('not something that is not a path', () => {
    expect(isOpenableFromRemote(undefined, recents, saveDir)).toBe(false)
    expect(isOpenableFromRemote(42, recents, saveDir)).toBe(false)
  })
})
