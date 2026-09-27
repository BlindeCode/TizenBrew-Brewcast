import { preloadData } from 'common/Preload';
import { EventMessage } from 'common/Packets';
import { ServiceClient } from 'src/ServiceClient';
import { probeCapabilities } from 'src/Capabilities';

const service = new ServiceClient();

service.on('device_info', (info) => {
    preloadData.deviceInfo = info;
    preloadData.onDeviceInfoCb();
});

service.on('toast', (message) => preloadData.onToastCb(message.message, message.icon, message.duration));
service.on('connect', (message) => preloadData.onConnectCb(null, message));
service.on('disconnect', (message) => preloadData.onDisconnectCb(null, message));
service.on('event_subscribed_keys_update', (keys) => preloadData.onEventSubscribedKeysUpdate(keys));

// Something was cast (or was already playing when this page opened): show it.
service.on('load', (playInfo) => {
    sessionStorage.setItem('playData', JSON.stringify(playInfo));
    location.replace(`../${playInfo.contentViewer}/index.html`);
});

preloadData.sendEventCb = (message: EventMessage) => {
    service.call('send_event', message).catch((e) => console.error('Main: send_event failed', e));
};

window.targetAPI.getSessions(() => service.call('get_sessions'));
window.targetAPI.initializeSubscribedKeys(() => service.call('get_subscribed_keys'));

// Start receiving once renderer.js (end of <body>) has registered its callbacks.
document.addEventListener('DOMContentLoaded', () => {
    service.connect();
    try {
        service.call('report_capabilities', probeCapabilities()).catch((e) => console.error('Main: report_capabilities failed', e));
    } catch (e) {
        console.error('Main: could not probe capabilities', e);
    }
});
