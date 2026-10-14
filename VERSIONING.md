# Versioning and releases

I use `MAJOR.MINOR.PATCH`. Before 1.0, I may change behavior or interfaces in minor releases. I keep patch releases to compatible fixes.

I keep the app version in `src-tauri/tauri.conf.json` and mirror it in `src-tauri/Cargo.toml`. When changing it, update both and let Cargo refresh `src-tauri/Cargo.lock`; don't edit the lockfile manually. I tag releases with `v` followed by the version, such as `v0.1.0`.

## Release checklist

This is the checklist I use before releasing a build:

1. Review Unreleased changes and choose a version.
2. Update version values and the generated lockfile. Move changelog entries into a dated section.
3. Run CONTRIBUTING.md checks and `cargo tauri build -- --locked`.
4. Verify the installer on Windows, including engine startup, cancellation, exit, and license/source resources.
5. Pass CI on the exact release commit using a push to `main` or a manual CI run. Confirm the tag matches the app version and a nonempty changelog section exists for that version.
6. Push the version tag to run Release and publish after validation. Alternatively, manually run Release for an existing tag; it leaves a draft unless Publish is selected. Versions containing a prerelease suffix, including release candidates, are marked as prereleases.
7. Release builds use the validated commit SHA, verify checksums, and recheck the remote tag before publishing. Assets include the installer, portable ZIP with sidecar/resources, Stockfish source, commit identity, and SHA256SUMS.txt. GitHub supplies the app's source archives automatically. Do not reuse an existing published release. An existing draft must be handled manually before retrying creation.

I don't reuse published tags. My current builds are unsigned.
