import type { TapeAddOutcome, TapeImportResult } from './tape'

/** The first thing added (what the Tape place should land on) and what to tell the operator, in plain words. */
export function addSummary(o: Pick<TapeAddOutcome, 'added' | 'pending'>, titleOf: (sermonId: number) => string): { message: string | null; recordingId: string | null; problems: string[] } {
  const ok = o.added.filter((r): r is Extract<TapeImportResult, { ok: true }> => r.ok)
  const problems = o.added.filter((r): r is Extract<TapeImportResult, { ok: false }> => !r.ok).map((r) => r.message)
  const first = ok.find((r) => r.recording)?.recording ?? null
  let message: string | null = null
  if (ok.length === 1 && first) message = `Added “${ok[0].file.name}” to ${titleOf(first.sermonId)}.${ok[0].duplicate ? ' (It was already in BORN; it is attached to this sermon.)' : ''}`
  else if (ok.length > 1) message = `Added ${ok.length} recordings.`
  if (o.pending.length) message = `${message ? message + ' ' : ''}${o.pending.length === 1 ? '1 file needs you to say which sermon it is.' : `${o.pending.length} files need you to say which sermon they are.`}`
  return { message, recordingId: first?.id ?? null, problems }
}
