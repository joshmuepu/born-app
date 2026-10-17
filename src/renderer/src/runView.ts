/**
 * Prepare / Run (P-06). Prepare is the whole workspace (find things, build the queue). Run is the queue and the live controls, large, for the service itself.
 * Which one you are in is not remembered across restarts: a service starts in Prepare, and the screens opening can switch to Run (when that setting is on).
 */
export type AppView = 'prepare' | 'run'

/** Keys this app wrote before the Run view existed. A profile that has none of them has never been used — it gets "Switch to Run when the screens open" on; a profile in use keeps what it had (off). */
const OLD_KEYS = /^born\.(?!setupSunday$|autoRun$|clickShows$)/

export function looksNewProfile(storage: Pick<Storage, 'length' | 'key'> = localStorage): boolean {
  try {
    for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && OLD_KEYS.test(k)) return false }
    return true
  } catch {
    return false
  }
}

/** Should the screens opening switch to Run? Only with the setting on, from Prepare, and only when there is a queue to run. */
export function shouldAutoRun(o: { autoRun: boolean; view: AppView; projectionJustOpened: boolean; queueLength: number }): boolean {
  return o.autoRun && o.projectionJustOpened && o.view === 'prepare' && o.queueLength > 0
}
