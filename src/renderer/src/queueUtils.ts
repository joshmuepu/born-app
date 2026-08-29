/**
 * Pure helpers for service-queue mutations. Extracted so the index maths that
 * keeps the "active" (currently-projected) item pointed at the right row can be
 * unit-tested.
 */

export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** New index of the active item after a row moves from `from` to `to`. */
export function remapActiveIndexAfterReorder(
  active: number | null,
  from: number,
  to: number
): number | null {
  if (active === null) return null
  if (active === from) return to
  if (from < to && active > from && active <= to) return active - 1
  if (from > to && active >= to && active < from) return active + 1
  return active
}

/** New index of the active item after the row at `removed` is deleted. */
export function remapActiveIndexAfterRemove(
  active: number | null,
  removed: number
): number | null {
  if (active === null) return null
  if (active === removed) return null
  return active > removed ? active - 1 : active
}
