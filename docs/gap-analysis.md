# Gap analysis: imported code vs. current FCast and TizenBrew

Written 2026-09-27 from these sources:
- futo-org/fcast `master` at `d6953ca`, read via `../fcast-upstream`
- the two imported upstream refs, `tizen-v1.0.0` (`bf620b4`) and `5c79300`
- reisxd/TizenBrew at `14760a3`

Paths without a prefix are relative to this repo. `upstream:` paths are in `../fcast-upstream`, and
`tizenbrew:` paths are in the TizenBrew repo.

## Status (updated 2026-09-27)

What follows the status section is the original analysis, unchanged. Since it was written:

| Work order step ([§6](#6-proposed-work-order)) | State |
|---|---|
| 1. Fix the web build | **Done.** Upstream's lint errors are fixed too. The pages were also out of date with the shared renderers, so they now follow upstream's webOS pages. |
| 2. Probe module on a TV | **Not done.** The §5 questions are still open (see below). |
| 3. Node service | **Done** (`receivers/tizen/service/`), ported from the webOS service onto `common/web` at `5c79300`. |
| 4. IPC and launch | **Done:** SSE + POST on `127.0.0.1:46897`. Launching through TizenBrew AppControl is implemented but unverified. |
| 5. Discovery | **Done**, using `multicast-dns`, because `@futo/mdns-js` is only on FUTO's registry. TXT carries `v` and `fp`. |
| 6. Packaging | **Done:** the built module is committed in `module/` (rebuilt with `npm run build:module`; the build is reproducible). |
| 7. Cleanup of the C# / `.wgt` path | **Not done.** That path is now stale: the pages no longer speak MessagePort. |
| 8. Protocol v4 | **Done**, matching what FUTO's reference receiver (`crates/receiver-core`) does. See below. |

**Protocol v4 coverage.** Everything the reference receiver handles:
- The TLS 1.3 upgrade with a persisted ECDSA P-256 key and `fp`, the introductions, the heartbeat,
  and Error replies with packet numbers.
- Load (single item and queue); progress, state (including Buffering and Ended), volume and speed
  both ways; progress at the sender's SetProgressUpdateInterval.
- Queues, kept by the service (`service/MediaSession.ts`): QueueItemSelected, QueueInsert and
  QueueRemove with the reference receiver's checks and error kinds, `autoplay`, relays to the other
  senders (without request headers), and announcements when the TV or autoplay changes the item.
- TracksAvailable/ChangeTrack for video, audio and subtitle tracks (hls.js, dash.js, native), and
  AddSubtitleSource (WebVTT, plus SRT and ASS/SSA converted by the service).
- FCompanion, including media from one connection played through another
  (`service/Companion.ts`).
- Mirroring (StartMirroringSession/MirroringSessionDescription), with the player page as the WebRTC
  answerer. Advertised only when the TV's browser has WebRTC.
- Images (a viewer page), SeekOutOfRange clamping, and load errors reported as ResourceNotFound,
  UnsupportedFormat or Internal to the sender that loaded the media.
- `ReceiverIntroduction` capabilities come from what the TV's browser reports it can play.

Differences from the reference receiver, because the TV's browser can't do otherwise: "audio off"
mutes instead of dropping the track, and HLS video renditions are reported as one video track.

*Protocol limitation:* a v4 receiver can't be reached by a sender that connects by IP without
knowing `fp` (the SDK refuses to upgrade). That's inherent to the protocol, and the same for FUTO's
desktop receiver.

**How it was verified (in the dev container, not on a TV).**
- 44 jest tests pass, including socket-level tests of the queue, track, subtitle, companion and
  mirroring rules.
- End to end, 43 checks: upstream's Rust sender SDK (scripted) drives the built module, with the
  pages in Chromium and the service in a copy of TizenBrew's service sandbox. It covers queues with
  autoplay (video, image, video), queue edits and their errors, autoplay off, transport and progress
  intervals, HLS audio/subtitle switching, external subtitles, FCompanion playback and seeking,
  relays between two senders, error kinds, mirroring from a browser peer, and a raw v3 JSON sender.

**Still unknown until tested on a TV:** everything in [§5](#5-unknowns-that-need-a-real-tv).
Especially the Node version (v4 needs Node 12+; the bundle parses as ES2018), whether UDP 5353 and
TCP 46899 are usable from TizenBrew's service, whether AppControl launching works, which formats the
TV's player accepts, and whether its browser has WebRTC for mirroring.

## Summary

- **What we have.** A Tizen web UI (main page with a QR code, plus an HTML5 player using hls.js and
  dash.js) and a **C# .NET background service** that speaks **FCast protocol v2**. The shared TS in
  `receivers/common` is on **v3**, but on Tizen only the UI uses it. All networking goes through the
  C# service.
- **The build is broken at `5c79300`.** Upstream commit `b1850e3` (2025‑12‑16) removed
  `common/web/{main,player}/Preload.ts` and never updated the Tizen sources. The released
  `tizen-v1.0.0` code still builds.
- **v3 is enough for today's senders.** Upstream's sender SDK accepts v2 and v3 receivers. It
  refuses to downgrade from v4 only when the receiver advertised an `fp` fingerprint. v4 (TLS 1.3,
  FlatBuffers) can come later, but until it's implemented we must **never advertise `fp` or claim
  version 4**.
- **TizenBrew can't run the C# service.** The network side has to become a single bundled Node.js
  `serviceFile`. Upstream's **webOS receiver** already had a Node service built on the same
  `common/web` code (TCP listener, `FCastSession`, mDNS, media cache), so it's the template.
- **Some questions only a real TV can answer.** Which Node version TizenBrew's service runs on each
  Tizen release. Whether that service can listen on TCP 46899 and join mDNS multicast. How the
  service and the module page talk to each other. How the player gets brought up when a cast
  arrives. A small probe module should answer these before the real port starts (see
  [§6](#6-proposed-work-order)).

## 1. What the imported code implements

| Area | `tizen-v1.0.0` | `5c79300` (current tree) |
|------|----------------|--------------------------|
| UI pages | `src/main` (connection status, QR code), `src/player` (player) | same, plus `lib/common.ts` (key handling helpers) |
| Player | HTML5 `<video>` with hls.js and dash.js (`common/web/player/Renderer.ts`) | same, plus image/generic viewer and WHEP mirroring code in common (not wired into Tizen) |
| Network service | C# `FCastReceiverService` (Tizen.NET, `netcoreapp2.1`), shipped inside the `.wgt` | same |
| Transports | TCP 46899, WebSocket 46898 | TCP 46899 only (`3e1efb8` removed WS) |
| Protocol on the wire | C# sends `Version {version: 2}` (`FCastReceiverService/TcpListenerService.cs:141`) and handles opcodes 1–13 (`FCastSession.cs`, `Packets.cs`) | same. The C# code never got v3 |
| Discovery | Tizen native DNS-SD (`Tizen.Network.Nsd.DnssdService`) advertising `_fcast._tcp` and `_fcast-ws._tcp`, named `<Manufacturer> <Model>`, no TXT records | `_fcast._tcp` only |
| QR code | `fcast://r/<base64>` with `name`, `addresses`, `services: [{port: 46899, type: 0}]` (`common/web/main/Renderer.ts`) | same |
| UI ↔ service IPC | Tizen MessagePort `ipcPort` (`src/*/Preload.ts`, `SendAppMessage` in `FCastReceiverService.cs`) | same |
| Bringing the UI up on cast | The service polls for the UI app for ~20 s, then forwards `play` (`ReattemptOnPlay`) | same |
| Header proxying | `NetworkService.ProxyPlayIfRequired` (C#) proxies media that needs request headers | same |
| Remote keys | `tizen.tvinputdevice.registerKeyBatch` for media keys; Back exits | same |

The Node-side equivalents in `receivers/common/web` at `5c79300` are `TcpListenerService.ts`,
`ListenerService.ts`, `FCastSession.ts` (v3; defaults to v2 until the sender sends `Version`),
`DiscoveryService.ts` (uses `@futo/mdns-js`, TXT `version`/`appName`/`appVersion`),
`ConnectionMonitor.ts`, `MediaCache.ts`, `NetworkService.ts` and `UtilityBackend.ts`
(`preparePlayMessage`, including proxying). On Tizen none of these ran, because the C# service
replaced them. They expect the platform to provide a `src/Main` module that exports
`getComputerName`, `getAppName`, `getAppVersion`, `getPlayMessage` and `getPlaybackUpdateMessage`.

## 2. Upstream changes between the two imported refs

`git diff 355afee eca9d9e` shows the exact changes: 65 files, +5460/−1655.

- **Shared code (`receivers/common`, 95 commits, mostly made for Electron and webOS).**
  - Protocol v3: playlists, metadata, event subscriptions, `Initial`/`PlayUpdate`, and the media cache.
  - Connection monitor, unified logger, settings store.
  - Image and generic-content viewer, responsive UI, network/Wi‑Fi status UI, toast tuning.
  - mDNS fixes and `audio/x-flac` support.
  - Initial mirroring (`Whep.ts`); WebSocket support removed.
- **Tizen-specific.**
  - `30c2b9c` fix frontend build (2025‑10‑14)
  - `d320144` better local dev scripts
  - `940da67` certificate parse error fix
  - `f75e9bb` drop the WS mDNS advert
  - `3e1efb8` remove WebSocket
  - `92d4d3d` deprecation notice (2026‑04‑28)
- **The breakage.** `b1850e3` ("Electron: Add support for running in single-window", 2025‑12‑16)
  replaced `common/web/main/Preload.ts` and `common/web/player/Preload.ts` with a single
  `common/web/Preload.ts`. Neither TV receiver was updated. At `5c79300`, `npm run build` fails with
  10 errors per bundle, 18 TS errors in total:
  - `TS2307`: `common/main/Preload` and `common/player/Preload` not found (`src/*/Preload.ts:1`).
  - `TS2339`: `window.tizenOSAPI` unknown. The `declare global` for it now lives in
    `common/web/Preload.ts`, which Tizen doesn't import.
  - `TS2554`: a call-signature drift in `src/player/Renderer.ts`.

  The fix pattern is Electron's single `src/Preload.ts` that imports `'common/Preload'`, visible at
  `upstream: ed71376^:receivers/electron/src/Preload.ts`. Electron itself was removed in `ed71376`.
- **Lint.** `npx eslint src` reports 6 upstream errors (unused vars, `prefer-const`).

## 3. Protocol gaps against master's docs

Docs: `upstream: docs/docs/protocol/v{2,3,4}.md`. Reference code: `upstream: crates/fcast-protocol/`.

| Opcode | Name | v2 | v3 | v4 | C# service | `common/web` |
|-------:|------|:--:|:--:|:--:|:----------:|:------------:|
| 1–8 | Play, Pause, Resume, Stop, Seek, PlaybackUpdate, VolumeUpdate, SetVolume | ✓ | ✓ | — | ✓ | ✓ |
| 9–10 | PlaybackError, SetSpeed | ✓ | ✓ | — | ✓ | ✓ |
| 11 | Version | ✓ | ✓ | ✓ | ✓ | ✓ |
| 12–13 | Ping, Pong | ✓ | ✓ | ✓ | ✓ | ✓ |
| 14–19 | Initial, PlayUpdate, SetPlaylistItem, Subscribe/UnsubscribeEvent, Event | — | ✓ | — | ✗ | ✓ |
| 20 | Flatbuf (all v4 messages) | — | — | ✓ | ✗ | ✗ |
| 21 | Resource (FCompanion data) | — | — | ✓ | ✗ | ✗ |

Other v4 changes that nothing here implements:

- **Transport security.** After the plaintext `Version` exchange, the same TCP socket is upgraded to
  **TLS 1.3**, with the receiver acting as the TLS server using a self-signed certificate. Senders
  pin the SHA‑256 of its SPKI, published as the `fp` mDNS TXT record and in the QR code's `txt`.
- **Bodies.** v4 bodies are FlatBuffers (`upstream: crates/fcast-protocol/flatbuffers/fcast.fbs`),
  not JSON. The maximum packet is 512 KiB, versus 32 000 bytes in v3.
- **Discovery TXT.** v4 uses `v` (highest version) and `fp`. Our common code publishes `version`,
  `appName` and `appVersion`.
- **New features.** Tracks and subtitles, queue operations, chapters, WebRTC screen mirroring, and
  FCompanion (media served by the sender over the FCast connection). There's also a heartbeat
  policy: Ping after 3 s idle, drop after 6 s.

**What this means for compatibility today.** `upstream:
sdk/sender/fcast-sender-sdk/src/fcast.rs` handles `Version` 2, 3 and 4 (lines ~438–470). It refuses
a version below 4 only when `require_v4` is set, and that's true exactly when it knows the
receiver's fingerprint (`DeviceStateMachine::new(receiver_fingerprint.is_some())`, where the
fingerprint comes from the `fp` TXT record). So:

1. A **v3** receiver works with current SDK-based senders, and most of v3 already exists in
   `common/web`.
2. **Never** publish `fp`, or `v`/`version` ≥ 4, until TLS and FlatBuffers work. If we do, senders
   will either refuse the connection or attempt a TLS upgrade we can't complete.
3. v4 needs a TLS 1.3 server in the service. Node's `tls` module only supports TLS 1.3 from Node 12,
   so v4 is only realistic on TVs whose TizenBrew service runs a modern Node (see §5).

## 4. TizenBrew port gaps

How TizenBrew runs an app module, from `tizenbrew: docs/MODULES.md` and `service-nextgen/service/`:

- It loads `https://cdn.jsdelivr.net/<module>/package.json`, e.g.
  `gh/BlindeCode/tizenbrew-brewcast/package.json` (`utils/moduleLoader.js`). It needs
  `packageType: "app"`, `appName`, `appPath`, `keys`, and optionally `serviceFile`.
- The page is served through TizenBrew's local proxy at
  `http://127.0.0.1:8081/module/<module>/<appPath>`, which fetches from jsDelivr (`index.js`).
- `serviceFile` is downloaded from jsDelivr and run once with `vm.runInContext` in a sandbox that
  holds TizenBrew's globals, its `require`, and `tizen` (`utils/serviceLauncher.js`). It starts when
  the module launches, or at boot if the user adds the module to TizenBrew's auto-launch service
  list.
- Other apps can start a module by sending TizenBrew an AppControl request with
  `{moduleName, moduleType, args}`. TizenBrew then navigates to `appPath?args`
  (`tizenbrew-ui/src/components/WebSocketClient.js`).

| # | Gap | Current state | What's needed | Risk |
|---|-----|---------------|---------------|------|
| 4.1 | Module metadata | None; `receivers/tizen/package.json` is the webpack project | A **root** `package.json` with `packageType: "app"`, `appName: "BrewCast"`, `appPath` pointing at the built main page, `keys` (media keys), `serviceFile`. The npm name must not look like an official FCast package | Low |
| 4.2 | Built files reachable by jsDelivr | `dist/` is gitignored | Either commit build output (e.g. a `module/` dir, or a release branch/tag) or publish to npm and use `npm/<pkg>`. jsDelivr caches branch URLs, so releases should be tags | Low |
| 4.3 | Network service | C# (can't run under TizenBrew) | Single bundled Node file: webpack `target: node…`, all deps bundled, only Node builtins at runtime, sandbox `require` instead of `__non_webpack_require__`. Port from **upstream's webOS service** `receivers/webos/fcast-receiver-service/src/Main.ts` (webpack `target: 'node8.12'`). Read it against `webOS-v2.0.1`: at `5c79300` it had drifted from common too (e.g. it calls `preparePlayMessage` with 3 args; common now takes 2). Provide the `src/Main` exports that `common/web` expects | Medium |
| 4.4 | Node version | Unknown per TV | TizenBrew special-cases Node **v4.4.3** (Tizen 3.0: `index.js`, `utils/serviceLauncher.js`) and transpiles its own service with Babel. Pick a minimum Tizen version, then set the webpack/TS target to its Node | **High** until measured |
| 4.5 | Service ↔ page IPC | Tizen MessagePort | A localhost channel owned by our service, e.g. a WebSocket server on `127.0.0.1:<port>` (the pattern TizenBrew itself uses on 8081), or MessagePort if `tizen.messageport` works in both the sandbox and the module page. Port the message names from `src/*/Preload.ts` (`play`, `pause`, `seek`, `setvolume`, `connect`, `toast`…) | Medium |
| 4.6 | Showing the player on cast | C# `ApplicationManager` + AppControl | When the page isn't open, send TizenBrew an AppControl request (`{moduleName, moduleType, args}`) from the service via `tizen.application`. TizenBrew's app ID is `<its package>.TizenBrewStandalone` | **High**: unverified from the sandbox |
| 4.7 | Discovery (mDNS) | Tizen native DNS-SD | `common/web/DiscoveryService.ts` with `@futo/mdns-js` (pure JS over UDP multicast). `receivers/tizen/package.json` still lists `mdns-js` from GitHub instead, so add `@futo/mdns-js` (webOS used `1.0.3`). Fallback if UDP 5353 isn't available: the QR code, plus manual IP entry in senders | **High** until measured |
| 4.8 | TCP listener | C# `TcpListener` on 46899 | `common/web/TcpListenerService.ts` bound to `0.0.0.0:46899` | Medium |
| 4.9 | Header proxying | C# `ProxyPlayIfRequired` | `common/web/NetworkService.proxyPlayIfRequired` (via `UtilityBackend.preparePlayMessage`) | Low |
| 4.10 | Page environment | `FCastReceiver/index.html` loads `$WEBAPIS/webapis/webapis.js`; code uses `tizen-common-web` and `tizen-tv-webapis` | Confirm that `tizen` and `webapis` exist on a page served from `127.0.0.1:8081`. TizenBrew registers the module's `keys` with `tizen.tvinputdevice` before navigating, but that happens on its own page. Otherwise, feature-detect | **High** until measured |
| 4.11 | Always-on receiver | C# service has `on-boot="true"`, `auto-restart="true"` | Document that users must enable **auto-launch service** for BrewCast in TizenBrew settings, or the TV is only discoverable while the module is open | Low (docs) |
| 4.12 | Leftover `.wgt` path | `FCastReceiverService/`, `tizen-manifest.xml`, `scripts/build*.sh`, `Dockerfile`, `.gitlab-ci.yml` | Keep as a reference until the Node service works, then delete, or keep `.wgt` as an optional target. `.gitlab-ci.yml` is inert (FUTO infrastructure) | Low |

## 5. Unknowns that need a real TV

These are the probe module's checklist. Record the Tizen version and TV model with each answer.

1. What does `process.version` report inside the TizenBrew service?
2. Can the service `net.createServer().listen(46899, '0.0.0.0')` and accept a LAN connection?
3. Can it bind UDP 5353 with `reuseAddr` and join `224.0.0.251`? Do senders then discover it?
4. On the module page (served from `127.0.0.1:8081`): do `window.tizen`, `tizen.tvinputdevice`,
   `tizen.messageport` and `webapis` exist?
5. Can the service open a localhost WebSocket or HTTP server that the page can reach?
6. Can the service launch or foreground BrewCast through TizenBrew's AppControl, both when TizenBrew
   is closed and when another module is in front?
7. Do hls.js and dash.js play smoothly in TizenBrew's webview?

## 6. Proposed work order

Proposal only; nothing below has been started.

1. **Fix the web build.** Port `src/{main,player}/Preload.ts` to the single `common/Preload`
   structure, following Electron's post‑`b1850e3` code. Fix the `TS2554` drift. Clean up the 6 lint
   errors.
2. **Probe module.** A minimal TizenBrew app module: a root `package.json`, a one-page UI and a tiny
   `serviceFile` that answers §5 and shows the results on screen. Install it from a branch through
   `gh/BlindeCode/tizenbrew-brewcast`.
3. **Node service (v3).** Port the webOS service onto `common/web`, targeting the Node version
   measured in step 2. Wire up the TCP listener, `FCastSession`, `ConnectionMonitor` and header
   proxying.
4. **IPC and launch.** Replace MessagePort in `src/*/Preload.ts` with the channel chosen in step 2,
   and bring the player up on `play` via TizenBrew AppControl.
5. **Discovery.** Add mDNS via `@futo/mdns-js` if step 2 showed UDP works; the QR code covers it
   otherwise.
6. **Packaging and release.** Decide between committed build output and npm, add the root module
   metadata, tag a first release, and document installation and auto-launch.
7. **Cleanup.** Retire the C# service and `.wgt` scripts once the Node service replaces them.
8. **Later, optional: protocol v4.** TLS 1.3 upgrade with a persisted self-signed key and `fp`,
   FlatBuffers, and a QR `txt`. Only on TVs with Node ≥ 12. Until then, keep advertising v3 without
   `fp`.
