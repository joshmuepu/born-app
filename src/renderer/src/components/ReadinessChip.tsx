import { CheckCircle2, AlertTriangle, ClipboardCheck } from 'lucide-react'

/** "Is tonight ready?" as a chip in the queue header: ✓ Ready / ⚠ N to look at / Check. It only reports the last check, for this queue as it is now; pressing it
 *  runs the check again and opens the full list. It never changes anything by itself. */
export function readinessLabel(r: { fail: number; warn: number } | null): { text: string; level: 'unknown' | 'ready' | 'warn' | 'fail' } {
  if (!r) return { text: 'Is tonight ready?', level: 'unknown' }
  if (r.fail > 0) return { text: `${r.fail} to fix`, level: 'fail' }
  if (r.warn > 0) return { text: `${r.warn} to look at`, level: 'warn' }
  return { text: 'Ready', level: 'ready' }
}

export default function ReadinessChip({ queueLength, readiness, onCheck }: { queueLength: number; readiness: { fail: number; warn: number } | null; onCheck: () => void }): JSX.Element {
  const { text, level } = readinessLabel(readiness)
  const Icon = level === 'ready' ? CheckCircle2 : level === 'unknown' ? ClipboardCheck : AlertTriangle
  return (
    <button
      type="button"
      className={`readiness readiness--${level}`}
      onClick={onCheck}
      disabled={queueLength === 0}
      title="Check that everything in this service is ready to show"
      aria-label={level === 'unknown' ? 'Is tonight ready? Check the service' : `Is tonight ready? ${text}`}
    >
      <Icon width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
      {text}
    </button>
  )
}
