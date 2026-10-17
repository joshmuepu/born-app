/**
 * Getting a tape from the publisher's own site (Voice Of God Recordings), on the operator's click, one recording at a time.
 * The publisher's public "stream" page for a message names the very file its "Download Audio" button gives; BORN reads that page, downloads that one
 * file into the church's "Tape audio" folder and adds it. Nothing is cached anywhere else, nothing is bulk-fetched, and the recording is never changed.
 * Only English is fetched this way (the page's `ENG=` code); another language still opens the publisher's page.
 */
export const TAPE_STREAM_PAGE = 'https://branham.org/en/messagestream/ENG='

/** The publisher's page for one message, by date code (e.g. 65-0418M). Null when the code is not a date code. */
export function streamPageUrl(dateCode: string): string | null {
  const c = String(dateCode ?? '').trim().toUpperCase()
  return /^\d{2}-\d{4}[A-Z]{0,2}$/.test(c) ? TAPE_STREAM_PAGE + encodeURIComponent(c) : null
}

/** The one audio link on the page: https, an .m4a, on the publisher's own CDN. Anything else is ignored (never follow a link to somewhere unexpected). */
export function findAudioUrl(html: string): string | null {
  const found = String(html ?? '').match(/https:\/\/[A-Za-z0-9.-]+\.cloudfront\.net\/[^"'\s<>]+?\.m4a/g) ?? []
  return found[0] ?? null
}

/** The name the file is saved under in the Tape audio folder: the date code, so BORN matches it to the sermon by itself. */
export const downloadFileName = (dateCode: string): string => `${String(dateCode).trim().toUpperCase()}.m4a`

/** Plain words for a download that did not work. */
export function downloadProblem(kind: 'offline' | 'no-page' | 'no-audio' | 'http' | 'short' | 'disk' | 'cancelled' | 'unknown', detail?: number): string {
  switch (kind) {
    case 'offline': return 'BORN could not reach the publisher’s site. Check the internet connection and try again, or use “Open the publisher’s page”.'
    case 'no-page': return 'This sermon has no download page with the publisher under that date code. Use “Open the publisher’s page” to look for it.'
    case 'no-audio': return 'The publisher’s page for this sermon has no audio file to download. Use “Open the publisher’s page”.'
    case 'http': return `The publisher’s site refused the download (error ${detail ?? '?'}). Try again later, or use “Open the publisher’s page”.`
    case 'short': return 'The download stopped before the whole recording arrived. It was thrown away; try again.'
    case 'disk': return 'BORN could not save the recording (the disk may be full, or the folder is not writable).'
    case 'cancelled': return 'The download was cancelled.'
    default: return 'The download did not work. Use “Open the publisher’s page” and choose the file yourself.'
  }
}
