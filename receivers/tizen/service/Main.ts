// BrewCast network service: TizenBrew runs this bundle (package.json `serviceFile`) in its Node
// service. Ported from upstream's webOS service (receivers/webos/fcast-receiver-service at
// 5c79300), with the Luna bus replaced by a local HTTP/SSE channel (Ipc.ts) and protocol v4 added.
import * as fs from 'fs';
import * as os from 'os';
import { EventEmitter } from 'events';
import { EventMessage, EventType, Opcode, PlaybackUpdateMessage, V4_PROTOCOL_VERSION, PROTOCOL_VERSION, VolumeUpdateMessage } from 'common/Packets';
import { DiscoveryService } from 'common/DiscoveryService';
import { TcpListenerService } from 'common/TcpListenerService';
import { ConnectionMonitor } from 'common/ConnectionMonitor';
import { Logger, LoggerType } from 'common/Logger';
import { ToastIcon } from 'common/components/Toast';
import { V4Config } from 'common/FCastSession';
import { loadOrCreateV4Identity, v4UnsupportedReason } from 'common/v4/Certificate';
import { V4MediaCapabilities, encodeLoadSource } from 'common/v4/Codec';
import { IpcServer, IPC_PORT } from 'src/Ipc';
import { dataPath, fetchDeviceName, launchModule } from 'src/Platform';
import { Companion } from 'src/Companion';
import { MediaSession, PlaybackErrorKind, TrackReport } from 'src/MediaSession';
import { subtitleRoute, subtitleRouteUrl } from 'src/Subtitles';

const logger = new Logger('Main', LoggerType.BACKEND);

const APP_NAME = 'BrewCast';
// Replaced at build time from package.json.
declare const APP_VERSION: string;

const CAPABILITIES_FILE = 'brewcast-capabilities.json';

// What the TV's player handles, as v4 format tokens (fcast.fbs). Senders use this to decide what
// to send or transcode. These are conservative defaults: the player page probes the TV and
// reports what it actually supports (`report_capabilities`), which is kept for later sessions.
const DEFAULT_MEDIA_CAPABILITIES: V4MediaCapabilities = {
    protocols: ['http', 'https', 'data'],
    containers: ['mp4', 'quicktime', 'webm', 'mkv', 'mpegts', 'hls', 'dash'],
    videoFormats: ['h264', 'h265', 'vp8', 'vp9'],
    audioFormats: ['aac', 'mp3', 'ac3', 'eac3', 'opus', 'vorbis', 'flac', 'pcm'],
    // External subtitles are converted to WebVTT by the service (Subtitles.ts).
    subtitleFormats: ['vtt', 'srt', 'ass', 'ssa'],
    hdrFormats: [],
    imageFormats: ['png', 'jpeg', 'gif', 'webp', 'bmp'],
    externalSubtitles: true,
    // Needs WebRTC in the TV's browser, which only the pages can tell.
    mirroring: false,
};

// What a page found out about the TV's browser (see src/Capabilities.ts).
interface PageCapabilities {
    webrtc: boolean;
    containers?: string[];
    videoFormats?: string[];
    audioFormats?: string[];
    imageFormats?: string[];
}

class AppCache {
    public deviceName: string = null;
    public fingerprint: string = null;
    public protocolVersion = PROTOCOL_VERSION;
}

export class Main {
    static tcpListenerService: TcpListenerService;
    static discoveryService: DiscoveryService;
    static connectionMonitor: ConnectionMonitor;
    static ipc: IpcServer;
    static emitter: EventEmitter;
    static cache: AppCache = new AppCache();
    static companion: Companion;
    static media: MediaSession;
    // Shared with every session (by reference), so capability reports apply to new senders.
    static mediaCapabilities: V4MediaCapabilities = { ...DEFAULT_MEDIA_CAPABILITIES };

    // Events forwarded to the pages as-is.
    private static pageEvents = [
        'toast',
        'connect',
        'disconnect',
        'event_subscribed_keys_update',
    ];

    private static bridgeBase(): string {
        return `http://127.0.0.1:${Main.ipc.port || IPC_PORT}`;
    }

    private static subscribedKeys() {
        const keys = Main.tcpListenerService.getAllSubscribedKeys();
        // JSON can't carry sets.
        return { keyDown: Array.from(keys.keyDown), keyUp: Array.from(keys.keyUp) };
    }

    // What the main page shows and encodes in its QR code (fcast://r/ connection URL).
    private static deviceInfo() {
        return {
            name: Main.cache.deviceName,
            interfaces: getAllIPv4Interfaces(),
            txt: Main.discoveryTxt(),
        };
    }

    private static applyPageCapabilities(capabilities: PageCapabilities) {
        const target = Main.mediaCapabilities;
        const list = (value: string[] | undefined, fallback: string[]) =>
            Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : fallback;

        target.containers = list(capabilities.containers, DEFAULT_MEDIA_CAPABILITIES.containers);
        target.videoFormats = list(capabilities.videoFormats, DEFAULT_MEDIA_CAPABILITIES.videoFormats);
        target.audioFormats = list(capabilities.audioFormats, DEFAULT_MEDIA_CAPABILITIES.audioFormats);
        target.imageFormats = list(capabilities.imageFormats, DEFAULT_MEDIA_CAPABILITIES.imageFormats);
        target.mirroring = capabilities.webrtc === true;
        target.protocols = DEFAULT_MEDIA_CAPABILITIES.protocols.concat(target.mirroring ? ['whep'] : []);
    }

    private static loadPageCapabilities() {
        const file = dataPath(CAPABILITIES_FILE);
        if (file === null || !fs.existsSync(file)) {
            return;
        }
        try {
            Main.applyPageCapabilities(JSON.parse(fs.readFileSync(file, 'utf8')));
        } catch (e) {
            logger.warn('Could not read the saved capabilities', e);
        }
    }

    private static savePageCapabilities(capabilities: PageCapabilities) {
        Main.applyPageCapabilities(capabilities);
        logger.info(`Capabilities reported by the page: ${JSON.stringify(Main.mediaCapabilities)}`);
        const file = dataPath(CAPABILITIES_FILE);
        if (file !== null) {
            try {
                fs.writeFileSync(file, JSON.stringify(capabilities));
            } catch (e) {
                logger.warn('Could not save the capabilities', e);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON from the pages
    private static handleCall(method: string, value: any) {
        switch (method) {
            case 'send_playback_error':
                Main.media.onPlaybackError(`${value.message}`, value.kind as PlaybackErrorKind).catch((e) => logger.error('Error report failed', e));
                return null;

            case 'send_playback_update':
                Main.media.onPlaybackUpdate(value as PlaybackUpdateMessage);
                return null;

            case 'send_playback_state':
                if (value.state === 'buffering' || value.state === 'ended') {
                    Main.media.onPlaybackState(value.state);
                }
                return null;

            case 'send_volume_update':
                Main.media.onVolumeUpdate(value as VolumeUpdateMessage);
                return null;

            case 'send_tracks':
                Main.media.onTracks(value.loadId, value.report as TrackReport);
                return null;

            case 'subtitle_failed':
                Main.media.onSubtitleFailed(value.id);
                return null;

            case 'send_event':
                Main.tcpListenerService.send(Opcode.Event, value as EventMessage);
                return null;

            case 'play_request':
                Main.media.playRequest(value.loadId, value.playlistIndex).catch((e) => logger.error('Play request failed', e));
                return null;

            case 'mirroring_answer':
                Main.media.mirroringAnswer(value.loadId, `${value.sdp}`);
                return null;

            case 'report_capabilities':
                Main.savePageCapabilities(value as PageCapabilities);
                return null;

            case 'get_sessions':
                return Main.tcpListenerService.getSenders();

            case 'get_subscribed_keys':
                return Main.subscribedKeys();

            case 'get_device_info':
                return Main.deviceInfo();

            case 'playback_stopped':
                // The user left the player on the TV.
                Main.media.stop(null);
                return null;

            case 'network_changed':
                logger.info('Network interfaces have changed');
                Main.restartDiscovery();
                Main.ipc.broadcast('device_info', Main.deviceInfo());
                return null;

            default:
                throw new Error(`unknown method ${method}`);
        }
    }

    private static discoveryTxt(): { [key: string]: string } {
        const txt: { [key: string]: string } = { v: `${Main.cache.protocolVersion}` };
        if (Main.cache.fingerprint !== null) {
            txt.fp = Main.cache.fingerprint;
        }
        return txt;
    }

    private static restartDiscovery() {
        Main.discoveryService.stop();
        Main.discoveryService = new DiscoveryService();
        Main.discoveryService.start(Main.discoveryTxt(), Main.tcpListenerService.port);
    }

    private static setupV4(): V4Config {
        const reason = v4UnsupportedReason();
        if (reason !== null) {
            logger.warn(`Protocol v4 disabled (${reason}); offering v${PROTOCOL_VERSION}`);
            return null;
        }

        try {
            const identity = loadOrCreateV4Identity(dataPath('brewcast-v4-key.pem'));
            Main.cache.fingerprint = identity.fingerprint;
            Main.cache.protocolVersion = V4_PROTOCOL_VERSION;
            logger.info(`Protocol v4 enabled, fingerprint ${identity.fingerprint}`);
            return { identity: identity, mediaCapabilities: Main.mediaCapabilities, volumeStepInterval: 0.01 };
        } catch (e) {
            logger.error(`Protocol v4 disabled: could not set up TLS; offering v${PROTOCOL_VERSION}`, e);
            return null;
        }
    }

    private static wireListener(listener: TcpListenerService) {
        const on = (event: string, handler: (...args: any[]) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            listener.emitter.on(event, (...args) => {
                try {
                    handler(...args);
                } catch (e) {
                    logger.error(`Handling '${event}' failed`, e);
                }
            });
        };

        Main.media.bind(listener.emitter, () => Main.mediaCapabilities.mirroring);

        on('connect', (message) => {
            ConnectionMonitor.onConnect(listener, message, () => Main.emitter.emit('connect', message));
        });
        on('disconnect', (message) => {
            ConnectionMonitor.onDisconnect(message, () => Main.emitter.emit('disconnect', message));
        });
        on('ping', (sessionId: string) => ConnectionMonitor.onPingPong(sessionId));
        on('pong', (sessionId: string) => ConnectionMonitor.onPingPong(sessionId));
        on('initial', (message) => logger.info(`Sender introduced itself: ${JSON.stringify(message)}`));

        const onSubscriptionChange = (subscribe: boolean) => (message) => {
            if (subscribe) {
                listener.subscribeEvent(message.sessionId, message.body.event);
            } else {
                listener.unsubscribeEvent(message.sessionId, message.body.event);
            }

            if (message.body.event.type === EventType.KeyDown.valueOf() || message.body.event.type === EventType.KeyUp.valueOf()) {
                Main.emitter.emit('event_subscribed_keys_update', Main.subscribedKeys());
            }
        };
        on('subscribeevent', onSubscriptionChange(true));
        on('unsubscribeevent', onSubscriptionChange(false));
    }

    static async start() {
        logger.info(`${APP_NAME} ${APP_VERSION} service starting, Node ${process.version} on ${process.platform} ${process.arch}`);

        Main.emitter = new EventEmitter();
        Main.ipc = new IpcServer((method, value) => Main.handleCall(method, value));
        Main.companion = new Companion((sessionId) => Main.tcpListenerService?.getSession(sessionId), () => Main.bridgeBase());
        Main.media = new MediaSession({
            listener: () => Main.tcpListenerService,
            companion: Main.companion,
            page: (event, value) => Main.ipc.broadcast(event, value),
            ensurePage: () => {
                if (!Main.ipc.hasClients()) {
                    launchModule('launch=play');
                }
            },
            subtitleUrl: (source) => subtitleRouteUrl(Main.bridgeBase(), source),
        });

        Main.pageEvents.forEach((event) => Main.emitter.on(event, (value) => Main.ipc.broadcast(event, value)));
        Main.ipc.routes.push(Main.companion.route, subtitleRoute);
        Main.ipc.onClientConnected = (send) => {
            // A page that just (re)loaded catches up on anything it missed while navigating.
            send('device_info', Main.deviceInfo());
            Main.media.replay(send);
        };
        Main.ipc.start(envPort('BREWCAST_IPC_PORT', IPC_PORT));

        Main.loadPageCapabilities();
        Main.cache.deviceName = await fetchDeviceName();
        const v4Config = Main.setupV4();

        Main.connectionMonitor = new ConnectionMonitor();
        const listener = new TcpListenerService(v4Config);
        Main.tcpListenerService = listener;
        Main.wireListener(listener);
        listener.start(envPort('BREWCAST_PORT', TcpListenerService.PORT));

        Main.discoveryService = new DiscoveryService();
        Main.discoveryService.start(Main.discoveryTxt(), listener.port || TcpListenerService.PORT);
        logger.info(`Listening on port ${listener.port || TcpListenerService.PORT} as "${Main.cache.deviceName}", protocol v${Main.cache.protocolVersion}`);
    }
}

// Ports can be moved for local test runs; senders and the pages expect the defaults.
function envPort(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 && value < 65536 ? value : fallback;
}

export function getComputerName() {
    return Main.cache.deviceName;
}

export function getAppName() {
    return APP_NAME;
}

export function getAppVersion() {
    return APP_VERSION;
}

export function getPlayMessage() {
    return Main.media ? Main.media.currentPlayMessage() : null;
}

export function getPlaybackUpdateMessage() {
    return Main.media ? Main.media.playbackUpdate : null;
}

export function getPlayerVolume() {
    return Main.media ? Main.media.volume : null;
}

// What a v4 sender that connects mid-playback is told: the loaded media, then its tracks.
export function getV4JoinMessages(): Uint8Array[] {
    if (!Main.media) {
        return [];
    }
    const source = Main.media.v4LoadSource();
    return (source ? [encodeLoadSource(source)] : []).concat(Main.media.v4TrackMessages());
}

export async function errorHandler(error: Error) {
    logger.error('Service error:', error);
    Main.emitter?.emit('toast', { message: `${error}`, icon: ToastIcon.ERROR });
}

// In the shape the main page renders. Signal strength isn't available to the service.
function getAllIPv4Interfaces() {
    const interfaces = os.networkInterfaces();
    const result: { name: string, address: string, type: string }[] = [];

    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        if (!addresses) continue;

        for (const addressInfo of addresses) {
            if ((addressInfo.family === 'IPv4' || (addressInfo.family as unknown) === 4) && !addressInfo.internal) {
                const wireless = /^(wl|wifi|ra)/i.test(interfaceName);
                result.push({ name: wireless ? 'Wi-Fi' : 'Wired', address: addressInfo.address, type: wireless ? 'wireless' : 'wired' });
            }
        }
    }

    return result;
}
