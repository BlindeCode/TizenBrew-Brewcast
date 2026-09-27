<img src="receivers/tizen/assets/icons/brewcast.svg" width="96" alt="BrewCast icon">

# BrewCast

BrewCast is an FCast-compatible receiver for Samsung Tizen TVs, packaged as a
[TizenBrew](https://github.com/reisxd/TizenBrew) module. Cast video from any FCast sender app to your TV,
with no Samsung developer certificate needed.

BrewCast speaks FCast protocol v4: encrypted TLS 1.3 connections, with the receiver identified by
a key fingerprint that senders get from mDNS or the on-screen QR code. It falls back to v3/v2 for
older senders and for TVs whose runtime can't do TLS 1.3.

> [!WARNING]
> **Not tested on a TV yet.** Casting works end to end against FCast's reference sender in local
> tests, but the module isn't published for TizenBrew yet, and some TV behaviour is still unverified.
> [docs/gap-analysis.md](docs/gap-analysis.md) has the status and what's still open.

## Installing (once published)

1. In TizenBrew's module manager, add the GitHub module `gh/BlindeCode/tizenbrew-brewcast`.
2. In TizenBrew's settings, enable **auto-launch service** for BrewCast. Otherwise the TV is only
   discoverable while BrewCast is open.

## Repository layout

| Path | What it is |
|------|------------|
| `package.json` | TizenBrew module manifest (`appPath`, `serviceFile`, `keys`) |
| `receivers/tizen/service/` | Network service TizenBrew runs in Node: listener, discovery, page channel |
| `receivers/tizen/src/` | TV pages: main screen (QR code) and player |
| `receivers/common/` | Shared TypeScript and assets from upstream's receivers, plus protocol v4 (`web/v4/`) |
| `docs/` | Project notes, including the gap analysis |

The `receivers/` layout matches upstream, so the `../common` paths in the build config keep working.

## Development

```bash
cd receivers/tizen
npm ci
npm test               # protocol tests
npm run build:module   # builds the pages and service into ./module
```

`module/` is what TizenBrew loads: `appPath` and `serviceFile` point into it. Upstream's signed
`.wgt` build steps are kept in [receivers/tizen/README.md](receivers/tizen/README.md) for reference
only; that path still uses upstream's C# service, which the pages no longer talk to.

## Where the code comes from

BrewCast started from the Tizen receiver in [futo-org/fcast](https://github.com/futo-org/fcast), which
is MIT-licensed:

1. `receivers/tizen` and `receivers/common` at tag `tizen-v1.0.0`, the released Tizen receiver.
2. The same directories at `5c79300` (2026-09-24), the last upstream commit before they were removed.

Both imports are unmodified. The diff between them shows what upstream changed after the release.
Rebranding and all later work are separate commits on top.

## Disclaimer

This application is an independent community implementation of the FCast protocol. It is not
affiliated with FUTO. FCast is a registered trademark of FUTO.

## License

MIT. See [LICENSE](LICENSE), which carries both FUTO's copyright notice for the imported code and
ours. Bundled fonts (Inter, Outfit) are under the SIL Open Font License; see the `OFL.txt` files in
`receivers/common/assets/fonts/`.
