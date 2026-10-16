# YouTube — what needs counsel or the owner before it is promised publicly

Written for the owner. Information, not legal advice. The YouTube feature in `v2-youtube` is built to the *least* the rules allow: official embedded player only, official IFrame
Player API calls only, no downloading, caching, ripping, stream extraction, ad blocking or skipping, no scraping, no overlay on the player. The questions below are the ones that
were **left alone on purpose** because the right answer is not an engineering decision.

Sources are the ones already collected in `docs/design/media/06-youtube.md` (§4, §6, §10). Re-read the live terms before anyone relies on them; they change.

## 1. Ads and Premium
- BORN shows the player as YouTube serves it. **Ads may play, and BORN does nothing about them** — no blocking, skipping, muting-during-ads, speeding through, or hiding the player. The
  app only says so (manual page, add dialog, bar note).
- **Not known:** whether a YouTube Premium sign-in changes ads inside BORN's embedded player (no sign-in is built; Google also restricts sign-in in embedded browsers). A Premium
  claim must not be made in any wording until someone has tested it on the church computer. *Owner by-hand test listed in the report.*
- **Question for counsel:** is it acceptable for a church product to say nothing more than "ads may appear"? Any statement that BORN "removes" or "avoids" ads is **forbidden** (YouTube
  Developer Policies III.I.5).

## 2. Is a congregation showing "personal, non-commercial"?
The Terms of Service allow the embedded player but frame viewing as personal and non-commercial. Whether a church service (and a **paid** BORN) is inside that is a legal question —
not answered here. Also: public performance rights for the video itself are **separate** from YouTube's terms (see 06 §10B). BORN makes no claim that anything is cleared.

## 3. Alerts over video
YouTube forbids visual elements in front of any part of the player. **Shipped policy: `stage-only`** — an alert is never drawn on the congregation screen while a YouTube video is live
there; it goes to the stage monitor and the operator is told. The single switch is `YOUTUBE_ALERT_POLICY` in `src/shared/youtube.ts`.
- **Question:** is *re-laying-out* the screen (shrinking the player to make a band for an emergency alert — option A in 06 §6) acceptable? Not built. Until answered, an emergency alert
  during a YouTube video reaches the stage monitor and the operator only; the operator can press Clear.

## 4. Pointer-events and the player's own controls
The player frame on the congregation screen ignores mouse input (`pointer-events: none`) so a click in the room can never reach it, and YouTube's own keyboard shortcuts are turned off
(`disablekb`, a documented parameter). The player's controls and branding are **not hidden or restyled**; they simply cannot be clicked. **Question:** does making the frame
non-interactive count as "blocking functionality of the player"? We believe not (the operator drives the documented API), but it is a reading of the policy.

## 5. API terms, identification, privacy wording
- Using the IFrame Player API makes BORN an "API Client" under the YouTube API Services Terms. Recalled but **not re-verified**: required links to YouTube's terms/privacy policy and
  attribution wording in a commercial product. **To verify before any release.**
- **Identification (Error 153).** YouTube asks API clients to identify themselves with an HTTP Referer. BORN's windows load from `file://` (no usable origin), so the player is served from
  a local page on `http://127.0.0.1:<port>` and that origin is what YouTube sees. **Proven working** on a real public video from the file://-loaded app (see the report). An optional
  override that sets the embed's Referer to the app id (`com.joshmuepu.born.v2dev`) exists but is OFF (env `BORN_YT_REFERER=1`); it was not needed. **Question:** is a
  `127.0.0.1` origin acceptable identification long-term, or does YouTube expect the app-id form? Re-test on the Windows build.
- BORN makes a few requests to YouTube on its own: the player script (`https://www.youtube.com/iframe_api`) for the online check, the public oEmbed address for a title, and the
  `i.ytimg.com` preview picture in the operator's own window. **Question:** is any of that a data-protection disclosure the product must make?

## 6. Branding / attribution
BORN says "YouTube" and "Online" in its own words and uses a globe icon, **not** YouTube's logo. The player's own branding is untouched. **Question:** may BORN's UI say "YouTube" in
labels (nominative use), and is any attribution line required in the product or the manual?

## 7. Caching and stored metadata
- **Stored:** the 11-character video id, an optional operator name, the title text YouTube returned (with the time it was read), and an optional backup reference. A saved service and a
  `.bornpack` carry **only that** — never video, never a thumbnail.
- **Not stored:** thumbnails (shown live from `i.ytimg.com` in the operator's window only, never saved), any video data, any stream address.
- **Question:** YouTube asks that stored API data not go stale (30 days, Developer Policies III.E.4). BORN re-reads the title when an item is added; it does **not yet** refresh titles of
  old items automatically. Is a display-only title (with the operator's own label always winning) acceptable as is, or must stale titles be dropped after 30 days?
- Hidden "cue-only" player used by the online check: a cued, never-played player in a window nobody sees. **Question:** does that conflict with the rule about players "not displayed
  in the page or screen the user is viewing"? (Design 06 §3 chose it; counsel should confirm.)

## 8. Thumbnails on other screens
Other screens (stage, Graphics) show the **name only**, not YouTube's preview picture. **Question:** if the owner wants the picture there, is showing an `i.ytimg.com` thumbnail on
another output acceptable metadata use?

## 9. Not built, on purpose
Search (needs the Data API key, quota and terms), playlists, adding a link from the phone, live-stream/premiere handling beyond "can't be tested ahead", any ads handling beyond the
warning, offline copies of any kind, and any Premium/sign-in feature.
