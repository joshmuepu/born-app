/**
 * Test-process workaround, not app code: with better-sqlite3 11 on Node 24, a prepared statement that is garbage-collected
 * inside the test runner aborts the whole test process ("Assertion failed: (env) != nullptr"). Tests that allocate a lot make that
 * GC happen mid-run, so which test it kills depends on timing. Keeping every statement referenced until the process ends avoids it.
 * `pragma()` and `transaction()` prepare through the native database object, so that is where this hooks in.
 * The app itself (Electron 33 / Node 20) is not affected.
 */
import { createRequire } from 'module'

const keep: unknown[] = []
const req = createRequire(import.meta.url)
const native = req('better-sqlite3/build/Release/better_sqlite3.node') as { Database: { prototype: { prepare: (...a: unknown[]) => unknown; __kept?: boolean } } }
const proto = native.Database.prototype
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
