/** "1963 · 63-0324E · ¶233" for a sermon quote. A Church Age Book chapter has no date code and no paragraph numbers (its rows carry an
 *  internal "§<row id>" token), so it reads "Book" instead of " ·  · ¶§12345". */
export function quoteMeta(q: { dateCode: string; paragraphRef: string }, opts: { year?: boolean; code?: boolean } = {}): string {
  const code = (q.dateCode ?? '').trim()
  const ref = (q.paragraphRef ?? '').trim()
  const yy = /^(\d{2})-/.exec(code)
  const year = opts.year !== false && yy && parseInt(yy[1], 10) >= 30 ? `19${yy[1]}` : ''
  const para = ref && !ref.startsWith('§') && /\d/.test(ref) ? `¶${ref}` : ''
  const parts = [year, opts.code === false ? '' : code, para].filter(Boolean)
  return parts.length > 0 && code ? parts.join(' · ') : para || 'Book'
}
