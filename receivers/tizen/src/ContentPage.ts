import { preloadData } from 'common/Preload';
import { EventMessage, PlaybackErrorMessage, PlaybackUpdateMessage, PlayMessage, VolumeUpdateMessage } from 'common/Packets';
import { ServiceClient } from 'src/ServiceClient';

// The service side of a content page (player or viewer). The service owns what's loaded,
// including the queue: pages play one item at a time and report back (service/MediaSession.ts).
//
// Service events for these pages:
//   load          a new load, or the current one replayed when a page connects (`loadId` tells)
//   item          the queue item to play now, the answer to `play_request`
//   queue_update  the queue changed (sender inserts and removals)
// `sessionStorage.playData` hands the load to the next page when switching between the player
// and the viewer.

export type ContentViewer = 'player' | 'viewer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON from the service
type Json = any;

export const service = new ServiceClient();
let currentLoadId: number = null;

export function loadId(): number {
    return currentLoadId;
}

const logError = (method: string) => (e: Error) => console.error(`${method} failed`, e);

function switchTo(viewer: ContentViewer, playData: Json) {
    if (playData) {
        sessionStorage.setItem('playData', JSON.stringify(playData));
    } else {
        // The other page picks up the current load when the service replays it.
        sessionStorage.removeItem('playData');
    }
    location.replace(`../${viewer}/index.html`);
}

function deliverLoad(info: Json) {
    const volume = info.playerVolume !== undefined ? info.playerVolume : null;
    if (info.rendererEvent === 'play-playlist') {
        preloadData.onPlayPlaylistCb(null, info.rendererMessage, volume);
    } else {
        preloadData.onPlayCb(null, info.rendererMessage, info.proxyUrl, volume);
    }
}

export function connectContentPage(viewer: ContentViewer) {
    const pendingPlay = JSON.parse(sessionStorage.getItem('playData'));
    currentLoadId = pendingPlay ? pendingPlay.loadId : null;

    // For the renderer bundle, which has its own copy of every module: the play that brought us
    // here (picked up by the renderer on load), and the calls the player's track handling makes.
    // `stopped` tells the service when the user leaves on the TV.
    window.tizenOSAPI = {
        pendingPlay: pendingPlay,
        stopped: () => service.call('playback_stopped').catch(logError('playback_stopped')),
        sendTracks: (report: Json) => service.call('send_tracks', { loadId: currentLoadId, report: report }).catch(logError('send_tracks')),
        subtitleFailed: (id: number) => service.call('subtitle_failed', { id: id }).catch(logError('subtitle_failed')),
        reportCapabilities: (capabilities: Json) => service.call('report_capabilities', capabilities).catch(logError('report_capabilities')),
        // Set by the renderer.
        onChangeTrack: null as (change: Json) => void,
        onAddSubtitle: null as (subtitle: Json) => void,
    };

    preloadData.sendPlaybackErrorCb = (error: PlaybackErrorMessage & { kind?: string }) => {
        service.call('send_playback_error', error).catch(logError('send_playback_error'));
    };
    preloadData.sendPlaybackUpdateCb = (update: PlaybackUpdateMessage) => {
        service.call('send_playback_update', update).catch(logError('send_playback_update'));
    };
    preloadData.sendPlaybackStateCb = (state: string) => {
        service.call('send_playback_state', { state: state }).catch(logError('send_playback_state'));
    };
    preloadData.sendVolumeUpdateCb = (update: VolumeUpdateMessage) => {
        service.call('send_volume_update', update).catch(logError('send_volume_update'));
    };
    preloadData.sendEventCb = (event: EventMessage) => {
        service.call('send_event', event).catch(logError('send_event'));
    };
    preloadData.sendPlayRequestCb = (_message: PlayMessage, playlistIndex: number) => {
        service.call('play_request', { loadId: currentLoadId, playlistIndex: playlistIndex }).catch(logError('play_request'));
    };
    preloadData.sendMirroringAnswerCb = (sdp: string) => {
        service.call('mirroring_answer', { loadId: currentLoadId, sdp: sdp }).catch(logError('mirroring_answer'));
    };

    window.targetAPI.getSessions(() => service.call('get_sessions'));
    window.targetAPI.initializeSubscribedKeys(() => service.call('get_subscribed_keys'));

    service.on('toast', (message) => preloadData.onToastCb(message.message, message.icon, message.duration));
    service.on('connect', (message) => preloadData.onConnectCb(null, message));
    service.on('disconnect', (message) => preloadData.onDisconnectCb(null, message));
    service.on('event_subscribed_keys_update', (keys) => preloadData.onEventSubscribedKeysUpdate(keys));

    service.on('load', (info: Json) => {
        if (info.loadId === currentLoadId) {
            // The replay of what we're already showing.
            return;
        }
        if (info.contentViewer !== viewer) {
            switchTo(info.contentViewer, info);
            return;
        }

        currentLoadId = info.loadId;
        sessionStorage.setItem('playData', JSON.stringify(info));
        if (preloadData.onPlayCb === undefined) {
            window.tizenOSAPI.pendingPlay = info;
        } else {
            deliverLoad(info);
        }
    });

    service.on('item', (item: Json) => {
        if (item.loadId !== currentLoadId) {
            return;
        }
        if (item.contentViewer !== viewer) {
            switchTo(item.contentViewer, null);
            return;
        }
        preloadData.onPlayCb(null, item.message, item.proxyUrl, item.playerVolume);
    });

    const forCurrentLoad = (handler: (value: Json) => void) => (value: Json) => {
        if (value && value.loadId === currentLoadId) {
            handler(value);
        }
    };
    service.on('queue_update', forCurrentLoad((update) => preloadData.onQueueUpdateCb(null, update)));
    service.on('mirroring_offer', forCurrentLoad((offer) => preloadData.onMirroringOfferCb(null, offer)));
    service.on('changetrack', forCurrentLoad((change) => window.tizenOSAPI.onChangeTrack?.(change)));
    service.on('addsubtitle', forCurrentLoad((subtitle) => window.tizenOSAPI.onAddSubtitle?.(subtitle)));

    service.on('pause', () => preloadData.onPauseCb());
    service.on('resume', () => preloadData.onResumeCb());
    service.on('stop', () => {
        sessionStorage.removeItem('playData');
        location.replace('../main_window/index.html');
    });
    service.on('seek', (message) => preloadData.onSeekCb(null, message));
    service.on('setvolume', (message) => preloadData.onSetVolumeCb(null, message));
    service.on('setspeed', (message) => preloadData.onSetSpeedCb(null, message));
    service.on('setplaylistitem', (message) => preloadData.onSetPlaylistItemCb(null, message));

    // Start receiving once renderer.js (end of <body>) has registered its callbacks.
    document.addEventListener('DOMContentLoaded', () => service.connect());
}
