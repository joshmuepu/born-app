# Glossary

Plain-language definitions, using the exact words you'll see in Born Again itself.

**Show** — Send this to the screens now. One word, everywhere: the **Show** button on a
verse, paragraph, song, picture or search result, **Show next** in the live box, and
**Show on the screens** for the tape's text. (Older versions said "Project" and "Take".)

**Next / Back** — Step through the service queue. They never hide anything.

**Hide screen / Show screen** — The blackout: the screens go black and your place is
kept. **Esc** does the same; **Shift+Esc** also pauses the tape. On the phone it is the
same pair of words.

**Clear** — Remove the text from a channel's output but keep the screens on.

**Projection** — The window the congregation sees: **Open projection** / **Close projection**.

**Channel** — A separate, independent feed of live content. Most services use
only the built-in **Main** channel; a church running a second language can add a
second channel that tracks Main's navigation (**Follow Main**) while showing its
own translation, or runs completely on its own (**Independent**). A channel never
knows which display or Graphics output it ends up on.

**Destination / Output** — Wherever a channel's content actually gets shown: a
window (the Congregation screen, the Stage monitor) or a **Graphics output** (a
web page for OBS or another viewer). A destination has no content of its own —
only whatever channel is currently routed to it.

**Display** — Any physical screen your computer can show something on: a TV, a
projector, a monitor. Born Again tells displays apart by model + resolution, plus an
operator-given name if you've set one (see [Connecting & naming
displays](setup/displays.md)).

**Congregation** — The display the congregation looks at; Born Again's main projected
output.

**Stage monitor** — An optional second display facing the stage/platform, showing
the current slide (and what's next) for whoever is speaking or leading worship.

**Profile** — How a Graphics output lays out live content: **Full-screen**
(replaces the whole frame, solid background) or **Lower third** (a transparent
caption band over other video). **Auto** picks between them based on content type
(songs → Lower third, Bible/quotes → Full-screen).

**Follow** (**Follow Main**) — A channel sync setting: this channel automatically
tracks Main's navigation, re-resolving the same content in its own translation.
The alternative is **Independent** — driven on its own.

**Fallback** (shown as **Fallback: English**) — When a following channel's own
translation has no version of the current content, Born Again shows the English
version instead rather than a blank screen, and marks it as a fallback.

**Browser Source** — OBS Studio's term for a source that renders a web page.
Born Again's Graphics output is designed to be pasted into a Browser Source so a
livestream shows the same live content the room sees.

**Automatic** — The default display choice for Congregation/Stage: pick a sensible
external display without the operator naming one specifically.
