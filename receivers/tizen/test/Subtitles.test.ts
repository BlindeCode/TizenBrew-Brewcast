import { assToVtt, decodeText, srtToVtt, toVtt } from 'src/Subtitles';
import { parseRange } from 'src/Companion';

describe('subtitle conversion', () => {
    test('SRT becomes WebVTT with its timing, tags and entities fixed up', () => {
        const srt = '1\n00:00:01,5 --> 00:00:02,000 X1:0\n{\\an8}<b>Top</b>\n\n\n2\n01:02:03,004 --> 01:02:04,000\nLine one\nLine <font face="x">two</font>\n';
        expect(srtToVtt(srt)).toBe('WEBVTT\n\n00:00:01.500 --> 00:00:02.000\n<b>Top</b>\n\n01:02:03.004 --> 01:02:04.000\nLine one\nLine two\n');
    });

    test('ASS dialogue becomes WebVTT cues in time order, keeping italics and bold', () => {
        const ass = [
            '[Script Info]',
            'Title: test',
            '',
            '[V4+ Styles]',
            'Format: Name, Fontname',
            'Style: Default,Arial',
            '',
            '[Events]',
            'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
            'Dialogue: 0,0:00:05.00,0:00:06.50,Default,,0,0,0,,Second, with a comma',
            'Comment: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,not shown',
            'Dialogue: 0,0:00:01.25,0:00:02.00,Default,,0,0,0,,{\\pos(1,2)}{\\i1}First{\\i0}\\Nline {\\b1}two',
        ].join('\r\n');
        expect(assToVtt(ass)).toBe('WEBVTT\n\n00:00:01.250 --> 00:00:02.000\n<i>First</i>\nline <b>two</b>\n\n00:00:05.000 --> 00:00:06.500\nSecond, with a comma\n');
        expect(toVtt(ass)).toBe(assToVtt(ass));
    });

    test('WebVTT passes through and the format is detected from content', () => {
        expect(toVtt('\ufeffWEBVTT\n\n00:00.000 --> 00:01.000\nhi\n')).toBe('WEBVTT\n\n00:00.000 --> 00:01.000\nhi\n');
        expect(toVtt('1\n00:00:00,000 --> 00:00:01,000\nhi')).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhi\n');
    });

    test('text decoding handles BOMs and falls back from invalid UTF-8', () => {
        expect(decodeText(Buffer.from([0xef, 0xbb, 0xbf, 0x68, 0xc3, 0xa9]))).toBe('h\u00e9');
        expect(decodeText(Buffer.from([0xff, 0xfe, 0x68, 0x00, 0xe9, 0x00]))).toBe('h\u00e9');
        expect(decodeText(Buffer.from([0xfe, 0xff, 0x00, 0x68, 0x00, 0xe9]))).toBe('h\u00e9');
        expect(decodeText(Buffer.from([0x68, 0xe9]))).toBe('h\u00e9');
        expect(decodeText(Buffer.from('h\u00e9', 'utf8'))).toBe('h\u00e9');
    });
});

describe('companion range requests', () => {
    test('ranges are parsed against the resource size', () => {
        expect(parseRange(undefined, 100)).toBeNull();
        expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
        expect(parseRange('bytes=10-', 100)).toEqual({ start: 10, end: 99 });
        expect(parseRange('bytes=90-200', 100)).toEqual({ start: 90, end: 99 });
        expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
        expect(parseRange('bytes=100-', 100)).toBe('unsatisfiable');
        expect(parseRange('bytes=10-', null)).toEqual({ start: 10, end: null });
        expect(parseRange('bytes=-10', null)).toBeNull();
        expect(parseRange('bytes=0-1,5-6', 100)).toBeNull();
    });
});
