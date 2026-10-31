# Library snapshots

BORN ships with three libraries built in: the sermons, the Bible (KJV, WEB, ASV) and the songs. They used to be rebuilt from the outside
sites on every release. When the Bible site was busy (it answers "429 Too Many Requests"), a release had to be retried, once four times.
Release builds now use a **library snapshot** instead and never contact those sites.

## What a snapshot is

- **A pre-release in this repo**, tagged `libraries-v1-YYYYMMDD` (for example `libraries-v1-20261031`).
  - It holds two files and nothing else: `sermons.db.gz` and `library.db.gz` (Bible and songs).
  - Its notes say only "Library snapshot used by release builds".
  - Being a pre-release, it is never offered by BORN's own update check.
- **`scripts/data/library-snapshot.json`** (the manifest) names the snapshot that release builds use. It records, with no text from the libraries:
  - the size and SHA-256 of each file;
  - the sermon library's format number (the app's own `SERMON_DB_FORMAT`);
  - the date it was built;
  - the exact counts (sermons, paragraph rows, Bible translations and verses, songs and song slides);
  - the comparison it passed before it was published.

## How a release uses it

The `build-db` job of `release.yml` runs `scripts/data/fetch-library-snapshot.mjs`. It works in four steps:

1. It downloads the two files from the snapshot named in the manifest.
2. It checks each file's size and SHA-256 against the manifest.
3. It runs `scripts/qa/verify-libraries.cjs` with the exact counts from the manifest.
4. If anything differs (a file is missing, a checksum is wrong, a count is off), the build stops with the snapshot's name. It does **not** fall back to the outside sites.

Everything after that is unchanged: the library check, both builds, the smoke tests and the published installers. The manual dry run (Actions > Release > Run workflow) uses the snapshot too.

## Refreshing the libraries on purpose

Do this when the sources have changed and the release should pick up the change, or when the build scripts change. Pick a quiet time; the run takes an hour or so.

1. **Actions > refresh libraries (manual) > Run workflow** (on `main`).
   - Leave **allow_changes** off for a plain refresh.
   - Turn it on only when you expect corrected sermon, Bible or song text.
2. The workflow builds the libraries from the sources once. It goes slowly and waits whenever the Bible site says it is busy.
3. It compares the result with the snapshot release builds use today, using `scripts/data/check-library-refresh.py`, which calls `scripts/data/compare-sermon-dbs.py`. The comparison requires:
   - no sermon missing;
   - every sermon's text identical (or the differences listed by sermon code);
   - paragraphs, not sections;
   - every Bible verse and song identical;
   - the same counts.
4. Only if that passes does it publish the new snapshot pre-release, and it pushes a branch `library-snapshot/libraries-v1-YYYYMMDD` with the updated manifest. Then it opens a pull request; where Actions may not open one, it prints the link to open it.
5. **Merge that pull request.** Until it is merged, releases keep using the previous snapshot.

## If a refresh fails

Nothing is published and nothing changes for releases: they keep using the current snapshot.

| What failed | What to do |
|---|---|
| A build step (a site busy for over an hour, or down) | Run it again later |
| The comparison | The log lists what differs, by sermon code and counts. If the differences are expected corrections, run it again with **allow_changes**. A missing sermon or one left in sections always fails; that needs a look at the source or the build script first |

## Rules

- **A snapshot tag must never start with `v`.** `release.yml` builds and publishes every tag that is `v1.MINOR.PATCH`; snapshot tags start with `libraries-`.
- **Keep the last three snapshots.** The workflow never deletes any; remove older ones by hand if wanted, never the one the manifest names.
- **Never commit the library files themselves.** Only the manifest belongs in the repo.
