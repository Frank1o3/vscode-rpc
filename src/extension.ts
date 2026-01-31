import * as vscode from 'vscode';
import * as os from 'os';
import { DiscordService } from './discord/DiscordService';

let startTimestamp = Date.now();
let updateTimer: NodeJS.Timeout | null = null;

const discord = DiscordService.getInstance();

const languageMap: Record<string, string> = {
    python: 'Python',
    java: 'Java',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    cpp: 'C++',
    c: 'C',
    csharp: 'C#',
    lua: 'Lua',
    html: 'HTML',
    json: 'JSON',
    css: 'CSS',
    react: 'React',
    txt: 'Text',
    yaml: 'YAML',
    yml: 'YAML',
    ruby: 'Ruby',
    xml: 'XML'
};

function getOSName(): string {
    switch (os.platform()) {
        case 'win32': return 'Windows';
        case 'darwin': return 'macOS';
        case 'linux': return 'Linux';
        default: return 'Unknown';
    }
}

function updatePresenceDebounced(): void {
    if (updateTimer) {
        clearTimeout(updateTimer);
    }

    const conf = vscode.workspace.getConfiguration('discordPresence');
    const debounceMs = conf.get<number>('debounceMs', 1000);

    updateTimer = setTimeout(() => {
        updatePresence();
    }, debounceMs);
}

async function updatePresence(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const osName = getOSName();

    if (!editor) {
        await discord.setActivity({
            details: 'Idle',
            state: `OS: ${osName}`,
            startTimestamp,
            largeImageKey: 'vscode',
            largeImageText: 'Visual Studio Code'
        });
        return;
    }

    const langId = editor.document.languageId;
    const language = languageMap[langId] ?? langId;

    const fileName = editor.document.uri.scheme === 'file'
        ? vscode.workspace.asRelativePath(editor.document.uri).split('/').pop()
        : 'untitled';

    const conf = vscode.workspace.getConfiguration('discordPresence');
    const showWorkspace = conf.get<boolean>('showWorkspace', true);

    let details = `Editing ${fileName}`;
    if (showWorkspace && vscode.workspace.name) {
        details += ` — ${vscode.workspace.name}`;
    }

    await discord.setActivity({
        details,
        state: `Language: ${language} | OS: ${osName}`,
        startTimestamp,
        largeImageKey: 'vscode',
        largeImageText: 'Visual Studio Code',
        smallImageKey: langId,
        smallImageText: language
    });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const conf = vscode.workspace.getConfiguration('discordPresence');

    discord.updateConfig({
        clientId: conf.get<string>('clientId', ''),
        clientSecret: conf.get<string>('clientSecret', ''),
        transport: conf.get<'ipc' | 'websocket'>('transport', 'ipc')
    });

    // Set up connection status listener
    discord.onConnectionChange((connected, error) => {
        if (connected) {
            vscode.window.showInformationMessage('Discord RPC: Connected successfully! 🎉');
        } else if (error) {
            vscode.window.showErrorMessage(`Discord RPC: Failed to connect - ${error.message}`);
        }
    });

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updatePresenceDebounced),
        vscode.workspace.onDidChangeTextDocument(updatePresenceDebounced),
        vscode.workspace.onDidChangeWorkspaceFolders(updatePresenceDebounced),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('discordPresence')) {
                const conf = vscode.workspace.getConfiguration('discordPresence');
                discord.updateConfig({
                    clientId: conf.get<string>('clientId', ''),
                    clientSecret: conf.get<string>('clientSecret', ''),
                    transport: conf.get<'ipc' | 'websocket'>('transport', 'ipc')
                });
                updatePresenceDebounced();
            }
        }),
        // Add command to manually reconnect
        vscode.commands.registerCommand('discordPresence.reconnect', async () => {
            discord.disconnect();
            vscode.window.showInformationMessage('Discord RPC: Reconnecting...');
            await updatePresence();
        })
    );

    // Initial connection attempt
    try {
        await updatePresence();
    } catch (error) {
        console.error('Initial presence update failed:', error);
    }
}

export function deactivate(): void {
    if (updateTimer) {
        clearTimeout(updateTimer);
    }
    discord.disconnect();
}