import dashjs from 'modules/dashjs';
import Hls from 'modules/hls.js';
import { Player, PlayerType } from 'common/player/Player';

// Tracks of the playing item, for protocol v4 (`TracksAvailable`, `ChangeTrack`,
// `AddSubtitleSource`). Tracks are reported to the service, which announces them to senders and
// passes their track changes back. Embedded tracks are numbered in order (video, audio,
// subtitles); external subtitles keep the ids the service gave them.

type TrackType = 'video' | 'audio' | 'subtitle';

interface ReportedTrack {
    id: number;
    type: TrackType;
    language: string;
    title: string | null;
    width?: number;
    height?: number;
}

interface Entry extends ReportedTrack {
    selected: boolean;
    select: () => void;
}

interface External {
    id: number;
    name: string | null;
    track: TextTrack;
}

const REPORT_INTERVAL_MS = 2000;

function language(value: string | null | undefined): string {
    return value && value.length > 0 ? value : 'und';
}

// Parses WebVTT as the service serves it (converted from SRT/ASS, or the sender's own WebVTT).
function parseVtt(text: string): { start: number, end: number, text: string }[] {
    const toSeconds = (value: string) => {
        const parts = value.replace(',', '.').split(':').map(Number);
        return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    };
    const timing = /((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})/;

    const cues = [];
    for (const block of text.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
        const lines = block.split('\n');
        const index = lines.findIndex((line) => timing.test(line));
        if (index < 0) {
            continue;
        }
        const match = timing.exec(lines[index]);
        const cueText = lines.slice(index + 1).join('\n').replace(/\s+$/, '');
        if (cueText.length > 0) {
            cues.push({ start: toSeconds(match[1]), end: toSeconds(match[2]), text: cueText });
        }
    }
    return cues;
}

export class TrackManager {
    private player: Player = null;
    private entries: Entry[] = [];
    private externals: External[] = [];
    // Tracks we created, which aren't the media's own.
    private ownTracks: TextTrack[] = [];
    private videoHidden = false;
    private audioMuted = false;
    private lastReport: string = null;

    constructor(private video: HTMLVideoElement, private isLive: () => boolean) {
        window.tizenOSAPI.onChangeTrack = (change: { type: TrackType, id: number | null }) => this.change(change.type, change.id);
        window.tizenOSAPI.onAddSubtitle = (subtitle: { id: number, url: string, name: string | null, select: boolean }) => this.addExternal(subtitle);

        const report = () => this.report();
        video.textTracks.addEventListener('addtrack', report);
        video.textTracks.addEventListener('change', report);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- not in every browser's typings
        const media = video as any;
        media.audioTracks?.addEventListener?.('change', report);
        media.audioTracks?.addEventListener?.('addtrack', report);
        video.addEventListener('loadedmetadata', report);
        video.addEventListener('resize', report);
        setInterval(report, REPORT_INTERVAL_MS);
    }

    // Called when an item has loaded in `player`.
    attach(player: Player) {
        if (player !== this.player) {
            this.reset();
            this.player = player;

            if (player.playerType === PlayerType.Hls) {
                const report = () => this.report();
                [Hls.Events.AUDIO_TRACKS_UPDATED, Hls.Events.AUDIO_TRACK_SWITCHED, Hls.Events.SUBTITLE_TRACKS_UPDATED,
                    Hls.Events.SUBTITLE_TRACK_SWITCH, Hls.Events.LEVEL_SWITCHED].forEach((event) => player.hlsPlayer.on(event, report));
            } else if (player.playerType === PlayerType.Dash) {
                const report = () => this.report();
                [dashjs.MediaPlayer.events.TRACK_CHANGE_RENDERED, dashjs.MediaPlayer.events.TEXT_TRACKS_ADDED,
                    dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED].forEach((event) => player.dashPlayer.on(event, report));
            }
        }
        this.report();
    }

    // A new item: its external subtitles and track choices are gone.
    private reset() {
        this.externals.forEach((external) => {
            external.track.mode = 'disabled';
            while (external.track.cues && external.track.cues.length > 0) {
                external.track.removeCue(external.track.cues[0]);
            }
        });
        this.externals = [];
        this.entries = [];
        this.showVideo(true);
        if (this.audioMuted) {
            this.audioMuted = false;
            this.video.muted = false;
        }
        this.lastReport = null;
    }

    private showVideo(show: boolean) {
        this.videoHidden = !show;
        this.video.style.visibility = show ? '' : 'hidden';
    }

    private enumerate(): Entry[] {
        const player = this.player;
        const entries: Entry[] = [];
        if (!player) {
            return entries;
        }

        let nextId = 0;
        const add = (entry: Omit<Entry, 'id'>) => entries.push({ ...entry, id: nextId++ });

        // Video
        const width = this.video.videoWidth;
        const height = this.video.videoHeight;
        if (player.playerType === PlayerType.Dash && player.dashPlayer.getTracksFor('video').length > 0) {
            const current = player.dashPlayer.getCurrentTrackFor('video');
            player.dashPlayer.getTracksFor('video').forEach((track) => {
                const best = (track.bitrateList || []).reduce((a, b) => (b.height || 0) > (a ? a.height || 0 : 0) ? b : a, null);
                add({
                    type: 'video', language: language(track.lang), title: track.labels && track.labels[0] ? track.labels[0].text : null,
                    width: best ? best.width : undefined, height: best ? best.height : undefined,
                    selected: !this.videoHidden && current !== null && current.index === track.index,
                    select: () => { player.dashPlayer.setCurrentTrack(track); this.showVideo(true); },
                });
            });
        } else if (width > 0 && height > 0) {
            add({ type: 'video', language: 'und', title: null, width: width, height: height, selected: !this.videoHidden, select: () => this.showVideo(true) });
        }

        // Audio
        if (player.playerType === PlayerType.Hls) {
            const hls = player.hlsPlayer;
            hls.audioTracks.forEach((track, index) => add({
                type: 'audio', language: language(track.lang), title: track.name || null,
                selected: !this.audioMuted && hls.audioTrack === index,
                select: () => { hls.audioTrack = index; },
            }));
        } else if (player.playerType === PlayerType.Dash) {
            const current = player.dashPlayer.getCurrentTrackFor('audio');
            player.dashPlayer.getTracksFor('audio').forEach((track) => add({
                type: 'audio', language: language(track.lang), title: track.labels && track.labels[0] ? track.labels[0].text : null,
                selected: !this.audioMuted && current !== null && current.index === track.index,
                select: () => player.dashPlayer.setCurrentTrack(track),
            }));
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AudioTrackList isn't in every browser's typings
            const audioTracks = (this.video as any).audioTracks;
            if (audioTracks && audioTracks.length > 0) {
                for (let i = 0; i < audioTracks.length; i++) {
                    const track = audioTracks[i];
                    add({
                        type: 'audio', language: language(track.language), title: track.label || null,
                        selected: !this.audioMuted && track.enabled,
                        select: () => {
                            for (let j = 0; j < audioTracks.length; j++) {
                                audioTracks[j].enabled = j === i;
                            }
                        },
                    });
                }
            }
        }

        // Subtitles embedded in the media
        const embeddedOff: (() => void)[] = [];
        if (player.playerType === PlayerType.Hls) {
            const hls = player.hlsPlayer;
            embeddedOff.push(() => { hls.subtitleTrack = -1; hls.subtitleDisplay = false; });
            hls.subtitleTracks.forEach((track, index) => add({
                type: 'subtitle', language: language(track.lang), title: track.name || null,
                selected: hls.subtitleDisplay && hls.subtitleTrack === index,
                select: () => { hls.subtitleTrack = index; hls.subtitleDisplay = true; },
            }));
        } else if (player.playerType === PlayerType.Dash) {
            const dash = player.dashPlayer;
            embeddedOff.push(() => dash.enableText(false));
            dash.getTracksFor('text').forEach((track, index) => add({
                type: 'subtitle', language: language(track.lang), title: track.labels && track.labels[0] ? track.labels[0].text : null,
                selected: dash.isTextEnabled() && dash.getCurrentTextTrackIndex() === index,
                select: () => { dash.enableText(true); dash.setTextTrack(index); },
            }));
        } else {
            const own = this.ownTracks;
            const tracks = Array.prototype.slice.call(this.video.textTracks).filter((track: TextTrack) =>
                own.indexOf(track) < 0 && (track.kind === 'subtitles' || track.kind === 'captions'));
            embeddedOff.push(() => tracks.forEach((track: TextTrack) => { track.mode = 'disabled'; }));
            tracks.forEach((track: TextTrack) => add({
                type: 'subtitle', language: language(track.language), title: track.label || null,
                selected: track.mode === 'showing',
                select: () => { track.mode = 'showing'; },
            }));
        }

        // External subtitles, by their own ids
        this.externals.forEach((external) => entries.push({
            id: external.id, type: 'subtitle', language: 'und', title: external.name,
            selected: external.track.mode === 'showing',
            select: () => { external.track.mode = 'showing'; },
        }));

        // Selecting a subtitle turns the others off.
        const subtitlesOff = () => {
            embeddedOff.forEach((off) => off());
            this.externals.forEach((external) => { if (external.track.mode === 'showing') external.track.mode = 'hidden'; });
        };
        entries.forEach((entry) => {
            if (entry.type === 'subtitle') {
                const select = entry.select;
                entry.select = () => { subtitlesOff(); select(); };
            }
        });
        this.subtitlesOff = subtitlesOff;
        return entries;
    }

    private subtitlesOff: () => void = () => undefined;

    report() {
        // A destroyed player (the next item is loading) has no type any more.
        if (!this.player || this.player.playerType === null) {
            return;
        }

        let entries: Entry[];
        let duration: number;
        try {
            entries = this.enumerate();
            duration = this.player.getDuration();
        } catch (e) {
            console.warn('Could not list tracks', e);
            return;
        }
        this.entries = entries;

        const selected = (type: TrackType) => {
            const entry = entries.find((e) => e.type === type && e.selected);
            return entry ? entry.id : null;
        };
        const report = {
            tracks: entries.map((entry) => {
                const track: ReportedTrack = { id: entry.id, type: entry.type, language: entry.language, title: entry.title };
                if (entry.width && entry.height) {
                    track.width = entry.width;
                    track.height = entry.height;
                }
                return track;
            }),
            selected: { video: selected('video'), audio: selected('audio'), subtitle: selected('subtitle') },
            live: this.isLive(),
            seekable: !this.isLive() && isFinite(duration) && duration > 0,
        };

        const json = JSON.stringify(report);
        if (json !== this.lastReport) {
            this.lastReport = json;
            window.tizenOSAPI.sendTracks(report);
        }
    }

    // A sender's ChangeTrack (validated by the service against our last report).
    change(type: TrackType, id: number | null) {
        if (id === null) {
            if (type === 'video') {
                this.showVideo(false);
            } else if (type === 'audio') {
                // Browsers can't drop the audio track; muting is the closest.
                this.audioMuted = true;
                this.video.muted = true;
            } else {
                this.subtitlesOff();
            }
        } else {
            const entry = this.entries.find((e) => e.id === id && e.type === type);
            if (entry) {
                if (type === 'audio' && this.audioMuted) {
                    this.audioMuted = false;
                    this.video.muted = false;
                }
                entry.select();
            }
        }
        this.report();
    }

    // A sender's AddSubtitleSource. The service serves the subtitles as WebVTT; they're added as
    // cues because a <track> from another origin needs CORS on the media element as well.
    addExternal(subtitle: { id: number, url: string, name: string | null, select: boolean }) {
        const player = this.player;
        const track = this.video.addTextTrack('subtitles', subtitle.name || '', 'und');
        this.ownTracks.push(track);
        track.mode = 'hidden';
        const external: External = { id: subtitle.id, name: subtitle.name, track: track };

        fetch(subtitle.url)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.text();
            })
            .then((text) => {
                if (this.player !== player) {
                    return;
                }
                parseVtt(text).forEach((cue) => track.addCue(new VTTCue(cue.start, cue.end, cue.text)));
                this.externals.push(external);
                this.report();
                if (subtitle.select) {
                    this.change('subtitle', subtitle.id);
                }
            })
            .catch((e) => {
                console.warn(`Could not load subtitles ${subtitle.url}`, e);
                track.mode = 'disabled';
                window.tizenOSAPI.subtitleFailed(subtitle.id);
            });
    }
}
