import * as net from 'net';
import { EventEmitter } from 'events';
import { Opcode, PlayMessage, SeekMessage, SetSpeedMessage, SetVolumeMessage, VersionMessage, InitialSenderMessage, SetPlaylistItemMessage, SubscribeEventMessage, UnsubscribeEventMessage, PROTOCOL_VERSION, V4_PROTOCOL_VERSION, InitialReceiverMessage, PlaybackUpdateMessage, VolumeUpdateMessage } from 'common/Packets';
import { Logger, LoggerType } from 'common/Logger';
import { getComputerName, getAppName, getAppVersion, getPlayMessage, getPlaybackUpdateMessage, getPlayerVolume, getV4JoinMessages } from 'src/Main';
import { v4 as uuidv4 } from 'modules/uuid';
import { AVCapabilities, LivestreamCapabilities, ReceiverCapabilities } from './Packets';
import { V4Identity } from 'common/v4/Certificate';
import {
    V4MediaCapabilities, V4DecodeError, ErrorKind, V4PlaybackState, decodeV4, encodeCompanionHelloResponse,
    encodeCompanionResourceInfoRequest, encodeCompanionResourceRequest, encodeError,
    encodeMirroringSessionDescription, encodePlaybackStateChanged, encodeProgressChanged, encodeReceiverIntroduction, encodeSpeedChanged, encodeVolumeChanged, parseResourcePacket, playbackStateToV4,
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
const COMPANION_REQUEST_TIMEOUT_MS = 30000;

// What a session needs to offer protocol v4. Without it, sessions negotiate v3 at most.
export interface V4Config {
    identity: V4Identity;
    mediaCapabilities: V4MediaCapabilities;
    volumeStepInterval: number;
}

// Who sent a request: the session, and the packet's sequence number for v4 `Error` replies.
export interface PacketOrigin {
    sessionId: string;
    packetNumber: number;
}

export interface CompanionResourceInfo {
    contentType: string;
    size: number | null;
}

interface CompanionRequest {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    // Resource reads: the parts received so far.
    parts?: Buffer[];
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
    // When the last packet arrived, for the v4 heartbeat.
    public lastPacketAt = Date.now();

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
    private lastProgressTime: number = null;
    private lastProgressSentAt = 0;
    // The player reports about once a second; between reports the position is extrapolated so
    // senders get progress at the interval they asked for.
    private lastUpdate: PlaybackUpdateMessage = null;
    private lastUpdateAt = 0;
    private progressTimer: ReturnType<typeof setInterval> = null;
    private progressTimerMs = 0;

    private mirroringSessionId: number = null;
    private companionRequests: Map<number, CompanionRequest> = new Map();
    private nextCompanionRequestId = 0;

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

    get isV4(): boolean {
        return this.protocolVersion >= V4_PROTOCOL_VERSION && !this.upgrading;
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

    // Called by the listener once the connection is gone.
    closed() {
        this.stopProgressTimer();
        const error = new Error('the sender disconnected');
        this.companionRequests.forEach((request) => {
            clearTimeout(request.timer);
            request.reject(error);
        });
        this.companionRequests.clear();
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

        this.sendV4Message(encodeReceiverIntroduction(
            { displayName: getComputerName(), appName: getAppName(), appVersion: getAppVersion() },
            this.v4Config.mediaCapabilities,
            this.v4Config.volumeStepInterval,
        ));

        const volume = getPlayerVolume();
        if (volume !== null && volume !== undefined) {
            this.sendV4Message(encodeVolumeChanged(volume));
        }

        // A sender joining mid-playback learns what's loaded (without request headers), its tracks
        // and its state.
        const join = getV4JoinMessages();
        join.forEach((message) => this.sendV4Message(message));
        const update = getPlaybackUpdateMessage();
        if (join.length > 0 && update) {
            this.sendV4PlaybackUpdate(update);
        }

        this.emitter.emit("version", new VersionMessage(V4_PROTOCOL_VERSION));
    }

    private handlePacket(opcode: number, body: string | undefined, origin: PacketOrigin) {
        logger.info(`handlePacket: (session: ${this.sessionId}, opcode: ${opcode}, body: ${body})`);

        try {
            switch (opcode) {
                case Opcode.Play:
                    this.emitter.emit("play", JSON.parse(body) as PlayMessage, origin);
                    break;
                case Opcode.Pause:
                    this.emitter.emit("pause", origin);
                    break;
                case Opcode.Resume:
                    this.emitter.emit("resume", origin);
                    break;
                case Opcode.Stop:
                    this.emitter.emit("stop", origin);
                    break;
                case Opcode.Seek:
                    this.emitter.emit("seek", JSON.parse(body) as SeekMessage, origin);
                    break;
                case Opcode.SetVolume:
                    this.emitter.emit("setvolume", JSON.parse(body) as SetVolumeMessage, origin);
                    break;
                case Opcode.SetSpeed:
                    this.emitter.emit("setspeed", JSON.parse(body) as SetSpeedMessage, origin);
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
                    this.emitter.emit("setplaylistitem", JSON.parse(body) as SetPlaylistItemMessage, origin);
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
        const origin: PacketOrigin = { sessionId: this.sessionId, packetNumber: this.packetsReceived };
        this.packetsReceived += 1;
        this.lastPacketAt = Date.now();

        if (!this.active) {
            this.active = true;
            if (opcode !== Opcode.Version) {
                logger.info(`Session ${this.sessionId} started without a version message, assuming v${this.protocolVersion}`);
            }
        }

        if (this.protocolVersion >= V4_PROTOCOL_VERSION) {
            this.handlePacketV4(opcode, this.buffer.subarray(1, this.packetLength), origin);
            return;
        }

        const body = this.packetLength > 1 ? this.buffer.toString('utf8', 1, this.packetLength) : null;
        this.handlePacket(opcode, body, origin);
    }

    private handlePacketV4(opcode: number, body: Buffer, origin: PacketOrigin) {
        switch (opcode) {
            case Opcode.Ping:
                this.writePacket(Opcode.Pong, Buffer.alloc(0));
                this.emitter.emit("ping");
                return;
            case Opcode.Pong:
                this.emitter.emit("pong");
                return;
            case Opcode.Resource:
                this.handleResourcePacket(body, origin);
                return;
            case Opcode.Flatbuf:
                break;
            default:
                logger.warn(`Session ${this.sessionId}: opcode ${opcode} is invalid in protocol v4`);
                this.sendV4Error(ErrorKind.InvalidOpcode, origin.packetNumber);
                return;
        }

        let message;
        try {
            message = decodeV4(body);
        } catch (e) {
            logger.warn(`Session ${this.sessionId}: malformed v4 message`, e);
            this.sendV4Error(e instanceof V4DecodeError ? ErrorKind.MalformedBody : ErrorKind.Internal, origin.packetNumber);
            return;
        }

        logger.info(`handlePacketV4: (session: ${this.sessionId}, message: ${message.type})`);

        switch (message.type) {
            case 'load':
                this.emitter.emit("play", message.play, origin);
                break;
            case 'seek':
                this.emitter.emit("seek", new SeekMessage(message.time), origin);
                break;
            case 'volume': {
                const volume = isNaN(message.volume) ? 0 : Math.min(1, Math.max(0, message.volume));
                if (volume !== message.volume) {
                    this.sendV4Error(ErrorKind.VolumeOutOfRange, origin.packetNumber);
                }
                this.emitter.emit("setvolume", new SetVolumeMessage(volume), origin);
                break;
            }
            case 'speed': {
                // Browsers can't play backwards, so only positive rates are valid here.
                const valid = isFinite(message.speed) && message.speed > 0;
                if (!valid) {
                    this.sendV4Error(ErrorKind.RateOutOfRange, origin.packetNumber);
                }
                this.emitter.emit("setspeed", new SetSpeedMessage(valid ? message.speed : 1), origin);
                break;
            }
            case 'playbackState':
                switch (message.state) {
                    case V4PlaybackState.Playing:
                        this.emitter.emit("resume", origin);
                        break;
                    case V4PlaybackState.Paused:
                        this.emitter.emit("pause", origin);
                        break;
                    case V4PlaybackState.Idle:
                    case V4PlaybackState.Ended:
                        this.emitter.emit("stop", origin);
                        break;
                    default:
                        // Like the reference receiver, requests for other states are ignored.
                        break;
                }
                break;
            case 'stop':
                this.emitter.emit("stop", origin);
                break;
            case 'queueItemSelected':
                this.emitter.emit("queueselect", { position: message.position }, origin);
                break;
            case 'queueInsert':
                this.emitter.emit("queueinsert", { item: message.item, position: message.position }, origin);
                break;
            case 'queueRemove':
                this.emitter.emit("queueremove", { position: message.position }, origin);
                break;
            case 'changeTrack':
                this.emitter.emit("changetrack", { trackType: message.trackType, id: message.id }, origin);
                break;
            case 'addSubtitleSource':
                this.emitter.emit("addsubtitle", { url: message.url, select: message.select, name: message.name }, origin);
                break;
            case 'senderIntroduction':
                this.emitter.emit("initial", new InitialSenderMessage(
                    message.deviceInfo.displayName, message.deviceInfo.appName, message.deviceInfo.appVersion));
                break;
            case 'progressUpdateInterval':
                // Per spec: at least 100ms, rounded to the closest 100ms.
                this.progressIntervalMs = Math.max(100, Math.round(message.intervalMs / 100) * 100);
                this.updateProgressTimer();
                break;
            case 'startMirroringSession':
                this.mirroringSessionId = message.sessionId;
                this.emitter.emit("mirroringstart", { mirroringSessionId: message.sessionId }, origin);
                break;
            case 'mirroringSessionDescription':
                // Only the announced session's offer is valid.
                if (message.sessionId !== this.mirroringSessionId) {
                    this.sendV4Error(ErrorKind.InvalidState, origin.packetNumber);
                } else {
                    this.emitter.emit("mirroringoffer", { sdp: message.sdp }, origin);
                }
                break;
            case 'companionHelloRequest':
                this.emitter.emit("companionhello", origin);
                break;
            case 'companionResourceInfoResponse': {
                const request = this.takeCompanionRequest(message.requestId);
                if (request) {
                    request.resolve({ contentType: message.contentType, size: message.size });
                }
                break;
            }
            case 'unsupported':
                // Receiver-to-sender messages and anything else a sender shouldn't send.
                this.sendV4Error(ErrorKind.InvalidPayloadType, origin.packetNumber);
                break;
        }
    }

    // ---- v4: messages the receiver sends ------------------------------------------------------

    // Writes a v4 FlatBuffers message; a no-op for sessions that aren't (yet) on v4.
    sendV4Message(data: Uint8Array) {
        if (this.protocolVersion >= V4_PROTOCOL_VERSION && !this.upgrading) {
            this.writePacket(Opcode.Flatbuf, data);
        }
    }

    sendV4Error(kind: ErrorKind, packetNumber: number | null) {
        this.sendV4Message(encodeError(kind, packetNumber));
    }

    // Playback states the v2/v3 model can't express (Buffering, Ended).
    sendV4PlaybackState(state: V4PlaybackState) {
        if (this.isV4 && state !== this.lastState) {
            this.lastState = state;
            this.sendV4Message(encodePlaybackStateChanged(state));
            this.updateProgressTimer();
        }
    }

    // Confirms a speed change even when nothing changed, like the reference receiver.
    sendV4Speed(speed: number) {
        if (this.isV4) {
            this.lastSpeed = speed;
            this.sendV4Message(encodeSpeedChanged(speed));
        }
    }

    sendCompanionHelloResponse(providerId: number) {
        this.sendV4Message(encodeCompanionHelloResponse(providerId));
    }

    sendMirroringAnswer(sdp: string): boolean {
        if (!this.isV4 || this.mirroringSessionId === null) {
            return false;
        }
        this.sendV4Message(encodeMirroringSessionDescription(this.mirroringSessionId, sdp));
        return true;
    }

    // ---- v4: FCompanion (media served by the sender over this connection) -----------------------

    private startCompanionRequest<T>(build: (requestId: number) => Uint8Array, collectParts: boolean): Promise<T> {
        if (!this.isV4) {
            return Promise.reject(new Error('not a v4 session'));
        }

        const requestId = this.nextCompanionRequestId;
        this.nextCompanionRequestId = (this.nextCompanionRequestId + 1) >>> 0;

        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.companionRequests.delete(requestId);
                reject(new Error(`companion request ${requestId} timed out`));
            }, COMPANION_REQUEST_TIMEOUT_MS);
            this.companionRequests.set(requestId, { resolve, reject, timer, parts: collectParts ? [] : undefined });
            this.sendV4Message(build(requestId));
        });
    }

    private takeCompanionRequest(requestId: number): CompanionRequest | null {
        const request = this.companionRequests.get(requestId);
        if (!request) {
            logger.warn(`Session ${this.sessionId}: response to unknown companion request ${requestId}`);
            return null;
        }
        clearTimeout(request.timer);
        this.companionRequests.delete(requestId);
        return request;
    }

    companionResourceInfo(resourceId: number): Promise<CompanionResourceInfo> {
        return this.startCompanionRequest((requestId) => encodeCompanionResourceInfoRequest(requestId, resourceId), false);
    }

    // Reads bytes [start, stopInclusive] of a resource. Resolves with the bytes the sender returned
    // (fewer at the end of the resource), or null if the resource doesn't exist.
    companionRead(resourceId: number, start: number, stopInclusive: number): Promise<Buffer | null> {
        return this.startCompanionRequest((requestId) => encodeCompanionResourceRequest(requestId, resourceId, start, stopInclusive), true);
    }

    private handleResourcePacket(body: Buffer, origin: PacketOrigin) {
        let part;
        try {
            part = parseResourcePacket(body);
        } catch (e) {
            logger.warn(`Session ${this.sessionId}: malformed Resource packet`, e);
            this.sendV4Error(ErrorKind.MalformedBody, origin.packetNumber);
            return;
        }

        const request = this.companionRequests.get(part.requestId);
        if (!request || !request.parts) {
            logger.warn(`Session ${this.sessionId}: Resource for unknown request ${part.requestId}`);
            return;
        }

        if (!part.found) {
            this.takeCompanionRequest(part.requestId).resolve(null);
            return;
        }

        // The body is a view of the receive buffer, which the next packet overwrites.
        request.parts[part.part] = Buffer.from(part.data);
        const received = request.parts.filter((p) => p !== undefined).length;
        if (received >= Math.max(1, part.totalParts)) {
            this.takeCompanionRequest(part.requestId).resolve(Buffer.concat(request.parts));
        }
    }

    // ---- v4: translating v2/v3 updates ---------------------------------------------------------

    // Translates the v2/v3 messages the rest of the receiver sends into v4 ones. Messages without
    // a v4 equivalent are dropped: after the upgrade a v4 sender rejects any other opcode. Loads,
    // queue changes and errors for v4 senders are sent explicitly, see ListenerService.sendV4.
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
                this.sendV4Message(encodeVolumeChanged((message as VolumeUpdateMessage).volume));
                break;
            default:
                break;
        }
    }

    private sendV4PlaybackUpdate(update: PlaybackUpdateMessage) {
        let state = playbackStateToV4(update.state);
        const now = Date.now();

        // An item that ended stays Ended (sent separately) until something else happens.
        if (state === V4PlaybackState.Idle && this.lastState === V4PlaybackState.Ended) {
            state = V4PlaybackState.Ended;
        }

        if (update.time !== null && update.time !== undefined) {
            // Progress goes out right away when the state changes or the position jumps (a seek);
            // while playing, the progress timer sends it at the requested interval.
            const speed = update.speed !== null && update.speed !== undefined ? update.speed : 1;
            const expected = this.lastProgressTime === null ? null :
                this.lastProgressTime + (this.lastState === V4PlaybackState.Playing ? (now - this.lastProgressSentAt) / 1000 * speed : 0);
            const jumped = expected === null || Math.abs(update.time - expected) > 1;

            this.lastUpdate = update;
            this.lastUpdateAt = now;
            if (state !== this.lastState || jumped) {
                this.lastProgressTime = update.time;
                this.lastProgressSentAt = now;
                this.sendV4Message(encodeProgressChanged(update.time, update.duration));
            }
        } else {
            this.lastUpdate = null;
        }

        if (state !== this.lastState) {
            this.lastState = state;
            this.sendV4Message(encodePlaybackStateChanged(state));
        }
        this.updateProgressTimer();

        if (update.speed !== null && update.speed !== undefined && update.speed !== this.lastSpeed) {
            this.lastSpeed = update.speed;
            this.sendV4Message(encodeSpeedChanged(update.speed));
        }
    }

    private stopProgressTimer() {
        if (this.progressTimer !== null) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    }

    // Runs while playing, at the sender's progress interval.
    private updateProgressTimer() {
        if (!this.isV4 || this.lastState !== V4PlaybackState.Playing || this.lastUpdate === null) {
            this.stopProgressTimer();
            return;
        }
        if (this.progressTimer !== null && this.progressTimerMs === this.progressIntervalMs) {
            return;
        }

        this.stopProgressTimer();
        this.progressTimerMs = this.progressIntervalMs;
        this.progressTimer = setInterval(() => this.sendExtrapolatedProgress(), this.progressIntervalMs);
    }

    private sendExtrapolatedProgress() {
        const update = this.lastUpdate;
        if (update === null || this.lastState !== V4PlaybackState.Playing) {
            this.updateProgressTimer();
            return;
        }

        const now = Date.now();
        const speed = update.speed !== null && update.speed !== undefined ? update.speed : 1;
        let position = update.time + (now - this.lastUpdateAt) / 1000 * speed;
        if (update.duration !== null && update.duration !== undefined && isFinite(update.duration) && update.duration > 0) {
            position = Math.min(position, update.duration);
        }

        this.lastProgressTime = position;
        this.lastProgressSentAt = now;
        this.sendV4Message(encodeProgressChanged(position, update.duration));
    }

    bindEvents(emitter: EventEmitter) {
        const forward = (event: string) => this.emitter.on(event, (...args: unknown[]) => { emitter.emit(event, ...args) });
        ["play", "pause", "resume", "stop", "seek", "setvolume", "setspeed", "version", "initial", "setplaylistitem",
            "queueselect", "queueinsert", "queueremove", "changetrack", "addsubtitle", "mirroringstart", "mirroringoffer",
            "companionhello"].forEach(forward);
        this.emitter.on("ping", () => { emitter.emit("ping", this.sessionId) });
        this.emitter.on("pong", () => { emitter.emit("pong", this.sessionId) });
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
