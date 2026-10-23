# Needs owner decision (nothing here was built)

## A. A faster way to a far-down paragraph or slide
After the fixes, reaching a queued paragraph takes one click and under a second. What is still missing in v1, if you want it:
- type a **paragraph number** (or slide number) to jump inside an open sermon;
- a **"back to the queued paragraph"** button after the operator has scrolled away;
- a small **mini-map** or paragraph strip for 700+ paragraph sermons.

v1 has none of these: building one is a new feature, so it is left out of this hardening line.

Options: (1) do nothing in v1; (2) a paragraph-number jump box in the sermon reader as v1.14 (about one component, ~60 lines, plus CSS and tests — small, but a new control on the screen); (3) mini-map (larger, new design).
**Recommendation: (1) for v1.13.3 (ship the fixes only), and (2) in a later minor if operators still ask after using the fixes.**

## B. Whether to ship v1.13.3
The fixes are small, display-only and tested; Note 1 (Esc moves the list) is the one operators would feel in a service. Recommendation: release them as v1.13.3 after you press Esc once in the installed build during a projected sermon. Release, tag and version were not touched.

## C. Not changed on purpose
- A paragraph with no number shows no label at all when it is a single slide (previously "¶§id"); say if you would rather see "Slide 1".
- While the screen is hidden, the Bible and song lists show no "On screen" tag (the place is kept); the sermon reader keeps a normal marker.
