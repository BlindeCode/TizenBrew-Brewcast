import { EventEmitter } from 'events';
import {
    ContentType, GenericMediaMetadata, MediaItem, MetadataObject, MetadataType, Opcode, PlaybackErrorMessage, PlaybackState,
    PlaybackUpdateMessage, PlayMessage, PlayUpdateMessage, SeekMessage, SetPlaylistItemMessage, SetSpeedMessage, SetVolumeMessage,
    VolumeUpdateMessage,
} from 'common/Packets';
import { ListenerService } from 'common/ListenerService';
import { PacketOrigin } from 'common/FCastSession';
import { MediaCache } from 'common/MediaCache';
import { NetworkService } from 'common/NetworkService';
import { supportedImageTypes, supportedPlayerTypes } from 'common/MimeTypes';
import { fetchJSON } from 'common/UtilityBackend';
import { Logger, LoggerType } from 'common/Logger';
import {
    ErrorKind, PLAYLIST_CONTAINER, V4LoadSource, V4PlaybackState, V4PlaylistContent, V4QueuePosition, V4Track, V4TrackType,
    encodeChangeTrack, encodeLoadSource, encodeQueueInsert, encodeQueueItemSelected, encodeQueueRemove, encodeStopPlayback,
    encodeTracksAvailable,
} from 'common/v4/Codec';
import { Companion } from 'src/Companion';
import { probeUrl } from 'src/Probe';
const logger = new Logger('MediaSession', LoggerType.BACKEND);

// What is loaded on the receiver, and the rules the reference receiver (futo-org/fcast
// crates/receiver-core) applies to it: the queue is kept here, not in the pages, so queue
// requests are validated and relayed to other senders the same way. The pages play one item at a
// time and report back.

// v4 queue positions are ubytes.
export const MAX_QUEUE_LENGTH = 256;
export const MIRRORING_CONTAINER = 'application/x-fwebrtc';
// External subtitles get ids of their own, stable for the life of the item, well clear of the
// indices the pages give embedded tracks.
const FIRST_EXTERNAL_SUBTITLE_ID = 1000;

export type ContentViewer = 'player' | 'viewer';

// Sent to the pages as `load`: a new load (single item or queue), and replayed to pages that
// (re)connect. `loadId` tells a replay of the current load from a new one.
export interface PlayInfo {
    loadId: number;
    rendererEvent: 'play' | 'play-playlist';
    rendererMessage: PlayMessage | V4PlaylistContent;
    proxyUrl: string | null;
    contentViewer: ContentViewer;
    playerVolume: number | null;
}

// Sent to the pages as `item`: the queue item to play now (answers `play_request`).
export interface ItemInfo {
    loadId: number;
    index: number;
    message: PlayMessage;
    proxyUrl: string | null;
    contentViewer: ContentViewer;
    playerVolume: number | null;
}

export interface QueueUpdate {
    loadId: number;
    items: MediaItem[];
    index: number;
    autoplay: boolean;
}

// What the player page reports about the current item's tracks.
export interface TrackReport {
    tracks: V4Track[];
    selected: { video: number | null, audio: number | null, subtitle: number | null };
    live: boolean;
    seekable: boolean;
}

// What the player could tell about an error: the resource is gone, the connection failed, or it
// couldn't decode or play it.
export type PlaybackErrorKind = 'not_found' | 'network' | 'decode' | 'unsupported';

interface Queue {
    // As the senders sent them (URLs not rewritten), for relays and new senders.
    items: MediaItem[];
    index: number;
    autoplay: boolean;
    playlist: V4PlaylistContent;
}

interface ExternalSubtitle {
    id: number;
    url: string;
    name: string | null;
    origin: PacketOrigin | null;
}

interface Loaded {
    loadId: number;
    // Who loaded it, for v4 error replies (null: the TV itself).
    origin: PacketOrigin | null;
    message: PlayMessage;
    queue: Queue | null;
    // Mirroring: the sender session that started it, and its SDP offer once received.
    mirroring: { sessionId: string, offer: string | null } | null;
    // Single items: what the pages were sent. Queues rebuild it from the current state.
    singlePlayInfo: PlayInfo | null;
    viewer: ContentViewer;
}

export interface MediaSessionHost {
    listener: () => ListenerService;
    companion: Companion;
    // Sends an event to the pages.
    page: (event: string, value: unknown) => void;
    // Opens a page when none is showing.
    ensurePage: () => void;
    subtitleUrl: (source: string) => string;
}

export function contentViewerFor(container: string): ContentViewer {
    const type = (container || '').toLowerCase();
    if (type === MIRRORING_CONTAINER || supportedPlayerTypes.indexOf(type) >= 0) {
        return 'player';
    }
    // Images and anything else the player can't handle go to the viewer, like upstream.
    return supportedImageTypes.indexOf(type) >= 0 ? 'viewer' : 'player';
}

function resolvePosition(position: V4QueuePosition, length: number, forInsert: boolean): number {
    switch (position.kind) {
        case 'front':
            return 0;
        case 'back':
            return forInsert ? length : length - 1;
        default:
            return position.index;
    }
}

function playMessageFromItem(item: MediaItem): PlayMessage {
    return new PlayMessage(item.container, item.url, item.content, item.time, item.volume, item.speed, item.headers, item.metadata);
}

function sameTracks(a: TrackReport | null, b: TrackReport | null): boolean {
    return JSON.stringify(a && { tracks: a.tracks, selected: a.selected }) === JSON.stringify(b && { tracks: b.tracks, selected: b.selected });
}

export class MediaSession {
    private nextLoadId = 1;
    private loaded: Loaded | null = null;
    private mediaCache: MediaCache | null = null;

    public playbackUpdate: PlaybackUpdateMessage | null = null;
    public volume: number | null = null;
    private tracks: TrackReport | null = null;
    private externals: ExternalSubtitle[] = [];
    private nextExternalId = FIRST_EXTERNAL_SUBTITLE_ID;

    constructor(private host: MediaSessionHost) {}

    private get listener(): ListenerService {
        return this.host.listener();
    }

    get isLoaded(): boolean {
        return this.loaded !== null;
    }

    // Handles what senders ask for: the events of a ListenerService.
    bind(emitter: EventEmitter, mirroringSupported: () => boolean) {
        const on = (event: string, handler: (...args: any[]) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            emitter.on(event, (...args) => {
                try {
                    handler(...args);
                } catch (e) {
                    logger.error(`Handling '${event}' failed`, e);
                }
            });
        };

        on('play', (message: PlayMessage, origin: PacketOrigin) => this.load(message, origin).catch((e) => logger.error('Load failed', e)));
        on('pause', () => this.pause());
        on('resume', () => this.resume());
        on('stop', (origin: PacketOrigin) => this.stop(origin));
        on('seek', (message: SeekMessage, origin: PacketOrigin) => this.seek(message.time, origin));
        on('setvolume', (message: SetVolumeMessage) => this.setVolume(message.volume));
        on('setspeed', (message: SetSpeedMessage) => this.setSpeed(message.speed));
        on('setplaylistitem', (message: SetPlaylistItemMessage, origin: PacketOrigin) => this.setPlaylistItem(message.itemIndex, origin));
        on('queueselect', (message: { position: V4QueuePosition }, origin: PacketOrigin) => this.queueSelect(message.position, origin));
        on('queueinsert', (message: { item: MediaItem, position: V4QueuePosition }, origin: PacketOrigin) =>
            this.queueInsert(message.item, message.position, origin));
        on('queueremove', (message: { position: V4QueuePosition }, origin: PacketOrigin) => this.queueRemove(message.position, origin));
        on('changetrack', (message: { trackType: V4TrackType, id: number | null }, origin: PacketOrigin) =>
            this.changeTrack(message.trackType, message.id, origin));
        on('addsubtitle', (message: { url: string, select: boolean, name: string | null }, origin: PacketOrigin) =>
            this.addSubtitle(message.url, message.select, message.name, origin));
        on('mirroringstart', (_message: unknown, origin: PacketOrigin) => this.startMirroring(origin, mirroringSupported()));
        on('mirroringoffer', (message: { sdp: string }, origin: PacketOrigin) => this.mirroringOffer(message.sdp, origin));
        on('companionhello', (origin: PacketOrigin) => {
            const provider = this.host.companion.register(origin.sessionId);
            this.listener.getSession(origin.sessionId)?.sendCompanionHelloResponse(provider);
        });
        on('disconnect', (message: { sessionId: string }) => {
            this.host.companion.unregister(message.sessionId);
            this.onSenderGone(message.sessionId);
        });
    }

    // ---- Loading ------------------------------------------------------------------------------

    async load(message: PlayMessage, origin: PacketOrigin | null) {
        const loadId = this.nextLoadId++;
        // A load replaces whatever was loading before it finished preparing.
        this.pendingLoadId = loadId;

        let playlist: V4PlaylistContent = null;
        if (message.container === PLAYLIST_CONTAINER) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON
                const json: any = message.url ? await fetchJSON(this.host.companion.rewriteUrl(message.url)) : JSON.parse(message.content);
                if (json && json.contentType === ContentType.Playlist && Array.isArray(json.items)) {
                    playlist = json;
                }
            } catch (e) {
                logger.warn('Could not load the playlist', e);
                this.reportLoadError(origin, message.url ? ErrorKind.ResourceNotFound : ErrorKind.MalformedBody, `Could not load the playlist: ${e}`);
                return;
            }
            if (this.pendingLoadId !== loadId) {
                return;
            }
        }

        let queue: Queue = null;
        if (playlist !== null) {
            const index = playlist.offset !== null && playlist.offset !== undefined ? playlist.offset : 0;
            if (playlist.items.length > MAX_QUEUE_LENGTH) {
                this.reportLoadError(origin, ErrorKind.MalformedBody, 'The playlist is too long');
                return;
            }
            if (playlist.items.length === 0 || index < 0 || index >= playlist.items.length) {
                this.reportLoadError(origin, ErrorKind.QueuePositionOutOfRange, 'The playlist start position does not exist');
                return;
            }
            queue = {
                items: playlist.items.slice(),
                index: index,
                // v3 playlists always advance.
                autoplay: playlist.autoplay !== undefined && playlist.autoplay !== null ? playlist.autoplay : true,
                playlist: playlist,
            };
        }

        this.resetItemState();
        this.mediaCache?.destroy();
        this.mediaCache = null;

        const loaded: Loaded = {
            loadId: loadId,
            origin: origin,
            message: message,
            queue: queue,
            mirroring: null,
            singlePlayInfo: null,
            viewer: contentViewerFor(queue ? queue.items[queue.index].container : message.container),
        };

        this.relayLoad(loaded, origin);

        if (queue) {
            this.mediaCache = new MediaCache(this.pagePlaylist(queue));
        } else {
            const pageMessage = this.pageMessage(message);
            const proxyUrl = await NetworkService.proxyPlayIfRequired(pageMessage);
            if (this.pendingLoadId !== loadId) {
                return;
            }
            loaded.singlePlayInfo = {
                loadId: loadId,
                rendererEvent: 'play',
                rendererMessage: pageMessage,
                proxyUrl: proxyUrl,
                contentViewer: loaded.viewer,
                playerVolume: this.volume,
            };
        }

        this.loaded = loaded;
        this.host.page('load', this.playInfo());
        this.host.ensurePage();
    }

    private pendingLoadId = 0;

    // Other senders learn what was loaded: v3 as `PlayUpdate`, v4 as a `Load` without request
    // headers (so credentials aren't shared), except to the sender that loaded it.
    private relayLoad(loaded: Loaded, origin: PacketOrigin | null) {
        this.listener.send(Opcode.PlayUpdate, new PlayUpdateMessage(Date.now(), loaded.message));
        const source = this.loadSourceOf(loaded);
        if (source) {
            this.listener.sendV4(() => encodeLoadSource(source), { exclude: origin ? origin.sessionId : undefined });
        }
    }

    private loadSourceOf(loaded: Loaded): V4LoadSource | null {
        if (loaded.mirroring) {
            return null;
        }
        if (loaded.queue) {
            return { kind: 'queue', items: loaded.queue.items, index: loaded.queue.index, autoplay: loaded.queue.autoplay };
        }
        return { kind: 'single', message: loaded.message };
    }

    // For senders that join mid-playback.
    v4LoadSource(): V4LoadSource | null {
        return this.loaded ? this.loadSourceOf(this.loaded) : null;
    }

    // What v3 senders get in `Initial`.
    currentPlayMessage(): PlayMessage | null {
        if (!this.loaded || this.loaded.mirroring) {
            return null;
        }
        const message = this.loaded.message;
        return this.playbackUpdate === null ? message : {
            ...message,
            time: this.playbackUpdate.time,
            volume: this.volume,
            speed: this.playbackUpdate.speed,
        };
    }

    // ---- What the pages see -------------------------------------------------------------------

    private rewrite(value: string): string {
        return value ? this.host.companion.rewriteUrl(value) : value;
    }

    private pageMetadata(metadata: MetadataObject): MetadataObject {
        if (metadata && metadata.type === MetadataType.Generic && (metadata as GenericMediaMetadata).thumbnailUrl) {
            return { ...metadata, thumbnailUrl: this.rewrite((metadata as GenericMediaMetadata).thumbnailUrl) } as MetadataObject;
        }
        return metadata;
    }

    private pageMessage(message: PlayMessage): PlayMessage {
        return { ...message, url: this.rewrite(message.url), metadata: this.pageMetadata(message.metadata) };
    }

    private pageItem(item: MediaItem): MediaItem {
        return { ...item, url: this.rewrite(item.url), metadata: this.pageMetadata(item.metadata) };
    }

    private pagePlaylist(queue: Queue): V4PlaylistContent {
        return {
            ...queue.playlist,
            contentType: ContentType.Playlist,
            items: queue.items.map((item) => this.pageItem(item)),
            offset: queue.index,
            autoplay: queue.autoplay,
        };
    }

    playInfo(): PlayInfo | null {
        const loaded = this.loaded;
        if (!loaded) {
            return null;
        }
        if (!loaded.queue) {
            return loaded.singlePlayInfo ? { ...loaded.singlePlayInfo, playerVolume: this.volume } : null;
        }
        return {
            loadId: loaded.loadId,
            rendererEvent: 'play-playlist',
            rendererMessage: this.pagePlaylist(loaded.queue),
            proxyUrl: null,
            contentViewer: contentViewerFor(loaded.queue.items[loaded.queue.index].container),
            playerVolume: this.volume,
        };
    }

    // Replayed to a page that just (re)connected, after `device_info`.
    replay(send: (event: string, value: unknown) => void) {
        const info = this.playInfo();
        if (info) {
            send('load', info);
            if (this.loaded.mirroring && this.loaded.mirroring.offer) {
                send('mirroring_offer', { loadId: this.loaded.loadId, sdp: this.loaded.mirroring.offer });
            }
        }
    }

    private queueUpdate(): QueueUpdate {
        const queue = this.loaded.queue;
        return { loadId: this.loaded.loadId, items: queue.items.map((item) => this.pageItem(item)), index: queue.index, autoplay: queue.autoplay };
    }

    // ---- Queue ----------------------------------------------------------------------------------

    // The player asks to play queue item `index`: after a load, on the TV's previous/next keys,
    // on autoplay, or after we asked it to (`setplaylistitem`).
    async playRequest(loadId: number, index: number) {
        const loaded = this.loaded;
        if (!loaded || loaded.loadId !== loadId || !loaded.queue || index < 0 || index >= loaded.queue.items.length) {
            logger.info(`Ignoring a play request for item ${index} of load ${loadId}`);
            return;
        }

        const queue = loaded.queue;
        if (index !== queue.index) {
            // Chosen on the TV or by autoplay: every v4 sender hears about it.
            queue.index = index;
            this.resetItemState();
            this.listener.sendV4(() => encodeQueueItemSelected(index));
        }

        const item = queue.items[index];
        this.listener.send(Opcode.PlayUpdate, new PlayUpdateMessage(Date.now(), playMessageFromItem(item)));

        const message = playMessageFromItem(this.pageItem(item));
        if (this.mediaCache && this.mediaCache.has(index)) {
            message.url = this.mediaCache.getUrl(index);
        }
        this.mediaCache?.cacheItems(index);

        const proxyUrl = await NetworkService.proxyPlayIfRequired(message);
        if (this.loaded !== loaded || queue.index !== index) {
            return;
        }
        loaded.viewer = contentViewerFor(item.container);
        const info: ItemInfo = {
            loadId: loaded.loadId,
            index: index,
            message: message,
            proxyUrl: proxyUrl,
            contentViewer: loaded.viewer,
            playerVolume: this.volume,
        };
        this.host.page('item', info);
    }

    private requireQueue(origin: PacketOrigin): Queue | null {
        const queue = this.loaded ? this.loaded.queue : null;
        if (!queue) {
            logger.warn('Queue request without a queue');
            this.listener.sendV4Error(origin, ErrorKind.InvalidState);
        }
        return queue;
    }

    // Queue changes can't go through the media cache, which is indexed by position.
    private dropMediaCache() {
        this.mediaCache?.destroy();
        this.mediaCache = null;
    }

    queueSelect(position: V4QueuePosition, origin: PacketOrigin) {
        const queue = this.requireQueue(origin);
        if (!queue) {
            return;
        }

        const index = resolvePosition(position, queue.items.length, false);
        if (queue.items.length === 0 || index < 0 || index >= queue.items.length) {
            this.listener.sendV4Error(origin, ErrorKind.QueuePositionOutOfRange);
            return;
        }

        queue.index = index;
        this.resetItemState();
        this.listener.sendV4(() => encodeQueueItemSelected(position), { exclude: origin.sessionId });
        this.host.page('setplaylistitem', new SetPlaylistItemMessage(index));
    }

    queueInsert(item: MediaItem, position: V4QueuePosition, origin: PacketOrigin) {
        const queue = this.requireQueue(origin);
        if (!queue) {
            return;
        }
        if (queue.items.length >= MAX_QUEUE_LENGTH) {
            this.listener.sendV4Error(origin, ErrorKind.QueueFull);
            return;
        }

        const index = resolvePosition(position, queue.items.length, true);
        if (queue.items.length === 0 || index < 0 || index > queue.items.length) {
            this.listener.sendV4Error(origin, ErrorKind.QueuePositionOutOfRange);
            return;
        }

        if (index <= queue.index) {
            queue.index += 1;
        }
        queue.items.splice(index, 0, item);
        this.dropMediaCache();

        this.listener.sendV4(() => encodeQueueInsert(item, position), { exclude: origin.sessionId });
        this.host.page('queue_update', this.queueUpdate());
    }

    queueRemove(position: V4QueuePosition, origin: PacketOrigin) {
        const queue = this.requireQueue(origin);
        if (!queue) {
            return;
        }

        const index = resolvePosition(position, queue.items.length, false);
        if (queue.items.length === 0 || index < 0 || index >= queue.items.length) {
            this.listener.sendV4Error(origin, ErrorKind.QueuePositionOutOfRange);
            return;
        }
        if (index === queue.index) {
            this.listener.sendV4Error(origin, ErrorKind.QueueRemovePlayingItem);
            return;
        }

        if (index < queue.index) {
            queue.index -= 1;
        }
        queue.items.splice(index, 1);
        this.dropMediaCache();

        this.listener.sendV4(() => encodeQueueRemove(position), { exclude: origin.sessionId });
        this.host.page('queue_update', this.queueUpdate());
    }

    // v3 `SetPlaylistItem`.
    setPlaylistItem(index: number, origin: PacketOrigin) {
        this.queueSelect({ kind: 'index', index: index }, origin);
    }

    // ---- Transport ------------------------------------------------------------------------------

    pause() {
        this.host.page('pause', null);
    }

    resume() {
        this.host.page('resume', null);
    }

    seek(time: number, origin: PacketOrigin | null) {
        if (!this.loaded) {
            // Like the reference receiver: nothing to seek.
            return;
        }

        const duration = this.playbackUpdate ? this.playbackUpdate.duration : null;
        if (duration !== null && duration !== undefined && isFinite(duration) && duration > 0 && time > duration) {
            if (origin) {
                this.listener.sendV4Error(origin, ErrorKind.SeekOutOfRange);
            }
            time = duration;
        }
        this.host.page('seek', new SeekMessage(Math.max(0, time)));
    }

    setSpeed(speed: number) {
        const current = this.playbackUpdate && this.playbackUpdate.speed !== null && this.playbackUpdate.speed !== undefined ? this.playbackUpdate.speed : 1;
        if (!this.loaded || Math.abs(current - speed) < 1e-9) {
            // Nothing will change, so the player won't report it: confirm it here, as the
            // reference receiver does.
            this.listener.getV4Sessions().forEach((session) => session.sendV4Speed(speed));
        }
        if (this.loaded) {
            this.host.page('setspeed', new SetSpeedMessage(speed));
        }
    }

    // Confirmed to every sender right away; the player's own report follows.
    setVolume(volume: number) {
        this.volume = volume;
        this.host.page('setvolume', new SetVolumeMessage(volume));
        this.listener.send(Opcode.VolumeUpdate, new VolumeUpdateMessage(Date.now(), volume));
    }

    // Stops playback. `origin` is the sender that asked (not sent a `StopPlayback` relay), or
    // null when stopped on the TV.
    stop(origin: PacketOrigin | null) {
        this.listener.sendV4(() => encodeStopPlayback(), { exclude: origin ? origin.sessionId : undefined });

        const wasLoaded = this.loaded !== null;
        this.loaded = null;
        this.pendingLoadId = 0;
        this.resetItemState();
        this.dropMediaCache();

        if (wasLoaded) {
            this.listener.getV4Sessions().forEach((session) => session.sendV4PlaybackState(V4PlaybackState.Idle));
            this.listener.send(Opcode.PlaybackUpdate, new PlaybackUpdateMessage(Date.now(), PlaybackState.Idle));
        }
        this.host.page('stop', null);
    }

    // ---- Reports from the player ----------------------------------------------------------------

    onPlaybackUpdate(update: PlaybackUpdateMessage) {
        this.playbackUpdate = update;
        this.listener.send(Opcode.PlaybackUpdate, update);
    }

    onVolumeUpdate(update: VolumeUpdateMessage) {
        this.volume = update.volume;
        this.listener.send(Opcode.VolumeUpdate, update);
    }

    // States the v2/v3 update can't express.
    onPlaybackState(state: 'buffering' | 'ended') {
        const v4State = state === 'buffering' ? V4PlaybackState.Buffering : V4PlaybackState.Ended;
        this.listener.getV4Sessions().forEach((session) => session.sendV4PlaybackState(v4State));
    }

    // v2/v3 senders get the player's message. The v4 sender that loaded the media gets an error
    // kind; browsers report a missing resource like one they can't play, so the URL is checked.
    async onPlaybackError(message: string, kind: PlaybackErrorKind | undefined) {
        this.listener.send(Opcode.PlaybackError, new PlaybackErrorMessage(message));

        const loaded = this.loaded;
        if (!loaded || !loaded.origin) {
            return;
        }

        let errorKind = ErrorKind.ResourceNotFound;
        if (kind !== 'not_found') {
            const item = loaded.queue ? loaded.queue.items[loaded.queue.index] : loaded.message;
            const probe = item && item.url ? await probeUrl(this.rewrite(item.url), item.headers) : 'unknown';
            if (this.loaded !== loaded) {
                return;
            }
            errorKind = probe === 'missing' ? ErrorKind.ResourceNotFound :
                kind === 'unsupported' || kind === 'decode' ? ErrorKind.UnsupportedFormat : ErrorKind.Internal;
        }
        this.listener.sendV4Error(loaded.origin, errorKind);
    }

    private reportLoadError(origin: PacketOrigin | null, kind: ErrorKind, message: string) {
        if (origin) {
            this.listener.sendV4Error(origin, kind);
            const session = this.listener.getSession(origin.sessionId);
            if (session && !session.isV4) {
                this.listener.send(Opcode.PlaybackError, new PlaybackErrorMessage(message), origin.sessionId);
            }
        }
    }

    // ---- Tracks and subtitles -----------------------------------------------------------------

    private resetItemState() {
        this.playbackUpdate = null;
        this.externals = [];
        if (this.tracks !== null) {
            this.tracks = null;
        }
    }

    private trackMessages(): Uint8Array[] {
        const report = this.tracks;
        if (!report) {
            return [];
        }
        return [
            encodeTracksAvailable(report.tracks),
            encodeChangeTrack(report.selected.video, 'video'),
            encodeChangeTrack(report.selected.audio, 'audio'),
            encodeChangeTrack(report.selected.subtitle, 'subtitle'),
        ];
    }

    // For senders that join mid-playback.
    v4TrackMessages(): Uint8Array[] {
        return this.trackMessages();
    }

    onTracks(loadId: number, report: TrackReport) {
        if (!this.loaded || this.loaded.loadId !== loadId) {
            return;
        }
        const changed = !sameTracks(this.tracks, report);
        this.tracks = report;
        if (changed) {
            this.listener.sendV4(() => encodeTracksAvailable(report.tracks));
            this.listener.sendV4(() => encodeChangeTrack(report.selected.video, 'video'));
            this.listener.sendV4(() => encodeChangeTrack(report.selected.audio, 'audio'));
            this.listener.sendV4(() => encodeChangeTrack(report.selected.subtitle, 'subtitle'));
        }
    }

    changeTrack(type: V4TrackType, id: number | null, origin: PacketOrigin) {
        if (!this.loaded) {
            this.listener.sendV4Error(origin, ErrorKind.InvalidState);
            return;
        }

        const report = this.tracks;
        if (id !== null && !(report && report.tracks.some((track) => track.id === id && track.type === type))) {
            this.listener.sendV4Error(origin, ErrorKind.MalformedBody);
            return;
        }
        // Subtitles are drawn over the video, so they need it shown.
        if (type === 'subtitle' && id !== null && report && report.selected.video === null && report.tracks.some((track) => track.type === 'video')) {
            this.listener.sendV4Error(origin, ErrorKind.InvalidState);
            return;
        }

        this.host.page('changetrack', { loadId: this.loaded.loadId, type: type, id: id });
    }

    addSubtitle(sourceUrl: string, select: boolean, name: string | null, origin: PacketOrigin) {
        const loaded = this.loaded;
        const report = this.tracks;
        if (!loaded || loaded.mirroring || loaded.viewer !== 'player' || (report && (report.live || !report.seekable))) {
            this.listener.sendV4Error(origin, ErrorKind.InvalidState);
            return;
        }

        const subtitle: ExternalSubtitle = { id: this.nextExternalId++, url: sourceUrl, name: name, origin: origin };
        this.externals.push(subtitle);
        this.host.page('addsubtitle', {
            loadId: loaded.loadId,
            id: subtitle.id,
            url: this.host.subtitleUrl(this.rewrite(sourceUrl)),
            name: name,
            select: select,
        });
    }

    // The player could not load an external subtitle.
    onSubtitleFailed(id: number) {
        const index = this.externals.findIndex((subtitle) => subtitle.id === id);
        if (index < 0) {
            return;
        }
        const [subtitle] = this.externals.splice(index, 1);
        logger.warn(`External subtitle ${subtitle.url} failed to load`);
        if (subtitle.origin) {
            this.listener.sendV4Error(subtitle.origin, ErrorKind.ResourceNotFound);
        }
    }

    // ---- Mirroring (v4 StartMirroringSession) -----------------------------------------------

    startMirroring(origin: PacketOrigin, supported: boolean) {
        if (!supported) {
            this.listener.sendV4Error(origin, ErrorKind.UnsupportedFormat);
            return;
        }

        const loadId = this.nextLoadId++;
        this.pendingLoadId = loadId;
        this.resetItemState();
        this.dropMediaCache();

        // Players need a URL; a unique one also keeps a new session from looking like the last.
        const message = new PlayMessage(MIRRORING_CONTAINER, `fwebrtc://mirroring/${loadId}`);
        this.loaded = {
            loadId: loadId,
            origin: origin,
            message: message,
            queue: null,
            mirroring: { sessionId: origin.sessionId, offer: null },
            singlePlayInfo: {
                loadId: loadId,
                rendererEvent: 'play',
                rendererMessage: message,
                proxyUrl: null,
                contentViewer: 'player',
                playerVolume: this.volume,
            },
            viewer: 'player',
        };
        this.host.page('load', this.playInfo());
        this.host.ensurePage();
    }

    mirroringOffer(sdp: string, origin: PacketOrigin) {
        const loaded = this.loaded;
        if (!loaded || !loaded.mirroring || loaded.mirroring.sessionId !== origin.sessionId) {
            this.listener.sendV4Error(origin, ErrorKind.InvalidState);
            return;
        }
        loaded.mirroring.offer = sdp;
        this.host.page('mirroring_offer', { loadId: loaded.loadId, sdp: sdp });
    }

    mirroringAnswer(loadId: number, sdp: string) {
        const loaded = this.loaded;
        if (!loaded || loaded.loadId !== loadId || !loaded.mirroring) {
            return;
        }
        const session = this.listener.getSession(loaded.mirroring.sessionId);
        if (!session || !session.sendMirroringAnswer(sdp)) {
            logger.warn('The mirroring sender is gone; dropping the answer');
        }
    }

    // A sender disconnected: mirroring from it can't continue.
    onSenderGone(sessionId: string) {
        if (this.loaded && this.loaded.mirroring && this.loaded.mirroring.sessionId === sessionId) {
            logger.info('The mirroring sender disconnected; stopping');
            this.stop(null);
        }
    }
}
