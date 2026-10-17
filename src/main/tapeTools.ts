/**
 * tapeTools.ts — finds the speech recogniser that ships inside the app (whisper.cpp program + English model). The operator never chooses it;
 * a path saved in Settings by an earlier version still wins so nothing they set up is lost.
 */
import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { getSettings } from './settings'

const plat = (): string => `${process.platform}-${process.arch}`
const exe = (): string => (process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli')

export interface BundledTools { whisper: string; model: string }

export function bundledTools(): BundledTools | null {
  const roots = app.isPackaged ? [join(process.resourcesPath, 'whisper')] : [join(app.getAppPath(), 'resources', 'whisper')]
  const t = getSettings().tape
  for (const r of roots) {
    const whisper = t.whisperPath && existsSync(t.whisperPath) ? t.whisperPath : join(r, plat(), exe())
    const model = t.whisperModelPath && existsSync(t.whisperModelPath) ? t.whisperModelPath : join(r, 'ggml-base.en.bin')
    if (existsSync(whisper) && existsSync(model)) return { whisper, model }
  }
  return null
}
