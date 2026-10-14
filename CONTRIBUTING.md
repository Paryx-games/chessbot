# Contributing to Chessbot

Thanks for taking a look at my project. Please keep changes focused and explain what they improve. For a substantial feature, open an issue first so I can discuss the approach with you.

## Get started

Follow the setup in [README.md](README.md). Run `scripts/fetch-stockfish.ps1` before the first build or test; engine executables are not stored in Git. Create a descriptive branch from the repository's default branch.

I've documented the architecture and boundaries in [.agents/instructions.md](.agents/instructions.md). I keep engine lifecycle and chess-status rules in Rust, and the UI in plain HTML/CSS/JavaScript. Please preserve that structure and the Cargo lockfile, and avoid adding a frontend toolchain without a clear need.

## Verification

Close any running app built from the target directory, then run:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
node --check frontend/app.js
node scripts/check-version.cjs
node --test .github/scripts/*.test.cjs
```

For UI changes, I'd like you to check the changed flow, keyboard focus, light and dark appearance, and minimum window size in the native app. For engine changes, test analysis, cancellation on position changes, and app exit. Include FENs for chess-rule fixes. Tell me which checks you ran and what you couldn't verify, and add regression coverage for meaningful behavior changes.

## Pull requests

- Follow [CONVENTIONAL_COMMITS.md](CONVENTIONAL_COMMITS.md) and [PR_CONVENTIONS.md](PR_CONVENTIONS.md).
- Describe the problem, resulting behavior, and verification using the PR template.
- Update [CHANGELOG.md](CHANGELOG.md) for user-visible changes.
- Exclude generated build output, downloaded engine executables, and local diagnostic logs.
- Preserve Stockfish license and corresponding source resources in distributions.
- Report security issues through [SECURITY.md](SECURITY.md).

I accept contributions under GPL-3.0-or-later. Please keep the attribution and compatible licensing for any third-party code you include.
