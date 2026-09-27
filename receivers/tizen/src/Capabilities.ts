// What this TV's browser can play, as protocol v4 format tokens (fcast.fbs `MediaCapabilities`).
// The service advertises these to senders in `ReceiverIntroduction`, so they don't send what the
// TV can't play. Probed with the browser's own answers; hls.js and dash.js need Media Source
// Extensions.

const CONTAINERS: [string, string[]][] = [
    ['mp4', ['video/mp4']],
    ['quicktime', ['video/quicktime']],
    ['webm', ['video/webm']],
    ['mkv', ['video/x-matroska', 'video/mkv']],
    ['mpegts', ['video/mp2t']],
    ['ogg', ['video/ogg', 'audio/ogg']],
    ['wav', ['audio/wav']],
    ['avi', ['video/x-msvideo', 'video/avi']],
    ['flv', ['video/x-flv']],
];

const VIDEO_FORMATS: [string, string[]][] = [
    ['h264', ['video/mp4; codecs="avc1.640028"', 'video/mp4; codecs="avc1.42E01E"']],
    ['h265', ['video/mp4; codecs="hvc1.1.6.L120.90"', 'video/mp4; codecs="hev1.1.6.L120.90"']],
    ['vp8', ['video/webm; codecs="vp8"']],
    ['vp9', ['video/webm; codecs="vp9"', 'video/mp4; codecs="vp09.00.10.08"']],
    ['av1', ['video/mp4; codecs="av01.0.08M.08"']],
    ['theora', ['video/ogg; codecs="theora"']],
];

const AUDIO_FORMATS: [string, string[]][] = [
    ['aac', ['audio/mp4; codecs="mp4a.40.2"']],
    ['mp3', ['audio/mpeg', 'audio/mp4; codecs="mp4a.6B"']],
    ['ac3', ['audio/mp4; codecs="ac-3"']],
    ['eac3', ['audio/mp4; codecs="ec-3"']],
    ['dts', ['audio/mp4; codecs="dtsc"']],
    ['opus', ['audio/webm; codecs="opus"', 'audio/mp4; codecs="opus"']],
    ['vorbis', ['audio/webm; codecs="vorbis"', 'audio/ogg; codecs="vorbis"']],
    ['flac', ['audio/flac', 'audio/mp4; codecs="flac"']],
    ['pcm', ['audio/wav; codecs="1"']],
];

export interface PageCapabilities {
    webrtc: boolean;
    containers: string[];
    videoFormats: string[];
    audioFormats: string[];
    imageFormats: string[];
}

export function probeCapabilities(): PageCapabilities {
    const video = document.createElement('video');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- older typings lack it
    const mediaSource = (window as any).MediaSource;
    const supported = (type: string) => {
        try {
            if (mediaSource && mediaSource.isTypeSupported(type)) {
                return true;
            }
        } catch {
            // Treat as unsupported by MSE; the element may still play it.
        }
        return video.canPlayType(type) !== '';
    };
    const pick = (table: [string, string[]][]) => table.filter(([, types]) => types.some(supported)).map(([token]) => token);

    const containers = pick(CONTAINERS);
    if (mediaSource || video.canPlayType('application/vnd.apple.mpegurl') !== '') {
        containers.push('hls');
    }
    if (mediaSource) {
        containers.push('dash');
    }

    const imageFormats = ['png', 'jpeg', 'gif', 'bmp', 'ico'];
    try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
            imageFormats.push('webp');
        }
    } catch {
        // No canvas: leave WebP out.
    }

    return {
        webrtc: typeof RTCPeerConnection === 'function',
        containers: containers,
        videoFormats: pick(VIDEO_FORMATS),
        audioFormats: pick(AUDIO_FORMATS),
        imageFormats: imageFormats,
    };
}
