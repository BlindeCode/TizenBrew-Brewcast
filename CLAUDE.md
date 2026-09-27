# BrewCast

BrewCast is an FCast-compatible receiver for Samsung Tizen TVs, delivered as a
[TizenBrew](https://github.com/reisxd/TizenBrew) **app module**. The GitHub repo is
`BlindeCode/tizenbrew-brewcast` (renamed from `TizenBrew-FcastReceiver`), and TizenBrew users will
install it as `gh/BlindeCode/tizenbrew-brewcast`.

The code started as FUTO's deleted Tizen receiver from `futo-org/fcast` (MIT). It doesn't run as a
TizenBrew module yet. Read `docs/gap-analysis.md` before planning new work.

## Layout

- `receivers/tizen/`: Tizen app. `src/` is the web UI (main and player pages), `lib/` holds Tizen
  helpers, `FCastReceiverService/` is upstream's C# .NET background service, and there's a webpack
  config and scripts.
- `receivers/common/`: shared TS (`web/`) and assets from upstream's receivers. It has the protocol
  (`Packets.ts`, `FCastSession.ts`), the TCP listener, the player and the UI.
- `docs/`: project notes.

Keep the `receivers/{tizen,common}` layout. `webpack.config.js` and `tsconfig.json` import shared
code via `../common/web` (alias `common/*`).

## Commands

```bash
cd receivers/tizen
npm ci          # the SessionStart hook runs npm install in cloud sessions
npm run build   # webpack -> dist/, copied to FCastReceiver/dist/ on success
npx eslint src  # lint (6 pre-existing unused-var/prefer-const errors from upstream)
```

`npm run build` currently fails. `src/*/Preload.ts` import `common/main/Preload` and
`common/player/Preload`, which upstream removed in b1850e3. There are no tests yet (`npm test` is
upstream's placeholder). The signed `.wgt` path (`scripts/build.sh`, Tizen Studio, .NET) can't run in
cloud sessions.

## Upstream reference: `../fcast-upstream` is READ-ONLY

`../fcast-upstream` is a blobless clone of `https://github.com/futo-org/fcast`, created or updated by
`scripts/fetch-upstream.sh` (run automatically by the SessionStart hook in cloud sessions). It's there
to read and compare against. **Never edit, commit, push, check out branches or run builds there.** If
something from upstream is needed, copy it into this repo in a commit that names the upstream ref.
`.claude/settings.json` also denies `Edit(../fcast-upstream/**)`, but that rule is unverified (the
docs don't cover `../` patterns), so this note is the rule.

Useful refs:
- `tizen-v1.0.0`: the released Tizen receiver (protocol v2). Imported in commit 355afee.
- `5c79300`: the last commit before Tizen/webOS were removed (8d4fc4f). Imported in eca9d9e. Diff
  the two to see what upstream changed after the release.
- `origin/master`: current protocol docs in `docs/docs/protocol/` (v1–v4), the reference
  implementation in `crates/fcast-protocol/`, and `TRADEMARK.md`.
- The tizen/webOS tree at a given ref: `git -C ../fcast-upstream show <ref>:receivers/...`.

## Naming, IDs and trademark rules

FCast is a registered trademark of FUTO (see upstream `TRADEMARK.md`):
- The app name is **BrewCast**. Never call it "FCast Receiver", "FCast Player", "FCast for TV",
  "FCast <anything>", or publish a package named like `fcast-receiver`. Descriptive wording such as
  "FCast-compatible" or "supports the FCast protocol" is fine.
- The FCast logo must not be BrewCast's icon or appear as its logo. The app icon is
  `receivers/tizen/assets/icons/brewcast.svg` (PNG copies: `assets/icons/largeIcon.png`,
  `FCastReceiver/icon.png`, `FCastReceiverService/shared/res/icon.png`). Showing the FCast logo to
  signal compatibility is allowed.
- Keep the disclaimer in `README.md`: "This application is an independent community implementation
  of the FCast protocol. It is not affiliated with FUTO. FCast is a registered trademark of FUTO."
- Keep FUTO's copyright line in `LICENSE`.

Our IDs, which must never be FUTO's:
- Tizen package `smqfcwo4ld`, app `smqfcwo4ld.brewcast`
- service `io.github.blindecode.brewcastservice`
- widget id `https://github.com/BlindeCode/tizenbrew-brewcast`

Internal names (`FCastReceiver/`, `FCastReceiverService/`, `FCastSession`) are upstream's and are
kept on purpose to keep the diff against upstream readable. Don't rename them just for style.

## Conventions

- The code is upstream TypeScript: 4-space indent and single quotes. Match the surrounding file.
- Upstream's `.gitlab-ci.yml` in `receivers/tizen/` is inert (FUTO's GitLab runners and registry).
- mDNS service name `_fcast._tcp` and port 46899 are protocol constants, not branding.
