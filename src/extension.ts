import * as vscode from 'vscode';
import * as os from 'os';
import { DiscordService } from './discord/DiscordService';

let startTimestamp = Date.now();
let updateTimer: NodeJS.Timeout | null = null;
let lastFile: string | undefined = undefined;
let lastLanguage: string | undefined = undefined;

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
    xml: 'XML',
    go: 'Go',
    rust: 'Rust',
    php: 'PHP',
    markdown: 'Markdown',
    sql: 'SQL',
    shellscript: 'Shell',
    powershell: 'PowerShell'
};

function getOSName(): string {
    switch (os.platform()) {
        case 'win32': return 'Windows';
        case 'darwin': return 'macOS';
        case 'linux': return 'Linux';
        default: return 'Unknown';
    }
}

function updatePresenceDebounced(immediate: boolean = false): void {
    if (updateTimer) {
        clearTimeout(updateTimer);
    }

    const conf = vscode.workspace.getConfiguration('discordPresence');
    const debounceMs = immediate ? 0 : conf.get<number>('debounceMs', 1000);

    updateTimer = setTimeout(() => {
        updatePresence();
    }, debounceMs);
}

async function updatePresence(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const osName = getOSName();

    if (!editor) {
        console.log('[Discord RPC] No active editor - setting idle state');
        await discord.setActivity({
            details: 'Idle',
            state: `OS: ${osName}`,
            startTimestamp,
            largeImageKey: 'vscode',
            largeImageText: 'Visual Studio Code'
        });
        lastFile = undefined;
        lastLanguage = undefined;
        return;
    }

    const langId = editor.document.languageId;
    const language = languageMap[langId] ?? langId;

    const fileName = editor.document.uri.scheme === 'file'
        ? vscode.workspace.asRelativePath(editor.document.uri).split('/').pop()
        : 'untitled';

    const currentFile = editor.document.uri.toString();

    // Check if language actually changed
    if (lastLanguage !== langId) {
        console.log(`[Discord RPC] Language changed: ${lastLanguage} -> ${langId}`);
        lastLanguage = langId;
    }

    // Reset timestamp when switching to a different file
    if (lastFile !== currentFile) {
        console.log(`[Discord RPC] File changed: ${lastFile} -> ${currentFile}`);
        startTimestamp = Date.now();
        lastFile = currentFile;
    }

    const conf = vscode.workspace.getConfiguration('discordPresence');
    const showWorkspace = conf.get<boolean>('showWorkspace', true);

    let details = `Editing ${fileName}`;
    if (showWorkspace && vscode.workspace.name) {
        details += ` — ${vscode.workspace.name}`;
    }

    const activity = {
        details,
        state: `Language: ${language} | OS: ${osName}`,
        startTimestamp,
        largeImageKey: 'vscode',
        largeImageText: 'Visual Studio Code',
        smallImageKey: langId,
        smallImageText: language
    };

    console.log('[Discord RPC] Setting activity:', JSON.stringify(activity, null, 2));

    await discord.setActivity(activity);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('[Discord RPC] Extension activating...');

    const conf = vscode.workspace.getConfiguration('discordPresence');

    discord.updateConfig({
        clientId: conf.get<string>('clientId', ''),
        clientSecret: conf.get<string>('clientSecret', ''),
        transport: conf.get<'ipc' | 'websocket'>('transport', 'ipc')
    });

    // Set up connection status listener
    discord.onConnectionChange((connected, error) => {
        if (connected) {
            console.log('[Discord RPC] Connected successfully!');
            vscode.window.showInformationMessage('Discord RPC: Connected successfully! 🎉');
        } else if (error) {
            console.error('[Discord RPC] Connection failed:', error);
            vscode.window.showErrorMessage(`Discord RPC: Failed to connect - ${error.message}`);
        }
    });

    context.subscriptions.push(
        // Update immediately when changing active editor (switching files/tabs)
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            console.log('[Discord RPC] Active editor changed:', editor?.document.languageId);
            updatePresenceDebounced(true);
        }),
        // Debounce updates when typing in the same document
        vscode.workspace.onDidChangeTextDocument(() => {
            updatePresenceDebounced(false);
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            console.log('[Discord RPC] Workspace folders changed');
            updatePresenceDebounced(true);
        }),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('discordPresence')) {
                console.log('[Discord RPC] Configuration changed');
                const conf = vscode.workspace.getConfiguration('discordPresence');
                discord.updateConfig({
                    clientId: conf.get<string>('clientId', ''),
                    clientSecret: conf.get<string>('clientSecret', ''),
                    transport: conf.get<'ipc' | 'websocket'>('transport', 'ipc')
                });
                updatePresenceDebounced(true);
            }
        }),
        // Add command to manually reconnect
        vscode.commands.registerCommand('discordPresence.reconnect', async () => {
            console.log('[Discord RPC] Manual reconnect requested');
            discord.disconnect();
            vscode.window.showInformationMessage('Discord RPC: Reconnecting...');
            lastFile = undefined;
            lastLanguage = undefined;
            startTimestamp = Date.now();
            await updatePresence();
        }),
        // Add command to show current status
        vscode.commands.registerCommand('discordPresence.showStatus', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const langId = editor.document.languageId;
                const language = languageMap[langId] ?? langId;
                vscode.window.showInformationMessage(
                    `Current: ${langId} (${language}) | Last: ${lastLanguage}`
                );
            }
        })
    );

    // Initial connection attempt
    console.log('[Discord RPC] Performing initial presence update...');
    try {
        await updatePresence();
    } catch (error) {
        console.error('[Discord RPC] Initial presence update failed:', error);
    }
}

export function deactivate(): void {
    console.log('[Discord RPC] Extension deactivating...');
    if (updateTimer) {
        clearTimeout(updateTimer);
    }
    discord.disconnect();
}