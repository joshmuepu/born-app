/** Build-time check for scripts/build-sermon-db.ts. */

/** One row per numbered paragraph puts a full library at about 225,000 rows for about 1,200 sermons; far outside that range, or with any
 *  sermon missing, the fetch went wrong and the build stops instead of shipping it. */
export function checkLibrarySanity(c: { sermons: number; paragraphs: number; expected: number; missing: number }): void {
  const problems: string[] = []
  if (c.missing > 0) problems.push(`${c.missing} sermon(s) could not be fetched`)
  if (c.sermons < c.expected) problems.push(`${c.expected - c.sermons} sermon(s) missing (${c.sermons} of ${c.expected})`)
  if (c.sermons < 1000) problems.push(`only ${c.sermons} sermons`)
  if (c.paragraphs < 150000 || c.paragraphs > 400000) problems.push(`${c.paragraphs} paragraph rows (expected 150,000–400,000)`)
  if (problems.length) throw new Error(`the sermon library does not look right — not shipping it: ${problems.join('; ')}`)
}
