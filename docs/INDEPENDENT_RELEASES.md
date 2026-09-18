# Independent releases

This fork starts with release **8.1**, based on upstream **2.5.4-rc**.
Upstream versions describe the source baseline, not this fork's release number.

The interface shows **8.1**, while package and installer metadata use the full
SemVer **8.1.0**. The next releases are **8.2** and **8.3**, stored as **8.2.0**
and **8.3.0**. Keep the patch component at zero for this release sequence.

From the repository root, with the development environment loaded, prepare the
next release with:

```sh
pnpm release-version 8.2.0
cargo update --workspace --offline
```

The version script updates `package.json`, `src-tauri/Cargo.toml`, and
`src-tauri/tauri.conf.json`; Cargo updates the app entry in `Cargo.lock`.
The offline command requires the existing dependency cache. Review the diff to
confirm that a version-only release does not change dependency versions, and
update the `Changelog.md` heading and user-visible release notes.

Keep `productName` (`Clash Verge`), publisher (`Clash Verge Rev`), and identifier
(`io.github.clash-verge-rev.clash-verge-rev`) unchanged. Build release installers
without `verge-dev`, `dev-sidecar`, or `clippy` so they reuse the existing install
and configuration directories. On Windows, use the installer with `/UPDATE` to
preserve application data.

Application updates are manual for this fork. Keep official updater endpoints
disabled when merging upstream changes; distribute the independently versioned
installer for each release.
