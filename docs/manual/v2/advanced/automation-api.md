# Automation API

HTTP + WebSocket control for a macro pad (Stream Deck, Bitfocus Companion,
or anything else that can fire an HTTP request or hold a WebSocket open).
This is a thin adapter over the exact same internal functions the operator
console and BORN's own phone remote already call — no capability exists
here that isn't already reachable some other way.

Served by the same HTTP server as the phone remote and the Graphics
outputs, on the same port (`BORN_REMOTE_PORT`, default `4316`; the base URL
is shown in the desktop app's Remote panel).

## Versioning

Every route exists at two paths:

- **`/api/v1/...`** — the versioned path. Use this for anything you're
  configuring today.
- The same route's original, unversioned path (e.g. `/api/automation/next`,
  `/command`, `/state`) — kept working forever as a plain alias, so an
  already-saved Stream Deck/Companion button never breaks just because a
  versioned path was added later.

A future breaking change gets a new `/api/v2/...` surface, added the same
way — `/api/v1/...` keeps meaning exactly what it means today.

`/output/graphics/:id` (the actual Browser Source page/SSE feed you paste
into OBS) and `/` (the phone remote's own page) are **not** versioned and
never move — those are pasted into another product's configuration, not
called as an API.

WebSocket messages (see below) carry a `"v"` field in the message body
itself, since a long-lived connection doesn't have a per-message path to
version against.

## Authentication

Off by default — every route below is reachable with no credentials,
matching the existing phone remote's own posture. An operator can turn on
a shared token in the desktop app's Remote panel ("Automation API" →
"Require a token"). Once set, every request (HTTP and the WebSocket
handshake) must include it as **either**:

- an `X-Born-Token` header, or
- a `?token=` query string parameter

A request with a missing or wrong token gets `401`. A WebSocket handshake
with a missing or wrong token is rejected before it upgrades.

## HTTP routes

All under `/api/v1/automation/` (or the unversioned `/api/automation/`
alias).

| Method | Path | Effect |
|---|---|---|
| `POST` | `/next` | Advance the Main operator console's current item/slide — identical to the phone remote's own Next. Only has an effect while the Main window is open (queue navigation lives in that window's own state). |
| `POST` | `/prev` | Same, in reverse. |
| `POST` | `/clear/<channelId>` | Clear that channel's current content (there's no dedicated "Clear" button in the operator UI today — the closest equivalents are Hide/Show screen, which blanks the whole channel instead of removing its loaded content, and simply projecting something else). |
| `POST` | `/blank/<channelId>` | Blank that channel (congregation screen goes black; a Graphics output on it reports blanked). |
| `POST` | `/show/<channelId>` | Un-blank / re-assert that channel's current content. Does **not** accept a content payload — it shows whatever is already current on that channel, the inverse of blank. |
| `GET` | `/state` | Read-only snapshot of every channel: `{ id, label, current, blanked }[]`. `current` is `null` when nothing is live. |

`<channelId>` is `main` for the default channel, or a channel's own id
(visible in the desktop app's Channels section).

All `POST` routes return `204` with an empty body on success. `GET /state`
returns `200` with a JSON array.

## WebSocket

`wss://<host>/api/v1/automation/ws` (or the unversioned
`/api/automation/ws` alias). Sends one message immediately on connect, then
roughly once a second after — a push feed for an LED/text feedback light,
not a frame-accurate event stream. Every message has the same shape:

```json
{ "v": 1, "state": [ { "id": "main", "label": "Main", "current": null, "blanked": false } ] }
```

`state` is exactly the same shape `GET /state` returns. There is no way to
send commands over the WebSocket — issue those as the `POST` requests
above; the socket is read-only.

## Example: Stream Deck via Bitfocus Companion

Use Companion's "Generic HTTP" module. For a "Next" button:

- Method: `POST`
- URL: `http://<born-host>:4316/api/v1/automation/next`
- Header (only if a token is set): `X-Born-Token: <your token>`

For a feedback light showing whether Main is blanked, use Companion's
generic WebSocket feedback against `ws://<born-host>:4316/api/v1/automation/ws`
and read `state[0].blanked` from each incoming message (`state[0]` is
whichever channel you're watching — match by `id`, not array position, if
you're driving more than one channel).
