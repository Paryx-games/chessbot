# Changelog

I record changes here and use the versioning described in [VERSIONING.md](VERSIONING.md).

## Unreleased

### Added

- Modern knight icon, matching GitHub social image, and branded README for Paryx-games/chessbot.
- Project-specific CI selection, failure reporting, workflow security checks, and exact-commit release validation.
- Portable release packages, bundled Stockfish source, checksums, version checks, and guarded publication.
- GitHub issue forms, contribution and PR guidance, security policy, and Ko-fi links.
- Windows CI, installer artifact builds, and weekly dependency updates.
- GPL-3.0-or-later project licensing and third-party notices.

### Changed

- Social preview and README tagline now read "Chess move analysis".
- Contribution templates and automated review guidance focus on the chess editor, Stockfish, and release tooling.
- CI planning, gating, and PR summaries now use project-specific implementations.
- README layout follows the app's showcase, download, usage, build, and contribution sections.
- App source downloads use GitHub's automatic release archives instead of a duplicate uploaded ZIP.

## 0.1.0

Initial local build; no public release date is recorded.

### Added

- Tauri desktop app with the original editor UI and native Stockfish 19 sidecar.
- Rust engine startup, validation, streaming analysis, cancellation, and cleanup.
- FEN editing, themes, orientation controls, and automated play.
- Game-status box and checked-king highlights, including mate and draw detection.
- Vertical evaluation bar and minimum content size of 1310 × 925 logical pixels.
- Custom depth dropdown with presets 6, 8, 12, 16, 24, a 1–48 slider, and warning above 24.
