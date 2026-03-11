/**
 * logger.ts — Persistent file logger for the main process.
 * Writes to <userData>/born.log with timestamps and log levels.
 * Also mirrors to console so output appears in the dev terminal.
 */
import { app } from 'electron'
import { appendFileSync, existsSync, renameSync, statSync } from 'fs'
import { join } from 'path'

const MAX_LOG_BYTES = 5 * 1024 * 1024 // 5 MB — rotate when exceeded

let logPath: string | null = null

function getLogPath(): string {
  if (!logPath) {
    logPath = join(app.getPath('userData'), 'born.log')
  }
  return logPath
}

function rotatIfNeeded(path: string): void {
  try {
    if (existsSync(path) && statSync(path).size > MAX_LOG_BYTES) {
      renameSync(path, path + '.old')
    }
  } catch {
    // ignore rotation errors
  }
}

function write(level: string, msg: string, extra?: unknown): void {
  const ts = new Date().toISOString()
  const extraStr = extra !== undefined
    ? ' ' + (extra instanceof Error
        ? `${extra.message}\n${extra.stack ?? ''}`
        : JSON.stringify(extra))
    : ''
  const line = `[${ts}] [${level}] ${msg}${extraStr}\n`

  // Always mirror to console (visible in dev terminal)
  if (level === 'ERROR') {
    console.error(line.trimEnd())
  } else {
    console.log(line.trimEnd())
  }

  // Write to file
  try {
    const path = getLogPath()
    rotatIfNeeded(path)
    appendFileSync(path, line)
  } catch {
    // If file logging fails, console is still available
  }
}

export const log = {
  info:  (msg: string, extra?: unknown) => write('INFO ', msg, extra),
  warn:  (msg: string, extra?: unknown) => write('WARN ', msg, extra),
  error: (msg: string, extra?: unknown) => write('ERROR', msg, extra),
  debug: (msg: string, extra?: unknown) => write('DEBUG', msg, extra),

  /** Call once on startup to log environment info. */
  boot(): void {
    write('INFO ', '─────────────────────────────────────────')
    write('INFO ', `BORN starting  v${app.getVersion()}`)
    write('INFO ', `Electron ${process.versions.electron}  Node ${process.version}  ABI ${process.versions.modules}`)
    write('INFO ', `userData: ${app.getPath('userData')}`)
    write('INFO ', `logFile:  ${getLogPath()}`)
    write('INFO ', '─────────────────────────────────────────')
  }
}
