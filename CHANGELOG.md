# Changelog

All notable changes to the Vscode RPC extension will be documented in this file.

## [0.1.3] - 2025-08-11
### Added
- Customizable large and small images via `discordPresence.customImageKeys` and `discordPresence.defaultSmallImageKey`.
- GitHub button in Discord presence linking to repository.
- Support for `ipc` and `websocket` transports.

### Fixed
- Resolved connection issues on Linux with Snap by supporting `websocket` transport.
