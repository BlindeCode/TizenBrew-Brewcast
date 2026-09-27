import * as net from 'net';
import { EventEmitter } from 'events';
import { Opcode, PlayMessage, SeekMessage, SetSpeedMessage, SetVolumeMessage, VersionMessage, InitialSenderMessage, SetPlaylistItemMessage, SubscribeEventMessage, UnsubscribeEventMessage, PROTOCOL_VERSION, V4_PROTOCOL_VERSION, InitialReceiverMessage, PlaybackUpdateMessage, VolumeUpdateMessage, PlayUpdateMessage } from 'common/Packets';
import { Logger, LoggerType } from 'common/Logger';
import { getComputerName, getAppName, getAppVersion, getPlayMessage, getPlaybackUpdateMessage, getPlayerVolume } from 'src/Main';
import { v4 as uuidv4 } from 'modules/uuid';
import { AVCapabilities, LivestreamCapabilities, ReceiverCapabilities } from './Packets';
import { V4Identity } from 'common/v4/Certificate';
import {
    V4MediaCapabilities, V4DecodeError, ErrorKind, Message, V4PlaybackState, decodeV4, encodeError, encodeLoad,
    encodePlaybackStateChanged, encodeProgressChanged, encodeQueueItemSelected, encodeReceiverIntroduction,
    encodeSpeedChanged, encodeVolumeChanged, playbackStateToV4,
} from 'common/v4/Codec';
const logger = new Logger('FCastSession', LoggerType.BACKEND);

enum SessionState {
    Idle = 0,
    WaitingForLength,
    WaitingForData,
    Disconnected,
};

const LENGTH_BYTES = 4;
const MAXIMUM_PACKET_LENGTH = 32000;
const V4_MAXIMUM_PACKET_LENGTH = 512 * 1024;
const V4_DEFAULT_PROGRESS_INTERVAL_MS = 500;

// What a session needs to offer protocol v4. Without it, sessions negotiate v3 at most.
export interface V4Config {
    identity: V4Identity;
    mediaCapabilities: V4MediaCapabilities;
    volumeStepInterval: number;
}

export class FCastSession {
    public sessionId: string;
    public protocolVersion: number;
    public remoteAddress: string = null;
    buffer: Buffer = Buffer.alloc(MAXIMUM_PACKET_LENGTH);
    bytesRead = 0;
    packetLength = 0;
    socket: net.Socket;
    writer: (data: Buffer) => void;
    state: SessionState;
    emitter = new EventEmitter();

    // Called with the bytes that followed the sender's v4 `Version` packet; they are the start of
    // the TLS handshake. The listener upgrades the connection and then calls `completeV4Upgrade`.
    public onUpgradeRequest: (prefix: Buffer) => void = null;

    private sentInitialMessage: boolean;
    private v4Config: V4Config;
    private maximumPacketLength = MAXIMUM_PACKET_LENGTH;
    // Nothing but our own `Version` is sent until the sender's first packet: a sender that is
    // still negotiating treats any other message as a protocol error.
    private active = false;
    private upgrading = false;
    private upgradePending = false;
    private packetsReceived = 0;

    // v4 state for translating v2/v3 updates into v4 messages
    private progressIntervalMs = V4_DEFAULT_PROGRESS_INTERVAL_MS;
    private lastState: V4PlaybackState = null;
    private lastSpeed: number = null;
    private lastItemIndex: number = null;
    private lastProgressTime: number = null;
    private lastProgressSentAt = 0;
    private lastLoadFromSender: PlayMessage = null;

    constructor(socket: net.Socket, writer: (data: Buffer) => void, v4Config: V4Config = null) {
        this.sessionId = uuidv4();
        // Not all senders send a version message to the receiver on connection. Choosing version 2
        // as the base version since most/all current senders support this version.
        this.protocolVersion = 2;
        this.sentInitialMessage = false;
        this.socket = socket;
        this.writer = writer;
        this.v4Config = v4Config;
        this.state = SessionState.WaitingForLength;
    }

    // The highest protocol version this session can offer to the sender.
    get maximumVersion(): number {
        return this.v4Config !== null ? V4_PROTOCOL_VERSION : PROTOCOL_VERSION;
    }

    sendVersion() {
        this.writePacket(Opcode.Version, Buffer.from(JSON.stringify(new VersionMessage(this.maximumVersion)), 'utf8'));
    }

    send(opcode: number, message = null) {
        if (!this.active || this.upgrading) {
            return;
        }

        if (this.protocolVersion >= V4_PROTOCOL_VERSION) {
            this.sendV4(opcode, message);
            return;
        }

        if (!this.isSupportedOpcode(opcode)) {
            return;
        }

        message = this.stripUnsupportedFields(opcode, message);
        const json = message ? JSON.stringify(message) : null;
        logger.info(`send: (session: ${this.sessionId}, opcode: ${opcode}, body: ${json})`);

        let data: Uint8Array;
        if (json) {
            // Do NOT use the TextEncoder utility class, it does not exist in the NodeJS runtime
            // for webOS 6.0 and earlier...
            data = Buffer.from(json, 'utf8');
        } else  {
            data = Buffer.alloc(0);
        }

        this.writePacket(opcode, data);
    }

    private writePacket(opcode: number, data: Uint8Array) {
        const size = 1 + data.length;
        const header = Buffer.alloc(4 + 1);

        // webOS 22 and earlier node versions do not support `writeUint32LE` despite nodejs stating
        // it should be supported in those versions... `writeUIntLE` however works instead.
        // @ts-ignore
        if (TARGET === 'webOS') {
            header.writeUIntLE(size, 0, 4);
        } else {
            header.writeUint32LE(size, 0);
        }

        header[4] = opcode;

        let packet: Buffer;
        if (data.length > 0) {
            packet = Buffer.concat([ header, data ]);
        } else {
            packet = header;
        }

        this.writer(packet);
    }

    close() {
        this.socket.end();
    }

    processBytes(receivedBytes: Buffer) {
        //TODO: Multithreading?

        if (receivedBytes.length == 0) {
            return;
        }

        logger.debug(`${receivedBytes.length} bytes received`);

        switch (this.state) {
            case SessionState.WaitingForLength:
                this.handleLengthBytes(receivedBytes);
                break;
            case SessionState.WaitingForData:
                this.handlePacketBytes(receivedBytes);
                break;
            default:
                logger.warn(`Data received is unhandled in current session state ${this.state}.`);
                break;
        }
    }

    private handleLengthBytes(receivedBytes: Buffer) {
        const remaining = LENGTH_BYTES - this.bytesRead;
        const bytesToRead = Math.min(remaining, receivedBytes.length);
        const bytesRemaining = receivedBytes.length - bytesToRead;
        receivedBytes.copy(this.buffer, this.bytesRead, 0, bytesToRead);
        this.bytesRead += bytesToRead;

        logger.debug(`handleLengthBytes: Read ${bytesToRead} bytes from packet`);

        if (this.bytesRead >= LENGTH_BYTES) {
            this.state = SessionState.WaitingForData;
            this.packetLength = this.buffer.readUInt32LE(0);
            this.bytesRead = 0;
            logger.debug(`Packet length header received from: ${this.packetLength}`);

            if (this.packetLength > this.maximumPacketLength) {
                throw new Error(`Maximum packet length is ${this.maximumPacketLength} bytes: ${this.packetLength}`);
            }
            if (this.packetLength === 0 && this.protocolVersion >= V4_PROTOCOL_VERSION) {
                throw new Error('Received a packet without an opcode');
            }

            if (bytesRemaining > 0) {
                logger.debug(`${bytesRemaining} remaining bytes pushed to handlePacketBytes`);
                this.handlePacketBytes(receivedBytes.slice(bytesToRead));
            }
        }
    }

    private handlePacketBytes(receivedBytes: Buffer) {
        const remaining = this.packetLength - this.bytesRead;
        const bytesToRead = Math.min(remaining, receivedBytes.length);
        const bytesRemaining = receivedBytes.length - bytesToRead;
        receivedBytes.copy(this.buffer, this.bytesRead, 0, bytesToRead);
        this.bytesRead += bytesToRead;

        logger.debug(`handlePacketBytes: Read ${bytesToRead} bytes from packet`);

        if (this.bytesRead >= this.packetLength) {
            logger.debug(`handlePacketBytes: Finished handling packet with ${this.packetLength} bytes. Total bytes read ${this.bytesRead}.`);
            this.handleNextPacket();

            this.state = SessionState.WaitingForLength;
            this.packetLength = 0;
            this.bytesRead = 0;

            if (this.upgradePending) {
                // Everything after the `Version` packet belongs to the TLS handshake.
                this.upgradePending = false;
                this.upgrading = true;
                this.onUpgradeRequest(Buffer.from(receivedBytes.slice(bytesToRead)));
                return;
            }

            if (bytesRemaining > 0) {
                logger.debug(`${bytesRemaining} remaining bytes pushed to handleLengthBytes`);
                this.handleLengthBytes(receivedBytes.slice(bytesToRead));
            }
        }
    }

    // Called by the listener once the TLS handshake finished; `writer` writes to the TLS stream.
    completeV4Upgrade(socket: net.Socket, writer: (data: Buffer) => void) {
        this.socket = socket;
        this.writer = writer;
        this.protocolVersion = V4_PROTOCOL_VERSION;
        this.maximumPacketLength = V4_MAXIMUM_PACKET_LENGTH;
        this.buffer = Buffer.alloc(V4_MAXIMUM_PACKET_LENGTH);
        this.upgrading = false;
        logger.info(`Session ${this.sessionId} upgraded to protocol v4`);

        this.writeFlatbuf(encodeReceiverIntroduction(
            { displayName: getComputerName(), appName: getAppName(), appVersion: getAppVersion() },
            this.v4Config.mediaCapabilities,
            this.v4Config.volumeStepInterval,
        ));

        const volume = getPlayerVolume();
        if (volume !== null && volume !== undefined) {
            this.writeFlatbuf(encodeVolumeChanged(volume));
        }

        const playMessage = getPlayMessage();
        if (playMessage) {
            this.writeFlatbuf(encodeLoad(playMessage));
            const update = getPlaybackUpdateMessage();
            if (update) {
                this.sendV4PlaybackUpdate(update);
            }
        }

        this.emitter.emit("version", new VersionMessage(V4_PROTOCOL_VERSION));
    }

    private handlePacket(opcode: number, body: string | undefined) {
        logger.info(`handlePacket: (session: ${this.sessionId}, opcode: ${opcode}, body: ${body})`);

        try {
            switch (opcode) {
                case Opcode.Play:
                    this.emitter.emit("play", JSON.parse(body) as PlayMessage);
                    break;
                case Opcode.Pause:
                    this.emitter.emit("pause");
                    break;
                case Opcode.Resume:
                    this.emitter.emit("resume");
                    break;
                case Opcode.Stop:
                    this.emitter.emit("stop");
                    break;
                case Opcode.Seek:
                    this.emitter.emit("seek", JSON.parse(body) as SeekMessage);
                    break;
                case Opcode.SetVolume:
                    this.emitter.emit("setvolume", JSON.parse(body) as SetVolumeMessage);
                    break;
                case Opcode.SetSpeed:
                    this.emitter.emit("setspeed", JSON.parse(body) as SetSpeedMessage);
                    break;
                case Opcode.Version: {
                    const versionMessage = JSON.parse(body) as VersionMessage;

                    if (versionMessage.version >= V4_PROTOCOL_VERSION && this.v4Config !== null && this.onUpgradeRequest !== null) {
                        // Both sides speak v4: upgrade this connection to TLS in place.
                        this.upgradePending = true;
                        break;
                    }

                    // The side with the higher version downgrades to the other's.
                    if (versionMessage.version > 0) {
                        this.protocolVersion = Math.min(versionMessage.version, PROTOCOL_VERSION);
                    }
                    if (!this.sentInitialMessage && this.protocolVersion >= 3) {
                        this.send(Opcode.Initial, new InitialReceiverMessage(
                            getComputerName(),
                            getAppName(),
                            getAppVersion(),
                            getPlayMessage(),
                            new ReceiverCapabilities(
                                new AVCapabilities(
                                    new LivestreamCapabilities(true)
                                )
                            ),
                        ));

                        const updateMessage = getPlaybackUpdateMessage();
                        if (updateMessage) {
                            this.send(Opcode.PlaybackUpdate, updateMessage);
                        }
                        this.sentInitialMessage = true;
                    }

                    this.emitter.emit("version", versionMessage);
                    break;
                }
                case Opcode.Ping:
                    this.send(Opcode.Pong);
                    this.emitter.emit("ping");
                    break;
                case Opcode.Pong:
                    this.emitter.emit("pong");
                    break;
                case Opcode.Initial:
                    this.emitter.emit("initial", JSON.parse(body) as InitialSenderMessage);
                    break;
                case Opcode.SetPlaylistItem:
                    this.emitter.emit("setplaylistitem", JSON.parse(body) as SetPlaylistItemMessage);
                    break;
                case Opcode.SubscribeEvent:
                    this.emitter.emit("subscribeevent", JSON.parse(body) as SubscribeEventMessage);
                    break;
                case Opcode.UnsubscribeEvent:
                    this.emitter.emit("unsubscribeevent", JSON.parse(body) as UnsubscribeEventMessage);
                    break;
            }
        } catch (e) {
            logger.warn(`Error handling packet from.`, e);
        }
    }

    private handleNextPacket() {
        const opcode = this.buffer[0];
        const packetNumber = this.packetsReceived;
        this.packetsReceived += 1;

        if (!this.active) {
            this.active = true;
            if (opcode !== Opcode.Version) {
                logger.info(`Session ${this.sessionId} started without a version message, assuming v${this.protocolVersion}`);
            }
        }

        if (this.protocolVersion >= V4_PROTOCOL_VERSION) {
            this.handlePacketV4(opcode, this.buffer.subarray(1, this.packetLength), packetNumber);
            return;
        }

        const body = this.packetLength > 1 ? this.buffer.toString('utf8', 1, this.packetLength) : null;
        this.handlePacket(opcode, body);
    }

    private handlePacketV4(opcode: number, body: Buffer, packetNumber: number) {
        switch (opcode) {
            case Opcode.Ping:
                this.writePacket(Opcode.Pong, Buffer.alloc(0));
                this.emitter.emit("ping");
                return;
            case Opcode.Pong:
                this.emitter.emit("pong");
                return;
            case Opcode.Flatbuf:
                break;
            default:
                // Includes `Resource`: FCompanion isn't supported, so we never request resources.
                logger.warn(`Session ${this.sessionId}: opcode ${opcode} is invalid in protocol v4`);
                this.writeFlatbuf(encodeError(ErrorKind.InvalidOpcode, packetNumber));
                return;
        }

        let message;
        try {
            message = decodeV4(body);
        } catch (e) {
            logger.warn(`Session ${this.sessionId}: malformed v4 message`, e);
            this.writeFlatbuf(encodeError(e instanceof V4DecodeError ? ErrorKind.MalformedBody : ErrorKind.Internal, packetNumber));
            return;
        }

        logger.info(`handlePacketV4: (session: ${this.sessionId}, message: ${JSON.stringify(message)})`);

        switch (message.type) {
            case 'load':
                this.lastLoadFromSender = message.play;
                this.emitter.emit("play", message.play);
                break;
            case 'seek':
                this.emitter.emit("seek", new SeekMessage(message.time));
                break;
            case 'volume': {
                const volume = isNaN(message.volume) ? 0 : Math.min(1, Math.max(0, message.volume));
                if (volume !== message.volume) {
                    this.writeFlatbuf(encodeError(ErrorKind.VolumeOutOfRange, packetNumber));
                }
                this.emitter.emit("setvolume", new SetVolumeMessage(volume));
                break;
            }
            case 'speed': {
                const valid = isFinite(message.speed) && message.speed > 0;
                if (!valid) {
                    this.writeFlatbuf(encodeError(ErrorKind.RateOutOfRange, packetNumber));
                }
                this.emitter.emit("setspeed", new SetSpeedMessage(valid ? message.speed : 1));
                break;
            }
            case 'playbackState':
                switch (message.state) {
                    case V4PlaybackState.Playing:
                        this.emitter.emit("resume");
                        break;
                    case V4PlaybackState.Paused:
                        this.emitter.emit("pause");
                        break;
                    case V4PlaybackState.Idle:
                        this.emitter.emit("stop");
                        break;
                    default:
                        this.writeFlatbuf(encodeError(ErrorKind.InvalidState, packetNumber));
                        break;
                }
                break;
            case 'stop':
                this.emitter.emit("stop");
                break;
            case 'queueItemSelected':
                if (message.position.kind === 'index') {
                    this.emitter.emit("setplaylistitem", new SetPlaylistItemMessage(message.position.index));
                } else if (message.position.kind === 'front') {
                    this.emitter.emit("setplaylistitem", new SetPlaylistItemMessage(0));
                } else {
                    // The v3 playlist model has no way to address the last item.
                    this.writeFlatbuf(encodeError(ErrorKind.QueuePositionOutOfRange, packetNumber));
                }
                break;
            case 'senderIntroduction':
                this.emitter.emit("initial", new InitialSenderMessage(
                    message.deviceInfo.displayName, message.deviceInfo.appName, message.deviceInfo.appVersion));
                break;
            case 'progressUpdateInterval':
                // Per spec: at least 100ms, rounded to the closest 100ms.
                this.progressIntervalMs = Math.max(100, Math.round(message.intervalMs / 100) * 100);
                break;
            case 'unsupported':
                if (message.message === Message.CompanionHelloRequest) {
                    // FCompanion (sender-served media) isn't supported yet. Not answering leaves
                    // companion loads pending in the sender; everything else works normally.
                    logger.info(`Session ${this.sessionId}: ignoring CompanionHelloRequest`);
                } else {
                    this.writeFlatbuf(encodeError(ErrorKind.InvalidPayloadType, packetNumber));
                }
                break;
        }
    }

    private writeFlatbuf(data: Uint8Array) {
        this.writePacket(Opcode.Flatbuf, data);
    }

    // Translates the v2/v3 messages the rest of the receiver sends into v4 ones. Messages without
    // a v4 equivalent are dropped: after the upgrade a v4 sender rejects any other opcode.
    private sendV4(opcode: number, message: unknown) {
        switch (opcode) {
            case Opcode.Ping:
            case Opcode.Pong:
                this.writePacket(opcode, Buffer.alloc(0));
                break;
            case Opcode.PlaybackUpdate:
                this.sendV4PlaybackUpdate(message as PlaybackUpdateMessage);
                break;
            case Opcode.VolumeUpdate:
                this.writeFlatbuf(encodeVolumeChanged((message as VolumeUpdateMessage).volume));
                break;
            case Opcode.PlaybackError:
                this.writeFlatbuf(encodeError(ErrorKind.Internal, null));
                break;
            case Opcode.PlayUpdate: {
                const playData = (message as PlayUpdateMessage).playData;
                // The spec relays a load to the *other* senders. The listener passes the same
                // PlayMessage object this session emitted, so skip our own load when it comes back.
                if (playData && playData !== this.lastLoadFromSender) {
                    this.writeFlatbuf(encodeLoad(playData));
                }
                this.lastLoadFromSender = null;
                break;
            }
            default:
                break;
        }
    }

    private sendV4PlaybackUpdate(update: PlaybackUpdateMessage) {
        const state = playbackStateToV4(update.state);
        const now = Date.now();

        if (update.itemIndex !== null && update.itemIndex !== undefined && update.itemIndex !== this.lastItemIndex) {
            this.lastItemIndex = update.itemIndex;
            this.writeFlatbuf(encodeQueueItemSelected(update.itemIndex));
        }

        if (update.time !== null && update.time !== undefined) {
            // Progress goes out at the requested interval while playing, and immediately when the
            // state changes or the position jumps (a seek).
            const speed = update.speed !== null && update.speed !== undefined ? update.speed : 1;
            const expected = this.lastProgressTime === null ? null :
                this.lastProgressTime + (this.lastState === V4PlaybackState.Playing ? (now - this.lastProgressSentAt) / 1000 * speed : 0);
            const jumped = expected === null || Math.abs(update.time - expected) > 1;

            if (state !== this.lastState || jumped || (state === V4PlaybackState.Playing && now - this.lastProgressSentAt >= this.progressIntervalMs)) {
                this.lastProgressTime = update.time;
                this.lastProgressSentAt = now;
                this.writeFlatbuf(encodeProgressChanged(update.time, update.duration));
            }
        }

        if (state !== this.lastState) {
            this.lastState = state;
            this.writeFlatbuf(encodePlaybackStateChanged(state));
        }

        if (update.speed !== null && update.speed !== undefined && update.speed !== this.lastSpeed) {
            this.lastSpeed = update.speed;
            this.writeFlatbuf(encodeSpeedChanged(update.speed));
        }
    }

    bindEvents(emitter: EventEmitter) {
        this.emitter.on("play", (body: PlayMessage) => { emitter.emit("play", body) });
        this.emitter.on("pause", () => { emitter.emit("pause") });
        this.emitter.on("resume", () => { emitter.emit("resume") });
        this.emitter.on("stop", () => { emitter.emit("stop") });
        this.emitter.on("seek", (body: SeekMessage) => { emitter.emit("seek", body) });
        this.emitter.on("setvolume", (body: SetVolumeMessage) => { emitter.emit("setvolume", body) });
        this.emitter.on("setspeed", (body: SetSpeedMessage) => { emitter.emit("setspeed", body) });
        this.emitter.on("version", (body: VersionMessage) => { emitter.emit("version", body) });
        this.emitter.on("ping", () => { emitter.emit("ping", this.sessionId) });
        this.emitter.on("pong", () => { emitter.emit("pong", this.sessionId) });
        this.emitter.on("initial", (body: InitialSenderMessage) => { emitter.emit("initial", body) });
        this.emitter.on("setplaylistitem", (body: SetPlaylistItemMessage) => { emitter.emit("setplaylistitem", body) });
        this.emitter.on("subscribeevent", (body: SubscribeEventMessage) => { emitter.emit("subscribeevent", { sessionId: this.sessionId, body: body }) });
        this.emitter.on("unsubscribeevent", (body: UnsubscribeEventMessage) => { emitter.emit("unsubscribeevent", { sessionId: this.sessionId, body: body }) });
    }

    private isSupportedOpcode(opcode: number) {
        switch (this.protocolVersion) {
            case 1:
                return opcode <= 8;

            case 2:
                return opcode <= 13;

            case 3:
                return opcode <= 19;

            default:
                return false;
        }
    }

    private stripUnsupportedFields(opcode: number, message: any = null): any {
        // The same message object is sent to every session, so strip a copy.
        message = message ? Object.assign({}, message) : message;

        switch (this.protocolVersion) {
            case 1: {
                switch (opcode) {
                    case Opcode.Play:
                        delete message.speed;
                        delete message.headers;
                        break;
                    case Opcode.PlaybackUpdate:
                        delete message.generationTime;
                        delete message.duration;
                        delete message.speed;

                        message.time = message.time !== null ? message.time : 0;
                        break;
                    case Opcode.VolumeUpdate:
                        delete message.generationTime;
                        break;
                    default:
                        break;
                }

                // fallthrough
            }
            case 2: {
                switch (opcode) {
                    case Opcode.Play:
                        delete message.volume;
                        delete message.metadata;
                        break;
                    case Opcode.PlaybackUpdate:
                        delete message.itemIndex;

                        message.time = message.time !== null ? message.time : 0;
                        message.duration = message.duration !== null ? message.duration : 0;
                        message.speed = message.speed !== null ? message.speed : 1;
                        break;
                    default:
                        break;
                }

                // fallthrough
            }
            case 3:
                break;

            default:
                break;
        }

        return message;
    }
}
