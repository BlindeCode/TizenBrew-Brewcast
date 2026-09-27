import * as net from 'net';
import * as tls from 'tls';
import { ListenerService } from 'common/ListenerService';
import { FCastSession, V4Config } from 'common/FCastSession';
import { Logger, LoggerType } from 'common/Logger';
const logger = new Logger('TcpListenerService', LoggerType.BACKEND);

const TLS_UPGRADE_TIMEOUT_MS = 10000;

export class TcpListenerService extends ListenerService {
    public static readonly PORT = 46899;
    private server: net.Server;
    private v4Config: V4Config;

    // Pass a V4Config to offer protocol v4 (TLS 1.3 + FlatBuffers); without one, sessions
    // negotiate v3 at most.
    constructor(v4Config: V4Config = null) {
        super();
        this.v4Config = v4Config;
    }

    start(port: number = TcpListenerService.PORT) {
        if (this.server != null) {
            return;
        }

        this.server = net.createServer()
            .listen(port)
            .on("connection", this.handleConnection.bind(this))
            .on("error", this.handleServerError.bind(this));
    }

    stop() {
        if (this.server == null) {
            return;
        }

        const server = this.server;
        this.server = null;

        // close() only stops accepting; the senders' connections would keep the server alive.
        server.close();
        this.sessionMap.forEach((session) => session.socket.destroy());
    }

    // The bound port, or null before listening (tests start on port 0).
    get port(): number {
        const address = this.server ? this.server.address() : null;
        return address && typeof address === 'object' ? address.port : null;
    }

    disconnect(sessionId: string) {
        this.sessionMap.get(sessionId)?.socket.destroy();
        this.sessionMap.delete(sessionId);
    }

    public getSenders(): string[] {
        const senders = [];
        this.sessionMap.forEach((sender) => { senders.push(sender.remoteAddress); });
        return senders;
    }

    private handleConnection(socket: net.Socket) {
        logger.info(`New connection from ${socket.remoteAddress}:${socket.remotePort}`);
        const address = socket.remoteAddress;
        const port = socket.remotePort;

        const session = new FCastSession(socket, (data) => socket.write(data), this.v4Config);
        session.remoteAddress = address;
        session.bindEvents(this.emitter);
        this.sessionMap.set(session.sessionId, session);

        const onData = (buffer: Buffer) => {
            try {
                session.processBytes(buffer);
            } catch (e) {
                logger.warn(`Error while handling packet from ${address}:${port}.`, e);
                socket.destroy();
            }
        };

        // After a TLS upgrade either socket may report the close, so clean up once.
        let closed = false;
        const onClose = () => {
            if (closed) {
                return;
            }
            closed = true;
            session.closed();
            this.sessionMap.delete(session.sessionId);
            this.emitter.emit('disconnect', { sessionId: session.sessionId, type: 'tcp', data: { address: address, port: port }});
        };

        if (this.v4Config !== null) {
            session.onUpgradeRequest = (prefix: Buffer) => {
                socket.removeListener("data", onData);
                this.upgradeToTls(session, socket, prefix, onClose);
            };
        }

        socket.on("error", (err) => {
            logger.warn(`Error from ${address}:${port}.`, err);
            this.disconnect(session.sessionId);
        });

        socket.on("data", onData);
        socket.on("close", onClose);

        this.emitter.emit('connect', { sessionId: session.sessionId, type: 'tcp', data: { address: address, port: port }});
        try {
            logger.info('Sending version');
            session.sendVersion();
        } catch (e) {
            logger.info('Failed to send version', e);
        }
    }

    // Upgrades the connection to TLS in place, as protocol v4 requires. `prefix` holds bytes that
    // were read past the sender's `Version` packet: the start of its TLS ClientHello.
    private upgradeToTls(session: FCastSession, socket: net.Socket, prefix: Buffer, onClose: () => void) {
        // Pause before unshifting so the prefix is buffered rather than emitted to no listener.
        // TLSSocket feeds any buffered data to the handshake when it starts reading.
        socket.pause();
        if (prefix.length > 0) {
            socket.unshift(prefix);
        }

        const tlsSocket = new tls.TLSSocket(socket, {
            isServer: true,
            secureContext: this.v4Config.identity.secureContext,
            requestCert: false,
        });

        const timeout = setTimeout(() => {
            logger.warn(`TLS upgrade of session ${session.sessionId} timed out`);
            tlsSocket.destroy();
        }, TLS_UPGRADE_TIMEOUT_MS);

        tlsSocket.on("error", (err) => {
            clearTimeout(timeout);
            logger.warn(`TLS error in session ${session.sessionId}.`, err);
            socket.destroy();
        });
        tlsSocket.on("close", () => {
            clearTimeout(timeout);
            onClose();
        });

        tlsSocket.once("secure", () => {
            clearTimeout(timeout);
            tlsSocket.on("data", (buffer: Buffer) => {
                try {
                    session.processBytes(buffer);
                } catch (e) {
                    logger.warn(`Error while handling packet in session ${session.sessionId}.`, e);
                    tlsSocket.destroy();
                }
            });

            try {
                session.completeV4Upgrade(tlsSocket, (data) => tlsSocket.write(data));
            } catch (e) {
                logger.warn(`Failed to start v4 session ${session.sessionId}.`, e);
                tlsSocket.destroy();
            }
        });
    }
}
