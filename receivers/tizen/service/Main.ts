// BrewCast network service: TizenBrew runs this bundle (package.json `serviceFile`) in its Node
// service. Ported from upstream's webOS service (receivers/webos/fcast-receiver-service at
// 5c79300), with the Luna bus replaced by a local HTTP/SSE channel (Ipc.ts) and protocol v4 added.
import * as os from 'os';
import { EventEmitter } from 'events';
import {
    EventMessage, EventType, Opcode, PlayMessage, PlayUpdateMessage, PlaybackErrorMessage, PlaybackState, PlaybackUpdateMessage, PlaylistContent,
    SeekMessage, SetPlaylistItemMessage, SetSpeedMessage, SetVolumeMessage, V4_PROTOCOL_VERSION, PROTOCOL_VERSION, VolumeUpdateMessage,
} from 'common/Packets';
import { DiscoveryService } from 'common/DiscoveryService';
import { TcpListenerService } from 'common/TcpListenerService';
import { ConnectionMonitor } from 'common/ConnectionMonitor';
import { Logger, LoggerType } from 'common/Logger';
import { MediaCache } from 'common/MediaCache';
import { preparePlayMessage } from 'common/UtilityBackend';
import { ToastIcon } from 'common/components/Toast';
import { V4Config } from 'common/FCastSession';
import { loadOrCreateV4Identity, v4UnsupportedReason } from 'common/v4/Certificate';
import { V4MediaCapabilities } from 'common/v4/Codec';
import { IpcServer } from 'src/Ipc';
import { dataPath, fetchDeviceName, launchModule } from 'src/Platform';

const logger = new Logger('Main', LoggerType.BACKEND);

const APP_NAME = 'BrewCast';
// Replaced at build time from package.json.
declare const APP_VERSION: string;

// What the TV's HTML5 player is expected to handle, as v4 format tokens (fcast.fbs). Conservative:
// senders use this to decide what to send or transcode. Images and subtitle sources aren't
// offered because the Tizen pages have no image viewer or AddSubtitleSource support yet.
const MEDIA_CAPABILITIES: V4MediaCapabilities = {
    protocols: ['http', 'https', 'data'],
    containers: ['mp4', 'quicktime', 'webm', 'mkv', 'mpegts', 'hls', 'dash'],
    videoFormats: ['h264', 'h265', 'vp8', 'vp9'],
    audioFormats: ['aac', 'mp3', 'ac3', 'eac3', 'opus', 'vorbis', 'flac', 'pcm'],
    subtitleFormats: ['vtt'],
    hdrFormats: [],
    imageFormats: [],
    externalSubtitles: false,
    mirroring: false,
};

interface PlayInfo {
    rendererEvent: string;
    rendererMessage: unknown;
    proxyUrl: string;
    contentViewer: string;
    playerVolume: number;
}

class AppCache {
    public deviceName: string = null;
    public playMessage: PlayMessage = null;
    public playInfo: PlayInfo = null;
    public playerVolume: number = null;
    public playbackUpdate: PlaybackUpdateMessage = null;
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

    private static mediaCache: MediaCache = null;
    // Events forwarded to the pages as-is.
    private static pageEvents = [
        'toast',
        'connect',
        'disconnect',
        'play',
        'pause',
        'resume',
        'stop',
        'seek',
        'setvolume',
        'setspeed',
        'setplaylistitem',
        'event_subscribed_keys_update',
    ];

    private static async play(message: PlayMessage) {
        // Relayed to the other senders (v3 PlayUpdate / v4 Load). Must be the same object the
        // session emitted: v4 sessions use that to avoid echoing a load back to its sender.
        Main.tcpListenerService.send(Opcode.PlayUpdate, new PlayUpdateMessage(Date.now(), message));
        Main.cache.playMessage = message;
        Main.cache.playbackUpdate = null;

        const messageInfo = await preparePlayMessage(message, (playlist: PlaylistContent) => {
            Main.mediaCache?.destroy();
            Main.mediaCache = new MediaCache(playlist);
        });

        // The Tizen pages have a player but no image/content viewer yet.
        Main.cache.playInfo = { ...messageInfo, contentViewer: 'player', playerVolume: Main.cache.playerVolume };
        Main.emitter.emit('play', Main.cache.playInfo);

        if (!Main.ipc.hasClients()) {
            launchModule('launch=play');
        }
    }

    // Nothing is loaded any more: tell senders, and forget the item so new senders aren't sent it.
    private static stopped() {
        Main.cache.playMessage = null;
        Main.cache.playInfo = null;
        Main.cache.playbackUpdate = null;
        Main.tcpListenerService.send(Opcode.PlaybackUpdate, new PlaybackUpdateMessage(Date.now(), PlaybackState.Idle));
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON from the pages
    private static handleCall(method: string, value: any) {
        switch (method) {
            case 'send_playback_error':
                Main.tcpListenerService.send(Opcode.PlaybackError, value as PlaybackErrorMessage);
                return null;

            case 'send_playback_update':
                Main.cache.playbackUpdate = value as PlaybackUpdateMessage;
                Main.tcpListenerService.send(Opcode.PlaybackUpdate, value as PlaybackUpdateMessage);
                return null;

            case 'send_volume_update':
                Main.cache.playerVolume = (value as VolumeUpdateMessage).volume;
                Main.tcpListenerService.send(Opcode.VolumeUpdate, value as VolumeUpdateMessage);
                return null;

            case 'send_event':
                Main.tcpListenerService.send(Opcode.Event, value as EventMessage);
                return null;

            case 'play_request': {
                const message: PlayMessage = value.message;
                const playlistIndex: number = value.playlistIndex;
                logger.debug(`Received play request for index ${playlistIndex}:`, message);
                message.url = Main.mediaCache?.has(playlistIndex) ? Main.mediaCache?.getUrl(playlistIndex) : message.url;
                Main.mediaCache?.cacheItems(playlistIndex);
                Main.play(message).catch((e) => logger.error('Play request failed', e));
                return null;
            }

            case 'get_sessions':
                return Main.tcpListenerService.getSenders();

            case 'get_subscribed_keys':
                return Main.subscribedKeys();

            case 'get_device_info':
                return Main.deviceInfo();

            case 'playback_stopped':
                // The user left the player on the TV.
                Main.stopped();
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
        Main.discoveryService.start(Main.discoveryTxt());
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
            return { identity: identity, mediaCapabilities: MEDIA_CAPABILITIES, volumeStepInterval: 0.01 };
        } catch (e) {
            logger.error(`Protocol v4 disabled: could not set up TLS; offering v${PROTOCOL_VERSION}`, e);
            return null;
        }
    }

    static async start() {
        logger.info(`${APP_NAME} ${APP_VERSION} service starting, Node ${process.version} on ${process.platform} ${process.arch}`);

        Main.emitter = new EventEmitter();
        Main.ipc = new IpcServer((method, value) => Main.handleCall(method, value));
        Main.pageEvents.forEach((event) => Main.emitter.on(event, (value) => Main.ipc.broadcast(event, value)));
        Main.ipc.onClientConnected = (send) => {
            // A page that just (re)loaded catches up on anything it missed while navigating.
            send('device_info', Main.deviceInfo());
            if (Main.cache.playInfo !== null) {
                send('play', Main.cache.playInfo);
            }
        };
        Main.ipc.start();

        Main.cache.deviceName = await fetchDeviceName();
        const v4Config = Main.setupV4();

        Main.connectionMonitor = new ConnectionMonitor();
        Main.discoveryService = new DiscoveryService();
        Main.discoveryService.start(Main.discoveryTxt());

        const listener = new TcpListenerService(v4Config);
        Main.tcpListenerService = listener;

        listener.emitter.on('play', (message: PlayMessage) => Main.play(message).catch((e) => logger.error('Play failed', e)));
        listener.emitter.on('pause', () => Main.emitter.emit('pause'));
        listener.emitter.on('resume', () => Main.emitter.emit('resume'));
        listener.emitter.on('stop', () => {
            Main.stopped();
            Main.emitter.emit('stop');
        });
        listener.emitter.on('seek', (message: SeekMessage) => Main.emitter.emit('seek', message));
        listener.emitter.on('setvolume', (message: SetVolumeMessage) => {
            Main.cache.playerVolume = message.volume;
            Main.emitter.emit('setvolume', message);
        });
        listener.emitter.on('setspeed', (message: SetSpeedMessage) => Main.emitter.emit('setspeed', message));
        listener.emitter.on('setplaylistitem', (message: SetPlaylistItemMessage) => Main.emitter.emit('setplaylistitem', message));

        listener.emitter.on('connect', (message) => {
            ConnectionMonitor.onConnect(listener, message, () => Main.emitter.emit('connect', message));
        });
        listener.emitter.on('disconnect', (message) => {
            ConnectionMonitor.onDisconnect(message, () => Main.emitter.emit('disconnect', message));
        });
        listener.emitter.on('ping', (sessionId: string) => ConnectionMonitor.onPingPong(sessionId));
        listener.emitter.on('pong', (sessionId: string) => ConnectionMonitor.onPingPong(sessionId));
        listener.emitter.on('initial', (message) => logger.info(`Sender introduced itself: ${JSON.stringify(message)}`));

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
        listener.emitter.on('subscribeevent', onSubscriptionChange(true));
        listener.emitter.on('unsubscribeevent', onSubscriptionChange(false));

        listener.start();
        logger.info(`Listening on port ${TcpListenerService.PORT} as "${Main.cache.deviceName}", protocol v${Main.cache.protocolVersion}`);
    }
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
    return Main.cache.playbackUpdate === null ? Main.cache.playMessage : {
        ...Main.cache.playMessage,
        time: Main.cache.playbackUpdate.time,
        volume: Main.cache.playerVolume,
        speed: Main.cache.playbackUpdate.speed
    };
}

export function getPlaybackUpdateMessage() {
    return Main.cache.playbackUpdate;
}

export function getPlayerVolume() {
    return Main.cache.playerVolume;
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
