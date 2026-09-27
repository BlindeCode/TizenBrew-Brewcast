import * as flatbuffers from 'modules/flatbuffers';
import {
    AddSubtitleSource, AudioCapabilities, AudioTrackMeta, ChangeTrack, CompanionHelloRequest, CompanionHelloResponse,
    CompanionResourceInfoRequest, CompanionResourceInfoResponse, CompanionResourceRequest, CompanionResourceSize, DeviceInfo,
    Error as ErrorMessage, ErrorKind, KnownResourceSize, Load, MediaCapabilities, MediaItem as V4MediaItem, MediaSource,
    MediaTrack, MediaTrackMetadata, MediaTrackType, Message, MirroringSessionDescription, Packet,
    PlaybackState as V4PlaybackState, PlaybackStateChanged, ProgressChanged, Queue, QueueIndex, QueueInsert, QueueItem,
    QueueItemSelected, QueueMarkerBack, QueueMarkerFront, QueuePosition, QueueRemove, ReceiverCapabilities, ReceiverIntroduction,
    RequestHeader, ResourceReadHead, SenderIntroduction, SetProgressUpdateInterval, SpeedChanged, StartMirroringSession,
    StopPlayback, SubtitleTrackMeta, Time, TracksAvailable, UnknownResourceSize, VideoResolution, VideoTrackMeta, VolumeChanged,
} from 'common/v4/generated/fcast/v4';
import {
    ContentType, GenericMediaMetadata, MediaItem, MetadataObject, PlaybackState, PlaylistContent, PlayMessage,
} from 'common/Packets';

// Protocol v4 FlatBuffers messages, translated to and from the v2/v3 message model that the rest
// of the receiver (players, listener services) is written against. Sender-side encoders are here
// too, for tests and tools.

export const PLAYLIST_CONTAINER = 'application/json';
// v4 `MaxPacketSize` (opcode + body) and the largest resource read that fits one `Resource` packet
// (fcast-protocol companion::MAX_RESOURCE_READ_SIZE).
export const V4_MAX_PACKET_SIZE = 512 * 1024;
const RESOURCE_HEADER_SIZE = 7; // request id (u32), part (u8), total parts (u8), result tag (u8)
export const MAX_RESOURCE_READ_SIZE = V4_MAX_PACKET_SIZE - RESOURCE_HEADER_SIZE - 1;

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
export type V4TrackType = 'video' | 'audio' | 'subtitle';

export interface V4Track {
    id: number;
    type: V4TrackType;
    // ISO 639 language code, "und" when unknown.
    language: string;
    title: string | null;
    width?: number;
    height?: number;
}

// A v3 playlist carrying v4's queue flag. v3 has no `autoplay`; v3 playlists always advance.
export interface V4PlaylistContent extends PlaylistContent {
    autoplay?: boolean;
}

export type V4Incoming =
    | { type: 'load', play: PlayMessage }
    | { type: 'seek', time: number }
    | { type: 'volume', volume: number }
    | { type: 'speed', speed: number }
    | { type: 'playbackState', state: V4PlaybackState }
    | { type: 'stop' }
    | { type: 'queueItemSelected', position: V4QueuePosition }
    | { type: 'queueInsert', item: MediaItem, position: V4QueuePosition }
    | { type: 'queueRemove', position: V4QueuePosition }
    | { type: 'changeTrack', trackType: V4TrackType, id: number | null }
    | { type: 'addSubtitleSource', url: string, select: boolean, name: string | null }
    | { type: 'senderIntroduction', deviceInfo: V4DeviceInfo }
    | { type: 'progressUpdateInterval', intervalMs: number }
    | { type: 'startMirroringSession', sessionId: number }
    | { type: 'mirroringSessionDescription', sessionId: number, sdp: string }
    | { type: 'companionHelloRequest' }
    | { type: 'companionResourceInfoResponse', requestId: number, contentType: string, size: number | null }
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

const TRACK_TYPES: { [type in V4TrackType]: MediaTrackType } = {
    video: MediaTrackType.Video,
    audio: MediaTrackType.Audio,
    subtitle: MediaTrackType.Subtitle,
};

function trackTypeFromV4(type: MediaTrackType): V4TrackType {
    switch (type) {
        case MediaTrackType.Video:
            return 'video';
        case MediaTrackType.Audio:
            return 'audio';
        case MediaTrackType.Subtitle:
            return 'subtitle';
        default:
            throw new V4DecodeError(`invalid track type ${type}`);
    }
}

// ---- Decoding (sender -> receiver) -----------------------------------------------------------

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

function mediaItemFromV4(queueItem: QueueItem): MediaItem {
    const item = queueItem.mediaItem();
    if (item === null) {
        throw new V4DecodeError('missing required field media_item');
    }

    return new MediaItem(
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
    );
}

// A v4 queue maps onto a v3 playlist: a PlayMessage whose content is a PlaylistContent.
function playMessageFromV4Queue(queue: Queue): PlayMessage {
    const items: MediaItem[] = [];
    for (let i = 0; i < queue.itemsLength(); i++) {
        items.push(mediaItemFromV4(queue.items(i)));
    }

    const startIndex = queue.startIndex();
    const playlist: V4PlaylistContent = new PlaylistContent(items, startIndex !== null ? startIndex : 0);
    playlist.autoplay = queue.autoplay();
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
        case Message.QueueInsert: {
            const msg = payload(new QueueInsert());
            const item = msg.item();
            if (item === null) {
                throw new V4DecodeError('missing required field item');
            }
            return {
                type: 'queueInsert',
                item: mediaItemFromV4(item),
                position: queuePositionFromV4(msg.positionType(), () => msg.position(new QueueIndex())),
            };
        }
        case Message.QueueRemove: {
            const msg = payload(new QueueRemove());
            return { type: 'queueRemove', position: queuePositionFromV4(msg.positionType(), () => msg.position(new QueueIndex())) };
        }
        case Message.ChangeTrack: {
            const msg = payload(new ChangeTrack());
            return { type: 'changeTrack', trackType: trackTypeFromV4(msg.trackType()), id: msg.id() };
        }
        case Message.AddSubtitleSource: {
            const msg = payload(new AddSubtitleSource());
            const url = requiredString(msg.url(), 'url');
            if (url.length === 0) {
                // The spec gives an empty URL no meaning.
                throw new V4DecodeError('empty subtitle URL');
            }
            return { type: 'addSubtitleSource', url: url, select: msg.select(), name: msg.name() };
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
        case Message.StartMirroringSession:
            return { type: 'startMirroringSession', sessionId: payload(new StartMirroringSession()).sessionId() };
        case Message.MirroringSessionDescription: {
            const msg = payload(new MirroringSessionDescription());
            return { type: 'mirroringSessionDescription', sessionId: msg.sessionId(), sdp: requiredString(msg.sdp(), 'sdp') };
        }
        case Message.CompanionHelloRequest:
            payload(new CompanionHelloRequest());
            return { type: 'companionHelloRequest' };
        case Message.CompanionResourceInfoResponse: {
            const msg = payload(new CompanionResourceInfoResponse());
            let size: number | null = null;
            if (msg.resourceSizeType() === CompanionResourceSize.Known) {
                size = Number((msg.resourceSize(new KnownResourceSize()) as KnownResourceSize).size());
            }
            return {
                type: 'companionResourceInfoResponse',
                requestId: msg.requestId(),
                contentType: requiredString(msg.contentType(), 'content_type'),
                size: size,
            };
        }
        default:
            return { type: 'unsupported', message: type };
    }
}

// `Resource` (opcode 21) bodies: request id (u32 LE), part, total parts, then a result tag (0 = not
// found, 1 = success) followed by the data.
export interface ResourcePart {
    requestId: number;
    part: number;
    totalParts: number;
    found: boolean;
    data: Buffer;
}

export function parseResourcePacket(body: Buffer): ResourcePart {
    if (body.length < RESOURCE_HEADER_SIZE) {
        throw new V4DecodeError('Resource packet too short');
    }

    const tag = body[6];
    if (tag !== 0 && tag !== 1) {
        throw new V4DecodeError(`invalid resource result ${tag}`);
    }

    return {
        requestId: body.readUInt32LE(0),
        part: body[4],
        totalParts: body[5],
        found: tag === 1,
        data: body.subarray(RESOURCE_HEADER_SIZE),
    };
}

export function encodeResourcePacket(requestId: number, part: number, totalParts: number, data: Buffer | null): Buffer {
    const header = Buffer.alloc(RESOURCE_HEADER_SIZE);
    header.writeUInt32LE(requestId, 0);
    header[4] = part;
    header[5] = totalParts;
    header[6] = data === null ? 0 : 1;
    return data === null ? header : Buffer.concat([header, data]);
}

// ---- Encoding --------------------------------------------------------------------------------

function createString(builder: flatbuffers.Builder, value: string | null | undefined): flatbuffers.Offset {
    return value !== null && value !== undefined ? builder.createString(value) : 0;
}

function createStringVector(builder: flatbuffers.Builder, values: string[]): flatbuffers.Offset {
    const offsets = values.map((value) => builder.createString(value));
    builder.startVector(4, offsets.length, 4);
    for (let i = offsets.length - 1; i >= 0; i--) {
        builder.addOffset(offsets[i]);
    }
    return builder.endVector();
}

function createQueuePosition(builder: flatbuffers.Builder, position: V4QueuePosition): [QueuePosition, flatbuffers.Offset] {
    switch (position.kind) {
        case 'index':
            return [QueuePosition.Index, QueueIndex.createQueueIndex(builder, position.index)];
        case 'front':
            QueueMarkerFront.startQueueMarkerFront(builder);
            return [QueuePosition.Front, QueueMarkerFront.endQueueMarkerFront(builder)];
        case 'back':
            QueueMarkerBack.startQueueMarkerBack(builder);
            return [QueuePosition.Back, QueueMarkerBack.endQueueMarkerBack(builder)];
    }
}

function createDeviceInfo(builder: flatbuffers.Builder, info: V4DeviceInfo): flatbuffers.Offset {
    return DeviceInfo.createDeviceInfo(builder, createString(builder, info.displayName), createString(builder, info.appName),
        createString(builder, info.appVersion));
}

export function encodeReceiverIntroduction(info: V4DeviceInfo, media: V4MediaCapabilities, volumeStepInterval: number): Uint8Array {
    const builder = new flatbuffers.Builder(1024);
    const deviceInfo = createDeviceInfo(builder, info);

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

// `duration` is omitted when unknown (null, NaN or infinite, e.g. livestreams). Sender-side this
// is a seek request.
export function encodeProgressChanged(position: number, duration: number | null): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    ProgressChanged.startProgressChanged(builder);
    ProgressChanged.addPosition(builder, Time.createTime(builder, secondsToMicros(position)));
    if (duration !== null && isFinite(duration)) {
        ProgressChanged.addDuration(builder, Time.createTime(builder, secondsToMicros(duration)));
    }
    return finish(builder, Message.ProgressChanged, ProgressChanged.endProgressChanged(builder));
}

export function encodeQueueItemSelected(position: V4QueuePosition | number): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    const [type, offset] = createQueuePosition(builder, typeof position === 'number' ? { kind: 'index', index: position } : position);
    return finish(builder, Message.QueueItemSelected, QueueItemSelected.createQueueItemSelected(builder, type, offset));
}

export function encodeQueueRemove(position: V4QueuePosition): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    const [type, offset] = createQueuePosition(builder, position);
    return finish(builder, Message.QueueRemove, QueueRemove.createQueueRemove(builder, type, offset));
}

export function encodeStopPlayback(): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    StopPlayback.startStopPlayback(builder);
    return finish(builder, Message.StopPlayback, StopPlayback.endStopPlayback(builder));
}

export function encodeError(kind: ErrorKind, packetNum: number | null): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, Message.Error, ErrorMessage.createError(builder, kind, packetNum));
}

export function encodeTracksAvailable(tracks: V4Track[]): Uint8Array {
    const builder = new flatbuffers.Builder(1024);
    const offsets = tracks.map((track) => {
        const language = builder.createString(track.language || 'und');
        const title = createString(builder, track.title);

        let metadataType: MediaTrackMetadata;
        let metadata: flatbuffers.Offset;
        switch (track.type) {
            case 'video':
                metadataType = MediaTrackMetadata.Video;
                VideoTrackMeta.startVideoTrackMeta(builder);
                if (track.width && track.height) {
                    VideoTrackMeta.addResolution(builder, VideoResolution.createVideoResolution(builder, track.width, track.height));
                }
                metadata = VideoTrackMeta.endVideoTrackMeta(builder);
                break;
            case 'audio':
                metadataType = MediaTrackMetadata.Audio;
                AudioTrackMeta.startAudioTrackMeta(builder);
                metadata = AudioTrackMeta.endAudioTrackMeta(builder);
                break;
            case 'subtitle':
                metadataType = MediaTrackMetadata.Subtitle;
                metadata = SubtitleTrackMeta.createSubtitleTrackMeta(builder);
                break;
        }

        return MediaTrack.createMediaTrack(builder, track.id, language, title, metadataType, metadata);
    });

    const list = TracksAvailable.createTracksVector(builder, offsets);
    return finish(builder, Message.TracksAvailable, TracksAvailable.createTracksAvailable(builder, list));
}

// `id` null means the track type is off (e.g. no subtitles).
export function encodeChangeTrack(id: number | null, type: V4TrackType): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, Message.ChangeTrack, ChangeTrack.createChangeTrack(builder, id, TRACK_TYPES[type]));
}

export function encodeCompanionHelloResponse(providerId: number): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, Message.CompanionHelloResponse, CompanionHelloResponse.createCompanionHelloResponse(builder, providerId));
}

export function encodeCompanionResourceInfoRequest(requestId: number, resourceId: number): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, Message.CompanionResourceInfoRequest,
        CompanionResourceInfoRequest.createCompanionResourceInfoRequest(builder, requestId, resourceId));
}

export function encodeCompanionResourceRequest(requestId: number, resourceId: number, start: number, stopInclusive: number): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    CompanionResourceRequest.startCompanionResourceRequest(builder);
    CompanionResourceRequest.addRequestId(builder, requestId);
    CompanionResourceRequest.addResourceId(builder, resourceId);
    CompanionResourceRequest.addReadHead(builder, ResourceReadHead.createResourceReadHead(builder, BigInt(start), BigInt(stopInclusive)));
    return finish(builder, Message.CompanionResourceRequest, CompanionResourceRequest.endCompanionResourceRequest(builder));
}

export function encodeMirroringSessionDescription(sessionId: number, sdp: string): Uint8Array {
    const builder = new flatbuffers.Builder(1024);
    const sdpOffset = builder.createString(sdp);
    return finish(builder, Message.MirroringSessionDescription,
        MirroringSessionDescription.createMirroringSessionDescription(builder, sessionId, sdpOffset));
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
    const url = item.url !== null && item.url !== undefined ? item.url :
        `data:${item.container};base64,${Buffer.from(item.content !== null && item.content !== undefined ? item.content : '', 'utf8').toString('base64')}`;

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

function createQueueItem(builder: flatbuffers.Builder, item: MediaItem, includeHeaders: boolean): flatbuffers.Offset {
    const mediaItem = createMediaItem(builder, item, includeHeaders);
    QueueItem.startQueueItem(builder);
    QueueItem.addMediaItem(builder, mediaItem);
    if (item.showDuration !== null && item.showDuration !== undefined) {
        QueueItem.addPlaybackDuration(builder, Time.createTime(builder, secondsToMicros(item.showDuration)));
    }
    return QueueItem.endQueueItem(builder);
}

export function parsePlaylist(message: PlayMessage): V4PlaylistContent | null {
    if (!message || message.container !== PLAYLIST_CONTAINER || !message.content) {
        return null;
    }

    try {
        const content = JSON.parse(message.content);
        return content && content.contentType === ContentType.Playlist && Array.isArray(content.items) ? content : null;
    } catch {
        return null;
    }
}

// A single item, or a queue with its current position.
export type V4LoadSource =
    | { kind: 'single', message: PlayMessage }
    | { kind: 'queue', items: MediaItem[], index: number, autoplay: boolean };

export function loadSourceOf(message: PlayMessage): V4LoadSource {
    const playlist = parsePlaylist(message);
    if (playlist === null) {
        return { kind: 'single', message: message };
    }
    return {
        kind: 'queue',
        items: playlist.items,
        index: playlist.offset !== null && playlist.offset !== undefined ? playlist.offset : 0,
        // v3 playlists always advance.
        autoplay: playlist.autoplay !== undefined ? playlist.autoplay : true,
    };
}

// Encodes a v4 `Load`. Request headers are left out by default: the spec strips them when relaying
// a load to other senders so credentials aren't shared.
export function encodeLoadSource(source: V4LoadSource, includeHeaders = false): Uint8Array {
    const builder = new flatbuffers.Builder(1024);

    let load: flatbuffers.Offset;
    if (source.kind === 'queue') {
        const items = source.items.map((item) => createQueueItem(builder, item, includeHeaders));
        const queue = Queue.createQueue(builder, Queue.createItemsVector(builder, items), source.index, source.autoplay);
        load = Load.createLoad(builder, MediaSource.Queue, queue);
    } else {
        load = Load.createLoad(builder, MediaSource.Single, createMediaItem(builder, source.message, includeHeaders));
    }

    return finish(builder, Message.Load, load);
}

export function encodeLoad(message: PlayMessage, includeHeaders = false): Uint8Array {
    return encodeLoadSource(loadSourceOf(message), includeHeaders);
}

export function encodeQueueInsert(item: MediaItem, position: V4QueuePosition, includeHeaders = false): Uint8Array {
    const builder = new flatbuffers.Builder(1024);
    const queueItem = createQueueItem(builder, item, includeHeaders);
    const [type, offset] = createQueuePosition(builder, position);
    return finish(builder, Message.QueueInsert, QueueInsert.createQueueInsert(builder, queueItem, type, offset));
}

// ---- Sender-side encoders (tests and tools) ---------------------------------------------------

export function encodeSenderIntroduction(info: V4DeviceInfo): Uint8Array {
    const builder = new flatbuffers.Builder(256);
    const deviceInfo = createDeviceInfo(builder, info);
    return finish(builder, Message.SenderIntroduction, SenderIntroduction.createSenderIntroduction(builder, deviceInfo));
}

export function encodeAddSubtitleSource(url: string, select: boolean, name: string | null): Uint8Array {
    const builder = new flatbuffers.Builder(256);
    const urlOffset = builder.createString(url);
    const nameOffset = createString(builder, name);
    AddSubtitleSource.startAddSubtitleSource(builder);
    AddSubtitleSource.addUrl(builder, urlOffset);
    AddSubtitleSource.addSelect(builder, select);
    if (nameOffset) {
        AddSubtitleSource.addName(builder, nameOffset);
    }
    return finish(builder, Message.AddSubtitleSource, AddSubtitleSource.endAddSubtitleSource(builder));
}

export function encodeSetProgressUpdateInterval(intervalMs: number): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    SetProgressUpdateInterval.startSetProgressUpdateInterval(builder);
    SetProgressUpdateInterval.addInterval(builder, Time.createTime(builder, secondsToMicros(intervalMs / 1000)));
    return finish(builder, Message.SetProgressUpdateInterval, SetProgressUpdateInterval.endSetProgressUpdateInterval(builder));
}

export function encodeStartMirroringSession(sessionId: number): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, Message.StartMirroringSession, StartMirroringSession.createStartMirroringSession(builder, sessionId));
}

export function encodeCompanionHelloRequest(): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    CompanionHelloRequest.startCompanionHelloRequest(builder);
    return finish(builder, Message.CompanionHelloRequest, CompanionHelloRequest.endCompanionHelloRequest(builder));
}

export function encodeCompanionResourceInfoResponse(requestId: number, contentType: string, size: number | null): Uint8Array {
    const builder = new flatbuffers.Builder(256);
    const contentTypeOffset = builder.createString(contentType);
    let sizeType: CompanionResourceSize;
    let sizeOffset: flatbuffers.Offset;
    if (size === null) {
        sizeType = CompanionResourceSize.Unknown;
        UnknownResourceSize.startUnknownResourceSize(builder);
        sizeOffset = UnknownResourceSize.endUnknownResourceSize(builder);
    } else {
        sizeType = CompanionResourceSize.Known;
        sizeOffset = KnownResourceSize.createKnownResourceSize(builder, BigInt(size));
    }
    return finish(builder, Message.CompanionResourceInfoResponse,
        CompanionResourceInfoResponse.createCompanionResourceInfoResponse(builder, requestId, contentTypeOffset, sizeType, sizeOffset));
}

export { ErrorKind, Message, V4PlaybackState };
