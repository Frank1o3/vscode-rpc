import * as vscode from 'vscode';
import * as RPC from 'discord-rpc';
import * as os from 'os';

let rpc: RPC.Client | null = null;
let startTimestamp: number = Date.now();
let updateTimer: NodeJS.Timeout | null = null;

// Map language IDs to display names
const languageMap: Record<string, string> = {
	python: 'Python',
	java: 'Java',
	javascript: 'JavaScript',
	typescript: 'TypeScript',
	cpp: 'C++',
	c: 'C',
	csharp: 'C#',
	lua: 'Lua',
	json: 'JSON'
};

// Map language IDs to Discord asset keys
const languageImageKeys: Record<string, string> = {
	python: 'python',
	java: 'java',
	javascript: 'javascript',
	typescript: 'typescript',
	cpp: 'cpp',
	c: 'c',
	csharp: 'csharp',
	lua: 'lua',
	json: 'json'
};

// Detect OS name for presence
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

async function safeLogin(clientId: string): Promise<void> {
	if (!clientId) { return; }
	try {
		rpc = new RPC.Client({ transport: 'ipc' });
		await rpc.login({ clientId });
	} catch (err) {
		console.error('Discord RPC login error:', err);
		rpc = null;
	}
}

function updatePresenceDebounced(): void {
	if (updateTimer) { clearTimeout(updateTimer); }
	updateTimer = setTimeout(() => {
		updatePresence().catch(e => console.error(e));
	}, 400);
}

async function updatePresence(): Promise<void> {
	if (!rpc) { return; }

	const editor = vscode.window.activeTextEditor;
	if (!editor || !editor.document) {
		await rpc.clearActivity();
		return;
	}

	const lang = getDisplayLanguage(editor.document.languageId);
	const langImage = getLargeImageKey(editor.document.languageId);
	const filename: string = editor.document.fileName.split(/[\\/]/).pop() ?? 'untitled';
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
			largeImageKey: langImage,
			largeImageText: lang,
			smallImageKey: smallKey,
			smallImageText: 'Visual Studio Code'
		});
	} catch (e) {
		console.error('Failed to set activity', e);
	}
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const conf = vscode.workspace.getConfiguration('discordPresence');
	const clientId: string = conf.get('clientId', '');

	if (!clientId) {
		vscode.window.showInformationMessage(
			'Discord Presence: set "discordPresence.clientId" in settings to enable RPC.'
		);
		return;
	}

	await safeLogin(clientId);

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updatePresenceDebounced));
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(updatePresenceDebounced));
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(updatePresenceDebounced));

	updatePresenceDebounced();

	context.subscriptions.push({
		dispose: () => {
			if (rpc) {
				try {
					rpc.destroy();
				} catch { /* ignore */ }
				rpc = null;
			}
		}
	});
}

export function deactivate(): void {
	if (rpc) {
		try { rpc.destroy(); } catch { /* ignore */ }
		rpc = null;
	}
}
