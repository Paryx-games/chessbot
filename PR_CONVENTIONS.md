# Pull request conventions

I use `type(scope): imperative description`, with an optional scope such as `engine`, `board`, `ui`, or `packaging`. See [CONVENTIONAL_COMMITS.md](CONVENTIONAL_COMMITS.md).

Please use the PR template so I can see what changed and how you checked it:

1. **Changes:** describe the problem and resulting behavior; link related issues.
2. **Testing:** state checks actually run, results, and any gaps.
3. **Notes:** optional compatibility details, limitations, or screenshots.
4. **Checklist:** complete applicable items and explain exceptions under Testing.

I'd like one focused change per PR. Give me reproduction FENs for chess-rule changes and screenshots for visual changes when useful. For sidecar or packaging changes, explain how you checked startup, cancellation, exit, and the license/source resources.
