# A damaged database

BORN checks its own local data — the sermon search index and the Bible/songs
library — for damage every time it starts.

## What happens if a file is damaged

If either one is found corrupted (most often from the computer losing power or
crashing mid-write), BORN:

1. **Keeps the damaged file** — it's renamed (e.g. `library.db.corrupt-<date>`),
   never deleted, in case support needs to look at it later.
2. **Rebuilds a fresh copy automatically** — the Bible/songs library rebuilds
   immediately; the sermon search index rebuilds the same way it did the very
   first time BORN ran, which needs an internet connection.
3. **Tells you, in plain language** — a warning appears in the footer (sermon
   data) or in the app-info popover reached by clicking the footer (library
   data): *"Your local [sermon / Bible/songs] data was damaged — it's been reset
   and [is rebuilding now / restored]. The damaged file was kept, not deleted, in
   case support needs it."*

Nothing you've saved is affected — your settings, channel/output setup,
presentation profiles, saved service files, and any songs imported yourself are
untouched. Only the large built-in reference data (which can always be rebuilt)
is ever reset this way.

## If the sermon warning doesn't go away

The sermon index needs an internet connection to rebuild. If it's stuck showing
**Preparing sermon database — search needs an internet connection the first
time**, connect this computer to the internet and click **Retry** (next to that
message in the footer).

## Finding the damaged file, or BORN's data folder generally

Click the footer (bottom-left, shows "BORN v*version*") to open the app-info
popover, then **Open data folder**. This opens the exact folder holding BORN's
settings and local databases — including any `.corrupt-<date>` file kept from a
past recovery — in the file manager, ready to send to whoever handles tech
support if they ask for it.
