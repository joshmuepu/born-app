# Backups and a damaged database

BORN checks its own local data — the sermon search index and the Bible/songs
library — for damage every time it starts.

## What happens if a file is damaged

If either one is found corrupted (most often from the computer losing power or
crashing mid-write), BORN:

1. **Keeps the damaged file** — it's renamed (e.g. `library.db.corrupt-<date>`),
   never deleted, in case support needs to look at it later.
2. **Rebuilds a fresh copy automatically** — both the sermon library and the
   Bible/songs library are restored straight away from the copy that comes with
   BORN; no internet connection is needed.
3. **Tells you, in plain language** — a warning appears in the footer (sermon
   data) or in the app-info popover reached by clicking the footer (library data):
   *"Your local [sermon / Bible/songs] data was damaged — it's been reset and
   [is rebuilding now / restored]. The damaged file was kept, not deleted, in case
   support needs it."*

Nothing you've saved — your settings, saved service queue files, and any songs
you've imported yourself — is affected by this; only the large built-in reference
data (which can always be rebuilt) is ever reset this way.

## If your settings or your remembered queue can't be read

If BORN's settings file or the service queue it remembers between sessions is
found damaged, BORN starts fresh but **keeps the damaged file** next to the
others in the data folder, renamed (for example `queue.corrupt-<date>.json` or
`settings.corrupt-<date>.json`), instead of overwriting it the next time it
saves. Open the data folder (below) to find it; send it to whoever handles tech
support if they ask.

## If BORN says it can't save its data

If BORN's data folder is read-only, full, or on a drive that isn't there, BORN
shows a message with the folder's location and closes, rather than closing
without a word. Make the folder writable (or free up disk space) and open BORN
again.

## If the sermon warning doesn't go away

The sermon library is restored from the copy that comes with BORN. If the footer
is still stuck showing **Preparing sermon database**, connect this computer to the
internet and click **Retry** (next to that message in the footer): BORN then
fetches what is missing online.

## Finding the damaged file, or BORN's data folder generally

Click the footer (bottom-left, shows "BORN v*version*") to open the app-info
popover, then **Open data folder**. This opens the exact folder holding BORN's
settings and local databases — including any `.corrupt-<date>` file kept from a
past recovery — in the file manager, ready to send to whoever handles tech
support if they ask for it.
