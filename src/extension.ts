import * as vscode from 'vscode';
import * as RPC from 'discord-rpc';
import * as os from 'os';

let rpc: RPC.Client | null = null;
let startTimestamp: number = Date.now();
let updateTimer: NodeJS.Timeout | null = null;

const languageMap: Record<string, string> = {
    python: 'Python',
    java: 'Java',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    cpp: 'C++',
    c: 'C',
    csharp: 'C#',
    lua: 'Lua',
    html: 'Html',
    json: 'Json',
    css: 'Css',
    react: 'React'
};

const languageImageKeys: Record<string, string> = {
    python: 'python',
    java: 'java',
    javascript: 'javascript',
    typescript: 'typescript',
    cpp: 'cpp',
    c: 'c',
    csharp: 'csharp',
    lua: 'lua',
    html: 'html',
    json: 'json',
    css: 'css',
    react: 'react'
};

function getOSName(): string {
    const platform = os.platform();
    switch (platform) {
        case 'win32': return 'Windows';
        case 'darwin': return 'macOS';
        case 'linux': return 'Linux';
        default: return platform;
    }
}

function getDisplayLanguage(languageId: string | undefined): string {
    if (!languageId) { return 'Unknown'; }
    const id = languageId.toLowerCase();
    return languageMap[id] ?? languageId;
}

function getLargeImageKey(languageId: string | undefined): string {
    if (!languageId) { return 'generic'; }
    const id = languageId.toLowerCase();
    return languageImageKeys[id] ?? 'generic';
}

async function safeLogin(clientId: string, clientSecret:string, transport: 'ipc' | 'websocket' = 'ipc'): Promise<void> {
    if (!clientId) {
        console.log('Discord Presence: No clientId provided');
        return;
    }
    try {
        console.log(`Discord Presence: Attempting to connect with transport: ${transport}`);
        rpc = new RPC.Client({ transport });
        await rpc.login({ clientId, clientSecret });
        console.log('Discord Presence: Successfully connected to Discord RPC');
        vscode.window.showInformationMessage('Discord Presence connected.');
    } catch (err) {
        console.error('Discord Presence: RPC login error:', err);
        vscode.window.showErrorMessage(`Discord Presence: Failed to connect to Discord (transport: ${transport}). Ensure Discord is running and check your client ID.`);
        rpc = null;
    }
}

function updatePresenceDebounced(): void {
    if (updateTimer) { clearTimeout(updateTimer); }
    const conf = vscode.workspace.getConfiguration('discordPresence');
    const debounceMs: number = conf.get('debounceMs', 1000);
    updateTimer = setTimeout(() => {
        updatePresence().catch(e => console.error('Discord Presence: Update error:', e));
    }, debounceMs);
}

async function updatePresence(): Promise<void> {
    if (!rpc) {
        const conf = vscode.workspace.getConfiguration('discordPresence');
        const clientId: string = conf.get('clientId', '');
        const transport: string = conf.get('transport', 'ipc');
        const validTransport: 'ipc' | 'websocket' = transport === 'websocket' ? 'websocket' : 'ipc';
        await safeLogin(clientId, validTransport);
        if (!rpc) { return; }
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document) {
        await rpc.setActivity({
            details: 'Idle',
            state: `OS: ${getOSName()}`,
            startTimestamp,
            largeImageKey: 'vscode',
            largeImageText: 'Visual Studio Code'
        });
        return;
    }
    console.log(editor.document.languageId);
    const lang = getDisplayLanguage(editor.document.languageId);
    const langImage = getLargeImageKey(editor.document.languageId);
    const uri = editor.document.uri;
    const filename: string = uri.scheme === 'file' ? vscode.workspace.asRelativePath(uri, false).split('/').pop() ?? 'untitled' : 'untitled';
    const conf = vscode.workspace.getConfiguration('discordPresence');
    const showWorkspace: boolean = conf.get('showWorkspace', true);

    let details: string = `Editing ${filename}`;
    if (showWorkspace) {
        const wf: string | undefined = vscode.workspace.name;
        if (wf) { details += ` — ${wf}`; }
    }

    const state: string = `Language: ${lang} | OS: ${getOSName()}`;
    const smallKey: string = 'vscode';
    try {
        await rpc.setActivity({
            details,
            state,
            startTimestamp,
            largeImageKey: smallKey,
            largeImageText: "Visual Studio Code",
            smallImageKey: langImage,
            smallImageText: lang
        });
        console.log('Discord Presence: Activity set successfully');
    } catch (e) {
        console.error('Discord Presence: Failed to set activity:', e);
    }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Discord Presence extension activated');
    const conf = vscode.workspace.getConfiguration('discordPresence');
    const clientId: string = conf.get('clientId', '');
    const clientSecret: string = conf.get('clientSecret', '');
    const transport: string = conf.get('transport', 'ipc');
    const validTransport: 'ipc' | 'websocket' = transport === 'websocket' ? 'websocket' : 'ipc';

    if (!clientId) {
        console.log('Discord Presence: No clientId provided');
        vscode.window.showErrorMessage('Discord Presence: Set "discordPresence.clientId" in settings to enable RPC.');
        return;
    }

    await safeLogin(clientId, clientSecret, validTransport);

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updatePresenceDebounced),
        vscode.workspace.onDidChangeTextDocument(updatePresenceDebounced),
        vscode.workspace.onDidChangeWorkspaceFolders(updatePresenceDebounced),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('discordPresence')) {
                console.log('Discord Presence: Configuration changed');
                const conf = vscode.workspace.getConfiguration('discordPresence');
                const newClientId = conf.get('clientId', '');
                const clientSecret: string = conf.get('clientSecret', '');
                const newTransport: string = conf.get('transport', 'ipc');
                const validNewTransport: 'ipc' | 'websocket' = newTransport === 'websocket' ? 'websocket' : 'ipc';
                if (rpc) {
                    rpc.destroy();
                    rpc = null;
                }
                safeLogin(newClientId, clientSecret, validNewTransport).then(() => updatePresenceDebounced());
            }
        })
    );

    updatePresenceDebounced();
}

export function deactivate(): void {
    console.log('Discord Presence extension deactivated');
    if (rpc) {
        try {
            rpc.destroy();
        } catch (e) {
            console.error('Discord Presence: Error destroying RPC:', e);
        }
        rpc = null;
    }
    if (updateTimer) {
        clearTimeout(updateTimer);
        updateTimer = null;
    }
}