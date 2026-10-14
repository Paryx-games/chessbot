# Conventional commits

I use this format for commit subjects:

```text
type(scope): imperative description
```

- **type** describes the change: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`.
- **scope** is optional and names the narrow project area; omit it when no scope is honest.
- **description** is concise, lowercase, imperative, and has no trailing period.

Examples:

```text
feat(board): support importing FEN positions
fix(engine): discard stale analysis after a position change
refactor: simplify sidecar startup
docs: explain custom search depth
ci: verify portable package contents
```

For a breaking change, I use `!` after the type or scope and a `BREAKING CHANGE:` footer explaining the impact.

```text
feat(ui)!: remove the depth 6 preset

BREAKING CHANGE: select Custom to use depth 6.
```

Choose the type based on the actual change, not the file edited. For example, a test-only change is `test`, CI configuration is `ci`, and behavior changes are `feat` or `fix` rather than `chore`.
