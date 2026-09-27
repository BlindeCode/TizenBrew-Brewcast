<img src="receivers/tizen/assets/icons/brewcast.svg" width="96" alt="BrewCast icon">

# BrewCast

BrewCast is an FCast-compatible receiver for Samsung Tizen TVs, packaged as a
[TizenBrew](https://github.com/reisxd/TizenBrew) module. Cast video from any FCast sender app to your TV,
with no Samsung developer certificate needed.

> [!WARNING]
> **Early days.** This repo holds FUTO's Tizen receiver code, imported as the starting point. It
> doesn't run as a TizenBrew module yet. [docs/gap-analysis.md](docs/gap-analysis.md) lists what's
> missing and the planned order of work.

## Installing (once it works)

In TizenBrew's module manager, add the GitHub module `gh/BlindeCode/tizenbrew-brewcast`.

## Repository layout

| Path | What it is |
|------|------------|
| `receivers/tizen/` | Tizen app: web UI (`src/`), upstream's C# network service (`FCastReceiverService/`), webpack build |
| `receivers/common/` | Shared TypeScript and assets from upstream's receivers (protocol, player, UI) |
| `docs/` | Project notes, including the gap analysis |

The `receivers/` layout matches upstream, so the `../common` paths in the build config keep working.

## Building the web UI

```bash
cd receivers/tizen
npm ci
npm run build
```

The imported upstream code (`5c79300`) doesn't build yet: upstream refactored `receivers/common` in
December 2025 without updating the Tizen sources. The gap analysis has details. Upstream's signed
`.wgt` build steps are kept in [receivers/tizen/README.md](receivers/tizen/README.md) for reference.

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
