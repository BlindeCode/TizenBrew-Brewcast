import * as flatbuffers from 'modules/flatbuffers';
import {
    AudioCapabilities, DeviceInfo, Error as ErrorMessage, ErrorKind, Load, MediaCapabilities,
    MediaItem as V4MediaItem, MediaSource, Message, Packet, PlaybackState as V4PlaybackState, PlaybackStateChanged,
    ProgressChanged, Queue, QueueIndex, QueueItem, QueueItemSelected, QueuePosition, ReceiverCapabilities, ReceiverIntroduction,
    RequestHeader, SenderIntroduction, SetProgressUpdateInterval, SpeedChanged, Time, VolumeChanged,
} from 'common/v4/generated/fcast/v4';
import {
    ContentType, GenericMediaMetadata, MediaItem, MetadataObject, PlaybackState, PlaylistContent, PlayMessage,
} from 'common/Packets';

// Translation between protocol v4 FlatBuffers messages and the v2/v3 message model that the rest
// of the receiver (players, listener services) is written against.

export const PLAYLIST_CONTAINER = 'application/json';

export interface V4DeviceInfo {
    displayName: string | null;
    appName: string | null;
    appVersion: string | null;
}

// Format tokens as defined in fcast.fbs `MediaCapabilities`.
export interface V4MediaCapabilities {
    protocols: string[];
    containers: string[];
    videoFormats: string[];
    audioFormats: string[];
    subtitleFormats: string[];
    hdrFormats: string[];
    imageFormats: string[];
    externalSubtitles: boolean;
    mirroring: boolean;
}

export type V4QueuePosition = { kind: 'index', index: number } | { kind: 'front' } | { kind: 'back' };

export type V4Incoming =
    | { type: 'load', play: PlayMessage }
    | { type: 'seek', time: number }
    | { type: 'volume', volume: number }
    | { type: 'speed', speed: number }
    | { type: 'playbackState', state: V4PlaybackState }
    | { type: 'stop' }
    | { type: 'queueItemSelected', position: V4QueuePosition }
    | { type: 'senderIntroduction', deviceInfo: V4DeviceInfo }
    | { type: 'progressUpdateInterval', intervalMs: number }
    | { type: 'unsupported', message: Message };

export class V4DecodeError extends Error {}

function secondsToMicros(seconds: number): bigint {
    return BigInt(Math.max(0, Math.round(seconds * 1000000)));
}

function timeToSeconds(time: Time | null): number | null {
    return time ? Number(time.micros()) / 1000000 : null;
}

function finish(builder: flatbuffers.Builder, type: Message, payload: flatbuffers.Offset): Uint8Array {
    builder.finish(Packet.createPacket(builder, type, payload));
    return builder.asUint8Array();
}

export function playbackStateFromV4(state: V4PlaybackState): PlaybackState {
    switch (state) {
        case V4PlaybackState.Playing:
        case V4PlaybackState.Buffering:
            return PlaybackState.Playing;
        case V4PlaybackState.Paused:
            return PlaybackState.Paused;
        default:
            return PlaybackState.Idle;
    }
}

export function playbackStateToV4(state: PlaybackState): V4PlaybackState {
    switch (state) {
        case PlaybackState.Playing:
            return V4PlaybackState.Playing;
        case PlaybackState.Paused:
            return V4PlaybackState.Paused;
        default:
            return V4PlaybackState.Idle;
    }
}

function headersFromV4(item: V4MediaItem): { [key: string]: string } | null {
    if (item.headersLength() === 0) {
        return null;
    }

    const headers: { [key: string]: string } = {};
    for (let i = 0; i < item.headersLength(); i++) {
        const header = item.headers(i);
        headers[header.key()] = header.value();
    }
    return headers;
}

function metadataFromV4(item: V4MediaItem): GenericMediaMetadata | null {
    const title = item.title();
    const thumbnailUrl = item.thumbnailUrl();
    return title !== null || thumbnailUrl !== null ? new GenericMediaMetadata(title, thumbnailUrl) : null;
}

function requiredString(value: string | null, field: string): string {
    if (value === null) {
        throw new V4DecodeError(`missing required field ${field}`);
    }
    return value;
}

function playMessageFromV4(item: V4MediaItem): PlayMessage {
    return new PlayMessage(
        requiredString(item.container(), 'container'),
        requiredString(item.sourceUrl(), 'source_url'),
        null,
        timeToSeconds(item.startTime()),
        item.volume(),
        item.speed(),
        headersFromV4(item),
        metadataFromV4(item),
    );
}

// A v4 queue maps onto a v3 playlist: a PlayMessage whose content is a PlaylistContent. v3 has no
// equivalent of `autoplay`, so v3 playlist behaviour applies.
function playMessageFromV4Queue(queue: Queue): PlayMessage {
    const items: MediaItem[] = [];
    for (let i = 0; i < queue.itemsLength(); i++) {
        const queueItem = queue.items(i);
        const item = queueItem.mediaItem();
        if (item === null) {
            throw new V4DecodeError('missing required field media_item');
        }

        items.push(new MediaItem(
            requiredString(item.container(), 'container'),
            requiredString(item.sourceUrl(), 'source_url'),
            null,
            timeToSeconds(item.startTime()),
            item.volume(),
            item.speed(),
            null,
            timeToSeconds(queueItem.playbackDuration()),
            headersFromV4(item),
            metadataFromV4(item),
        ));
    }

    const startIndex = queue.startIndex();
    const playlist = new PlaylistContent(items, startIndex !== null ? startIndex : 0);
    return new PlayMessage(PLAYLIST_CONTAINER, null, JSON.stringify(playlist));
}

function queuePositionFromV4(type: QueuePosition, getIndex: () => QueueIndex): V4QueuePosition {
    switch (type) {
        case QueuePosition.Index:
            return { kind: 'index', index: getIndex().index() };
        case QueuePosition.Front:
            return { kind: 'front' };
        case QueuePosition.Back:
            return { kind: 'back' };
        default:
            throw new V4DecodeError(`invalid queue position ${type}`);
    }
}

// Decodes the body of a `Flatbuf` (opcode 20) packet.
export function decodeV4(body: Uint8Array): V4Incoming {
    // The JS FlatBuffers runtime has no verifier and reads past the end as `undefined`, so at least
    // make sure the root table and its vtable are inside the buffer. Deeper damage surfaces as
    // missing fields or exceptions, which the session reports as errors.
    const bb = new flatbuffers.ByteBuffer(body);
    if (body.length < 8) {
        throw new V4DecodeError(`packet too short: ${body.length} bytes`);
    }
    const root = bb.readUint32(0);
    if (root + 4 > body.length) {
        throw new V4DecodeError('root table out of bounds');
    }
    const vtable = root - bb.readInt32(root);
    if (vtable < 0 || vtable + 4 > body.length) {
        throw new V4DecodeError('vtable out of bounds');
    }

    const packet = Packet.getRootAsPacket(bb);

    const type = packet.payloadType();
    const payload = <T>(table: T): T => {
        const value = packet.payload(table);
        if (value === null) {
            throw new V4DecodeError(`missing payload for message type ${type}`);
        }
        return value;
    };

    switch (type) {
        case Message.Load: {
            const load = payload(new Load());
            switch (load.sourceType()) {
                case MediaSource.Single:
                    return { type: 'load', play: playMessageFromV4(load.source(new V4MediaItem())) };
                case MediaSource.Queue:
                    return { type: 'load', play: playMessageFromV4Queue(load.source(new Queue())) };
                default:
                    throw new V4DecodeError(`invalid media source ${load.sourceType()}`);
            }
        }
        case Message.ProgressChanged: {
            const position = timeToSeconds(payload(new ProgressChanged()).position());
            if (position === null) {
                throw new V4DecodeError('ProgressChanged without position');
            }
            return { type: 'seek', time: position };
        }
        case Message.VolumeChanged:
            return { type: 'volume', volume: payload(new VolumeChanged()).volume() };
        case Message.SpeedChanged:
            return { type: 'speed', speed: payload(new SpeedChanged()).speed() };
        case Message.PlaybackStateChanged:
            return { type: 'playbackState', state: payload(new PlaybackStateChanged()).state() };
        case Message.StopPlayback:
            return { type: 'stop' };
        case Message.QueueItemSelected: {
            const msg = payload(new QueueItemSelected());
            return { type: 'queueItemSelected', position: queuePositionFromV4(msg.positionType(), () => msg.position(new QueueIndex())) };
        }
        case Message.SenderIntroduction: {
            const info = payload(new SenderIntroduction()).deviceInfo();
            return {
                type: 'senderIntroduction',
                deviceInfo: {
                    displayName: info ? info.displayName() : null,
                    appName: info ? info.appName() : null,
                    appVersion: info ? info.appVersion() : null,
                },
            };
        }
        case Message.SetProgressUpdateInterval: {
            const interval = timeToSeconds(payload(new SetProgressUpdateInterval()).interval());
            if (interval === null) {
                throw new V4DecodeError('SetProgressUpdateInterval without interval');
            }
            return { type: 'progressUpdateInterval', intervalMs: interval * 1000 };
        }
        default:
            return { type: 'unsupported', message: type };
    }
}

function createStringVector(builder: flatbuffers.Builder, values: string[]): flatbuffers.Offset {
    const offsets = values.map((value) => builder.createString(value));
    builder.startVector(4, offsets.length, 4);
    for (let i = offsets.length - 1; i >= 0; i--) {
        builder.addOffset(offsets[i]);
    }
    return builder.endVector();
}

export function encodeReceiverIntroduction(info: V4DeviceInfo, media: V4MediaCapabilities, volumeStepInterval: number): Uint8Array {
    const builder = new flatbuffers.Builder(1024);

    const displayName = info.displayName !== null ? builder.createString(info.displayName) : 0;
    const appName = info.appName !== null ? builder.createString(info.appName) : 0;
    const appVersion = info.appVersion !== null ? builder.createString(info.appVersion) : 0;
    const deviceInfo = DeviceInfo.createDeviceInfo(builder, displayName, appName, appVersion);

    const mediaCapabilities = MediaCapabilities.createMediaCapabilities(
        builder,
        createStringVector(builder, media.protocols),
        createStringVector(builder, media.containers),
        createStringVector(builder, media.videoFormats),
        createStringVector(builder, media.audioFormats),
        createStringVector(builder, media.subtitleFormats),
        createStringVector(builder, media.hdrFormats),
        createStringVector(builder, media.imageFormats),
        media.externalSubtitles,
        media.mirroring,
    );
    const audioCapabilities = AudioCapabilities.createAudioCapabilities(builder, volumeStepInterval);

    ReceiverCapabilities.startReceiverCapabilities(builder);
    ReceiverCapabilities.addMedia(builder, mediaCapabilities);
    ReceiverCapabilities.addAudio(builder, audioCapabilities);
    const capabilities = ReceiverCapabilities.endReceiverCapabilities(builder);

    ReceiverIntroduction.startReceiverIntroduction(builder);
    ReceiverIntroduction.addDeviceInfo(builder, deviceInfo);
    ReceiverIntroduction.addCapabilities(builder, capabilities);
    return finish(builder, Message.ReceiverIntroduction, ReceiverIntroduction.endReceiverIntroduction(builder));
}

export function encodeVolumeChanged(volume: number): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, Message.VolumeChanged, VolumeChanged.createVolumeChanged(builder, volume));
}

export function encodeSpeedChanged(speed: number): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, Message.SpeedChanged, SpeedChanged.createSpeedChanged(builder, speed));
}

export function encodePlaybackStateChanged(state: V4PlaybackState): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, Message.PlaybackStateChanged, PlaybackStateChanged.createPlaybackStateChanged(builder, state));
}

// `duration` is omitted when unknown (null, NaN or infinite, e.g. livestreams).
export function encodeProgressChanged(position: number, duration: number | null): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    ProgressChanged.startProgressChanged(builder);
    ProgressChanged.addPosition(builder, Time.createTime(builder, secondsToMicros(position)));
    if (duration !== null && isFinite(duration)) {
        ProgressChanged.addDuration(builder, Time.createTime(builder, secondsToMicros(duration)));
    }
    return finish(builder, Message.ProgressChanged, ProgressChanged.endProgressChanged(builder));
}

export function encodeQueueItemSelected(index: number): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    const position = QueueIndex.createQueueIndex(builder, index);
    return finish(builder, Message.QueueItemSelected, QueueItemSelected.createQueueItemSelected(builder, QueuePosition.Index, position));
}

export function encodeError(kind: ErrorKind, packetNum: number | null): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, Message.Error, ErrorMessage.createError(builder, kind, packetNum));
}

interface V4MediaItemFields {
    container: string;
    url: string | null;
    content: string | null;
    time: number | null;
    volume: number | null;
    speed: number | null;
    headers: { [key: string]: string } | null;
    metadata: MetadataObject | null;
}

function createMediaItem(builder: flatbuffers.Builder, item: V4MediaItemFields, includeHeaders: boolean): flatbuffers.Offset {
    // v4 items always carry a URL. Inline v2/v3 content (e.g. a DASH manifest) becomes a data URL.
    const url = item.url !== null ? item.url : `data:${item.container};base64,${Buffer.from(item.content !== null ? item.content : '', 'utf8').toString('base64')}`;

    const container = builder.createString(item.container);
    const sourceUrl = builder.createString(url);
    const metadata = (item.metadata ? item.metadata : {}) as Partial<GenericMediaMetadata>;
    const title = typeof metadata.title === 'string' ? builder.createString(metadata.title) : 0;
    const thumbnailUrl = typeof metadata.thumbnailUrl === 'string' ? builder.createString(metadata.thumbnailUrl) : 0;

    let headers = 0;
    if (includeHeaders && item.headers) {
        const headerOffsets = Object.keys(item.headers).map((key) =>
            RequestHeader.createRequestHeader(builder, builder.createString(key), builder.createString(item.headers[key])));
        headers = V4MediaItem.createHeadersVector(builder, headerOffsets);
    }

    V4MediaItem.startMediaItem(builder);
    V4MediaItem.addContainer(builder, container);
    V4MediaItem.addSourceUrl(builder, sourceUrl);
    if (item.time !== null && item.time !== undefined) {
        V4MediaItem.addStartTime(builder, Time.createTime(builder, secondsToMicros(item.time)));
    }
    if (item.volume !== null && item.volume !== undefined) {
        V4MediaItem.addVolume(builder, item.volume);
    }
    if (item.speed !== null && item.speed !== undefined) {
        V4MediaItem.addSpeed(builder, item.speed);
    }
    if (headers) {
        V4MediaItem.addHeaders(builder, headers);
    }
    if (title) {
        V4MediaItem.addTitle(builder, title);
    }
    if (thumbnailUrl) {
        V4MediaItem.addThumbnailUrl(builder, thumbnailUrl);
    }
    return V4MediaItem.endMediaItem(builder);
}

function parsePlaylist(message: PlayMessage): PlaylistContent | null {
    if (message.container !== PLAYLIST_CONTAINER || !message.content) {
        return null;
    }

    try {
        const content = JSON.parse(message.content);
        return content && content.contentType === ContentType.Playlist && Array.isArray(content.items) ? content : null;
    } catch {
        return null;
    }
}

// Encodes a v2/v3 PlayMessage as a v4 `Load`. Request headers are left out by default: the spec
// strips them when relaying a load to other senders so credentials aren't shared.
export function encodeLoad(message: PlayMessage, includeHeaders = false): Uint8Array {
    const builder = new flatbuffers.Builder(1024);
    const playlist = parsePlaylist(message);

    let load: flatbuffers.Offset;
    if (playlist !== null) {
        const items = playlist.items.map((item: MediaItem) => {
            const mediaItem = createMediaItem(builder, item, includeHeaders);
            QueueItem.startQueueItem(builder);
            QueueItem.addMediaItem(builder, mediaItem);
            if (item.showDuration !== null && item.showDuration !== undefined) {
                QueueItem.addPlaybackDuration(builder, Time.createTime(builder, secondsToMicros(item.showDuration)));
            }
            return QueueItem.endQueueItem(builder);
        });
        const offset = playlist.offset !== null && playlist.offset !== undefined ? playlist.offset : null;
        const queue = Queue.createQueue(builder, Queue.createItemsVector(builder, items), offset, true);
        load = Load.createLoad(builder, MediaSource.Queue, queue);
    } else {
        load = Load.createLoad(builder, MediaSource.Single, createMediaItem(builder, message, includeHeaders));
    }

    return finish(builder, Message.Load, load);
}

// Unused by the receiver itself; kept for tests and tools that play the sender role.
export function encodeSenderIntroduction(info: V4DeviceInfo): Uint8Array {
    const builder = new flatbuffers.Builder(256);
    const displayName = info.displayName !== null ? builder.createString(info.displayName) : 0;
    const appName = info.appName !== null ? builder.createString(info.appName) : 0;
    const appVersion = info.appVersion !== null ? builder.createString(info.appVersion) : 0;
    const deviceInfo = DeviceInfo.createDeviceInfo(builder, displayName, appName, appVersion);
    return finish(builder, Message.SenderIntroduction, SenderIntroduction.createSenderIntroduction(builder, deviceInfo));
}

export { ErrorKind, Message, V4PlaybackState };
