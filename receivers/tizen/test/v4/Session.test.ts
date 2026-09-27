import * as tls from 'tls';
import { TcpListenerService } from 'common/TcpListenerService';
import { V4Config } from 'common/FCastSession';
import { loadOrCreateV4Identity } from 'common/v4/Certificate';
import { encodeLoad, encodeSenderIntroduction, ErrorKind, Message, V4PlaybackState } from 'common/v4/Codec';
import {
    Error as ErrorMessage, Load, MediaItem as V4MediaItem, PlaybackStateChanged, ProgressChanged, ReceiverIntroduction,
    SpeedChanged, VolumeChanged,
} from 'common/v4/generated/fcast/v4';
import * as flatbuffers from 'flatbuffers';
import { Packet, VolumeChanged as VolumeChangedTable } from 'common/v4/generated/fcast/v4';
import { Opcode, PlaybackState, PlaybackUpdateMessage, PlayMessage, PlayUpdateMessage, VolumeUpdateMessage } from 'common/Packets';
import { connectPlain, connectV4, flatPacket, PacketStream, spkiFingerprintOf } from '../support/TestSender';
import { testState } from '../support/Main';

const identity = loadOrCreateV4Identity(null);
const v4Config: V4Config = {
    identity: identity,
    mediaCapabilities: {
        protocols: ['http', 'https'], containers: ['mp4'], videoFormats: ['h264'], audioFormats: ['aac'],
        subtitleFormats: [], hdrFormats: [], imageFormats: [], externalSubtitles: false, mirroring: false,
    },
    volumeStepInterval: 0.01,
};

function encodeVolume(volume: number): Uint8Array {
    const builder = new flatbuffers.Builder(64);
    builder.finish(Packet.createPacket(builder, Message.VolumeChanged, VolumeChangedTable.createVolumeChanged(builder, volume)));
    return builder.asUint8Array();
}

function nextEvent(listener: TcpListenerService, event: string): Promise<unknown> {
    return new Promise((resolve) => listener.emitter.once(event, (value) => resolve(value)));
}

async function expectMessage(stream: PacketStream, type: Message): Promise<Packet> {
    const packet = flatPacket(await stream.nextOf(Opcode.Flatbuf));
    expect(Message[packet.payloadType()]).toBe(Message[type]);
    return packet;
}

describe('protocol sessions', () => {
    let listener: TcpListenerService;
    const streams: PacketStream[] = [];

    async function startListener(config: V4Config = v4Config) {
        listener = new TcpListenerService(config);
        listener.start(0);
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    async function v4Sender(): Promise<PacketStream> {
        const stream = await connectV4(listener.port, identity.fingerprint);
        streams.push(stream);
        await expectMessage(stream, Message.ReceiverIntroduction);
        await expectMessage(stream, Message.VolumeChanged);
        return stream;
    }

    beforeEach(() => {
        testState.playMessage = null;
        testState.playbackUpdate = null;
        testState.playerVolume = 1;
    });

    afterEach(() => {
        streams.splice(0).forEach((stream) => stream.socket.destroy());
        listener.stop();
    });

    test('v4 handshake: Version, TLS 1.3 with the pinned key, then introduction and volume', async () => {
        await startListener();
        testState.playerVolume = 0.25;
        const stream = await connectV4(listener.port, identity.fingerprint);
        streams.push(stream);

        const intro: ReceiverIntroduction = (await expectMessage(stream, Message.ReceiverIntroduction)).payload(new ReceiverIntroduction());
        expect(intro.deviceInfo().displayName()).toBe('Test TV');
        expect(intro.deviceInfo().appName()).toBe('BrewCast');
        expect(intro.capabilities().media().protocols(1)).toBe('https');

        const volume: VolumeChanged = (await expectMessage(stream, Message.VolumeChanged)).payload(new VolumeChanged());
        expect(volume.volume()).toBeCloseTo(0.25);
    });

    test('sender messages become the same events v3 senders produce', async () => {
        await startListener();
        const stream = await v4Sender();

        const initial = nextEvent(listener, 'initial');
        stream.send(Opcode.Flatbuf, encodeSenderIntroduction({ displayName: 'Phone', appName: 'Sender', appVersion: '1' }));
        expect(await initial).toMatchObject({ displayName: 'Phone', appName: 'Sender' });

        const play = nextEvent(listener, 'play');
        stream.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', 'https://example.com/v.mp4', null, 3, null, null, { A: 'b' }), true));
        expect(await play).toMatchObject({ container: 'video/mp4', url: 'https://example.com/v.mp4', time: 3, headers: { A: 'b' } });

        const setvolume = nextEvent(listener, 'setvolume');
        stream.send(Opcode.Flatbuf, encodeVolume(0.5));
        expect(await setvolume).toEqual({ volume: 0.5 });
    });

    test('player updates are translated into v4 messages, and v3-only ones are dropped', async () => {
        await startListener();
        const stream = await v4Sender();

        listener.send(Opcode.PlaybackUpdate, new PlaybackUpdateMessage(Date.now(), PlaybackState.Playing, 5, 60, 1));
        const progress: ProgressChanged = (await expectMessage(stream, Message.ProgressChanged)).payload(new ProgressChanged());
        expect(Number(progress.position().micros())).toBe(5000000);
        expect(Number(progress.duration().micros())).toBe(60000000);
        const state: PlaybackStateChanged = (await expectMessage(stream, Message.PlaybackStateChanged)).payload(new PlaybackStateChanged());
        expect(state.state()).toBe(V4PlaybackState.Playing);
        expect((await expectMessage(stream, Message.SpeedChanged)).payload(new SpeedChanged()).speed()).toBe(1);

        // Unchanged state and speed, within the progress interval: nothing to send.
        listener.send(Opcode.PlaybackUpdate, new PlaybackUpdateMessage(Date.now(), PlaybackState.Playing, 5.1, 60, 1));

        // No v4 equivalent: must not reach the sender, which would treat opcode 14/19 as an error.
        listener.send(Opcode.Initial, {});
        listener.send(Opcode.Event, { event: { type: 0 } });
        listener.send(Opcode.VolumeUpdate, new VolumeUpdateMessage(Date.now(), 0.75));
        const volume = await stream.next();
        expect(volume.opcode).toBe(Opcode.Flatbuf);
        expect(flatPacket(volume).payload(new VolumeChanged()).volume()).toBeCloseTo(0.75);
    });

    test('a load is relayed to the other senders without headers, not echoed back', async () => {
        await startListener();
        const first = await v4Sender();
        const second = await v4Sender();

        // What the service does with a play request: relay it as a PlayUpdate.
        listener.emitter.once('play', (message: PlayMessage) => listener.send(Opcode.PlayUpdate, new PlayUpdateMessage(Date.now(), message)));
        first.send(Opcode.Flatbuf, encodeLoad(new PlayMessage('video/mp4', 'https://example.com/v.mp4', null, null, null, null, { Cookie: 'x' }), true));

        const item: V4MediaItem = (await expectMessage(second, Message.Load)).payload(new Load()).source(new V4MediaItem());
        expect(item.sourceUrl()).toBe('https://example.com/v.mp4');
        expect(item.headersLength()).toBe(0);

        first.send(Opcode.Ping);
        expect((await first.next()).opcode).toBe(Opcode.Pong);
    });

    test('out-of-range values are clamped and reported with the packet number', async () => {
        await startListener();
        const stream = await v4Sender();

        const setvolume = nextEvent(listener, 'setvolume');
        stream.send(Opcode.Flatbuf, encodeVolume(3));
        const error: ErrorMessage = (await expectMessage(stream, Message.Error)).payload(new ErrorMessage());
        expect(error.kind()).toBe(ErrorKind.VolumeOutOfRange);
        expect(error.packetNum()).toBe(1); // packet 0 was the plaintext Version
        expect(await setvolume).toEqual({ volume: 1 });
    });

    test('v3 opcodes and malformed bodies after the upgrade get v4 errors', async () => {
        await startListener();
        const stream = await v4Sender();

        stream.sendJson(Opcode.Play, { container: 'video/mp4', url: 'https://example.com' });
        expect((await expectMessage(stream, Message.Error)).payload(new ErrorMessage()).kind()).toBe(ErrorKind.InvalidOpcode);

        stream.send(Opcode.Flatbuf, new Uint8Array([1, 2, 3]));
        expect((await expectMessage(stream, Message.Error)).payload(new ErrorMessage()).kind()).toBe(ErrorKind.MalformedBody);
    });

    test('a sender joining mid-playback gets the current load and state', async () => {
        await startListener();
        testState.playMessage = new PlayMessage('video/mp4', 'https://example.com/now.mp4', null, null, null, null, { Cookie: 'x' });
        testState.playbackUpdate = new PlaybackUpdateMessage(Date.now(), PlaybackState.Paused, 42, 100, 1);
        const stream = await v4Sender();

        const item: V4MediaItem = (await expectMessage(stream, Message.Load)).payload(new Load()).source(new V4MediaItem());
        expect(item.sourceUrl()).toBe('https://example.com/now.mp4');
        expect(item.headersLength()).toBe(0);
        const progress: ProgressChanged = (await expectMessage(stream, Message.ProgressChanged)).payload(new ProgressChanged());
        expect(Number(progress.position().micros())).toBe(42000000);
        expect((await expectMessage(stream, Message.PlaybackStateChanged)).payload(new PlaybackStateChanged()).state()).toBe(V4PlaybackState.Paused);
    });

    test('the TLS handshake survives a ClientHello coalesced with the Version packet', async () => {
        await startListener();
        const plain = await connectPlain(listener.port);
        await plain.nextOf(Opcode.Version);
        plain.detach();

        plain.socket.cork();
        plain.send(Opcode.Version, JSON.stringify({ version: 4 }));
        const secure = tls.connect({ socket: plain.socket, rejectUnauthorized: false, minVersion: 'TLSv1.3' });
        setImmediate(() => plain.socket.uncork());
        await new Promise<void>((resolve, reject) => {
            secure.once('secureConnect', () => resolve());
            secure.once('error', reject);
        });
        expect(spkiFingerprintOf(secure)).toBe(identity.fingerprint);

        const stream = new PacketStream(secure);
        streams.push(stream);
        await expectMessage(stream, Message.ReceiverIntroduction);
    });

    test('v3 senders keep the JSON protocol', async () => {
        await startListener();
        const stream = await connectPlain(listener.port);
        streams.push(stream);

        expect(JSON.parse((await stream.nextOf(Opcode.Version)).body.toString())).toEqual({ version: 4 });
        stream.sendJson(Opcode.Version, { version: 3 });
        const initial = JSON.parse((await stream.nextOf(Opcode.Initial)).body.toString());
        expect(initial).toMatchObject({ displayName: 'Test TV', appName: 'BrewCast' });

        listener.send(Opcode.VolumeUpdate, new VolumeUpdateMessage(1, 0.5));
        expect(JSON.parse((await stream.nextOf(Opcode.VolumeUpdate)).body.toString())).toEqual({ generationTime: 1, volume: 0.5 });
    });

    test('without v4 support a v4 sender is downgraded to v3', async () => {
        await startListener(null);
        const stream = await connectPlain(listener.port);
        streams.push(stream);

        expect(JSON.parse((await stream.nextOf(Opcode.Version)).body.toString())).toEqual({ version: 3 });
        stream.sendJson(Opcode.Version, { version: 4 });
        await stream.nextOf(Opcode.Initial);
    });

    test('nothing but the Version is sent before the sender has spoken', async () => {
        await startListener();
        const stream = await connectPlain(listener.port);
        streams.push(stream);

        await stream.nextOf(Opcode.Version);
        listener.send(Opcode.PlaybackUpdate, new PlaybackUpdateMessage(Date.now(), PlaybackState.Playing, 1, 2, 1));
        listener.send(Opcode.Ping);
        await expect(stream.next(300)).rejects.toThrow('no packet');
    });

    test('legacy senders that skip the Version message still work as v2', async () => {
        await startListener();
        const stream = await connectPlain(listener.port);
        streams.push(stream);
        await stream.nextOf(Opcode.Version);

        const pause = nextEvent(listener, 'pause');
        stream.send(Opcode.Pause);
        await pause;

        listener.send(Opcode.PlaybackUpdate, new PlaybackUpdateMessage(1, PlaybackState.Paused, 1, 2, 1, 0));
        // v2 fields only: no itemIndex.
        expect(JSON.parse((await stream.nextOf(Opcode.PlaybackUpdate)).body.toString())).toEqual({
            generationTime: 1, state: PlaybackState.Paused, time: 1, duration: 2, speed: 1,
        });
    });
});
