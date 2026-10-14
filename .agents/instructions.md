# Board Editor instructions

## Project

I'm building a Windows x64 chess position editor with Tauri 2, a Rust backend, and Stockfish 19 as a bundled native sidecar. The frontend is plain HTML, CSS, and JavaScript. There is no frontend framework, npm dependency tree, or frontend build step.

## Where changes belong

- `frontend/`: board rendering, drag/drop, FEN editing, controls, and analysis display.
- `src-tauri/src/main.rs`: Tauri commands, shared engine state, and app lifecycle.
- `src-tauri/src/engine.rs`: Stockfish process, UCI communication, validation, and cancellation.
- `src-tauri/src/game_status.rs`: check, checkmate, stalemate, and draw detection.
- `scripts/`: engine download, version checks, release packaging, and release notes.
- `.github/`: CI selection, checks, reporting, and release workflows.
- `assets/branding/` and `src-tauri/icons/`: branding sources and application icons.
- `references/`: historical material, not the current application entry point.

## Boundaries

- Keep native engine execution in Rust. Don't expose arbitrary executable paths or shell commands through IPC.
- Validate FEN positions and depth values before sending commands to Stockfish. Keep UCI input isolated from user-provided text.
- Preserve cancellation when the position or depth changes. Old search output must never update the current board or trigger an automatic move.
- Stop and clean up the sidecar when the app exits. A failed engine must not leave analysis permanently blocked.
- Preserve free piece placement in the editor. Legal-move hints and engine validation must not silently turn editing into legal-moves-only play.
- Keep FEN counters, castling rights, en passant, promotion, and repetition history consistent when changing move handling.
- Preserve the current layout, themes, vertical evaluation bar, keyboard controls, and 1310 × 925 minimum content size unless I ask to change them.
- Don't upgrade Stockfish or add frameworks as incidental cleanup.

## Setup and checks

Run commands from the repository root. Before the first build or native engine test, fetch the pinned sidecar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/fetch-stockfish.ps1
cargo tauri dev
```

Use checks relevant to the change:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --all-features
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings
node --check frontend/app.js
node scripts/check-version.cjs
node --test .github/scripts/*.test.cjs
cargo tauri build --ci --bundles nsis -- --locked
```

For UI changes, check the changed flow in the native app, including keyboard focus and board orientation. For chess-rule changes, use concrete FEN positions. For engine changes, check startup, interrupted analysis, a new search after cancellation, and app exit. For packaging changes, verify the installer and portable ZIP include Stockfish, licenses, and the matching source resources.

Windows locks running executables. If I'm running the app, use a separate output directory or a release-profile check instead of closing my session to rebuild.

## Releases and repository hygiene

I keep engine executables, build output, caches, and local logs out of Git. Preserve the Cargo lockfile and let Cargo update it rather than editing it manually.

Keep the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the generated lockfile consistent. Preserve exact-commit CI validation, tag checks, release checksums, and Stockfish license/source packaging.

Keep changes focused, follow the existing conventions, and add regression coverage when it verifies meaningful behavior. Update the README and changelog for user-visible changes. Tell me what changed, which checks ran, and anything still unverified. Don't publish, push, upload, or create a release unless I ask.

## Commit all changes once finished using conventional commits

Follow `CONVENTIONAL_COMMITS.md` for this
