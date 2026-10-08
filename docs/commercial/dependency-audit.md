# BORN v2 — Dependency & Licensing Audit

*Prepared 2026-10-08, for internal use ahead of any commercial decision about BORN.
This is a read-only inventory — no code was changed, no features were added.*

**How to read this document:** every item below is rated **Low / Medium / High**
risk *for commercial use specifically* (selling BORN, or distributing it beyond
free/open-source use), with a one-line reason. Where something couldn't be
verified from the repository alone, it's marked **unknown, needs human or legal
check** rather than guessed at. Nothing here is legal advice — it's a factual
starting point for that conversation.

---

## 1. Content sources

### 1.1 Sermons (William Branham quotes)

- **Source:** a single host, `https://table.branham.org/rest` (`src/main/tableApi.ts:9`). Every sermon-related call — index listing, full text, search, autocomplete, series/state/city/date browse groups, subtitles — goes through one `post()` helper (`tableApi.ts:11-19`) to one of 11 sub-paths on this same host. No other sermon-content host exists anywhere in the codebase.
- **How fetched:** a prebuilt `sermons.db.gz` (built by `scripts/build-sermon-db.ts`, which itself pulls every sermon from table.branham.org) ships with the app and seeds the user's local SQLite DB on first launch (`src/main/db.ts:30-45`) — so normal use is **fully offline** after install. Live network calls to table.branham.org still happen automatically but are *usually dormant*: the indexer only re-queries if the local index is empty (`src/main/indexer.ts:38-39`), and `sermon:search` only falls back to a live server search if the local sermon count drops below 100 (`src/main/index.ts:1699`). Autocomplete, Browse→Series/State/City, and "Refresh index" are **live, user-triggered or incidental-to-typing** calls that always hit the network.
- **Translations:** fetched from the **same** table.branham.org host, same endpoint, with a `Language` parameter (63 language codes, including `fr` for French — see `src/shared/sermonLanguages.ts:10-88`). Cached locally after first fetch (`translated_paragraphs` table, `src/main/index.ts:2578-2589`).
- **Terms/limits found in the repo:** **NOT FOUND.** No LICENSE/NOTICE file anywhere, no code comment citing table.branham.org's own terms of use, no statement of what's permitted for a redistributed/commercial app. The only license text in the repo is BORN's own (`README.md:81-83`, MIT, which cannot license someone else's content anyway).
- **What happens if it disappears or blocks us:** the bundled `sermons.db.gz` means the app keeps working **offline** with whatever was indexed as of the last release build — but every release's build pipeline re-fetches from table.branham.org (`README.md:62-63`: "CI runs these on every release"), so an ongoing block would stop *future* releases from getting new/updated sermon content, not break the currently-installed app.
- **Risk: HIGH.** This is the core subject and differentiator of the entire app (search the Branham corpus), fetched live from one third party's unofficial-looking REST API with zero documented permission for bundling/redistribution, let alone commercial redistribution. **Needs a direct legal check with table.branham.org's operator (or the William Branham Evangelistic Association / Voice of God Recordings, if they're the rights holder) before any commercial step** — this is not something the repo can resolve on its own.

### 1.2 Bible translations (KJV, WEB, ASV, FRLSG)

- **Source:** all four translations are **bundled**, built at release time from a third-party API, **bolls.life** — `scripts/build-library-db.ts:81`: `https://bolls.life/get-text/${bollsCode}/${bookNum}/${chapter}/`. Not fetched at runtime; the built, gzipped DB (`resources/library.db.gz`) seeds the user's local DB on first launch (`src/main/libraryDb.ts:28-43`), so Bible lookup is fully local/offline from then on.
  - ⚠️ **Documentation/code mismatch found:** the build script's own header comment (`build-library-db.ts:3`) says the Bible data comes "via bible-api.com," but the code that actually runs (`build-library-db.ts:81`) calls **bolls.life**, a different service. This is a real, verifiable inconsistency in the project's own documentation of its data sourcing — worth noting as evidence that this wasn't rigorously tracked at the time.
- **Public-domain status:** KJV, WEB, and ASV are **well-established public-domain texts** in the US (this is common, well-documented knowledge, not something that needs bolls.life's say-so). **FRLSG** (`build-library-db.ts:56`, "Louis Segond") is an 1880s French translation, also very likely public domain by age, but this repo's only "evidence" for any of the four is a developer's own unsourced comment (`build-library-db.ts:51`: *"bolls.life: public-domain translations"*) — not a citation to any actual legal determination.
- **Terms/limits found in the repo:** **NOT FOUND.** No notice of bolls.life's own API terms (rate limits, whether commercial bundling/redistribution of their formatted text is permitted) anywhere in the repo.
- **What happens if it disappears or blocks us:** no impact on the installed app (fully bundled/offline); it would only block *rebuilding* `library.db.gz` for a future release.
- **Risk: MEDIUM.** The underlying texts themselves are very likely safe (centuries/100+ years old, standard public-domain translations) — the real open question is narrower: **does bolls.life's own API license permit using their formatted output as the basis of a bundled, commercially-distributed product?** That's a quick terms-of-service check, not a deep legal question, but it hasn't been done. **Needs: a read of bolls.life's API terms.**

### 1.3 Songs / songbooks — the highest-risk item in this audit

- **Source:** `Songs.zip` at the repo root (1,164 real song files, in native **ProPresenter 7** binary format) is unzipped at build time (`npm run prepare:songs`, `package.json:18`) into `resources/songs-source/Songs/`, then parsed and baked into the bundled `library.db.gz` (`scripts/build-library-db.ts:142-176`). Every user who installs BORN gets all 1,164 songs, with no license, author, or CCLI metadata attached — the ProPresenter7 parser (`src/main/songParsers/proPresenter7.ts`) doesn't even extract copyright/author/CCLI fields, unlike the OpenLyrics/OpenSong/ChordPro parsers, which do.
- **Provenance:** **NOT FOUND anywhere in the repo.** No README/commit/comment states who compiled this song set or under what rights. The folder structure (1,164 `.pro` files + 1,164 macOS resource-fork sidecar files) is a strong technical signature of a ZIP made directly from someone's real ProPresenter library folder on a Mac — consistent with (but not proof of) an informally-shared church ProPresenter library, the kind commonly passed between churches without licensing paperwork.
- **⚠️ Confirmed non-public-domain content, found by direct inspection:** scanning the 1,164 files for embedded copyright/publisher strings found exactly one with explicit credit text — **"Greatly Blessed Highly Favored.pro"**, crediting author **Larry Gatlin / William J. Gaither** and publishers **Mike Curb Music / Gaither Music Company** (an actively-administered, commercially-published song, not public domain). The other 1,163 files mostly lack embedded metadata (the binary format doesn't reliably carry it), **but several titles are well-known, actively CCLI-registered contemporary worship songs** — e.g. "Above All" (Michael W. Smith / Paul Baloche) — meaning the library is very likely a **mixed set of public-domain hymns and copyrighted contemporary songs**, not the public-domain-only hymnal the app's online-import feature (below) is careful to restrict itself to.
- **Contrast — the *online* import feature does this correctly:** Hymnary.org and hymntime.com ("Cyber Hymnal") imports are explicitly, programmatically gated on public-domain status (`src/main/hymnary.ts:248-251` hard-rejects anything not labeled `"Public Domain"`; `src/main/cyberHymnal.ts:190-199` uses a softer pre-1929 heuristic and flags anything uncertain for the operator to manually confirm). **The bundled Songs.zip library has no equivalent check at all** — it's just baked in wholesale.
- **Risk: HIGH — the single biggest content-licensing risk found in this audit.** BORN currently ships, to every installer, at least one confirmed commercially-copyrighted song with no license and no CCLI record, plus very likely dozens more. This is concrete and actionable, not speculative: **every one of the 1,164 bundled songs needs a copyright/CCLI check before any commercial distribution**, and the ones that aren't clearly public domain need either a real CCLI/licensing arrangement or removal from the bundle.

### 1.4 Announcements / other text content

- **NOT FOUND.** There is no "announcements" content type or feature anywhere in the app (confirmed by a repo-wide, case-insensitive search). No other bundled text-content source (liturgy, creeds, etc.) exists beyond sermons, Bible, and songs above.

### 1.5 Images, audio

- **No audio files** exist anywhere in the repo (checked `.mp3/.wav/.ogg/.m4a`, repo-wide).
- **Images** are covered under §4 (Assets) below — they're app icons and in-app screenshots, not a "content source" in the sermons/Bible/songs sense.

## 2. Third-party services and APIs

All network access in the app is confined to the main process (`src/main/**/*.ts`
— confirmed no `fetch`/`http(s)://` calls exist in renderer, preload, or shared
code). **No analytics, telemetry, or crash-reporting SDK is present anywhere**
(no Sentry/Bugsnag/Mixpanel/Amplitude/PostHog/Segment/GA, and Electron's
built-in `crashReporter` is never invoked). **No request anywhere carries an API
key, token, or Authorization header.** Five distinct external hosts are
contacted, all covered under Content sources above except the update-check pair:

| Host | Used for | Free / limits | Commercial-use terms | Trigger |
|---|---|---|---|---|
| `table.branham.org` | Sermon index/content/search (§1.1) | Unknown rate limits; no auth required | **Unknown — needs legal check** | Mixed: usually-dormant automatic indexing, plus live on search/browse/autocomplete |
| `bolls.life` | Bible text, build-time only (§1.2) | Unknown rate limits | **Unknown — needs a terms-of-service check** | Build-time only, not at app runtime |
| `hymnary.org` | Online hymn search/import (§1.3) | Unknown; loaded via a hidden browser window to pass their bot/JS challenge | Unknown, but the app only imports content Hymnary itself labels Public Domain | User-triggered only |
| `www.hymntime.com` ("Cyber Hymnal") | Online hymn search/import (§1.3) | Unknown | Unknown; **plain HTTP, not HTTPS** — see risk note below | User-triggered only |
| `api.github.com` | Update check (`src/main/updateCheck.ts:20,59`) | Public GitHub REST API, unauthenticated, generous standard rate limits | GitHub's API terms allow this kind of unauthenticated polling; standard practice | **Automatic, every app launch**, ~4s after window load (`src/main/index.ts:2686`), no visible opt-out and no consent prompt |
| `github.com` | Release page / installer download, after an update is found (`updateCheck.ts:87,111,116`) | N/A (direct file/page access) | Fine — BORN's own release assets on BORN's own repo | User-triggered (click-through after the automatic check above) |

**Data sent:** only what's needed for the feature in question — search queries,
sermon/song IDs, language codes, the app's own version string in a `User-Agent`
header. **No name, email, church identity, or usage/analytics data is sent
anywhere.** The hymntime.com calls do send a custom identifying User-Agent
(`BORN-app (+https://joshmuepu.com/born)`).

**Specific risk notes:**
- **`www.hymntime.com` is called over plain `http://`, not `https://`**
  (`src/main/cyberHymnal.ts:33`) — the only unencrypted external call in the
  app. **Risk: LOW-MEDIUM** — it's a read-only, user-triggered hymn lookup (no
  credentials, no write), but plain HTTP means the response (and thus imported
  lyrics) could in principle be tampered with in transit, and it's generally
  avoidable hygiene for a commercial product to clean up.
- **The GitHub update-check runs automatically on every launch with no visible
  opt-out.** **Risk: LOW** — GitHub's own API, no auth, no personal data, and
  this is extremely standard app behavior — but worth a line in any future
  privacy policy if BORN is commercialized, since "automatically contacts the
  internet on every launch" is a fact a commercial product's privacy
  documentation should state plainly even when benign.
- **table.branham.org and bolls.life have no documented rate limits or
  commercial-use terms anywhere accessible from this repo.** If either service
  throttles or blocks the app's build pipeline or (for table.branham.org) its
  live runtime calls, there's no fallback service — only the already-bundled,
  already-built local data. **Risk: MEDIUM** — an availability/business-continuity
  concern more than a legal one, but relevant to any commercial-reliability
  conversation.

## 3. Software licenses (npm dependencies)

BORN has **11 direct runtime dependencies** and **19 direct dev-only
dependencies** (build/test tooling that never ships inside the packaged app).
Including everything those pull in transitively, the full tree is **584
packages** (dev + runtime); the subset that actually ships inside the installed
app (runtime only, what `electron-builder` packages into the `asar` archive) is
**122 packages**.

A full machine-readable list of all 584 packages (name, version, license,
repository, publisher) is at
**[`docs/commercial/licenses.csv`](licenses.csv)** — generated via
`license-checker-rseidelsohn` directly against `package-lock.json`, not
hand-compiled, so it's complete and reproducible (`npx license-checker-rseidelsohn
--json` regenerates it).

### License breakdown (all 584 packages, dev + runtime)

| License | Count | Commercial risk |
|---|---|---|
| MIT | 446 | **Low** — permissive, no copyleft, attribution-only. |
| ISC | 72 | **Low** — functionally equivalent to MIT. |
| Apache-2.0 | 14 | **Low** — permissive; includes an explicit patent grant, which is a *plus* for commercial use. |
| BSD-2-Clause | 13 | **Low** — permissive. |
| BSD-3-Clause | 13 | **Low** — permissive. |
| BlueOak-1.0.0 | 9 | **Low** — a modern, OSI-style permissive license (used by some Node ecosystem packages); no copyleft. |
| MIT-0 | 2 | **Low** — MIT with the attribution clause removed; even more permissive. |
| Python-2.0 / PSF-2.0 | 2 | **Low** — permissive; these appear because `argparse` (a CLI-arg-parsing shim) ships a license file borrowing this language, not because any actual Python code is involved. |
| CC-BY-4.0 | 1 | **Low** — `caniuse-lite` (browser-compatibility data, build-time only); attribution-only, not code. |
| CC0-1.0 | 1 | **Low** — public-domain-equivalent. |
| 0BSD | 1 | **Low** — public-domain-equivalent (Microsoft's `tslib`). |
| WTFPL (and OR-combinations with it) | 4 | **Low** — WTFPL is an extremely permissive, if informally-worded, license; everywhere it appears here it's offered as *one option* in an OR with MIT/ISC, so MIT/ISC can be elected instead if WTFPL's wording is a concern. |
| **(MIT OR GPL-3.0-or-later)** | **1** | **Low, flagged per instructions** — see below. |

### The one GPL-family license found

**`jszip@3.10.2`** is dual-licensed **MIT OR GPL-3.0-or-later**. It's pulled in
by `mammoth` (used for `.docx` song-import parsing) and **does ship** in the
packaged app (it's in the 122-package runtime/production set, not just a
dev-tool). Because it's an *OR* dual-license, not AND, BORN (or anyone
redistributing BORN) can elect to use it under the **MIT** terms, which carries
no copyleft/source-disclosure obligation. This is the standard way dual-licensed
packages are safely used in commercial closed- or open-source products — as
long as nothing in the build process or documentation affirmatively elects the
GPL terms instead. **No other GPL, LGPL, or AGPL-licensed package was found
anywhere in the 584-package tree, direct or transitive.**

### Direct runtime dependencies (the 11 that matter most)

| Package | License | Used for |
|---|---|---|
| better-sqlite3 | MIT | Local SQLite database (bundles SQLite itself, which is **public domain**) |
| bonjour-service | MIT | mDNS advertisement for the mobile remote |
| fast-xml-parser | MIT | Parsing OpenLyrics/OpenSong song XML |
| lucide-react | ISC | UI icon set |
| mammoth | BSD-2-Clause | `.docx` → text extraction (song import) |
| markdown-it | MIT | Renders the in-app manual |
| pdfjs-dist | Apache-2.0 | `.pdf` → text extraction (song import) |
| qrcode | MIT | Mobile-remote QR code generation |
| react / react-dom | MIT | UI framework |
| ws | MIT | WebSocket server for the mobile remote/automation API |

Every direct runtime dependency is permissively licensed. **No action needed**
on this section beyond the jszip note above.

*(Dev-only dependencies — electron, electron-builder, electron-vite, vite,
vitest, typescript, testing-library, etc. — are all MIT or Apache-2.0 and never
ship inside the distributed app, so they carry no distribution obligations at
all; included in the CSV for completeness but not a commercial-use concern.)*

## 4. Assets

| Asset | Source | License | Risk |
|---|---|---|---|
| App icons (`build/icons/icon.{png,icns,ico}`) | Custom-made for this project — git history shows both added directly by the project's own author (Josh Muepu), no third-party sourcing indicator | Original work, owned by the author | **Low** |
| Mobile-remote PWA icons (`resources/remote-icons/icon-{180,192,512}.png`) | Same — added in one commit alongside the mobile-remote feature itself, by the same author | Original work | **Low** |
| **Inter-Variable.woff2** (`src/renderer/src/assets/fonts/`) | Bundled font file, loaded via local `@font-face` (no CDN) | **Not stated in the repo** — Inter is publicly distributed under the SIL Open Font License 1.1 by its publisher, which would be commercial-friendly, but this repo contains no license file or attribution alongside the bundled file itself | **Low, but unverified** — needs a quick confirmation that this exact file is an unmodified official OFL-licensed distribution |
| **JetBrainsMono-Variable.woff2** (same folder) | Same pattern | Same situation — publicly OFL-licensed by JetBrains, but unverified from this repo | **Low, but unverified** — same check needed |
| Icon set (UI icons throughout the app) | `lucide-react` npm package (the only icon library in use — confirmed no other icon package in `package.json`) | ISC (see §3) | **Low** — covered by the npm license audit already |
| In-app manual images (`docs/manual/v2/images/`, 26 files + 1 SVG diagram) | Real screenshots of the running app, captured by an automated script (`scripts/docs-screenshots.mjs`) — filenames all describe actual app UI states, nothing resembling stock photography or a third-party logo | Original (screenshots of BORN's own UI) | **Low** |
| Audio | **NOT FOUND** — no audio files anywhere in the repo | N/A | N/A |

**Overall: Low risk.** The only open item is confirming the two bundled font
files are genuine, unmodified copies of their publicly-OFL-licensed originals —
a five-minute check, not a legal question.

## 5. Branding

### BORN's own name

"BORN" and "Branham or Nothing" appear throughout the UI, manual, and
`package.json` (`productName: "Branham or Nothing"`, `appId:
"com.joshmuepu.born"`) — this is the product's own name, used consistently as
its own branding, not a third-party mark. **Risk: Low**, as BORN's own name —
but see the Branham-estate question below, since the product's *name itself*
invokes the subject's name directly ("Branham or Nothing"), which is a
different question from the sermon-content licensing in §1.1.

"William Branham" is named explicitly twice, both in `README.md` (describing
what the app searches), not in the in-app UI or manual. "Voice of God
Recordings" / "VOGR" do **not** appear anywhere in the repo.

### Third-party names/products mentioned

All of the following appear only as **instructional references** to other
software a user may pair BORN with — not bundled, not embedded logos, just
text in the manual/tooltips explaining integration:

| Name | Where | Nature |
|---|---|---|
| OBS / OBS Studio | Manual (`setup/graphics-obs.md` and others), in-app tooltips | Instructional — BORN exposes a browser-source URL OBS can consume |
| Stream Deck / Bitfocus Companion | Manual (`advanced/automation-api.md`), Remote panel UI | Instructional — BORN's automation API is designed to work with these |
| ProPresenter (7) | README, manual (`setup/songbooks.md`) | Instructional — BORN can *import* files in this format |
| GitHub | README | Informational — where releases are published |

Two names are **live integrations**, not just mentions (already covered above):
**table.branham.org** (§1.1) and **Hymnary.org / Cyber Hymnal** (§1.3) — these
are actual third-party services the app calls, which is a materially different
(and higher) risk category than a name appearing in a sentence.

**Risk: Low** for the instructional mentions (OBS/Stream Deck/ProPresenter/
GitHub) — this is normal, fair-use-style "works with X" documentation, not a
trademark or bundling concern. The live-integration names are already risk-rated
under Content sources / Third-party services above.

### LICENSE file — a real gap

**Confirmed twice independently: there is no `LICENSE`, `LICENSE.md`, or
`LICENSE.txt` file anywhere in the repo.** The only license statement anywhere
is `README.md:81-83`: "## License / MIT — joshmuepu.com" — a claim with no
backing license text. **Risk: Medium.** This doesn't block commercialization
(BORN's own code, as the author's original work, can be licensed however the
owner chooses going forward), but it's worth resolving before any commercial
step: anyone who already downloaded/forked the repo in good faith under the
README's MIT claim could reasonably believe they have MIT rights to the code
as it stood at the time, even with no formal LICENSE file. **Needs an owner
decision**, not a legal unknown — see the questions list below.

---

## Top 5 risks (summary)

1. **Bundled song library (`Songs.zip`, 1,164 songs) contains confirmed
   copyrighted content with no license or CCLI tracking.** One song
   ("Greatly Blessed, Highly Favored," Gaither/Curb) is directly confirmed
   non-public-domain by inspecting its own embedded metadata; several other
   titles are well-known, actively CCLI-registered contemporary worship songs.
   This ships to every installer today, with no per-song review. **Highest,
   most concrete, most actionable risk in this audit.**
2. **Sermon content (table.branham.org) has no documented license or
   commercial-bundling permission anywhere in the repo**, despite being the
   app's core subject matter and its entire reason for existing. Needs a
   direct conversation with table.branham.org's operator (or the rights
   holder, if different) before any commercial step.
3. **No `LICENSE` file exists for BORN's own code**, despite the README
   claiming MIT — an owner-level decision is needed on what license (if any)
   should formally apply going forward, and how to treat anyone who already
   used/forked the code under the README's MIT claim.
4. **Bible translation sourcing (bolls.life) is asserted public domain by an
   unsourced developer comment, and bolls.life's own API/commercial-use terms
   have not been checked.** The underlying texts (KJV/WEB/ASV/Segond) are
   almost certainly fine on their own merits as centuries-old public-domain
   works; the open question is narrower — bolls.life's terms for using their
   service as a data source.
5. **The online song-import feature's two safety checks aren't equally
   strong**, and one external call runs over plain HTTP: Hymnary.org's import
   path hard-gates on an explicit "Public Domain" field, but hymntime.com's
   path only uses a softer pre-1929-date heuristic and flags uncertain cases
   for manual confirmation — and that call happens over unencrypted `http://`.
   Lower severity than 1–4, but both are easy to tighten.

## Questions only the owner can answer

1. **Where did `Songs.zip` actually come from** — who compiled it, and was
   there ever any license, permission, or CCLI arrangement behind any of the
   1,164 songs in it? (This repo cannot answer this — it's not written down
   anywhere in the project's history.)
2. **What's the actual relationship/understanding with table.branham.org** (or
   whoever controls William Branham sermon content distribution) — was this
   ever discussed, even informally? Is there an existing understanding that
   personal/ministry use is fine but commercial use would need a separate
   conversation?
3. **What license should BORN's own code actually carry going forward?**
   The README says MIT, but there's no LICENSE file. Is MIT still the intent,
   or does commercialization change that?
4. **Is there a CCLI (or equivalent) account associated with this project or
   the churches it's been used in**, that any of the bundled songs could
   retroactively be covered under — or would licensing need to start from
   zero?
5. **How was `Songs.zip` actually used/distributed before now** — informally
   shared with specific churches, or publicly downloadable? This affects how
   much existing exposure there already is, separate from any future
   commercial decision.
6. **Is there a documented relationship between this project and the William
   Branham Evangelistic Association or Voice of God Recordings at all**
   (formal or informal), given the app's name and entire purpose center on
   that content?
