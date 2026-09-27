import * as http from 'http';
import { Logger, LoggerType } from 'common/Logger';
const logger = new Logger('Ipc', LoggerType.BACKEND);

// Local channel between this service and the module's pages, which TizenBrew serves from
// http://127.0.0.1:8081 (a different origin, hence CORS). Replaces upstream's Tizen MessagePort
// (C# service) and webOS Luna bus:
//   GET  /events        Server-Sent Events stream of service events (`event:` name, JSON `data:`)
//   POST /call/<method> JSON request body, JSON response `{ "value": ... }` or `{ "error": ... }`
// Only bound to 127.0.0.1, so senders on the network can't reach it.
export const IPC_PORT = 46897;

export type IpcCallHandler = (method: string, value: unknown) => unknown | Promise<unknown>;

export class IpcServer {
    private server: http.Server = null;
    private clients: Set<http.ServerResponse> = new Set();
    private keepAlive: ReturnType<typeof setInterval> = null;

    // Called with each new event-stream client, e.g. to replay state the page needs on load.
    public onClientConnected: (send: (event: string, value: unknown) => void) => void = null;

    constructor(private handler: IpcCallHandler) {}

    start(port: number = IPC_PORT) {
        this.server = http.createServer((req, res) => this.handleRequest(req, res));
        this.server.on('error', (err) => logger.error('IPC server error', err));
        this.server.listen(port, '127.0.0.1');

        // Comment lines keep idle event streams from being timed out by proxies or the browser.
        this.keepAlive = setInterval(() => this.clients.forEach((client) => client.write(': keep-alive\n\n')), 15000);
    }

    stop() {
        clearInterval(this.keepAlive);
        this.clients.forEach((client) => client.end());
        this.clients.clear();
        this.server?.close();
    }

    get port(): number {
        const address = this.server ? this.server.address() : null;
        return address && typeof address === 'object' ? address.port : null;
    }

    hasClients(): boolean {
        return this.clients.size > 0;
    }

    broadcast(event: string, value: unknown = null) {
        const message = IpcServer.format(event, value);
        this.clients.forEach((client) => client.write(message));
    }

    private static format(event: string, value: unknown): string {
        return `event: ${event}\ndata: ${JSON.stringify(value === undefined ? null : value)}\n\n`;
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.method === 'GET' && req.url === '/events') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });
            res.write('retry: 1000\n\n');
            this.clients.add(res);
            req.on('close', () => this.clients.delete(res));
            logger.info(`Page connected (${this.clients.size} connected)`);

            if (this.onClientConnected) {
                try {
                    this.onClientConnected((event, value) => res.write(IpcServer.format(event, value)));
                } catch (e) {
                    logger.error('Error replaying state to a new page', e);
                }
            }
            return;
        }

        const match = req.method === 'POST' && req.url ? /^\/call\/([a-z_]+)$/.exec(req.url) : null;
        if (!match) {
            res.writeHead(404);
            res.end();
            return;
        }

        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => { body += chunk; });
        req.on('end', () => {
            const respond = (status: number, payload: unknown) => {
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(payload));
            };

            let value: unknown;
            try {
                value = body.length > 0 ? JSON.parse(body) : null;
            } catch {
                respond(400, { error: 'invalid JSON' });
                return;
            }

            Promise.resolve()
                .then(() => this.handler(match[1], value))
                .then((result) => respond(200, { value: result === undefined ? null : result }))
                .catch((e) => {
                    logger.error(`IPC call ${match[1]} failed`, e);
                    respond(500, { error: `${e}` });
                });
        });
    }
}
