import { useEffect, useRef, useState } from 'react'
import { Smartphone, Copy, Check, AlertTriangle, ChevronDown, RefreshCw, Stethoscope } from 'lucide-react'
import QRCode from 'qrcode'

interface RemoteInfo {
  available: boolean
  url: string
  ipUrl: string
  hostnameUrl: string | null
}

interface AutomationInfo {
  token: string | null
  baseUrl: string | null
}

/** Plain-language, OS-specific next step — the self-test below this can say
 *  "nothing is obviously wrong" but still miss a firewall silently dropping
 *  inbound connections, so this is always shown rather than only on error. */
function firewallHint(platform: string): string {
  if (platform === 'darwin') {
    return 'macOS may have shown a firewall prompt for BORN the first time the remote started. If it was dismissed, denied, or never seen: open System Settings → Network → Firewall → Options, and make sure BORN is allowed to accept incoming connections.'
  }
  if (platform === 'win32') {
    return 'Windows may have shown a "Windows Defender Firewall has blocked some features" prompt for BORN. If it was cancelled, or the wrong network type (Public) was chosen: open Windows Security → Firewall & network protection → Allow an app through firewall, and check BORN for both Private and Public.'
  }
  return "Check this computer's firewall settings to make sure BORN is allowed to accept incoming connections on this network."
}

function buildDiagnosticsText(diag: RemoteDiagnostics): string {
  const lines = [
    `BORN remote connection check — ${new Date().toISOString()}`,
    `Platform: ${diag.platform}`,
    `Server listening: ${diag.available}`,
    `Port: ${diag.port}`,
    `Chosen address: ${diag.chosenIp}`,
    `mDNS hostname: ${diag.mdnsHostname ?? '(not resolved)'}`,
    `Connected phones: ${diag.connectedPhones}`,
    '',
    'Network adapters:',
    ...diag.adapters.map(
      (a) => `  ${a.chosen ? '→' : ' '} ${a.name}: ${a.address}${a.virtual ? ' (virtual/VPN)' : ''}`
    ),
    '',
    'Recent log lines:',
    ...diag.recentLogLines.map((l) => `  ${l}`)
  ]
  return lines.join('\n')
}

/**
 * "Scan once, on this WiFi" — the desktop side of the auto-connecting remote.
 * Shows a QR code for the computer's plain LAN IP (more reliable to resolve
 * than `.local` on networks/phones where mDNS is flaky) so a phone never
 * needs to type anything in. The `.local` name is offered as a secondary,
 * more DHCP-stable address once mDNS has finished probing.
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
  const [diag, setDiag] = useState<RemoteDiagnostics | null>(null)
  const [diagOpen, setDiagOpen] = useState(false)
  const [diagCopied, setDiagCopied] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  /** Collapsed by default — most operators never touch this; it's here for
   *  the ones wiring up a Stream Deck or Companion, not the common case. */
  const [automationOpen, setAutomationOpen] = useState(false)
  const [automation, setAutomation] = useState<AutomationInfo | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    window.electronAPI.getAutomationInfo().then(setAutomation)
  }, [open])

  const requireToken = (require: boolean): void => {
    if (require) window.electronAPI.generateAutomationToken().then(setAutomation)
    else window.electronAPI.setAutomationToken(null).then(setAutomation)
  }

  const copyToken = (): void => {
    if (!automation?.token) return
    navigator.clipboard?.writeText(automation.token)
    setTokenCopied(true)
    setTimeout(() => setTokenCopied(false), 1500)
  }

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

  const toggleDiagnostics = (): void => {
    const next = !diagOpen
    setDiagOpen(next)
    if (next) window.electronAPI.getWebRemoteDiagnostics().then(setDiag)
  }

  const copyDiagnostics = (): void => {
    if (!diag) return
    navigator.clipboard?.writeText(buildDiagnosticsText(diag))
    setDiagCopied(true)
    setTimeout(() => setDiagCopied(false), 1500)
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
            <div className="remote-popover-row">
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
                {info?.available && info.hostnameUrl && (
                  <p className="remote-note">
                    Also reachable at {info.hostnameUrl.replace(/^https?:\/\//, '')} once a phone
                    resolves it — the address above is more reliable to scan.
                  </p>
                )}
              </div>
            </div>

            <div className="remote-automation">
              <button
                className="remote-automation-head"
                onClick={() => setAutomationOpen((v) => !v)}
                aria-expanded={automationOpen}
              >
                <span>Automation API (Stream Deck, Companion)</span>
                <ChevronDown
                  width={13}
                  height={13}
                  strokeWidth={2.2}
                  aria-hidden="true"
                  style={{ transform: automationOpen ? 'rotate(180deg)' : undefined }}
                />
              </button>
              {automationOpen && (
                <div className="remote-automation-body">
                  <p className="remote-hint">
                    HTTP + WebSocket control for a macro pad — next, previous, clear, blank, and show,
                    per channel, plus a read-only state feed. Reachable at{' '}
                    <code>{automation?.baseUrl ?? '…'}/api/v1/automation/</code>{' '}
                    (the unversioned <code>/api/automation/</code> keeps working too).
                  </p>
                  <label className="remote-token-toggle">
                    <input
                      type="checkbox"
                      checked={!!automation?.token}
                      onChange={(e) => requireToken(e.target.checked)}
                    />
                    Require a token
                  </label>
                  {automation?.token && (
                    <>
                      <div className="remote-address">
                        <code>{automation.token}</code>
                        <button
                          className="btn-icon remote-copy"
                          onClick={copyToken}
                          title="Copy token"
                          aria-label="Copy automation token"
                        >
                          {tokenCopied ? (
                            <Check width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
                          ) : (
                            <Copy width={13} height={13} strokeWidth={2} aria-hidden="true" />
                          )}
                        </button>
                        <button
                          className="btn-icon remote-copy"
                          onClick={() => window.electronAPI.generateAutomationToken().then(setAutomation)}
                          title="Generate a new token — invalidates the old one"
                          aria-label="Regenerate automation token"
                        >
                          <RefreshCw width={13} height={13} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                      <p className="remote-note">
                        Send it as an <code>X-Born-Token</code> header or a <code>?token=</code> query param.
                      </p>
                    </>
                  )}
                  <p className="remote-note">
                    POST .../next · .../prev · .../clear/&lt;channel&gt; · .../blank/&lt;channel&gt; ·
                    .../show/&lt;channel&gt; — GET .../state — WS .../ws
                  </p>
                </div>
              )}
            </div>
          </div>
          )}

          <button className="btn-secondary btn-sm remote-diag-toggle" onClick={toggleDiagnostics}>
            <Stethoscope width={13} height={13} strokeWidth={2} aria-hidden="true" />
            {diagOpen ? 'Hide connection check' : 'Remote connection check'}
          </button>

          {diagOpen && (
            <div className="remote-diag">
              {diag ? (
                <>
                  <p className="remote-diag-row">
                    Server: {diag.available ? 'listening' : 'not listening'} on port {diag.port}
                  </p>
                  <p className="remote-diag-row">Connected phones right now: {diag.connectedPhones}</p>
                  <p className="remote-diag-row">
                    mDNS name: {diag.mdnsHostname ?? 'not resolved yet'}
                  </p>
                  <p className="remote-diag-row">Network adapters found:</p>
                  <ul className="remote-diag-adapters">
                    {diag.adapters.map((a) => (
                      <li key={a.name + a.address}>
                        {a.chosen ? '→ ' : '　'}
                        <code>{a.address}</code> ({a.name}
                        {a.virtual ? ', looks virtual/VPN' : ''})
                      </li>
                    ))}
                  </ul>
                  <p className="remote-diag-row remote-diag-firewall">{firewallHint(diag.platform)}</p>
                  <button className="btn-secondary btn-sm" onClick={copyDiagnostics}>
                    {diagCopied ? (
                      <Check width={13} height={13} strokeWidth={2.4} aria-hidden="true" />
                    ) : (
                      <Copy width={13} height={13} strokeWidth={2} aria-hidden="true" />
                    )}
                    Copy diagnostics
                  </button>
                </>
              ) : (
                <p className="remote-diag-row">Checking…</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
