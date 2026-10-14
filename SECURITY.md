# Security policy

## Supported versions

I apply fixes to the current source and latest published release. If you're using an older version, I may ask you to upgrade. I don't keep a separate long-term support branch.

## Reporting

Use **Security → Report a vulnerability** in this repository when private reporting is enabled. Otherwise, contact me through a private contact method I've listed on GitHub. If you can't find one, open an issue asking me for a private channel without including vulnerability details.

Please include the app version or commit, Windows version, affected component, impact, and steps I can follow to reproduce it. For a position-related issue, include the FEN, search depth, and engine settings. Keep exploit details in the private report. I can't promise a response time.

## Scope

I accept reports about FEN and UCI input handling, Tauri IPC and WebView permissions, Stockfish execution and cleanup, engine downloads, installer resources, release integrity, and dependency vulnerabilities reachable through the app. I'll investigate credible reports and work with you on a fix and disclosure where appropriate.

For incorrect chess evaluations, missing move highlights, draw-detection errors, or slow searches, please open a bug report. Give me a minimal position and the moves or actions leading to it so I can reproduce the behavior.
