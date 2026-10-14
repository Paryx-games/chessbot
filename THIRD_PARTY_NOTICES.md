# Third-party notices

I've licensed my Chessbot code under GPL-3.0-or-later. The third-party components I use retain their licenses and copyright notices.

## Stockfish

- Upstream: [Stockfish](https://github.com/official-stockfish/Stockfish).
- Pinned release: `sf_19` (Stockfish 19).
- License: GNU GPL version 3, in `src-tauri/licenses/Stockfish-GPL-3.0.txt`.
- Provenance: `src-tauri/licenses/stockfish.json` records the release, binary URL, and checksums.
- Source: `src-tauri/licenses/Stockfish-sf_19-source.zip`, prepared by `scripts/fetch-stockfish.ps1` and bundled with the app.

The downloader fetches the Windows x64 universal binary with embedded neural networks. Preserve upstream notices and the source archive when redistributing it. For a modified or rebuilt engine, supply the matching source and build information for that binary.

## Rust dependencies

Direct dependencies include Tauri and tauri-build (MIT or Apache-2.0), serde (MIT or Apache-2.0), and shakmaty (GPL-3.0-or-later). `src-tauri/Cargo.lock` records exact dependency versions. Consult downloaded crate manifests and license files for individual notices; this summary does not replace those licenses.
