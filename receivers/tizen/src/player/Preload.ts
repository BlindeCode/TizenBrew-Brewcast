import { preloadData } from 'common/Preload';
import { EventMessage, PlaybackErrorMessage, PlaybackUpdateMessage, PlayMessage, VolumeUpdateMessage } from 'common/Packets';
import { ServiceClient } from 'src/ServiceClient';

const service = new ServiceClient();
const logError = (method: string) => (e: Error) => console.error(`Player: ${method} failed`, e);

// The play that brought us here (stored by the main page), picked up by the renderer on load.
// `stopped` tells the service when the user leaves the player on the TV.
window.tizenOSAPI = {
    pendingPlay: JSON.parse(sessionStorage.getItem('playData')),
    stopped: () => service.call('playback_stopped').catch(logError('playback_stopped')),
};

preloadData.sendPlaybackErrorCb = (error: PlaybackErrorMessage) => {
    service.call('send_playback_error', error).catch(logError('send_playback_error'));
};
preloadData.sendPlaybackUpdateCb = (update: PlaybackUpdateMessage) => {
    service.call('send_playback_update', update).catch(logError('send_playback_update'));
};
preloadData.sendVolumeUpdateCb = (update: VolumeUpdateMessage) => {
    service.call('send_volume_update', update).catch(logError('send_volume_update'));
};
preloadData.sendEventCb = (event: EventMessage) => {
    service.call('send_event', event).catch(logError('send_event'));
};
preloadData.sendPlayRequestCb = (message: PlayMessage, playlistIndex: number) => {
    service.call('play_request', { message: message, playlistIndex: playlistIndex }).catch(logError('play_request'));
};

window.targetAPI.getSessions(() => service.call('get_sessions'));
window.targetAPI.initializeSubscribedKeys(() => service.call('get_subscribed_keys'));

service.on('toast', (message) => preloadData.onToastCb(message.message, message.icon, message.duration));
service.on('connect', (message) => preloadData.onConnectCb(null, message));
service.on('disconnect', (message) => preloadData.onDisconnectCb(null, message));
service.on('event_subscribed_keys_update', (keys) => preloadData.onEventSubscribedKeysUpdate(keys));

service.on('play', (playInfo) => {
    // The service replays the current play whenever a page connects, including the one that
    // brought us here: only act on a different one.
    if (JSON.stringify(playInfo) === sessionStorage.getItem('playData')) {
        return;
    }
    sessionStorage.setItem('playData', JSON.stringify(playInfo));

    if (preloadData.onPlayCb === undefined) {
        window.tizenOSAPI.pendingPlay = playInfo;
    } else if (playInfo.rendererEvent === 'play-playlist') {
        preloadData.onPlayPlaylistCb(null, playInfo.rendererMessage, playInfo.playerVolume);
    } else {
        preloadData.onPlayCb(null, playInfo.rendererMessage, playInfo.proxyUrl, playInfo.playerVolume);
    }
});

service.on('pause', () => preloadData.onPauseCb());
service.on('resume', () => preloadData.onResumeCb());
service.on('stop', () => location.replace('../main_window/index.html'));
service.on('seek', (message) => preloadData.onSeekCb(null, message));
service.on('setvolume', (message) => preloadData.onSetVolumeCb(null, message));
service.on('setspeed', (message) => preloadData.onSetSpeedCb(null, message));
service.on('setplaylistitem', (message) => preloadData.onSetPlaylistItemCb(null, message));

// Start receiving once renderer.js (end of <body>) has registered its callbacks.
document.addEventListener('DOMContentLoaded', () => service.connect());
