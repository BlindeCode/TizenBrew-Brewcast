import * as http from 'http';
import { TcpListenerService } from 'common/TcpListenerService';
import { V4Config } from 'common/FCastSession';
import { loadOrCreateV4Identity } from 'common/v4/Certificate';
import {
    ErrorKind, Message, V4PlaybackState, encodeAddSubtitleSource, encodeChangeTrack, encodeCompanionHelloRequest,
    encodeCompanionResourceInfoResponse, encodeLoad, encodeLoadSource, encodeMirroringSessionDescription, encodeProgressChanged,
    encodeQueueInsert, encodeQueueItemSelected, encodeQueueRemove, encodeResourcePacket, encodeSpeedChanged,
    encodeStartMirroringSession, encodeStopPlayback, encodeVolumeChanged,
} from 'common/v4/Codec';
import {
    ChangeTrack, CompanionHelloResponse, CompanionResourceInfoRequest, CompanionResourceRequest, Error as ErrorMessage, Load,
    MediaItem as V4MediaItem, MediaTrackType, MirroringSessionDescription, PlaybackStateChanged, Queue, QueueIndex, QueueInsert,
    QueueItemSelected, SpeedChanged, TracksAvailable, VolumeChanged,
} from 'common/v4/generated/fcast/v4';
import { MediaItem, Opcode, PlaybackState, PlaybackUpdateMessage, PlayMessage } from 'common/Packets';
import { NetworkService } from 'common/NetworkService';
import { IpcServer } from 'src/Ipc';
import { Companion } from 'src/Companion';
import { MediaSession, PlayInfo, ItemInfo, QueueUpdate } from 'src/MediaSession';
import { subtitleRoute, subtitleRouteUrl } from 'src/Subtitles';
import { connectPlain, connectV4, flatPacket, PacketStream } from '../support/TestSender';

const identity = loadOrCreateV4Identity(null);
const v4Config: V4Config = {
    identity: identity,
    mediaCapabilities: {
        protocols: ['http'], containers: ['mp4'], videoFormats: ['h264'], audioFormats: ['aac'],
        subtitleFormats: ['vtt'], hdrFormats: [], imageFormats: ['png'], externalSubtitles: true, mirroring: true,
    },
    volumeStepInterval: 0.01,
};

interface PageEvent {
    event: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- whatever the service sent
    value: any;
}

// A listener, the media session and the local HTTP routes, with the pages replaced by a log.
class Harness {
    listener: TcpListenerService;
    ipc: IpcServer;
    companion: Companion;
    media: MediaSession;
    streams: PacketStream[] = [];
    private events: PageEvent[] = [];
    private waiters: { event: string, resolve: (event: PageEvent) => void }[] = [];

    async start() {
        this.listener = new TcpListenerService(v4Config);
        this.listener.start(0);
        this.ipc = new IpcServer(() => null);
        this.ipc.start(0);
        this.companion = new Companion((id) => this.listener.getSession(id), () => this.base);
        this.ipc.routes.push(this.companion.route, subtitleRoute);
        this.media = new MediaSession({
            listener: () => this.listener,
            companion: this.companion,
            page: (event, value) => this.onPage(event, value),
            ensurePage: () => undefined,
            subtitleUrl: (source) => subtitleRouteUrl(this.base, source),
        });
        this.media.bind(this.listener.emitter, () => true);
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    get base(): string {
        return `http://127.0.0.1:${this.ipc.port}`;
    }

    stop() {
        this.streams.splice(0).forEach((stream) => stream.socket.destroy());
        this.listener.stop();
        this.ipc.stop();
    }

    private onPage(event: string, value: unknown) {
        const entry = { event: event, value: JSON.parse(JSON.stringify(value === undefined ? null : value)) };
        const index = this.waiters.findIndex((waiter) => waiter.event === event);
        if (index >= 0) {
            this.waiters.splice(index, 1)[0].resolve(entry);
        } else {
            this.events.push(entry);
        }
    }

    // The next event of this name the pages were sent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page(event: string, timeoutMs = 2000): Promise<any> {
        const index = this.events.findIndex((entry) => entry.event === event);
        if (index >= 0) {
            return Promise.resolve(this.events.splice(index, 1)[0].value);
        }
        return new Promise((resolve, reject) => {
            const waiter = { event: event, resolve: (entry: PageEvent) => { clearTimeout(timer); resolve(entry.value); } };
            const timer = setTimeout(() => {
                this.waiters.splice(this.waiters.indexOf(waiter), 1);
                reject(new Error(`no '${event}' page event within ${timeoutMs}ms`));
            }, timeoutMs);
            this.waiters.push(waiter);
        });
    }

    hasPageEvent(event: string): boolean {
        return this.events.some((entry) => entry.event === event);
    }

    async v4Sender(): Promise<PacketStream> {
        const stream = await connectV4(this.listener.port, identity.fingerprint);
        this.streams.push(stream);
        await expectMessage(stream, Message.ReceiverIntroduction);
        await expectMessage(stream, Message.VolumeChanged);
        return stream;
    }
}

async function expectMessage(stream: PacketStream, type: Message) {
    for (;;) {
        const packet = flatPacket(await stream.nextOf(Opcode.Flatbuf));
        // Volume and state updates arrive whenever they change; skip them unless asked for.
        const skippable = [Message.VolumeChanged, Message.PlaybackStateChanged, Message.ProgressChanged, Message.SpeedChanged];
        if (packet.payloadType() === type || skippable.indexOf(packet.payloadType()) < 0) {
            expect(Message[packet.payloadType()]).toBe(Message[type]);
            return packet;
        }
    }
}

async function expectError(stream: PacketStream, kind: ErrorKind): Promise<ErrorMessage> {
    const error: ErrorMessage = (await expectMessage(stream, Message.Error)).payload(new ErrorMessage());
    expect(ErrorKind[error.kind()]).toBe(ErrorKind[kind]);
    return error;
}

// TracksAvailable and the three ChangeTrack messages that follow it.
async function expectTrackAnnouncement(stream: PacketStream) {
    await expectMessage(stream, Message.TracksAvailable);
    for (let i = 0; i < 3; i++) {
        await expectMessage(stream, Message.ChangeTrack);
    }
}

// Nothing more arrives (other than heartbeats) within a short while.
async function expectSilence(stream: PacketStream, ms = 300) {
    await expect(stream.nextOf(Opcode.Flatbuf, ms)).rejects.toThrow();
}

function queueLoad(urls: string[], startIndex: number, autoplay = true): Uint8Array {
    return encodeLoadSource({
        kind: 'queue',
        items: urls.map((url) => new MediaItem('video/mp4', url)),
        index: startIndex,
        autoplay: autoplay,
    });
}

function get(url: string, headers: http.OutgoingHttpHeaders = {}): Promise<{ status: number, headers: http.IncomingHttpHeaders, body: Buffer }> {
    return new Promise((resolve, reject) => {
        http.get(url, { headers: headers }, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        }).on('error', reject);
    });
}

describe('media session', () => {
    const harness = new Harness();

    beforeEach(() => harness.start());
    afterEach(() => harness.stop());
    // Loads with request headers start the header proxy.
    afterAll(() => NetworkService.proxyServer?.close());

    test('a load is relayed to other senders without headers, and to v3 senders as PlayUpdate', async () => {
        const first = await harness.v4Sender();
        const second = await harness.v4Sender();
        const legacy = await connectPlain(harness.listener.port);
        harness.streams.push(legacy);
        legacy.sendJson(Opcode.Version, { version: 3 });
        await legacy.nextOf(Opcode.Version);

        first.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', 'https://example.com/v.mp4', null, null, null, null, { Cookie: 'x' }), true));

        const info: PlayInfo = await harness.page('load');
        expect(info.rendererEvent).toBe('play');
        expect((info.rendererMessage as PlayMessage).headers).toEqual({ Cookie: 'x' });
        expect(info.contentViewer).toBe('player');

        const item: V4MediaItem = (await expectMessage(second, Message.Load)).payload(new Load()).source(new V4MediaItem());
        expect(item.sourceUrl()).toBe('https://example.com/v.mp4');
        expect(item.headersLength()).toBe(0);

        const update = JSON.parse((await legacy.nextOf(Opcode.PlayUpdate)).body.toString('utf8'));
        expect(update.playData.url).toBe('https://example.com/v.mp4');

        await expectSilence(first);
    });

    test('queue selection is validated, relayed to the others and passed to the player', async () => {
        const first = await harness.v4Sender();
        const second = await harness.v4Sender();

        first.send(Opcode.Flatbuf, encodeQueueItemSelected(0));
        // Packet 0 was the plaintext Version.
        expect((await expectError(first, ErrorKind.InvalidState)).packetNum()).toBe(1);

        first.send(Opcode.Flatbuf, queueLoad(['https://e.com/0.mp4', 'https://e.com/1.mp4', 'https://e.com/2.mp4'], 1));
        const info: PlayInfo = await harness.page('load');
        expect(info.rendererEvent).toBe('play-playlist');
        expect(info.rendererMessage).toMatchObject({ offset: 1, autoplay: true });
        const queue: Queue = (await expectMessage(second, Message.Load)).payload(new Load()).source(new Queue());
        expect(queue.itemsLength()).toBe(3);
        expect(queue.startIndex()).toBe(1);

        first.send(Opcode.Flatbuf, encodeQueueItemSelected(3));
        await expectError(first, ErrorKind.QueuePositionOutOfRange);

        first.send(Opcode.Flatbuf, encodeQueueItemSelected({ kind: 'back' }));
        expect(await harness.page('setplaylistitem')).toEqual({ itemIndex: 2 });
        const selected: QueueItemSelected = (await expectMessage(second, Message.QueueItemSelected)).payload(new QueueItemSelected());
        expect(selected.positionType()).toBe(3); // QueuePosition.Back, relayed as sent
        await expectSilence(first);

        // The player then asks for the item: no second announcement.
        await harness.media.playRequest(info.loadId, 2);
        const item: ItemInfo = await harness.page('item');
        expect(item).toMatchObject({ index: 2, message: { url: 'https://e.com/2.mp4' } });
        await expectSilence(second);

        // The TV moves on by itself (autoplay, remote): every sender hears about it.
        await harness.media.playRequest(info.loadId, 0);
        for (const stream of [first, second]) {
            const position = (await expectMessage(stream, Message.QueueItemSelected)).payload(new QueueItemSelected()).position(new QueueIndex());
            expect(position.index()).toBe(0);
        }
    });

    test('queue inserts and removals keep the playing item and are relayed without headers', async () => {
        const first = await harness.v4Sender();
        const second = await harness.v4Sender();
        first.send(Opcode.Flatbuf, queueLoad(['https://e.com/a.mp4', 'https://e.com/b.mp4'], 1));
        await harness.page('load');
        await expectMessage(second, Message.Load);

        const inserted = new MediaItem('video/mp4', 'https://e.com/new.mp4', null, null, null, null, null, null, { Authorization: 'secret' });
        first.send(Opcode.Flatbuf, encodeQueueInsert(inserted, { kind: 'front' }, true));
        let update: QueueUpdate = await harness.page('queue_update');
        expect(update.items.map((item) => item.url)).toEqual(['https://e.com/new.mp4', 'https://e.com/a.mp4', 'https://e.com/b.mp4']);
        expect(update.index).toBe(2);
        const relayed: QueueInsert = (await expectMessage(second, Message.QueueInsert)).payload(new QueueInsert());
        expect(relayed.item().mediaItem().sourceUrl()).toBe('https://e.com/new.mp4');
        expect(relayed.item().mediaItem().headersLength()).toBe(0);

        first.send(Opcode.Flatbuf, encodeQueueInsert(inserted, { kind: 'index', index: 4 }));
        await expectError(first, ErrorKind.QueuePositionOutOfRange);

        first.send(Opcode.Flatbuf, encodeQueueRemove({ kind: 'index', index: 2 }));
        await expectError(first, ErrorKind.QueueRemovePlayingItem);

        first.send(Opcode.Flatbuf, encodeQueueRemove({ kind: 'front' }));
        update = await harness.page('queue_update');
        expect(update.items.map((item) => item.url)).toEqual(['https://e.com/a.mp4', 'https://e.com/b.mp4']);
        expect(update.index).toBe(1);
        await expectMessage(second, Message.QueueRemove);

        // A sender joining now learns the queue as it is.
        const late = await connectV4(harness.listener.port, identity.fingerprint);
        harness.streams.push(late);
        expect(harness.media.v4LoadSource()).toMatchObject({ kind: 'queue', index: 1 });
    });

    test('a full queue rejects inserts', async () => {
        const sender = await harness.v4Sender();
        const urls = Array.from({ length: 256 }, (_v, i) => `https://e.com/${i}.mp4`);
        sender.send(Opcode.Flatbuf, queueLoad(urls, 0));
        await harness.page('load');
        sender.send(Opcode.Flatbuf, encodeQueueInsert(new MediaItem('video/mp4', 'https://e.com/x.mp4'), { kind: 'back' }));
        await expectError(sender, ErrorKind.QueueFull);
    });

    test('seeks past the end are clamped and reported; speed and volume are confirmed', async () => {
        const sender = await harness.v4Sender();
        sender.send(Opcode.Flatbuf, encodeProgressChanged(10, null));
        await expectSilence(sender);
        expect(harness.hasPageEvent('seek')).toBe(false);

        sender.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', 'https://e.com/v.mp4')));
        await harness.page('load');
        harness.media.onPlaybackUpdate(new PlaybackUpdateMessage(Date.now(), PlaybackState.Playing, 5, 60, 1));

        sender.send(Opcode.Flatbuf, encodeProgressChanged(90, null));
        await expectError(sender, ErrorKind.SeekOutOfRange);
        expect(await harness.page('seek')).toEqual({ time: 60 });

        // Unchanged speed: nothing will happen on the player, so the receiver confirms it itself.
        sender.send(Opcode.Flatbuf, encodeSpeedChanged(1));
        expect((await expectMessage(sender, Message.SpeedChanged)).payload(new SpeedChanged()).speed()).toBe(1);
        expect(await harness.page('setspeed')).toEqual({ speed: 1 });
        sender.send(Opcode.Flatbuf, encodeSpeedChanged(1.5));
        expect(await harness.page('setspeed')).toEqual({ speed: 1.5 });

        sender.send(Opcode.Flatbuf, encodeVolumeChanged(0.3));
        expect((await expectMessage(sender, Message.VolumeChanged)).payload(new VolumeChanged()).volume()).toBeCloseTo(0.3);
        expect(await harness.page('setvolume')).toEqual({ volume: expect.closeTo(0.3) });
    });

    test('stopping relays StopPlayback to the others and reports Idle; Ended is reported', async () => {
        const first = await harness.v4Sender();
        const second = await harness.v4Sender();
        first.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', 'https://e.com/v.mp4')));
        await harness.page('load');
        await expectMessage(second, Message.Load);

        harness.media.onPlaybackUpdate(new PlaybackUpdateMessage(Date.now(), PlaybackState.Playing, 1, 60, 1));
        harness.media.onPlaybackState('ended');
        let state: PlaybackStateChanged = (await expectMessage(second, Message.PlaybackStateChanged)).payload(new PlaybackStateChanged());
        expect(state.state()).toBe(V4PlaybackState.Playing);
        state = (await expectMessage(second, Message.PlaybackStateChanged)).payload(new PlaybackStateChanged());
        expect(state.state()).toBe(V4PlaybackState.Ended);

        first.send(Opcode.Flatbuf, encodeStopPlayback());
        await harness.page('stop');
        await expectMessage(second, Message.StopPlayback);
        state = (await expectMessage(second, Message.PlaybackStateChanged)).payload(new PlaybackStateChanged());
        expect(state.state()).toBe(V4PlaybackState.Idle);
        expect(harness.media.v4LoadSource()).toBeNull();
    });

    test('tracks are announced, validated and switched through the player', async () => {
        const sender = await harness.v4Sender();
        sender.send(Opcode.Flatbuf, encodeChangeTrack(0, 'audio'));
        await expectError(sender, ErrorKind.InvalidState);

        sender.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', 'https://e.com/v.mp4')));
        const info: PlayInfo = await harness.page('load');
        harness.media.onTracks(info.loadId, {
            tracks: [
                { id: 0, type: 'video', language: 'und', title: null, width: 1920, height: 1080 },
                { id: 1, type: 'audio', language: 'eng', title: 'English' },
                { id: 2, type: 'audio', language: 'nld', title: null },
                { id: 3, type: 'subtitle', language: 'eng', title: null },
            ],
            selected: { video: 0, audio: 1, subtitle: null },
            live: false,
            seekable: true,
        });

        const tracks: TracksAvailable = (await expectMessage(sender, Message.TracksAvailable)).payload(new TracksAvailable());
        expect(tracks.tracksLength()).toBe(4);
        expect(tracks.tracks(1).iso639()).toBe('eng');
        const changes = [];
        for (let i = 0; i < 3; i++) {
            const change: ChangeTrack = (await expectMessage(sender, Message.ChangeTrack)).payload(new ChangeTrack());
            changes.push([MediaTrackType[change.trackType()], change.id()]);
        }
        expect(changes).toEqual([['Video', 0], ['Audio', 1], ['Subtitle', null]]);

        sender.send(Opcode.Flatbuf, encodeChangeTrack(3, 'audio'));
        await expectError(sender, ErrorKind.MalformedBody);

        sender.send(Opcode.Flatbuf, encodeChangeTrack(2, 'audio'));
        expect(await harness.page('changetrack')).toEqual({ loadId: info.loadId, type: 'audio', id: 2 });

        harness.media.onTracks(info.loadId, {
            tracks: [{ id: 0, type: 'video', language: 'und', title: null }, { id: 3, type: 'subtitle', language: 'eng', title: null }],
            selected: { video: null, audio: null, subtitle: null },
            live: false,
            seekable: true,
        });
        await expectTrackAnnouncement(sender);
        sender.send(Opcode.Flatbuf, encodeChangeTrack(3, 'subtitle'));
        await expectError(sender, ErrorKind.InvalidState);

        // The same report again isn't announced again.
        const joinTracks = harness.media.v4TrackMessages();
        expect(joinTracks.length).toBe(4);
    });

    test('external subtitles need seekable media and are served as WebVTT', async () => {
        const sender = await harness.v4Sender();
        sender.send(Opcode.Flatbuf, encodeAddSubtitleSource('https://e.com/s.srt', true, 'English'));
        await expectError(sender, ErrorKind.InvalidState);

        sender.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', 'https://e.com/v.mp4')));
        const info: PlayInfo = await harness.page('load');

        const srt = '1\r\n00:00:01,500 --> 00:00:03,000\r\n<font color="red">Hello</font> <i>there</i>\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,250\r\nA & B\r\n';
        const source = `data:text/plain;base64,${Buffer.from(srt, 'utf8').toString('base64')}`;
        sender.send(Opcode.Flatbuf, encodeAddSubtitleSource(source, true, 'English'));
        const added = await harness.page('addsubtitle');
        expect(added).toMatchObject({ loadId: info.loadId, id: 1000, name: 'English', select: true });

        const vtt = await get(added.url);
        expect(vtt.status).toBe(200);
        expect(vtt.headers['content-type']).toContain('text/vtt');
        expect(vtt.body.toString('utf8')).toBe('WEBVTT\n\n00:00:01.500 --> 00:00:03.000\nHello <i>there</i>\n\n00:00:04.000 --> 00:00:05.250\nA &amp; B\n');

        harness.media.onSubtitleFailed(1000);
        await expectError(sender, ErrorKind.ResourceNotFound);

        harness.media.onTracks(info.loadId, { tracks: [], selected: { video: null, audio: null, subtitle: null }, live: true, seekable: false });
        await expectTrackAnnouncement(sender);
        sender.send(Opcode.Flatbuf, encodeAddSubtitleSource(source, true, null));
        await expectError(sender, ErrorKind.InvalidState);
    });

    test('companion resources from one sender can be played through another', async () => {
        const provider = await harness.v4Sender();
        const loader = await harness.v4Sender();
        const content = Buffer.alloc(1300 * 1024);
        for (let i = 0; i < content.length; i++) {
            content[i] = (i * 7) & 0xff;
        }

        provider.send(Opcode.Flatbuf, encodeCompanionHelloRequest());
        const providerId = (await expectMessage(provider, Message.CompanionHelloResponse)).payload(new CompanionHelloResponse()).providerId();

        // The provider answers resource requests like a sender's companion server.
        let reads = 0;
        let serving = true;
        const serve = async () => {
            while (serving) {
                let packet;
                try {
                    packet = flatPacket(await provider.nextOf(Opcode.Flatbuf, 200));
                } catch {
                    continue;
                }
                if (packet.payloadType() === Message.CompanionResourceInfoRequest) {
                    const request: CompanionResourceInfoRequest = packet.payload(new CompanionResourceInfoRequest());
                    provider.send(Opcode.Flatbuf, encodeCompanionResourceInfoResponse(request.requestId(), 'video/mp4', content.length));
                } else if (packet.payloadType() === Message.CompanionResourceRequest) {
                    reads += 1;
                    const request: CompanionResourceRequest = packet.payload(new CompanionResourceRequest());
                    const start = Number(request.readHead().start());
                    const stop = Math.min(Number(request.readHead().stopInclusive()), content.length - 1);
                    const data = request.resourceId() === 7 ? content.subarray(start, stop + 1) : null;
                    provider.send(Opcode.Resource, encodeResourcePacket(request.requestId(), 0, 1, data));
                }
            }
        };
        const server = serve();

        loader.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', `fcomp://${providerId}.fcast/7`)));
        const info: PlayInfo = await harness.page('load');
        const pageUrl = (info.rendererMessage as PlayMessage).url;
        expect(pageUrl).toBe(`${harness.base}/fcomp/${providerId}/7`);

        const whole = await get(pageUrl);
        expect(whole.status).toBe(200);
        expect(whole.headers['content-length']).toBe(`${content.length}`);
        expect(whole.headers['accept-ranges']).toBe('bytes');
        expect(whole.body.equals(content)).toBe(true);
        expect(reads).toBe(3);

        const part = await get(pageUrl, { Range: 'bytes=1000-1999' });
        expect(part.status).toBe(206);
        expect(part.headers['content-range']).toBe(`bytes 1000-1999/${content.length}`);
        expect(part.body.equals(content.subarray(1000, 2000))).toBe(true);

        const tail = await get(pageUrl, { Range: 'bytes=-10' });
        expect(tail.body.equals(content.subarray(content.length - 10))).toBe(true);

        expect((await get(pageUrl, { Range: `bytes=${content.length}-` })).status).toBe(416);
        expect((await get(`${harness.base}/fcomp/${providerId}/8`)).status).toBe(404);
        expect((await get(`${harness.base}/fcomp/${providerId + 1}/7`)).status).toBe(404);

        serving = false;
        await server;
        provider.socket.destroy();
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect((await get(pageUrl)).status).toBe(404);
    }, 20000);

    test('mirroring: the offer goes to the player and its answer back to the sender', async () => {
        const sender = await harness.v4Sender();
        sender.send(Opcode.Flatbuf, encodeMirroringSessionDescription(5, 'v=0 offer'));
        await expectError(sender, ErrorKind.InvalidState);

        sender.send(Opcode.Flatbuf, encodeStartMirroringSession(5));
        const info: PlayInfo = await harness.page('load');
        expect(info.rendererMessage).toMatchObject({ container: 'application/x-fwebrtc' });

        sender.send(Opcode.Flatbuf, encodeMirroringSessionDescription(5, 'v=0 offer'));
        expect(await harness.page('mirroring_offer')).toEqual({ loadId: info.loadId, sdp: 'v=0 offer' });

        // A page that connects late still gets the offer.
        const replayed: { event: string, value: unknown }[] = [];
        harness.media.replay((event, value) => replayed.push({ event: event, value: value }));
        expect(replayed.map((entry) => entry.event)).toEqual(['load', 'mirroring_offer']);

        harness.media.mirroringAnswer(info.loadId, 'v=0 answer');
        const answer: MirroringSessionDescription = (await expectMessage(sender, Message.MirroringSessionDescription)).payload(new MirroringSessionDescription());
        expect(answer.sessionId()).toBe(5);
        expect(answer.sdp()).toBe('v=0 answer');

        sender.socket.destroy();
        await harness.page('stop');
    });

    test('player errors reach the sender that loaded the media', async () => {
        const first = await harness.v4Sender();
        const second = await harness.v4Sender();
        first.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', 'https://e.com/missing.mp4')));
        await harness.page('load');
        await expectMessage(second, Message.Load);

        await harness.media.onPlaybackError('404', 'not_found');
        const error = await expectError(first, ErrorKind.ResourceNotFound);
        expect(error.packetNum()).toBe(1);
        await expectSilence(second);
    });

    test('player errors are classified by checking the URL', async () => {
        const server = http.createServer((req, res) => {
            res.writeHead(req.url === '/there.mp4' ? 206 : 404);
            res.end(req.url === '/there.mp4' ? 'x' : '');
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        const port = (server.address() as { port: number }).port;
        const sender = await harness.v4Sender();

        try {
            sender.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', `http://127.0.0.1:${port}/there.mp4`)));
            await harness.page('load');
            await harness.media.onPlaybackError('code=4', 'unsupported');
            await expectError(sender, ErrorKind.UnsupportedFormat);

            sender.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', `http://127.0.0.1:${port}/gone.mp4`)));
            await harness.page('load');
            await harness.media.onPlaybackError('code=4', 'unsupported');
            await expectError(sender, ErrorKind.ResourceNotFound);
        } finally {
            server.close();
        }
    });
});
