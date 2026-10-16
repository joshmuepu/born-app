/**
 * Service pack (.bornpack) — shared types, limits, names and the manifest validator.
 * Design: docs/design/media/07-service-pack.md. No Node or Electron here so the renderer can use the types.
 */

export const PACK_FORMAT = 'born-service-pack'
export const PACK_VERSION = 1
export const PACK_EXTENSION = 'bornpack'

export const PACK_LIMITS = {
  /** the ZIP flavour used has no 64-bit mode */
  maxPackBytes: 4 * 1024 * 1024 * 1024 - 64 * 1024 * 1024,
  maxPictures: 5000,
  maxPictureBytes: 512 * 1024 * 1024,
  maxManifestBytes: 5 * 1024 * 1024,
  maxQueueBytes: 20 * 1024 * 1024,
  /** show a plain warning above this */
  bigPackBytes: 1024 * 1024 * 1024
} as const

export const PACK_IMAGE_EXTS = ['jpg', 'png', 'gif', 'webp', 'bmp', 'avif'] as const
export type PackImageExt = (typeof PACK_IMAGE_EXTS)[number]

export const PACK_MANIFEST_NAME = 'manifest.json'
export const PACK_QUEUE_NAME = 'service.born'
/** The only picture entry names ever accepted: media/<64 hex>.<allowed extension> */
export const PACK_MEDIA_NAME = /^media\/([0-9a-f]{64})\.(jpg|png|gif|webp|bmp|avif)$/

export type PackRole = 'item' | 'slide' | 'background' | 'logo'

export interface PackFileEntry {
  /** entry name inside the pack: media/<libraryHash>.<ext> */
  path: string
  /** SHA-256 of the bytes in the pack */
  sha256: string
  bytes: number
  /** the picture's identity in a library (what a saved service's `refs` name); differs from sha256 only for converted HEIC/TIFF */
  libraryHash: string
  name: string
  origFilename: string
  ext: PackImageExt
  width: number
  height: number
  convertedFrom: string | null
  roles: PackRole[]
}

export interface PackManifest {
  format: typeof PACK_FORMAT
  packVersion: number
  createdAt: string
  app: string
  /** "title" of the service for the review dialog (file name without extension at save time) */
  title: string
  /** what the queue looked like, for the review dialog: one line per item */
  items: Array<{ title: string; kind: string; libraryHashes: string[] }>
  files: PackFileEntry[]
  /** destinations/channels that used a background, for the summary only — never applied on open */
  backgrounds: Array<{ scope: 'destination' | 'channel'; id: string; libraryHash: string; dim: number }>
}

export type PackErrorCode =
  | 'not-a-pack'
  | 'truncated'
  | 'damaged'
  | 'newer'
  | 'too-big'
  | 'too-many'
  | 'bad-entry'
  | 'bad-type'
  | 'no-space'
  | 'missing-pictures'
  | 'has-video'
  | 'cancelled'
  | 'io'
  | 'permission'

export const PACK_MESSAGES: Record<PackErrorCode, string> = {
  'not-a-pack': "That file isn't a Born Again service pack, so nothing was opened. Nothing was changed.",
  truncated: 'The pack is cut short — probably a copy that did not finish. Copy it again from the original and try again. Nothing was changed.',
  damaged: 'The pack is damaged and cannot be trusted. Copy it again from the original. Nothing was changed.',
  newer: 'This pack was made by a newer Born Again. Update Born Again, or ask for a plain .born file. Nothing was changed.',
  'too-big': 'The pack is bigger than Born Again will open (4 GB). Nothing was opened.',
  'too-many': 'The pack claims more pictures than Born Again will open (5,000). For safety nothing was opened.',
  'bad-entry': 'The pack holds something it should not, so for safety the whole pack was refused. Nothing was opened or run, and nothing was changed.',
  'bad-type': 'The pack holds a file that is not a picture Born Again can show. For safety the whole pack was refused. Nothing was opened or run.',
  'no-space': 'There is not enough free disk space for the pictures in this pack. Free some space and try again. Nothing was copied.',
  'missing-pictures': 'Some pictures are missing or have changed on this computer, so nothing was saved. Use Check to find them, then save again.',
  'has-video': "This service has a video, and a service pack can't carry videos yet (only pictures). Save it as a plain Save (.born) — the video file stays on this computer — or take the video out of the queue first.",
  cancelled: 'Cancelled. Nothing was changed.',
  io: 'Something went wrong reading or writing the file. Nothing was changed. Try again.',
  permission: "Born Again isn't allowed to read or write there. Choose another place, or check the file's permissions. Nothing was changed."
}

export interface PackEstimate {
  count: number
  totalBytes: number
  big: boolean
  tooBig: boolean
  tooMany: boolean
  freeBytes: number | null
  files: Array<{ id: string; name: string; bytes: number; roles: PackRole[] }>
  /** videos in the service: they cannot go in a pack (pictures only) */
  videos: Array<{ id: string; name: string }>
  /** pictures that are not readable right now (offline drive, deleted, changed) */
  missing: Array<{ id: string; name: string; status: string }>
  /** grouped lines for the dialog */
  groups: Array<{ label: string; sub: string; bytes: number; ids: string[] }>
}

export type PackReviewState = 'new' | 'have' | 'damaged'

export interface PackReviewFile {
  libraryHash: string
  name: string
  bytes: number
  state: PackReviewState
  roles: PackRole[]
  width: number
  height: number
}

export interface PackReview {
  ok: true
  path: string
  title: string
  createdAt: string
  packBytes: number
  items: Array<{ title: string; kind: string; new: number; have: number; damaged: number }>
  files: PackReviewFile[]
  counts: { new: number; have: number; damaged: number }
  newBytes: number
  backgrounds: number
}

export type PackResult<T> = ({ ok: true } & T) | { ok: false; code: PackErrorCode; message: string; detail?: string; missing?: Array<{ id: string; name: string; status: string }> }

export interface PackImportSummary {
  added: number
  already: number
  damaged: number
  backgrounds: number
  /** the queue inside the pack, exactly as a plain Save wrote it */
  queue: unknown[]
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const hex64 = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
const cleanText = (v: unknown, max = 200): string =>
  (typeof v === 'string' ? v : '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/** Strictly validate a parsed manifest. Returns the cleaned manifest or an error code. Never trusts a field it does not check. */
export function validateManifest(raw: unknown): { ok: true; manifest: PackManifest } | { ok: false; code: PackErrorCode } {
  if (!isObj(raw) || raw.format !== PACK_FORMAT) return { ok: false, code: 'not-a-pack' }
  if (typeof raw.packVersion !== 'number' || !Number.isInteger(raw.packVersion) || raw.packVersion < 1) return { ok: false, code: 'not-a-pack' }
  if (raw.packVersion > PACK_VERSION) return { ok: false, code: 'newer' }
  if (!Array.isArray(raw.files)) return { ok: false, code: 'not-a-pack' }
  if (raw.files.length > PACK_LIMITS.maxPictures) return { ok: false, code: 'too-many' }
  const seenPaths = new Set<string>()
  const seenHashes = new Set<string>()
  const files: PackFileEntry[] = []
  let total = 0
  for (const f of raw.files) {
    if (!isObj(f)) return { ok: false, code: 'bad-entry' }
    const path = typeof f.path === 'string' ? f.path : ''
    const m = PACK_MEDIA_NAME.exec(path)
    if (!m) return { ok: false, code: 'bad-entry' }
    const ext = m[2] as PackImageExt
    if (!hex64(f.sha256) || !hex64(f.libraryHash) || m[1] !== f.libraryHash) return { ok: false, code: 'bad-entry' }
    if (f.ext !== ext) return { ok: false, code: 'bad-type' }
    if (typeof f.bytes !== 'number' || !Number.isInteger(f.bytes) || f.bytes <= 0 || f.bytes > PACK_LIMITS.maxPictureBytes) return { ok: false, code: 'bad-entry' }
    const key = path.toLowerCase()
    if (seenPaths.has(key) || seenHashes.has(f.libraryHash)) return { ok: false, code: 'bad-entry' }
    seenPaths.add(key)
    seenHashes.add(f.libraryHash)
    total += f.bytes
    if (total > PACK_LIMITS.maxPackBytes) return { ok: false, code: 'too-big' }
    const roles = (Array.isArray(f.roles) ? f.roles : []).filter((r): r is PackRole => r === 'item' || r === 'slide' || r === 'background' || r === 'logo')
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e6 ? Math.round(v) : 0)
    files.push({
      path,
      sha256: f.sha256,
      bytes: f.bytes,
      libraryHash: f.libraryHash,
      name: cleanText(f.name, 120) || 'Picture',
      origFilename: cleanText(f.origFilename, 200),
      ext,
      width: num(f.width),
      height: num(f.height),
      convertedFrom: f.convertedFrom === 'heic' || f.convertedFrom === 'tiff' ? f.convertedFrom : null,
      roles
    })
  }
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 2000).filter(isObj).map((i) => ({
    title: cleanText(i.title, 120) || 'Item',
    kind: cleanText(i.kind, 20),
    libraryHashes: (Array.isArray(i.libraryHashes) ? i.libraryHashes : []).filter(hex64).slice(0, 5000)
  }))
  const backgrounds = (Array.isArray(raw.backgrounds) ? raw.backgrounds : []).slice(0, 200).filter(isObj).flatMap((b) =>
    (b.scope === 'destination' || b.scope === 'channel') && hex64(b.libraryHash) && typeof b.id === 'string'
      ? [{ scope: b.scope as 'destination' | 'channel', id: cleanText(b.id, 60), libraryHash: b.libraryHash, dim: typeof b.dim === 'number' ? Math.max(0, Math.min(90, Math.round(b.dim))) : 0 }]
      : []
  )
  return {
    ok: true,
    manifest: {
      format: PACK_FORMAT,
      packVersion: raw.packVersion,
      createdAt: cleanText(raw.createdAt, 40),
      app: cleanText(raw.app, 40),
      title: cleanText(raw.title, 120) || 'Service',
      items,
      files,
      backgrounds
    }
  }
}
