import { useEffect, useRef, useState } from 'react'
import { Smartphone, Copy, Check, AlertTriangle } from 'lucide-react'
import QRCode from 'qrcode'

interface RemoteInfo {
  available: boolean
  url: string
  ipUrl: string
  hostnameUrl: string | null
}

/**
 * "Scan once, on this WiFi" — the desktop side of the auto-connecting remote.
 * Shows a QR code for the mDNS address (falls back to the raw IP until/unless
 * mDNS finishes probing) so a phone never needs to type anything in.
 */
/** A few retries covers the real "still starting up" window (the server and
 *  mDNS take a moment right after launch) — past this, retrying forever
 *  silently is what actually caused an outage once: the panel just said
 *  "Starting…" no matter how long the port stayed stuck, and the only fix
 *  anyone thought to try was rebooting the computer. */
const FAILED_ATTEMPTS_BEFORE_ERROR = 4

export default function RemotePanel(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<RemoteInfo | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const fetchInfo = (): void => {
      window.electronAPI.getWebRemoteURL().then((next) => {
        if (cancelled) return
        setInfo(next)
        if (next.available) {
          attempts = 0
          setFailedAttempts(0)
          return
        }
        attempts += 1
        setFailedAttempts(attempts)
        if (attempts < FAILED_ATTEMPTS_BEFORE_ERROR) setTimeout(fetchInfo, 1500)
      })
    }
    fetchInfo()
    // mDNS can finish probing a second or two after the server itself opens —
    // keep refreshing for a bit so the QR code upgrades from IP to hostname
    // without the operator needing to reopen this panel.
    const upgrade = setInterval(fetchInfo, 4000)
    return () => {
      cancelled = true
      clearInterval(upgrade)
    }
  }, [])

  const retryNow = (): void => {
    setFailedAttempts(0)
    window.electronAPI.getWebRemoteURL().then(setInfo)
  }

  const remoteErrored = !info?.available && failedAttempts >= FAILED_ATTEMPTS_BEFORE_ERROR

  useEffect(() => {
    if (!info?.url) {
      setQrDataUrl('')
      return
    }
    let cancelled = false
    QRCode.toDataURL(info.url, {
      margin: 1,
      width: 240,
      color: { dark: '#0d1117', light: '#ffffff' }
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl)
    })
    return () => {
      cancelled = true
    }
  }, [info?.url])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const copy = (): void => {
    if (!info?.url) return
    navigator.clipboard?.writeText(info.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="remote-panel" ref={wrapRef}>
      <button
        className={`btn-secondary remote-trigger${open ? ' is-open' : ''}${remoteErrored ? ' remote-trigger--error' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={remoteErrored ? "Remote couldn't start — click for details" : 'Control the service from a phone or tablet'}
      >
        {remoteErrored ? (
          <AlertTriangle width={14} height={14} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Smartphone width={14} height={14} strokeWidth={2} aria-hidden="true" />
        )}
        Remote
      </button>

      {open && (
        <div className="remote-popover" role="dialog" aria-label="Remote control">
          <div className="remote-popover-title">Remote control</div>
          {remoteErrored ? (
            <div className="remote-popover-body remote-popover-body--error">
              <AlertTriangle width={22} height={22} strokeWidth={1.75} aria-hidden="true" />
              <p className="remote-error-text">
                The remote couldn&rsquo;t start — usually another copy of BORN is already running
                somewhere and is holding the connection. Try quitting BORN completely (not just
                closing the window) and reopening it.
              </p>
              <button className="btn-secondary btn-sm" onClick={retryNow}>
                Try again
              </button>
            </div>
          ) : (
          <div className="remote-popover-body">
            <div className="remote-qr">
              {qrDataUrl ? (
                <img src={qrDataUrl} width={120} height={120} alt="QR code for the remote address" />
              ) : (
                <div className="remote-qr-placeholder" />
              )}
            </div>
            <div className="remote-info">
              <p className="remote-hint">
                Scan once, on this WiFi. It stays connected on that phone or tablet from then on
                — no address to type, no re-scanning.
              </p>
              {info?.url ? (
                <div className="remote-address">
                  <code>{info.url.replace(/^https?:\/\//, '')}</code>
                  <button className="btn-icon remote-copy" onClick={copy} title="Copy address" aria-label="Copy address">
                    {copied ? (
                      <Check width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
                    ) : (
                      <Copy width={13} height={13} strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="remote-address remote-address--pending">Starting…</div>
              )}
              {info?.available && !info.hostnameUrl && (
                <p className="remote-note">
                  Still finding a name for this computer — using its network address for now.
                </p>
              )}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  )
}
