/**
 * media.ts — types and plain rules for the Media library, shared by the main
 * process (which owns the files and the database) and the renderer (which only
 * ever sees these shapes). No Electron, no fs.
 */

export type MediaType = 'image' | 'video'

/** Where the bytes live. `managed` = a private copy in BORN's own library
 *  folder (the default). `linked` = the operator's original file, left where it
 *  is (for very large files) — BORN never modifies or deletes it. */
export type MediaStorage = 'managed' | 'linked'

/** What a media slide shows: a picture (default) or a video. */
export interface SlideMedia {
  mediaId: string
  fit?: 'fit' | 'fill' | 'stretch' | 'center'
  /** Present for a video. Its play/pause/position come from the main process's playback record, never from the slide. */
  type?: 'video'
  /** A video that starts over when it ends. */
  loop?: boolean
}
/** A background behind text: a still picture or (Phase 1b) a muted looping video. */
export interface SlideBackground {
  mediaId: string
  dim: number
  /** The background is a video (muted, looping). */
  motion?: boolean
}

/** How a picture sits on the screen. `fit` = whole picture, bars if needed (the safe default);
 *  `fill` = covers the screen, edges may be cropped; `stretch` = distorts to the screen;
 *  `center` = original size, centred, never scaled up. */
export type MediaFit = 'fit' | 'fill' | 'stretch' | 'center'
export const MEDIA_FITS: MediaFit[] = ['fit', 'fill', 'stretch', 'center']
export const MEDIA_FIT_LABEL: Record<MediaFit, string> = { fit: 'Fit (whole picture)', fill: 'Fill (crop edges)', stretch: 'Stretch', center: 'Original size, centred' }

export interface MediaRecord {
  id: string
  hash: string
  type: MediaType
  /** Display name — starts as the file name without extension; editable. */
  name: string
  /** The file name exactly as it was imported (for the operator's reference). */
  origFilename: string
  /** Lower-case extension of the stored file, no dot (`jpg`, `png`…). */
  ext: string
  mime: string
  bytes: number
  /** Natural size AFTER EXIF rotation — what the picture looks like. */
  width: number
  height: number
  /** GIF/WebP with more than one frame. */
  animated: boolean
  hasAlpha: boolean
  storage: MediaStorage
  /** Absolute path of the original — only for `linked` items. */
  linkPath: string | null
  /** Set when BORN converted the original (e.g. `heic`) to a JPEG on import. */
  convertedFrom: string | null
  folderId: string | null
  tags: string[]
  favorite: boolean
  addedAt: string
  lastUsedAt: string | null
  /** Soft delete: set while an Undo is still possible. */
  deletedAt: string | null
  // ── video only (null for pictures) ──
  /** Length in seconds. */
  durationSec: number | null
  /** Frames per second, when the file says. */
  fps: number | null
  /** Bits per second over the whole file. */
  bitrate: number | null
  /** `avc1` (H.264)… */
  videoCodec: string | null
  /** `mp4a` (AAC)… null = no audio track. */
  audioCodec: string | null
}

export interface MediaFolder {
  id: string
  name: string
  parentId: string | null
}

/** Why an import (or a check) did not produce a usable item. Stable codes the
 *  UI can switch on; `message` is always safe to show an operator as-is. */
export type MediaErrorCode =
  | 'not-found'
  | 'not-a-file'
  | 'permission'
  | 'empty'
  | 'unsupported'
  | 'unsupported-heic'
  | 'unsupported-video'
  | 'video-codec'
  | 'video-container'
  | 'video-too-large'
  | 'video-truncated'
  | 'video-damaged'
  | 'unsupported-audio'
  | 'is-pdf'
  | 'corrupt'
  | 'truncated'
  | 'too-large-pixels'
  | 'no-space'
  | 'library-unavailable'
  | 'io'

export interface MediaImportOk {
  ok: true
  item: MediaRecord
  /** The same picture was already in the library; this is the existing item. */
  duplicate: boolean
  /** Soft-deleted before and brought back by this import. */
  restored?: boolean
  warnings: string[]
}
export interface MediaImportFail {
  ok: false
  code: MediaErrorCode
  message: string
  /** The path that failed, for the operator's list of problems. */
  path: string
}
export type MediaImportResult = MediaImportOk | MediaImportFail

/** Health of a stored item right now (cheap: stat only). */
/** `offline`: a linked picture whose whole drive (USB stick, network share) is not connected — recoverable by plugging it in. */
export type MediaStatus = 'ok' | 'missing' | 'changed' | 'unreadable' | 'offline'

export const MEDIA_LIMITS = {
  /** Refuse pictures above this many pixels (decoding would exhaust memory). */
  maxPixels: 200_000_000,
  /** Warn above this many pixels — big enough to be slow, not unusable. */
  warnPixels: 60_000_000,
  /** Warn that a file is very large. */
  warnBytes: 100 * 1024 * 1024,
  /** Suggest "link in place" instead of copying at or above this size. */
  suggestLinkBytes: 500 * 1024 * 1024,
  /** Free space that must remain after a copy. */
  freeSpaceMarginBytes: 500 * 1024 * 1024,
  /** Soft-deleted items are purged this long after removal (undo window). */
  purgeAfterMs: 60 * 60 * 1000,
  thumbWidths: [320, 960] as const,
  /** Pictures bigger than this are shown from a screen-sized copy (never the raw file). */
  displayMaxPixels: 10_000_000,
  displayLongEdge: 3840
} as const

/**
 * Video limits — the resolved Phase 1b gates (docs/design/media/05-roadmap.md, spikes/PHASE-1B-GATES.md).
 * Only 1080p (2 h) and 4K (20 min) at 30 fps were soaked, on light test files.
 */
export const VIDEO_LIMITS = {
  maxWidth: 3840,
  maxHeight: 2160,
  /** 30 fps is what was verified; faster is allowed but flagged. */
  verifiedFps: 30,
  /** Warn above these bit rates (bits per second): 20 Mbit/s up to 1080p, 40 Mbit/s for 4K. */
  warnBitrate1080: 20_000_000,
  warnBitrate4k: 40_000_000,
  /** Above this many pixels it counts as "4K" for the warning. */
  fourKPixels: 1920 * 1080 * 1.5,
  /** Brands of real MP4 files; `qt  ` (QuickTime .mov) is refused. */
  mp4Brands: ['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'M4A ', 'dash', 'msdh'] as readonly string[]
} as const

export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi']

/** Extensions BORN will try, by what the bytes actually are (sniffed), not the name. */
export const NATIVE_IMAGE_FORMATS = ['jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'] as const
export type NativeImageFormat = (typeof NATIVE_IMAGE_FORMATS)[number]

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'jpe', 'png', 'gif', 'webp', 'bmp', 'avif', 'heic', 'heif', 'tif', 'tiff']

export const MEDIA_MESSAGES: Record<MediaErrorCode, string> = {
  'not-found': "That file couldn't be found. It may have been moved or deleted.",
  'not-a-file': "That's a folder, not a picture. Use “Add folder” to import everything inside it.",
  permission: "BORN isn't allowed to read that file. Check its permissions or copy it somewhere else first.",
  empty: 'That file is empty (0 bytes). Copy it again from the original.',
  unsupported: "BORN can't show this kind of file yet. Pictures work as JPEG, PNG, GIF, WebP, BMP or AVIF.",
  'unsupported-heic':
    "This is an iPhone photo format that this computer cannot open. Share it as JPEG: in Photos, choose Share, Options, Most Compatible (or use AirDrop with “Most Compatible”), then add it again.",
  'unsupported-video': "This isn't a video Born Again can use. Videos work as MP4 files (H.264 video, AAC audio).",
  'video-codec': 'This video uses a format many computers cannot play. In your editor, or in HandBrake, export it as MP4 with H.264 video and AAC audio (the “Web” or “Most compatible” preset), then add that file.',
  'video-container': 'Born Again plays MP4 files (H.264 video, AAC audio) — not MOV, MKV, AVI or WebM. Export it as MP4 (H.264 / AAC) from your editor or from HandBrake, then add that file.',
  'video-too-large': 'This video is bigger than 4K (3840×2160). Export a 1080p or 4K MP4 (H.264 / AAC) and add that instead.',
  'video-truncated': 'This video looks incomplete (the file was cut short — an unfinished copy or download). Copy it again from the original.',
  'video-damaged': "This video won't open on this computer (it may be damaged). Try exporting it again as MP4 with H.264 video and AAC audio.",
  'unsupported-audio': 'Audio arrives in a later version of BORN. Nothing was added.',
  'is-pdf': 'This is a PDF. Use “Import PDF” to turn its pages into a slideshow.',
  corrupt: 'This picture is damaged and cannot be shown. Copy it again from the original.',
  truncated: 'This picture looks incomplete (the file was cut short). Copy it again from the original.',
  'too-large-pixels': 'This picture is enormous (over 200 megapixels) and would not display safely. Resize it and add it again.',
  'no-space': "There isn't enough free disk space to add this picture. Free some space, or link it in place instead of copying.",
  'library-unavailable': "BORN's media library could not be opened. Your service files are not affected.",
  io: 'Something went wrong reading or writing that file. Try again.'
}

export interface MediaLibraryInfo {
  available: boolean
  message?: string | null
  dir: string
  items?: number
  bytesManaged?: number
  trashed?: number
  freeBytes?: number | null
}

// ── Still backgrounds (behind sermon, Bible and song text) ─────────────────────

/** `mediaId: null` means "explicitly no background here", which beats a channel default. */
export interface MediaBackground {
  mediaId: string | null
  /** Darkening laid over the picture so text stays readable: 0 (none) – 80 (%). */
  dim: number
}
export interface BackgroundSettings {
  destinations: Record<string, MediaBackground>
  channels: Record<string, MediaBackground>
}
export const DEFAULT_BACKGROUND_DIM = 35
export const EMPTY_BACKGROUNDS: BackgroundSettings = { destinations: {}, channels: {} }

export function clampDim(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : DEFAULT_BACKGROUND_DIM
  return Math.max(0, Math.min(80, v))
}

/**
 * Which background applies to one destination:
 *   1. the destination's own setting (including an explicit "none"),
 *   2. else its channel's default,
 *   3. else, if that channel follows another, that channel's default (and so on).
 * Returns null when nothing applies. Pure, so it is tested without Electron.
 */
export function resolveBackground(
  s: BackgroundSettings | undefined,
  destinationId: string,
  channelId: string,
  followOf: (channelId: string) => string | null
): { mediaId: string; dim: number } | null {
  if (!s) return null
  const own = s.destinations?.[destinationId]
  if (own) return own.mediaId ? { mediaId: own.mediaId, dim: clampDim(own.dim) } : null
  let c: string | null = channelId
  for (let hops = 0; c && hops < 6; hops++) {
    const b = s.channels?.[c]
    if (b) return b.mediaId ? { mediaId: b.mediaId, dim: clampDim(b.dim) } : null
    c = followOf(c)
  }
  return null
}

/** One picture's result from the pre-service check (see MediaLibrary.preflight). */
export interface MediaPreflightResult {
  id: string
  name: string
  status: MediaStatus
  /** `damaged` = the bytes no longer match what was imported; `undecodable` = it will not open as a picture. */
  deep: 'ok' | 'damaged' | 'undecodable' | 'skipped'
  width: number
  height: number
  bytes: number
  storage: MediaStorage | null
  notes: string[]
}
