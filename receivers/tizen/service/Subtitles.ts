import * as url from 'url';
import { http, https } from 'modules/follow-redirects';
import { Logger, LoggerType } from 'common/Logger';
import { IpcRoute } from 'src/Ipc';
const logger = new Logger('Subtitles', LoggerType.BACKEND);

// External subtitles (v4 `AddSubtitleSource`). The TV's player only renders WebVTT, so the pages
// load subtitles through `/subtitle?url=...` here, which fetches the file and converts SRT and
// ASS/SSA to WebVTT.

const MAX_SUBTITLE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20000;

export function subtitleRouteUrl(base: string, source: string): string {
    return `${base}/subtitle?url=${encodeURIComponent(source)}`;
}

function fetchBytes(source: string, redirectsLeft = 5): Promise<Buffer> {
    if (source.startsWith('data:')) {
        const comma = source.indexOf(',');
        if (comma < 0) {
            return Promise.reject(new Error('malformed data URL'));
        }
        const meta = source.substring(5, comma);
        const payload = source.substring(comma + 1);
        return Promise.resolve(/;base64$/i.test(meta) ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8'));
    }

    return new Promise((resolve, reject) => {
        const protocol = source.startsWith('https:') ? https : source.startsWith('http:') ? http : null;
        if (!protocol) {
            reject(new Error(`unsupported subtitle URL ${source}`));
            return;
        }

        const request = protocol.get({ ...url.parse(source), maxRedirects: redirectsLeft, timeout: FETCH_TIMEOUT_MS }, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            const chunks: Buffer[] = [];
            let length = 0;
            response.on('data', (chunk: Buffer) => {
                length += chunk.length;
                if (length > MAX_SUBTITLE_BYTES) {
                    request.destroy();
                    reject(new Error('subtitle file too large'));
                    return;
                }
                chunks.push(chunk);
            });
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        });
        request.on('timeout', () => request.destroy(new Error('timed out')));
        request.on('error', reject);
    });
}

// Subtitle files come in all sorts of encodings. Handles BOMs and UTF-8, and falls back to
// Windows-1252 (as Latin-1, which differs only in a few punctuation marks).
export function decodeText(data: Buffer): string {
    if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
        return data.toString('utf8', 3);
    }
    if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) {
        return data.toString('utf16le', 2);
    }
    if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) {
        const swapped = Buffer.from(data.subarray(2));
        swapped.swap16();
        return swapped.toString('utf16le');
    }

    const text = data.toString('utf8');
    // U+FFFD in the output without the bytes for it in the input means invalid UTF-8.
    if (text.indexOf('\ufffd') >= 0 && data.indexOf(Buffer.from([0xef, 0xbf, 0xbd])) < 0) {
        return data.toString('latin1');
    }
    return text;
}

function escapeCueText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Keeps the tags WebVTT shares with SRT (<b>, <i>, <u>) and drops the rest, e.g. <font>.
function cleanSrtText(text: string): string {
    return text
        .replace(/\{\\[^}]*\}/g, '')
        .replace(/<(\/?)([biu])>/gi, '\ue000$1$2\ue001')
        .replace(/<[^>]*>/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\ue000/g, '<').replace(/\ue001/g, '>')
        .replace(/-->/g, '--&gt;');
}

const SRT_TIMING = /^\s*(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})\s*-->\s*(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/;

function vttTime(hours: string | number, minutes: string | number, seconds: string | number, millis: string | number): string {
    const pad = (value: string | number, width: number) => String(value).padStart(width, '0');
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(String(millis).padEnd(3, '0').substring(0, 3), 3)}`;
}

export function srtToVtt(text: string): string {
    const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
    const cues: string[] = [];

    for (const block of blocks) {
        const lines = block.split('\n').filter((line, index) => index > 0 || line.trim() !== '');
        const timingIndex = lines.findIndex((line) => SRT_TIMING.test(line));
        if (timingIndex < 0) {
            continue;
        }

        const t = SRT_TIMING.exec(lines[timingIndex]);
        const timing = `${vttTime(t[1], t[2], t[3], t[4].padEnd(3, '0'))} --> ${vttTime(t[5], t[6], t[7], t[8].padEnd(3, '0'))}`;
        const body = lines.slice(timingIndex + 1).map(cleanSrtText).join('\n').trim();
        if (body.length > 0) {
            cues.push(`${timing}\n${body}`);
        }
    }

    return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

function assTimeToSeconds(value: string): number {
    const match = /^(\d+):(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(value.trim());
    if (!match) {
        return NaN;
    }
    const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + fraction;
}

function secondsToVtt(seconds: number): string {
    const millis = Math.round(seconds * 1000);
    return vttTime(Math.floor(millis / 3600000), Math.floor(millis / 60000) % 60, Math.floor(millis / 1000) % 60, millis % 1000);
}

// ASS/SSA to WebVTT: dialogue text only, styling and positioning are dropped (except italics
// and bold overrides, which WebVTT can express).
export function assToVtt(text: string): string {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    let inEvents = false;
    let format: string[] = null;
    const cues: { start: number, end: number, text: string }[] = [];

    for (const raw of lines) {
        const line = raw.trim();
        if (/^\[.*\]$/.test(line)) {
            inEvents = line.toLowerCase() === '[events]';
            continue;
        }
        if (!inEvents) {
            continue;
        }

        const colon = line.indexOf(':');
        if (colon < 0) {
            continue;
        }
        const key = line.substring(0, colon).trim().toLowerCase();
        const value = line.substring(colon + 1);

        if (key === 'format') {
            format = value.split(',').map((field) => field.trim().toLowerCase());
            continue;
        }
        if (key !== 'dialogue') {
            continue;
        }

        const fields = format || ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
        const parts = value.split(',');
        const textIndex = fields.indexOf('text');
        if (textIndex < 0 || parts.length < fields.length) {
            continue;
        }
        const get = (name: string) => parts[fields.indexOf(name)];
        const start = assTimeToSeconds(get('start'));
        const end = assTimeToSeconds(get('end'));
        if (isNaN(start) || isNaN(end) || end <= start) {
            continue;
        }

        let body = parts.slice(textIndex).join(',');
        let italic = false;
        let bold = false;
        body = body.replace(/\{([^}]*)\}/g, (_match, overrides: string) => {
            let out = '';
            const italicMatch = /\\i([01])/.exec(overrides);
            if (italicMatch && (italicMatch[1] === '1') !== italic) {
                italic = !italic;
                out += italic ? '\ue000i\ue001' : '\ue000/i\ue001';
            }
            const boldMatch = /\\b([01])/.exec(overrides);
            if (boldMatch && (boldMatch[1] === '1') !== bold) {
                bold = !bold;
                out += bold ? '\ue000b\ue001' : '\ue000/b\ue001';
            }
            return out;
        });
        body = escapeCueText(body.replace(/\\N/gi, '\n').replace(/\\h/g, '\u00a0'))
            .replace(/\ue000/g, '<').replace(/\ue001/g, '>');
        if (bold) {
            body += '</b>';
        }
        if (italic) {
            body += '</i>';
        }
        body = body.split('\n').map((l) => l.trim()).join('\n').trim();
        if (body.length > 0) {
            cues.push({ start: start, end: end, text: body });
        }
    }

    cues.sort((a, b) => a.start - b.start);
    return `WEBVTT\n\n${cues.map((cue) => `${secondsToVtt(cue.start)} --> ${secondsToVtt(cue.end)}\n${cue.text}`).join('\n\n')}\n`;
}

export function toVtt(text: string): string {
    const trimmed = text.replace(/^\ufeff/, '').replace(/^\s+/, '');
    if (/^WEBVTT/.test(trimmed)) {
        return trimmed;
    }
    if (/^\[Script Info\]/im.test(trimmed) || /^\[Events\]/im.test(trimmed)) {
        return assToVtt(trimmed);
    }
    return srtToVtt(trimmed);
}

export const subtitleRoute: IpcRoute = (req, res) => {
    const parsed = url.parse(req.url || '', true);
    if (parsed.pathname !== '/subtitle') {
        return false;
    }

    const source = typeof parsed.query.url === 'string' ? parsed.query.url : null;
    if (!source) {
        res.writeHead(400);
        res.end();
        return true;
    }

    fetchBytes(source)
        .then((data) => {
            const vtt = Buffer.from(toVtt(decodeText(data)), 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Content-Length': vtt.length });
            res.end(req.method === 'HEAD' ? undefined : vtt);
        })
        .catch((e) => {
            logger.warn(`Could not load subtitles from ${source}`, e);
            res.writeHead(502);
            res.end();
        });
    return true;
};
