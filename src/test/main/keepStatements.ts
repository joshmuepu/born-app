/**
 * Test-process workaround, not app code: with better-sqlite3 11 on Node 24, a prepared statement that is garbage-collected
 * inside vitest's sandbox aborts the whole test process ("Assertion failed: (env) != nullptr"). Tests that allocate a lot
 * (many zips, big buffers) make that GC happen mid-run. Keeping every statement referenced until the process ends avoids it.
 * The app itself (Electron 33 / Node 20) is not affected.
 */
import Database from 'better-sqlite3'

const keep: unknown[] = []
const proto = Database.prototype as unknown as { prepare: (...a: unknown[]) => unknown; __kept?: boolean }
if (!proto.__kept) {
  const orig = proto.prepare
  proto.prepare = function (this: unknown, ...a: unknown[]): unknown {
    const st = orig.apply(this, a)
    keep.push(st)
    return st
  }
  proto.__kept = true
}
export {}
