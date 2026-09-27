import * as http from 'http';
import * as url from 'url';
import { CompanionResourceInfo, FCastSession } from 'common/FCastSession';
import { MAX_RESOURCE_READ_SIZE } from 'common/v4/Codec';
import { Logger, LoggerType } from 'common/Logger';
import { IpcRoute } from 'src/Ipc';
const logger = new Logger('Companion', LoggerType.BACKEND);

// FCompanion (protocol v4): senders serve media over their own FCast connection, referenced as
// `fcomp://<provider-id>.fcast/<resource-id>`. The TV's player can't open those, so they're
// rewritten to this service's local HTTP port, where a bridge turns HTTP (range) requests into
// `CompanionResourceRequest`s to whichever connection owns the provider id. That needn't be the
// connection that loaded the media: the spec requires cross-connection use to work.

const FCOMP_URL = /^fcomp:\/\/(\d+)\.fcast\/(\d+)$/i;
const BRIDGE_PATH = /^\/fcomp\/(\d+)\/(\d+)$/;
const MAX_PROVIDER_ID = 0xffff;
// Reads in flight per HTTP response when the resource size is known. Each read is one round trip
// over the sender's connection, so a few in parallel keep the pipe full.
const READ_AHEAD = 4;

interface Range {
    start: number;
    // Inclusive; null reads to the end.
    end: number | null;
}

// Parses a single `bytes=` range. Returns null to serve the whole resource (no or unusable
// header), or 'unsatisfiable'.
export function parseRange(header: string | undefined, size: number | null): Range | 'unsatisfiable' | null {
    const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
    if (!match || (match[1] === '' && match[2] === '')) {
        return null;
    }

    let start: number;
    let end: number | null;
    if (match[1] === '') {
        // Suffix range: the last N bytes.
        if (size === null) {
            return null;
        }
        const length = Number(match[2]);
        if (length === 0) {
            return 'unsatisfiable';
        }
        start = Math.max(0, size - length);
        end = size - 1;
    } else {
        start = Number(match[1]);
        end = match[2] === '' ? null : Number(match[2]);
        if (end !== null && end < start) {
            return null;
        }
    }

    if (size !== null) {
        if (start >= size) {
            return 'unsatisfiable';
        }
        end = end === null ? size - 1 : Math.min(end, size - 1);
    }
    return { start: start, end: end };
}

export class Companion {
    // provider id -> session id
    private providers: Map<number, string> = new Map();
    private nextProviderId = 0;
    private infoCache: Map<string, Promise<CompanionResourceInfo>> = new Map();

    constructor(private getSession: (sessionId: string) => FCastSession | undefined, private bridgeBase: () => string) {}

    // Answers a sender's `CompanionHelloRequest`: one provider id per connection.
    register(sessionId: string): number {
        for (const [id, owner] of this.providers) {
            if (owner === sessionId) {
                return id;
            }
        }

        if (this.providers.size > MAX_PROVIDER_ID) {
            throw new Error('no free companion provider ids');
        }
        while (this.providers.has(this.nextProviderId)) {
            this.nextProviderId = (this.nextProviderId + 1) & MAX_PROVIDER_ID;
        }
        const id = this.nextProviderId;
        this.nextProviderId = (this.nextProviderId + 1) & MAX_PROVIDER_ID;
        this.providers.set(id, sessionId);
        logger.info(`Session ${sessionId} is companion provider ${id}`);
        return id;
    }

    unregister(sessionId: string) {
        for (const [id, owner] of [...this.providers]) {
            if (owner === sessionId) {
                this.providers.delete(id);
                for (const key of [...this.infoCache.keys()]) {
                    if (key.startsWith(`${id}/`)) {
                        this.infoCache.delete(key);
                    }
                }
            }
        }
    }

    // `fcomp://P.fcast/R` becomes the bridge URL; anything else is returned unchanged.
    rewriteUrl(value: string): string {
        const match = typeof value === 'string' ? FCOMP_URL.exec(value) : null;
        return match ? `${this.bridgeBase()}/fcomp/${Number(match[1])}/${Number(match[2])}` : value;
    }

    static isCompanionUrl(value: string): boolean {
        return typeof value === 'string' && FCOMP_URL.test(value);
    }

    route: IpcRoute = (req, res) => {
        const path = url.parse(req.url || '').pathname || '';
        const match = BRIDGE_PATH.exec(path);
        if (!match) {
            return false;
        }

        const provider = Number(match[1]);
        const resource = Number(match[2]);
        const session = this.providerSession(provider);
        if (!session) {
            logger.warn(`Request for resource ${resource} of unknown provider ${provider}`);
            res.writeHead(404);
            res.end();
            return true;
        }

        this.serve(session, provider, resource, req, res).catch((e) => {
            logger.warn(`Serving companion resource ${provider}/${resource} failed`, e);
            if (!res.headersSent) {
                res.writeHead(502);
            }
            res.end();
        });
        return true;
    };

    private providerSession(provider: number): FCastSession | null {
        const sessionId = this.providers.get(provider);
        const session = sessionId !== undefined ? this.getSession(sessionId) : undefined;
        return session && session.isV4 ? session : null;
    }

    private resourceInfo(session: FCastSession, provider: number, resource: number): Promise<CompanionResourceInfo> {
        const key = `${provider}/${resource}`;
        let info = this.infoCache.get(key);
        if (!info) {
            info = session.companionResourceInfo(resource);
            info.catch(() => this.infoCache.delete(key));
            this.infoCache.set(key, info);
        }
        return info;
    }

    private async serve(session: FCastSession, provider: number, resource: number, req: http.IncomingMessage, res: http.ServerResponse) {
        let closed = false;
        req.on('close', () => { closed = true; });

        const info = await this.resourceInfo(session, provider, resource);
        const size = info.size;
        const range = parseRange(req.headers.range as string | undefined, size);

        if (range === 'unsatisfiable') {
            res.writeHead(416, size !== null ? { 'Content-Range': `bytes */${size}` } : {});
            res.end();
            return;
        }

        const start = range ? range.start : 0;
        const end = range ? range.end : (size !== null ? size - 1 : null);
        const headers: http.OutgoingHttpHeaders = { 'Content-Type': info.contentType || 'application/octet-stream' };
        if (size !== null) {
            headers['Accept-Ranges'] = 'bytes';
        }

        if (size === 0 || (end !== null && end < start)) {
            headers['Content-Length'] = 0;
            res.writeHead(200, headers);
            res.end();
            return;
        }

        if (req.method === 'HEAD') {
            if (size !== null) {
                headers['Content-Length'] = end - start + 1;
                if (range) {
                    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
                }
            }
            res.writeHead(range && size !== null ? 206 : 200, headers);
            res.end();
            return;
        }

        const chunkEnd = (from: number) => end === null ? from + MAX_RESOURCE_READ_SIZE - 1 : Math.min(end, from + MAX_RESOURCE_READ_SIZE - 1);
        // Reads are issued ahead of time but written in order. With an unknown size, reads past
        // the end would be wasted, so they're issued one at a time.
        const pending: { from: number, to: number, data: Promise<Buffer | null> }[] = [];
        let next = start;
        const fill = () => {
            while (pending.length < (end === null ? 1 : READ_AHEAD) && (end === null || next <= end)) {
                const from = next;
                const to = chunkEnd(from);
                const data = session.companionRead(resource, from, to);
                // Handled when its turn comes; don't let an early rejection go unhandled.
                data.catch(() => undefined);
                pending.push({ from: from, to: to, data: data });
                next = to + 1;
            }
        };

        fill();
        const first = pending.shift();
        const firstData = await first.data;
        if (firstData === null) {
            res.writeHead(404);
            res.end();
            return;
        }

        if (size !== null) {
            headers['Content-Length'] = end - start + 1;
            if (range) {
                headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
            }
            res.writeHead(range ? 206 : 200, headers);
        } else if (range && start > 0) {
            // Without a total the only honest partial response is the bytes we have.
            res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${start + firstData.length - 1}/*`, 'Content-Length': firstData.length });
            res.end(firstData);
            return;
        } else {
            res.writeHead(200, headers);
        }

        let chunk: { from: number, to: number, data: Buffer } = { from: first.from, to: first.to, data: firstData };
        for (;;) {
            if (closed) {
                return;
            }
            if (chunk.data.length > 0 && !res.write(chunk.data)) {
                await new Promise<void>((resolve) => {
                    res.once('drain', resolve);
                    res.once('close', resolve);
                });
            }

            // A short read is the end of the resource.
            if (chunk.data.length < chunk.to - chunk.from + 1) {
                break;
            }

            fill();
            const nextRead = pending.shift();
            if (!nextRead) {
                break;
            }
            const data = await nextRead.data;
            if (data === null || data.length === 0) {
                break;
            }
            chunk = { from: nextRead.from, to: nextRead.to, data: data };
        }
        res.end();
    }
}
