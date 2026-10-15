import type { Quote } from './types'

/** What can be dragged from a browse pane into the service queue. The payload
 *  is a small description, never a live object: the queue resolves it (a
 *  verse reference is looked up, a song is loaded) only when it is dropped. */
export type QueueDragPayload =
  | { type: 'quote'; quote: Quote }
  | { type: 'bible'; reference: string }
  | { type: 'song'; songId: number }

export const QUEUE_DRAG_MIME = 'application/x-born-queue-item'

/** Call from a source element's onDragStart. */
export function startQueueDrag(e: React.DragEvent, payload: QueueDragPayload): void {
  e.dataTransfer.setData(QUEUE_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.setData('text/plain', payloadLabel(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

/** True while a queue-bound drag is in flight (types are readable during
 *  dragover; the data itself is only readable on drop). */
export function isQueueDrag(dt: DataTransfer | null): boolean {
  return !!dt && Array.from(dt.types ?? []).includes(QUEUE_DRAG_MIME)
}

export function readQueueDrag(dt: DataTransfer | null): QueueDragPayload | null {
  if (!dt) return null
  try {
    const raw = dt.getData(QUEUE_DRAG_MIME)
    if (!raw) return null
    const p = JSON.parse(raw) as QueueDragPayload
    if (p && (p.type === 'quote' || p.type === 'bible' || p.type === 'song')) return p
  } catch {
    /* not ours */
  }
  return null
}

function payloadLabel(p: QueueDragPayload): string {
  if (p.type === 'quote') return `${p.quote.sermonTitle} ¶${p.quote.paragraphRef}`
  if (p.type === 'bible') return p.reference
  return `Song ${p.songId}`
}
