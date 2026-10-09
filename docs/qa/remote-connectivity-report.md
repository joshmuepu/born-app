# Remote connectivity — investigation & fix report

Branch: `fix/remote-connectivity` (off `main` @ `4917fddf`)
Scope: connectivity and reliability of the phone remote only. No changes to what the remote can control, and no authentication was added or altered, per instruction.
Security-sensitive detail is intentionally **not** in this file — see the chat for that.

## 1. The incident

Phone (Safari/mobile Chrome) showed `ERR_CONNECTION_TIMED_OUT` at `born-remote.local:4316` after a long hang, on a church computer, not fixed by restarting the computer several times. The browser got far enough to attempt a connection (it is not a DNS failure — that would be a different, more immediate error), then the connection itself hung and died. That symptom shape matters for root-causing below.

## 2. What was reproduced, and how

| # | Failure class | Reproduced? | Evidence |
|---|---|---|---|
| 1 | Port already in use | **Yes**, live and via test | A real second BORN instance (this machine's own `v2-channels` dev build) was holding port 4316 while this work was in progress — confirmed with `lsof -nP -iTCP:4316`. Also covered by an automated test that occupies the port first and asserts the server's `error` handler fires, `onListening` never fires, and `isWebRemoteAvailable()` stays false. |
| 3 | Wrong displayed/advertised address across adapters | **Yes**, via a unit test against the real `getLocalIP()` implementation | This dev machine only has one real adapter (no VPN present), so a genuine second adapter couldn't be physically reproduced here. Instead, `os.networkInterfaces()` was mocked to simulate a VPN adapter (`utun3`) and Windows virtual adapters (`vEthernet`, `VMware`) enumerated before the real one — the *unmodified* old code picked the wrong one in both cases, deterministically. This is a real code defect, reproduced against the real function, just not against real hardware. |
| 9 | Two BORN instances colliding | **Partially — found already mitigated** | `main` already has `app.requestSingleInstanceLock()` (`src/main/index.ts`) with a `second-instance` handler that focuses the existing window instead of starting a second process — this already prevents two copies of *the same install* from colliding on the port or mDNS name. It does **not** cover two different installs (e.g., a v1 and a v2 build, or two separate checkouts) run side by side — not applicable to a normal single-install church machine, so left as-is. |
| — | mDNS's own interface selection | **Investigated, not fixed** | `bonjour-service` → `multicast-dns` has its own, separate interface-selection logic (`defaultInterface()` in `multicast-dns/index.js`) with a similar OS-enumeration-order dependency, and a macOS-specific hardcoded check for an adapter literally named `en0`. Unlike our `getLocalIP()`, it falls back to `'0.0.0.0'` (let the OS route it) rather than actively preferring a wrong adapter, so it's lower-severity — but it's vendored third-party code, not something to patch directly. Noted as a ranked idea below. |
| — | Service worker caching a stale address | **Investigated, ruled out** | Read `SW_JS` in `remoteAssets.ts` in full: its `fetch` handler is `() => {}` — a deliberate no-op, by design ("the remote is useless without [connectivity]"). It does not cache anything and cannot pin a stale address. |
| — | mDNS advertised before the server actually bound | **Yes — found and fixed** | Code reading found `startMdns()` was called unconditionally right after `startWebRemote()` returned, but `server.listen()` is asynchronous. Confirmed by reading the call sequence in `index.ts`; fixed by threading an `onListening` callback through so mDNS only starts after a confirmed successful bind. |

Failure classes **not** reproduced here at all: 2 (IP-vs-`.local` reachability), 4 (network up-late / drop-and-return), 5 (firewall), 6 (phone-side: iOS Local Network permission, Private Wi-Fi Address, AP/client isolation, cellular), 7 (sleep/background/brief-drop recovery — verified by reading the code, not by an actual phone), 8 (home-screen/PWA pinning a stale address beyond the service-worker check above). These need a real second device and/or the real church network; see §4.

## 3. Root cause of today's incident — confidence assessment

**No single definitive root cause was found or can honestly be claimed** — nothing here was reproduced on the actual church computer or against the actual phone. Ranked by plausibility given the specific symptom (resolved the name, then a *long silent hang*, not an immediate refusal, not a DNS error, and surviving several full computer restarts):

1. **Most likely: Wi-Fi access-point client/AP isolation, or a firewall silently dropping inbound traffic.** Both produce exactly this symptom (SYN sent, nothing comes back) and neither would be fixed by restarting the computer, which matches "still broken after several restarts" better than any BORN-side bug would. **Cannot be confirmed or ruled out without testing on the actual church network** — see the exact checks in §4.
2. **Plausible contributing factor: the `getLocalIP()` adapter-selection bug** (now fixed, commit `4f4eb4a`). If the church computer has any VPN client, Hyper-V/WSL/Docker virtual switch, or similar installed, BORN could have been silently advertising an address nothing on the real Wi-Fi can route to. This fits "survives restarts" (the bug was deterministic, not random) but doesn't fully fit "resolves then times out" as cleanly as #1 — a totally wrong/virtual-only address would often fail faster or differently. Worth ruling in/out on the real machine (§4 has the exact command).
3. **Less likely given the symptom, but possible: mDNS resolved an address nothing is listening on** — e.g., the bind-before-advertise ordering bug (now fixed, commit `76ee981`) combined with something else holding port 4316. This would need a second process on port 4316, which isn't typical on a single-purpose church machine, so lower confidence than #1/#2.

**Recommendation:** have the operator run the new in-app "Remote connection check" (commit `1cafe83`) next time this happens, and send a copy of its output — that alone would have immediately told us whether #2 or #3 was in play, and the adapter list would show if something unexpected (VPN, virtual switch) is present on that machine.

## 4. What could not be tested here, and exactly what to run

This machine has exactly one real network adapter and no second physical device available in this environment, so the following need the real hardware. Commands below assume BORN is already running normally (no special env vars — those are dev-only).

### On the church computer

**macOS:**
```
# List every network adapter and its IP — compare against what BORN's
# "Remote connection check" panel says it chose.
ifconfig | grep -E "^[a-z]|inet "

# Confirm something is actually listening on 4316 (should show born/Electron).
lsof -nP -iTCP:4316 -sTCP:LISTEN

# From the SAME computer, confirm the server answers at all (loopback —
# doesn't prove LAN reachability, just rules out "nothing is listening").
curl -v http://127.0.0.1:4316/state

# Check whether the Firewall has an entry for BORN, and whether it's set to
# allow incoming connections:
#   System Settings → Network → Firewall → Options…
```

**Windows:**
```
:: List every adapter and its IPv4 address.
ipconfig /all

:: Confirm something is listening on 4316.
netstat -ano | findstr :4316

:: From the same computer, confirm the server answers (loopback only).
curl.exe -v http://127.0.0.1:4316/state

:: Check Windows Defender Firewall → Allowed apps, confirm BORN is checked
:: for the network type this computer is actually using (Private vs Public —
:: a church guest network is sometimes seen as Public, which blocks more by
:: default).
```

### From the phone, on the same Wi-Fi

1. Open BORN's Remote panel on the desktop, open "Remote connection check," and read the exact IP address it shows (not the `.local` name).
2. On the phone's browser, go directly to `http://<that-ip>:4316/state` (skip the QR code — this isolates whether the IP itself is reachable from whether `.local`/mDNS resolution is the problem).
   - **Loads JSON immediately** → the IP is reachable; the earlier failure was `.local`-specific (mDNS/DNS on the phone or network) — scan the QR again, it should now use the IP directly (commit `b38245b`).
   - **Times out the same way** → the IP itself is unreachable from the phone on this network; points at AP isolation or a firewall (§3, #1), not a BORN bug.
   - **Fails immediately (not a hang)** → different symptom than before; port may be blocked outright or nothing is listening — check the "listening" line in the connection-check panel.
3. If the phone is iOS: Settings → Privacy & Security → Local Network → confirm the browser (Safari, or Chrome if used) is allowed. iOS blocks LAN access per-app without this, silently.
4. If the phone normally uses a "Private Wi-Fi Address" (iOS) or random MAC (Android) on this network: this doesn't block the phone *from* reaching BORN, but can make the phone itself hard to find if BORN ever needs to reach it — unlikely to be today's cause given the direction of the failure (phone → computer), noted for completeness.

None of this can honestly be marked "fixed" without running it — the checklist above is what to run and what each outcome means.

## 5. What was fixed (commits, most-severe first)

- **`4f4eb4a`** — `getLocalIP()` could silently and deterministically prefer a VPN or OS-level virtual adapter (Hyper-V, VMware, WSL, Docker, Tailscale, ZeroTier, etc.) over the real LAN adapter, depending on OS enumeration order. Now classifies candidates by interface name and prefers a non-virtual one. 8 tests (2 of which failed against the old code, proving the bug first).
- **`76ee981`** — mDNS was advertising `born-remote.local` before the HTTP server had confirmed it actually bound — a bind failure (port taken, or any other listen error) would leave BORN advertising a working-looking name nothing is listening on. Now mDNS only starts from the server's actual listen-success callback. Also switched EADDRINUSE/listen-error/success logging from `console.*` (invisible in a packaged app) to the file logger, so this is now in `born.log`. 2 tests.
- **`b38245b`** — the displayed/advertised/QR address now defaults to the plain LAN IP instead of the `.local` mDNS name, with `.local` shown as a secondary note. `.local` resolution depends on mDNS working on both the network and the phone, which isn't universal; a bare IP works whenever the phone can reach the port at all. 2 tests.

## 6. What was improved (not a defect fix, but requested)

- **`4ab42db`** — `main` had no dev-isolation escape hatches at all (`BORN_USER_DATA_DIR`/`BORN_REMOTE_PORT`/`BORN_MDNS_NAME`), unlike other branches. Ported over so this and future work can run a fully isolated instance for testing without colliding with a real install.
- **`1cafe83`** — built-in "Remote connection check" in the Remote popover: listening status, connected-phone count (new — tracked via the remote's existing 1-second `/state` poll, no new mechanism), every network adapter found and which one was chosen and why, mDNS hostname, a plain-language OS-specific firewall hint, and a "Copy diagnostics" button (adapters, port, listen status, recent `born.log` lines) for a support request. This directly targets the structural blind spot in the old Remote panel: it could only ever say "server bound" or "server failed to bind," with no way to know whether anything on the LAN could actually reach it — which is exactly what showed no error during today's incident. Live-verified end-to-end in an isolated instance, including a real `curl` request from outside the process hitting `/state` over the actual LAN IP and the connected-phone count visibly going from 0 to 1.

**Already adequate, verified, not changed:**
- Phone-side reconnect UX (`remoteAssets.ts`): polls `/state` every second, has a visible "Connected"/"Reconnecting…" label and status dot, degrades and recovers automatically with no backoff needed since it's a fixed short interval. No gaps found.
- Service worker: confirmed to do no caching at all (see §2) — not a source of the stale-address failure class.

**Not applicable on this branch:** the task asked for in-app manual pages about the remote to be updated with new screenshots. `main` (and therefore this branch) has no in-app manual/help-viewer feature at all — that exists only on other branches. Nothing to update here.

## 7. Ranked ideas not built (per "do not build beyond these")

1. **High value, medium effort — automatic mDNS re-publish on network change.** Right now, if the church Wi-Fi drops and reconnects with a new IP (or the computer sleeps/wakes), the *displayed* IP self-corrects within ~4 seconds (the Remote panel already re-polls `getLocalIP()`/`getMdnsHostname()` on an interval, uncached) — but whether `bonjour-service`'s underlying advertisement actually re-probes and updates what a phone resolves on its own was not verified, and there's no explicit listener for OS network-change events (`os.networkInterfaces()` changing) to force a fresh `mdns.unpublishAll()` + re-`publish()`. Needs a real network-change event to test against, which this single-adapter dev machine can't produce.
2. **Medium value, low effort — patch around the `multicast-dns` interface-selection quirk** (§2) by passing an explicit `opts.interface` into `bonjour-service`'s underlying `multicast-dns` config, pinning it to the same adapter `getLocalIP()` already chose, instead of leaving that package to guess independently. Not done here because it touches a third-party dependency's internal option surface in a way that needs care to get right and verify — flagged rather than rushed.
3. **Low value, low effort — surface the connected-phone count and chosen adapter directly on the main Remote button/badge** (not just inside the popover's connection-check), so an operator glancing at the toolbar — not clicking in — can see at a glance that zero phones are connected.
4. **Low value, medium effort — a "Test from this network" self-ping**: have the desktop app make an outbound HTTP request to its own LAN IP (not loopback) as a weak proxy for "is this address actually routable," since loopback always succeeds regardless of firewall/adapter issues. Weak signal (own-machine routing isn't the same as a phone's), so ranked low.

## 8. Operator checklist — "If the phone can't connect"

1. Open the **Remote** button on the desktop (top right), then click **Remote connection check**.
2. Does it say the server is **listening**? If not — quit BORN completely (not just the window) and reopen it.
3. Look at **Connected phones right now**. If it's not 0, a different phone session may already be attached from earlier — that's fine, a tap on the right item on the correct device should still work.
4. Look at the **network adapter** it picked (the one with the arrow). Does the IP address look like this network's normal address range? If it looks unfamiliar (e.g., starts with `10.8.` or similar and this network isn't normally that), something else on this computer — a VPN, a virtual machine app — may be interfering. Try disabling it and clicking **Try again**.
5. On the phone, type the address shown **exactly as digits** (e.g. `10.0.0.124:4316`) directly into the browser instead of scanning the QR code. If that works but the QR code didn't, re-scan — it's now using that same address.
6. Still nothing? Click **Copy diagnostics** and send that text along when asking for help — it has everything needed to find the cause without being back at this computer.
7. If it's a church guest Wi-Fi network: some guest networks deliberately block devices from reaching each other ("client isolation"), which no setting in BORN can work around — ask whoever manages the network, or connect the phone to the main staff Wi-Fi instead if one exists.
