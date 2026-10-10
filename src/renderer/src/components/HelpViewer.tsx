/**
 * HelpViewer.tsx — the in-app user manual. Opened from the "Help" button in
 * the header or the F1 key (see App.tsx), closed by Esc or the X, exactly
 * the same modal/Esc pattern ScreensManager.tsx already uses so this adds no
 * new interaction model to learn.
 *
 * The manual itself (docs/manual/v2/*.md + images/) ships inside the app and
 * is read entirely over IPC (see main/manual.ts) — no network request, no
 * renderer filesystem access. Markdown is rendered client-side with
 * markdown-it; every image's relative path is resolved to a data: URL before
 * the HTML is ever shown, so there's no flash of a broken image and no need
 * for the renderer to know how the manual is laid out on disk beyond its
 * own manifest.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import MarkdownIt from 'markdown-it'
import { X, Printer, Loader2, TriangleAlert } from 'lucide-react'
import type { ManualManifest } from '../types'

interface Props {
  onClose: () => void
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

/** GitHub-style heading slug, so a same-page link like
 *  `[Words you'll see](#words-youll-see)` resolves — markdown-it doesn't add
 *  heading ids on its own. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  const inline = tokens[idx + 1]
  const id = inline?.type === 'inline' ? slugify(inline.content) : undefined
  if (id) tokens[idx].attrSet('id', id)
  return self.renderToken(tokens, idx, options)
}

/** Joins a markdown link/image target against the directory of the page
 *  that referenced it — manifest file paths are always POSIX-style
 *  ("operators/quick-start.md"), never real filesystem paths, so a plain
 *  '/' join + '..' resolution is all that's needed. */
function resolveRelative(baseFile: string, href: string): string {
  const baseDir = baseFile.includes('/') ? baseFile.slice(0, baseFile.lastIndexOf('/')) : ''
  const parts = (baseDir ? baseDir.split('/') : []).concat(href.split('/'))
  const stack: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

const IMG_SRC_RE = /<img\s+[^>]*?src="([^"]+)"[^>]*>/g

/** Renders `source` and swaps every relative image src for a data: URL
 *  fetched over IPC, so the returned HTML never references a path the
 *  renderer process couldn't otherwise load. */
async function renderPage(source: string, file: string): Promise<string> {
  const rawHtml = md.render(source)
  const paths = new Set<string>()
  for (const m of rawHtml.matchAll(IMG_SRC_RE)) {
    if (!/^(https?:|data:)/i.test(m[1])) paths.add(m[1])
  }
  const resolved = new Map<string, string>()
  await Promise.all(
    Array.from(paths).map(async (p) => {
      const dataUrl = await window.electronAPI.getManualImage(resolveRelative(file, p))
      if (dataUrl) resolved.set(p, dataUrl)
    })
  )
  return rawHtml.replace(IMG_SRC_RE, (whole, src) => {
    const dataUrl = resolved.get(src)
    return dataUrl ? whole.replace(`src="${src}"`, `src="${dataUrl}"`) : whole
  })
}

function pageTitle(manifest: ManualManifest | null, file: string): string {
  for (const section of manifest?.sections ?? []) {
    const page = section.pages.find((p) => p.file === file)
    if (page) return page.title
  }
  return 'BORN manual'
}

/** Shown wherever a manual request fails — the manifest itself, or a single
 *  page — instead of leaving the loading spinner running forever. Plain
 *  language (no error codes, no "undefined"), always with a way out. */
function HelpErrorState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div className="help-error">
      <TriangleAlert width={22} height={22} strokeWidth={1.75} aria-hidden="true" />
      <p className="help-error-text">
        Help couldn&rsquo;t load. Try closing and reopening BORN. If it still fails,
        contact the person who set up BORN.
      </p>
      <button className="btn-secondary btn-sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

export default function HelpViewer({ onClose }: Props): JSX.Element {
  const [manifest, setManifest] = useState<ManualManifest | null>(null)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [manifestError, setManifestError] = useState(false)
  const [manifestAttempt, setManifestAttempt] = useState(0)
  const [pageError, setPageError] = useState(false)
  const [pageAttempt, setPageAttempt] = useState(0)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setManifestError(false)
    window.electronAPI
      .getManualManifest()
      .then((m) => {
        if (cancelled) return
        const first = m?.sections[0]?.pages[0]?.file
        if (first) {
          setManifest(m)
          setActiveFile(first)
        } else {
          setManifestError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setManifestError(true)
      })
    return () => {
      cancelled = true
    }
  }, [manifestAttempt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (lightboxSrc) setLightboxSrc(null)
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, lightboxSrc])

  useEffect(() => {
    if (!activeFile) return
    let cancelled = false
    setLoading(true)
    setPageError(false)
    window.electronAPI
      .getManualPage(activeFile)
      .then(async (source) => {
        if (cancelled) return
        if (source === null) {
          setPageError(true)
          setLoading(false)
          return
        }
        const rendered = await renderPage(source, activeFile)
        if (!cancelled) {
          setHtml(rendered)
          setLoading(false)
          contentRef.current?.scrollTo(0, 0)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPageError(true)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeFile, pageAttempt])

  const navigateTo = (file: string): void => {
    const exists = manifest?.sections.some((s) => s.pages.some((p) => p.file === file))
    if (exists) setActiveFile(file)
  }

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      setLightboxSrc((target as HTMLImageElement).src)
      return
    }
    const anchor = target.closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href') ?? ''
    e.preventDefault()
    if (/^https?:\/\//i.test(href)) {
      window.electronAPI.openManualExternalLink(href)
    } else if (href.startsWith('#')) {
      contentRef.current?.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
    } else if (activeFile) {
      navigateTo(resolveRelative(activeFile, href))
    }
  }

  const printCurrentPage = async (): Promise<void> => {
    if (!activeFile) return
    setPrinting(true)
    try {
      const title = pageTitle(manifest, activeFile)
      const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
        body { font: 14px/1.5 -apple-system, Segoe UI, sans-serif; color: #111; margin: 32px; }
        h1, h2, h3 { color: #000; }
        img { max-width: 100%; }
        code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; }
        table { border-collapse: collapse; }
        td, th { border: 1px solid #ccc; padding: 4px 8px; }
      </style></head><body>${html}</body></html>`
      await window.electronAPI.printManualPdf(doc, `BORN — ${title}.pdf`)
    } finally {
      setPrinting(false)
    }
  }

  const title = useMemo(() => pageTitle(manifest, activeFile ?? ''), [manifest, activeFile])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="BORN manual">
        <div className="modal-title-row">
          <h3 className="modal-title">BORN manual</h3>
          <button className="btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <X width={15} height={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        {manifestError ? (
          <div className="help-unavailable">
            <HelpErrorState onRetry={() => setManifestAttempt((n) => n + 1)} />
          </div>
        ) : (
          <div className="help-body">
            <nav className="help-sidebar" aria-label="Manual sections">
              {manifest?.sections.map((section) => (
                <div key={section.id} className="help-sidebar-section">
                  <div className="help-sidebar-heading">{section.title}</div>
                  {section.pages.map((page) => (
                    <button
                      key={page.id}
                      className={activeFile === page.file ? 'is-active' : ''}
                      onClick={() => setActiveFile(page.file)}
                    >
                      {page.title}
                    </button>
                  ))}
                </div>
              ))}
            </nav>

            <div className="help-content-pane">
              <div className="help-content-head">
                <span className="help-content-title">{title}</span>
                <button
                  className="btn-quiet btn-sm"
                  onClick={printCurrentPage}
                  disabled={printing || loading || pageError}
                >
                  {printing ? (
                    <Loader2 width={13} height={13} strokeWidth={2.2} className="spin" aria-hidden="true" />
                  ) : (
                    <Printer width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
                  )}
                  Save this page as PDF
                </button>
              </div>
              <div className="help-content" ref={contentRef} onClick={handleContentClick}>
                {pageError ? (
                  <HelpErrorState onRetry={() => setPageAttempt((n) => n + 1)} />
                ) : loading ? (
                  <div className="help-loading">
                    <Loader2 width={20} height={20} strokeWidth={2} className="spin" aria-hidden="true" />
                  </div>
                ) : (
                  <div className="help-markdown" dangerouslySetInnerHTML={{ __html: html }} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {lightboxSrc && (
        <div
          className="help-lightbox"
          onClick={(e) => {
            e.stopPropagation()
            setLightboxSrc(null)
          }}
        >
          <img src={lightboxSrc} alt="" />
          <span className="help-lightbox-hint">Click anywhere to close</span>
        </div>
      )}
    </div>
  )
}
