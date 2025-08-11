# Vscode RPC

Show your VS Code activity on Discord — language, workspace, and more in real time.

## Features

- Displays your current file and programming language in Discord.
- Customizable large and small images for Rich Presence.
- Shows workspace name (optional).
- Supports `ipc` and `websocket` transports for compatibility.
- Includes a "View on GitHub" button linking to [https://github.com/Frank1o3/vscode-rpc](https://github.com/Frank1o3/vscode-rpc).

## Requirements

- A Discord Application with a valid `clientId` (create one at [Discord Developer Portal](https://discord.com/developers/applications)).
- Discord desktop app running with "Display current activity as a status message" enabled in **Settings > Activity Privacy**.

## Installation

1. Download the `.vsix` file from [GitHub Releases](https://github.com/Frank1o3/vscode-rpc/releases).
2. Install in VS Code: `code --install-extension vscode-rpc-<version>.vsix` (e.g., `vscode-rpc-0.1.4.vsix`).
3. Create a Discord Application at [https://discord.com/developers/applications](https://discord.com/developers/applications).
4. Copy the **Application ID** from **General Information**.
5. In VS Code, go to **Settings > Extensions > Discord Presence** and set `discordPresence.clientId` to your Application ID.
6. (Optional) Upload 512x512 PNG/JPG images to **Rich Presence > Assets** in the Discord Developer Portal for custom icons (e.g., `python`, `javascript`, `vscode`).
7. Configure custom image keys in **Settings > Extensions > Discord Presence** (e.g., `{ "python": "custom_python_icon" }`).

## Extension Settings

- `discordPresence.clientId`: Your Discord Application ID.
- `discordPresence.showWorkspace`: Show workspace name in Discord presence (default: `true`).
- `discordPresence.transport`: Transport method (`ipc` or `websocket`, use `websocket` for Snap or remote environments).
- `discordPresence.debounceMs`: Debounce time (ms) for presence updates (default: `1000`).
- `discordPresence.customImageKeys`: Custom image keys for languages (e.g., `{ "python": "custom_python_icon" }`).
- `discordPresence.defaultSmallImageKey`: Default small image key (default: `vscode`).

## Example

Editing a Python file (`test.py`) in a workspace named `MyProject`:

- **Details**: `Editing test.py — MyProject`
- **State**: `Language: Python | OS: Linux`
- **Large Image**: Custom Python icon (e.g., `custom_python_icon`)
- **Small Image**: VS Code icon (e.g., `vscode`)
- **Button**: `View on GitHub`

## Known Issues

- On Linux with Snap-installed VS Code or Discord, use `websocket` transport to avoid IPC issues.
- Ensure Discord assets are uploaded and cached (wait 5-10 minutes after uploading).

## Contributing

File issues or contribute at [https://github.com/Frank1o3/vscode-rpc](https://github.com/Frank1o3/vscode-rpc).

## License

MIT License