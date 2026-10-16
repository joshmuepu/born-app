/**
 * youtubeLookup.ts — reading a video's title from YouTube's public oEmbed address (https://oembed.com), which is meant for exactly
 * this: "give me the title of this link". No sign-in, no key, no page reading. If it fails for any reason the caller simply shows
 * the video id and the operator's own label — a title is a nicety, never a requirement.
 */
import { isVideoId, youtubeWatchUrl } from '../shared/youtube'

export interface YouTubeInfo {
  title: string
  author: string
}

/** `fetchImpl` is injected so tests (and Electron's `net.fetch`) can stand in. */
export async function lookupYouTube(videoId: string, fetchImpl: (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>, timeoutMs = 5000): Promise<YouTubeInfo | null> {
  if (!isVideoId(videoId)) return null
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(videoId))}`
    const res = await fetchImpl(url, { signal: ctl.signal })
    if (!res.ok) return null
    const j = (await res.json()) as { title?: unknown; author_name?: unknown }
    if (typeof j.title !== 'string' || !j.title.trim()) return null
    return { title: j.title.trim().slice(0, 200), author: typeof j.author_name === 'string' ? j.author_name.slice(0, 120) : '' }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}
