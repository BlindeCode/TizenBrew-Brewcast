import * as crypto from 'crypto';
import * as net from 'net';
import * as tls from 'tls';
import * as flatbuffers from 'flatbuffers';
import { Packet } from 'common/v4/generated/fcast/v4';
import { Opcode } from 'common/Packets';

export interface TestPacket {
    opcode: number;
    body: Buffer;
}

// Minimal FCast sender for tests: frames packets and queues the ones it receives.
export class PacketStream {
    private pending = Buffer.alloc(0);
    private packets: TestPacket[] = [];
    private waiters: ((packet: TestPacket) => void)[] = [];
    private readonly onData = (data: Buffer) => this.receive(data);

    constructor(public readonly socket: net.Socket) {
        socket.on('data', this.onData);
    }

    // Stops reading so the socket can be handed to TLS.
    detach() {
        this.socket.removeListener('data', this.onData);
        this.socket.pause();
    }

    send(opcode: number, body: Uint8Array | string = null) {
        const data = body === null ? Buffer.alloc(0) : typeof body === 'string' ? Buffer.from(body, 'utf8') : Buffer.from(body);
        const header = Buffer.alloc(5);
        header.writeUInt32LE(data.length + 1, 0);
        header[4] = opcode;
        this.socket.write(Buffer.concat([header, data]));
    }

    sendJson(opcode: number, message: unknown) {
        this.send(opcode, JSON.stringify(message));
    }

    next(timeoutMs = 2000): Promise<TestPacket> {
        if (this.packets.length > 0) {
            return Promise.resolve(this.packets.shift());
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.waiters.splice(this.waiters.indexOf(waiter), 1);
                reject(new Error(`no packet within ${timeoutMs}ms`));
            }, timeoutMs);
            const waiter = (packet: TestPacket) => {
                clearTimeout(timer);
                resolve(packet);
            };
            this.waiters.push(waiter);
        });
    }

    // Returns the next packet whose opcode matches, dropping others (e.g. heartbeat pings).
    async nextOf(opcode: number, timeoutMs = 2000): Promise<TestPacket> {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            const packet = await this.next(Math.max(1, deadline - Date.now()));
            if (packet.opcode === opcode) {
                return packet;
            }
        }
    }

    private receive(data: Buffer) {
        this.pending = Buffer.concat([this.pending, data]);
        while (this.pending.length >= 4) {
            const size = this.pending.readUInt32LE(0);
            if (this.pending.length < 4 + size) {
                break;
            }

            const packet = { opcode: this.pending[4], body: Buffer.from(this.pending.subarray(5, 4 + size)) };
            this.pending = this.pending.subarray(4 + size);

            const waiter = this.waiters.shift();
            if (waiter) {
                waiter(packet);
            } else {
                this.packets.push(packet);
            }
        }
    }
}

export function flatPacket(packet: TestPacket): Packet {
    expect(packet.opcode).toBe(Opcode.Flatbuf);
    return Packet.getRootAsPacket(new flatbuffers.ByteBuffer(new Uint8Array(packet.body)));
}

export async function connectPlain(port: number): Promise<PacketStream> {
    const socket = net.connect(port, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('error', reject);
    });
    return new PacketStream(socket);
}

export function spkiFingerprintOf(socket: tls.TLSSocket): string {
    const spki = socket.getPeerX509Certificate().publicKey.export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(spki).digest('base64');
}

// Connects, negotiates v4 and upgrades to TLS, checking the receiver's fingerprint like a real
// sender does. The Version exchange happens in plaintext before the upgrade.
export async function connectV4(port: number, fingerprint: string): Promise<PacketStream> {
    const plain = await connectPlain(port);
    plain.sendJson(Opcode.Version, { version: 4 });

    const version = await plain.nextOf(Opcode.Version);
    expect(JSON.parse(version.body.toString('utf8'))).toEqual({ version: 4 });
    plain.detach();

    const secure = tls.connect({ socket: plain.socket, rejectUnauthorized: false, minVersion: 'TLSv1.3' });
    await new Promise<void>((resolve, reject) => {
        secure.once('secureConnect', () => resolve());
        secure.once('error', reject);
    });

    expect(secure.getProtocol()).toBe('TLSv1.3');
    expect(spkiFingerprintOf(secure)).toBe(fingerprint);
    return new PacketStream(secure);
}
