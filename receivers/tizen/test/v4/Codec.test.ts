import * as flatbuffers from 'flatbuffers';
import {
    decodeV4, encodeError, encodeLoad, encodeProgressChanged, encodeReceiverIntroduction, encodeSenderIntroduction,
    ErrorKind, Message, PLAYLIST_CONTAINER, V4DecodeError,
} from 'common/v4/Codec';
import {
    Load, MediaItem as V4MediaItem, MediaSource, Packet, ProgressChanged, Queue, ReceiverIntroduction, Error as ErrorMessage,
} from 'common/v4/generated/fcast/v4';
import { GenericMediaMetadata, MediaItem, PlaylistContent, PlayMessage } from 'common/Packets';

function packetOf(bytes: Uint8Array): Packet {
    return Packet.getRootAsPacket(new flatbuffers.ByteBuffer(bytes));
}

describe('v4 codec', () => {
    const play = new PlayMessage(
        'video/mp4', 'https://example.com/video.mp4', null, 12.5, 0.5, 1.25,
        { Authorization: 'Bearer secret' }, new GenericMediaMetadata('Title', 'https://example.com/thumb.jpg'),
    );

    test('a single-item Load round-trips, headers only when asked for', () => {
        const withHeaders = decodeV4(encodeLoad(play, true));
        expect(withHeaders).toEqual({ type: 'load', play: { ...play } });

        const relayed = decodeV4(encodeLoad(play));
        expect(relayed.type).toBe('load');
        expect(relayed.type === 'load' && relayed.play.headers).toBeNull();
    });

    test('a v3 playlist becomes a v4 queue and back', () => {
        const playlist = new PlaylistContent([
            new MediaItem('video/mp4', 'https://example.com/a.mp4'),
            new MediaItem('image/jpeg', 'https://example.com/b.jpg', null, null, null, null, null, 5),
        ], 1);
        const message = new PlayMessage(PLAYLIST_CONTAINER, null, JSON.stringify(playlist));

        const packet = packetOf(encodeLoad(message));
        expect(packet.payloadType()).toBe(Message.Load);
        const load: Load = packet.payload(new Load());
        expect(load.sourceType()).toBe(MediaSource.Queue);
        const queue: Queue = load.source(new Queue());
        expect(queue.itemsLength()).toBe(2);
        expect(queue.startIndex()).toBe(1);
        expect(Number(queue.items(1).playbackDuration().micros())).toBe(5000000);

        const decoded = decodeV4(encodeLoad(message));
        expect(decoded.type).toBe('load');
        const content = JSON.parse(decoded.type === 'load' ? decoded.play.content : null);
        expect(content.offset).toBe(1);
        expect(content.items.map((item: MediaItem) => item.url)).toEqual(['https://example.com/a.mp4', 'https://example.com/b.jpg']);
        expect(content.items[1].showDuration).toBe(5);
    });

    test('inline v2/v3 content becomes a data URL', () => {
        const dash = new PlayMessage('application/dash+xml', null, '<MPD/>');
        const item: V4MediaItem = packetOf(encodeLoad(dash)).payload(new Load()).source(new V4MediaItem());
        expect(item.sourceUrl()).toBe(`data:application/dash+xml;base64,${Buffer.from('<MPD/>').toString('base64')}`);
    });

    test('ProgressChanged carries microseconds and omits unknown durations', () => {
        const known: ProgressChanged = packetOf(encodeProgressChanged(1.5, 10)).payload(new ProgressChanged());
        expect(Number(known.position().micros())).toBe(1500000);
        expect(Number(known.duration().micros())).toBe(10000000);

        const live: ProgressChanged = packetOf(encodeProgressChanged(3, Infinity)).payload(new ProgressChanged());
        expect(live.duration()).toBeNull();
    });

    test('ReceiverIntroduction carries device info and capabilities', () => {
        const bytes = encodeReceiverIntroduction(
            { displayName: 'TV', appName: 'BrewCast', appVersion: '1.0' },
            {
                protocols: ['http', 'https'], containers: ['mp4', 'hls'], videoFormats: ['h264'], audioFormats: ['aac'],
                subtitleFormats: ['vtt'], hdrFormats: [], imageFormats: ['png'], externalSubtitles: false, mirroring: false,
            },
            0.01,
        );
        const intro: ReceiverIntroduction = packetOf(bytes).payload(new ReceiverIntroduction());
        expect(intro.deviceInfo().displayName()).toBe('TV');
        expect(intro.deviceInfo().appName()).toBe('BrewCast');
        const media = intro.capabilities().media();
        expect([media.containers(0), media.containers(1)]).toEqual(['mp4', 'hls']);
        expect(media.hdrFormatsLength()).toBe(0);
        expect(intro.capabilities().audio().volumeStepInterval()).toBeCloseTo(0.01);
    });

    test('SenderIntroduction decodes to device info', () => {
        expect(decodeV4(encodeSenderIntroduction({ displayName: null, appName: 'Sender', appVersion: '2' }))).toEqual({
            type: 'senderIntroduction', deviceInfo: { displayName: null, appName: 'Sender', appVersion: '2' },
        });
    });

    test('Error carries the kind and packet number', () => {
        const error: ErrorMessage = packetOf(encodeError(ErrorKind.VolumeOutOfRange, 7)).payload(new ErrorMessage());
        expect(error.kind()).toBe(ErrorKind.VolumeOutOfRange);
        expect(error.packetNum()).toBe(7);
    });

    test('messages the receiver does not handle are reported as unsupported', () => {
        expect(decodeV4(encodeError(ErrorKind.Internal, null))).toEqual({ type: 'unsupported', message: Message.Error });
    });

    test('garbage is rejected with a decode error', () => {
        expect(() => decodeV4(new Uint8Array([1, 2, 3]))).toThrow(V4DecodeError);
    });
});
