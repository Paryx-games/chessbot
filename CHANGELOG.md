# Changelog

I record changes here and use the versioning described in [VERSIONING.md](VERSIONING.md).

## 1.1.0

### Added

- Yellow origin and destination squares for the last completed move, kept with each workspace’s saved position.
- Saved engine preferences for available CPU threads (up to 16), 16–1,024 MiB hash memory, and 1–5 displayed analysis lines in Settings.
- Move, capture, castling, and check sounds, with a Sound effects checkbox saved in settings.ini.
- Custom Chessbot title bar with app icon and native minimize, maximize/restore, and close controls.
- Analyzer and Game Training workspaces with independent board positions and animated green tab underlines.
- Legal-rules and castling controls, with Rust validation for manual moves, castling, en passant, and promotion.
- Normal, Queen Collector, and Playful training modes. Queen Collector favours promotions, while Playful delays mate with strong evaluated alternatives; both check immediate draw risks and fall back to the strongest move when needed.
- settings.ini for display preferences and save choices, plus saved.ini for independent workspace state. Checkboxes select which controls to remember or disable workspace saving entirely.
- Settings tab for board colour, interface appearance, reduced motion, coordinates, and move arrows, saved on this device.
- Estimated 1320–3190 Elo slider in both workspaces, with a full-strength option. Limited Elo takes priority over playing style.

### Changed

- Replaced the sound checkbox with Mute Sounds under Settings > Audio. It defaults to off, mutes every cue when enabled, and preserves earlier sound preferences.
- Updated the complete sound pack from sounds/, including self/opponent move, checking-move, promotion, and illegal-move cues. Every source asset is synchronized into native builds, including the premove cue for future support.
- Removed playing modes and their saved values; full strength and the Elo slider remain available in both workspaces.
- Replaced em dashes in game-status messages with standard hyphens.
- Renamed the app, executable, and installer to Chessbot.
- Matched CI and release job structure with other rust checks I've made, trusted PR labels, live failure reporting, build provenance, generated release notes, and best-effort download scans.
- Widened the sidebar and moved board guidance into a footer to avoid horizontal scrolling at the minimum window size.
- Moved playing styles to Analyzer, disabled Both sides in Game Training, and moved the side-selection prompt into the position-status box.
- Tab underlines grow from the centre on hover and expand fully when selected, respecting reduced motion.

## 1.0.0

### Added

- Tauri desktop app with the original editor UI and native Stockfish 19 sidecar.
- Rust engine startup, validation, streaming analysis, cancellation, and cleanup.
- FEN editing, themes, orientation controls, and automated play.
- Game-status box and checked-king highlights, including mate and draw detection.
- Vertical evaluation bar and minimum content size of 1310 × 925 logical pixels.
- Custom depth dropdown with presets 6, 8, 12, 16, 24, a 1–48 slider, and warning above 24.
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
- Unified the app, installer, release examples, and packaging checks on version 1.0.0.
