# Versioning

`main` holds the released product, the one a real church installs and uses on
Sunday. It gets fixes and small improvements, shipped as `v1.x.x` GitHub
Releases.

## How releases are kept safe

- **Version numbers.** Ordinary `1.x.x` semver in `package.json`.
- **App identity.** The `appId` and `productName` (`package.json`) and the
  `app.setName()` call (`src/main/index.ts`) never change. They decide the
  install location, the macOS bundle identity, the Windows registry entry and
  the userData directory (settings, sermons.db, library.db), so changing them
  would make an update look like a different app.
- **Update checks.** `src/main/updateCheck.ts` only offers an update within
  the same major version (`sameMajor()`). GitHub's release feed returns
  whichever release is newest *by publish date*, not by version number, so
  without this guard an install could be offered a build of another major
  version.
- **The release workflow.** `.github/workflows/release.yml`'s tag guard only
  accepts `v1.x.x` tags; any other tag cannot trigger a public release, from
  any branch. A build can still be made and smoke-tested through the
  workflow's manual `workflow_dispatch` trigger, which never publishes.
