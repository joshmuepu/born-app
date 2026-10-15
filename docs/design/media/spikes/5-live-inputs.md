# Spike 5 — Capture cards and cameras as live inputs

**Question.** Can Born Again show a camera or capture card as an item, and what does it need?

**How tested** (macOS, Electron 33.4.11): a probe (`spikes/media/tools/capture-probe.js`) asks the
OS for privacy state and what Chromium can enumerate, **without** triggering a permission prompt. A
runnable test page (`spikes/media/capture/index.html`) is provided for the owner.

## Measured

| Item | Result |
|---|---|
| Camera permission state (macOS) | `not-determined` — the app *would* trigger a system prompt on first use; **I did not trigger it** |
| Microphone | `not-determined` |
| Screen recording | `granted` (for the Electron binary) |
| `enumerateDevices()` before permission | Works: lists device **names** here (`MacBook Pro Camera`, audio in/out incl. two HDMI monitors, a virtual Teams audio device) |
| `desktopCapturer.getSources` | 16 window/screen sources listed — window capture is possible |
| Camera *open*, resolution, frame rate, latency | **Not measured** (no prompt; no capture card on this Mac) |

## What is known from the platform (reasoned, not measured here)

- A UVC capture card or webcam appears as a normal video input to Chromium (`getUserMedia`) on
  Windows and macOS; resolution/fps are negotiated ("ideal" constraints) and must be *read back*.
- **NDI Virtual Input** (free NDI Tools) turns any NDI source into a webcam-like input
  ([NDI tools](https://ndi.video/tools)), so NDI sources need **no SDK** in our app — they look like
  cameras.
- Electron needs a **permission handler** for media and, on macOS, the camera/microphone usage strings
  in the app's `Info.plist` *(the packaged app's current plist was not inspected; unverified)*.
- Latency of a browser-based pipeline is typically a few frames but varies by card/driver
  *(unverified)*; **IMAG** use needs a measured number from a real card.

## Verdict: **SAFE WITH LIMITS — needs hardware**

Technically routine; the unknown is *your* hardware and drivers. Not safe to promise "IMAG" until a
real card is measured.

## What it means for the roadmap

Live inputs stay **Phase 4**. Design requirements discovered: a device picker that tolerates
"unnamed" devices before permission, a "re-open when the device returns" behaviour, and the failure
states in `03-product-design.md` §6.

## Needs the owner

On the church Windows PC, with the capture card / camera connected (and NDI Tools installed if you use
NDI):

1. Run `electron spikes/media/capture` (or open `spikes/media/capture/index.html` in Chrome/Edge — the
   result is similar but not identical to the app's engine, so prefer Electron).
2. Press **1. List devices** (allow the camera prompt), choose your card, press **2. Open selected**.
3. Press **Copy results** and send back. Also tell me the card model and what is connected to it.
4. For a rough latency number: point the camera at a stopwatch app on your phone next to a monitor
   showing the live preview and photograph both; send the photo.
