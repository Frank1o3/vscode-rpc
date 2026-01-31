import * as RPC from 'discord-rpc';

export type TransportType = 'ipc' | 'websocket';

export interface DiscordConfig {
    clientId: string;
    clientSecret?: string;
    transport: TransportType;
}

type ConnectionCallback = (connected: boolean, error?: Error) => void;

export class DiscordService {
    private static instance: DiscordService;

    private rpc: RPC.Client | null = null;
    private connected = false;
    private config: DiscordConfig | null = null;
    private connecting: Promise<void> | null = null;
    private connectionCallbacks: ConnectionCallback[] = [];

    private constructor() { }

    static getInstance(): DiscordService {
        if (!DiscordService.instance) {
            DiscordService.instance = new DiscordService();
        }
        return DiscordService.instance;
    }

    onConnectionChange(callback: ConnectionCallback): void {
        this.connectionCallbacks.push(callback);
    }

    private notifyConnectionChange(connected: boolean, error?: Error): void {
        this.connectionCallbacks.forEach(cb => cb(connected, error));
    }

    updateConfig(config: DiscordConfig): void {
        const needsReconnect =
            !this.config ||
            this.config.clientId !== config.clientId ||
            this.config.transport !== config.transport;

        this.config = config;

        if (needsReconnect && this.rpc) {
            this.disconnect();
        }
    }

    private async connect(): Promise<void> {
        if (!this.config || !this.config.clientId) {
            const error = new Error('No client ID configured');
            this.notifyConnectionChange(false, error);
            return;
        }

        if (this.connected) {
            return;
        }

        if (this.connecting) {
            return this.connecting;
        }

        this.connecting = (async () => {
            try {
                this.rpc = new RPC.Client({ transport: this.config!.transport });

                this.rpc.on('disconnected', () => {
                    this.connected = false;
                    this.rpc = null;
                    this.notifyConnectionChange(false);
                });

                this.rpc.on('ready', () => {
                    console.log('Discord RPC ready');
                });

                await this.rpc.login({
                    clientId: this.config!.clientId,
                    clientSecret: this.config!.clientSecret
                });

                this.connected = true;
                this.notifyConnectionChange(true);
            } catch (err) {
                this.rpc = null;
                this.connected = false;
                const error = err instanceof Error ? err : new Error(String(err));
                console.error('Discord RPC connection failed:', error);
                this.notifyConnectionChange(false, error);
            } finally {
                this.connecting = null;
            }
        })();

        return this.connecting;
    }

    async setActivity(activity: RPC.Presence): Promise<void> {
        if (!this.config) {
            return;
        }

        if (!this.connected) {
            await this.connect();
        }

        if (!this.rpc || !this.connected) {
            return;
        }

        try {
            await this.rpc.setActivity(activity);
        } catch (err) {
            console.error('Discord RPC setActivity failed:', err);
            this.connected = false;
            this.rpc = null;
            const error = err instanceof Error ? err : new Error(String(err));
            this.notifyConnectionChange(false, error);
        }
    }

    disconnect(): void {
        if (this.rpc) {
            try {
                this.rpc.destroy();
            } catch { }
        }
        this.rpc = null;
        this.connected = false;
    }
}