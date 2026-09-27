# BrewCast

BrewCast is an FCast-compatible receiver for Samsung Tizen TVs, delivered as a
[TizenBrew](https://github.com/reisxd/TizenBrew) **app module**. The GitHub repo is
`BlindeCode/tizenbrew-brewcast` (renamed from `TizenBrew-FcastReceiver`), and TizenBrew users will
install it as `gh/BlindeCode/tizenbrew-brewcast`.

The code started as FUTO's deleted Tizen receiver from `futo-org/fcast` (MIT). It speaks FCast
protocol v4 (with v2/v3 fallback) and works end to end in local tests, but hasn't been tried on a
TV or published yet. `docs/gap-analysis.md` has the status and what's still open.

## How it fits together

TizenBrew serves the module's pages from `http://127.0.0.1:8081` and runs `serviceFile` in its own
Node service. The root `package.json` is the TizenBrew module manifest.

- **Service** (`receivers/tizen/service/`, bundled to `dist/service/service.js`): TCP listener on
  46899, mDNS, protocol sessions, play preparation. `Main.ts` also exports the getters that shared
  code imports as `src/Main`. `Ipc.ts` is the page channel: SSE + POST on `127.0.0.1:46897`.
  `Platform.ts` wraps the TV: device name, storage in `/home/owner/share`, and opening the module via
  TizenBrew AppControl.
- **Pages** (`receivers/tizen/src/`): `main` (QR code, connection info) and `player`, with the
  renderers from `receivers/common/web`. `ServiceClient.ts` talks to the service. Pages switch with
  `location.replace` and hand the play over in `sessionStorage` (`playData`).
- **Protocol** (`receivers/common/web/`): `FCastSession.ts` and `TcpListenerService.ts` handle
  v1-v4. v4 lives in `v4/`: `Codec.ts` translates v4 FlatBuffers to and from the v2/v3 message model
  that everything else uses, and `Certificate.ts` makes the self-signed ECDSA P-256 identity whose
  SPKI hash is the `fp` fingerprint. `v4/generated/` is flatc output, so don't edit it; run
  `scripts/generate-v4.sh` with flatc at the `flatbuffers` npm version. `DiscoveryService.ts` is a
  small mDNS responder on `multicast-dns`.
- `receivers/tizen/FCastReceiverService/` (C#) and the `.wgt` scripts are upstream's old path. The
  pages no longer speak MessagePort, so a `.wgt` built from them won't work with that service.

Keep the `receivers/{tizen,common}` layout. The webpack and tsconfig files import shared code via
`../common/web` (alias `common/*`). Node packages used from `receivers/common` go through the
`modules/*` alias, because `common/` has no `node_modules`.

## Commands

```bash
cd receivers/tizen
npm ci                   # the SessionStart hook runs npm install in cloud sessions
npm test                 # jest: v4 certificate, codec and socket-level session tests
npm run build            # webpack -> dist/{main_window,player,assets,service}
npm run build:module     # build + copy into <repo>/module/ (what TizenBrew loads)
npx eslint src service test
# Shared files: run eslint from receivers/ with -c tizen/eslint.config.mjs
```

Runtime constraints: the service bundle must parse on older TV Node versions, so dependencies are
compiled to ES2018 and memfs is pinned to 4.17.2 (newer versions contain BigInt literals). v4 needs
Node 12+ (TLS 1.3); `v4UnsupportedReason()` turns it off otherwise, and then nothing may advertise
`fp` or version 4. After a v4 upgrade, a session must only send Flatbuf/Ping/Pong.

Interop testing (not in the repo): upstream's workspace can't be built here, because its git deps
live on gitlab.futo.org. Instead, copy `senders/terminal` into the scratchpad as a standalone crate
that points at `sdk/sender/fcast-sender-sdk`, and add a `--fp` flag. Run the service with
`BREWCAST_DATA_DIR=<dir> node <sandbox> module/service/service.js`, where the sandbox mimics
TizenBrew's `serviceLauncher.js` (`vm.runInContext`).

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
