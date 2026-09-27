// Image viewer page. Ported from upstream's webOS viewer (receivers/webos/fcast-receiver/src/viewer
// at 5c79300), with the remote handling of the Tizen player page.
import {
    PlayerControlEvent,
    playerCtrlStateUpdate,
    onPlay,
    onPlayPlaylist,
    setPlaylistItem,
    playlistIndex,
    uiHideTimer,
    showDurationTimer,
    isMediaItem,
    cachedPlayMediaItem,
    imageViewerPlaybackState,
} from 'common/viewer/Renderer';
import { KeyCode, RemoteKeyCode, ControlBarMode } from 'lib/common';
import * as common from 'lib/common';
import { PlaybackState } from 'common/Packets';

const playPreviousContainer = document.getElementById('playPreviousContainer');
const actionContainer = document.getElementById('actionContainer');
const playNextContainer = document.getElementById('playNextContainer');
const action = document.getElementById('action');

enum ControlFocus {
    Action,
    PlayPrevious,
    PlayNext,
}

let controlMode = ControlBarMode.KeyboardMouse;
let controlFocus = ControlFocus.Action;

// [|<][>][>|]
const locationMap = {
    Action: actionContainer,
    PlayPrevious: playPreviousContainer,
    PlayNext: playNextContainer,
};

function leaveViewer() {
    window.tizenOSAPI.stopped();
    location.replace('../main_window/index.html');
}

uiHideTimer.setDelay(5000);
uiHideTimer.setCallback(() => {
    if (controlMode === ControlBarMode.KeyboardMouse || !showDurationTimer.isPaused()) {
        controlMode = ControlBarMode.KeyboardMouse;
        locationMap[ControlFocus[controlFocus]].classList.remove('buttonFocus');
        playerCtrlStateUpdate(PlayerControlEvent.UiFadeOut);
    }
});

// Leave control bar on screen if magic remote cursor leaves window
document.onmouseout = () => {
    if (controlMode === ControlBarMode.KeyboardMouse) {
        uiHideTimer.end();
    }
};

function remoteNavigateTo(location: ControlFocus) {
    // Issues with using standard focus, so manually managing styles
    locationMap[ControlFocus[controlFocus]].classList.remove('buttonFocus');
    controlFocus = location;
    locationMap[ControlFocus[controlFocus]].classList.add('buttonFocus');
}

function setControlMode(mode: ControlBarMode, immediateHide: boolean = true) {
    if (mode === ControlBarMode.KeyboardMouse) {
        uiHideTimer.enable();

        if (immediateHide) {
            locationMap[ControlFocus[controlFocus]].classList.remove('buttonFocus');
            playerCtrlStateUpdate(PlayerControlEvent.UiFadeOut);
        }
        else {
            uiHideTimer.start();
        }
    }
    else {
        const focus = action?.style.display === 'none' ? ControlFocus.PlayNext : ControlFocus.Action;
        remoteNavigateTo(focus);
        playerCtrlStateUpdate(PlayerControlEvent.UiFadeIn);
        uiHideTimer.start();
    }

    controlMode = mode;
}

function togglePlayback() {
    if (cachedPlayMediaItem.showDuration && cachedPlayMediaItem.showDuration > 0) {
        if (imageViewerPlaybackState === PlaybackState.Paused || imageViewerPlaybackState === PlaybackState.Idle) {
            playerCtrlStateUpdate(PlayerControlEvent.Play);
        } else {
            playerCtrlStateUpdate(PlayerControlEvent.Pause);
        }
    }
}

export function targetPlayerCtrlStateUpdate(event: PlayerControlEvent): boolean {
    const handledCase = false;

    switch (event) {
        default:
            break;
    }

    return handledCase;
}

export function targetPlayerCtrlPostStateUpdate(event: PlayerControlEvent) {
    switch (event) {
        case PlayerControlEvent.Load: {
            if (!isMediaItem && controlMode === ControlBarMode.Remote) {
                setControlMode(ControlBarMode.KeyboardMouse);
            }
            actionContainer.style.display = action?.style.display === 'none' ? 'none' : 'block';
            break;
        }

        default:
            break;
    }
}

export function targetKeyDownEventListener(event: KeyboardEvent): { handledCase: boolean, key: string } {
    let handledCase = false;
    let key = '';

    switch (event.keyCode) {
        case KeyCode.KeyK:
        case KeyCode.Space:
            if (isMediaItem) {
                togglePlayback();
                event.preventDefault();
                handledCase = true;
            }
            break;

        case KeyCode.Enter:
            if (isMediaItem) {
                if (controlMode === ControlBarMode.KeyboardMouse) {
                    setControlMode(ControlBarMode.Remote);
                }
                else if (controlFocus === ControlFocus.Action) {
                    togglePlayback();
                }
                else if (controlFocus === ControlFocus.PlayPrevious) {
                    setPlaylistItem(playlistIndex - 1);
                }
                else if (controlFocus === ControlFocus.PlayNext) {
                    setPlaylistItem(playlistIndex + 1);
                }

                event.preventDefault();
                handledCase = true;
            }
            break;

        case KeyCode.ArrowUp:
        case KeyCode.ArrowDown:
            if (isMediaItem) {
                setControlMode(controlMode === ControlBarMode.KeyboardMouse ? ControlBarMode.Remote : ControlBarMode.KeyboardMouse);
                event.preventDefault();
                handledCase = true;
            }
            break;

        case KeyCode.ArrowLeft:
            if (isMediaItem) {
                if (controlMode === ControlBarMode.KeyboardMouse) {
                    setPlaylistItem(playlistIndex - 1);
                }
                else if (controlFocus === ControlFocus.Action || action?.style.display === 'none') {
                    remoteNavigateTo(ControlFocus.PlayPrevious);
                }
                else if (controlFocus === ControlFocus.PlayNext) {
                    remoteNavigateTo(ControlFocus.Action);
                }

                event.preventDefault();
                handledCase = true;
            }
            break;

        case KeyCode.ArrowRight:
            if (isMediaItem) {
                if (controlMode === ControlBarMode.KeyboardMouse) {
                    setPlaylistItem(playlistIndex + 1);
                }
                else if (controlFocus === ControlFocus.Action || action?.style.display === 'none') {
                    remoteNavigateTo(ControlFocus.PlayNext);
                }
                else if (controlFocus === ControlFocus.PlayPrevious) {
                    remoteNavigateTo(ControlFocus.Action);
                }

                event.preventDefault();
                handledCase = true;
            }
            break;

        case RemoteKeyCode.Stop:
            leaveViewer();
            event.preventDefault();
            handledCase = true;
            key = 'Stop';
            break;

        case RemoteKeyCode.Rewind:
            if (isMediaItem) {
                setPlaylistItem(playlistIndex - 1);
                event.preventDefault();
                handledCase = true;
                key = 'Rewind';
            }
            break;

        case RemoteKeyCode.Play:
            if (isMediaItem) {
                playerCtrlStateUpdate(PlayerControlEvent.Play);
                event.preventDefault();
                handledCase = true;
                key = 'Play';
            }
            break;

        case RemoteKeyCode.Pause:
            if (isMediaItem) {
                playerCtrlStateUpdate(PlayerControlEvent.Pause);
                event.preventDefault();
                handledCase = true;
                key = 'Pause';
            }
            break;

        case RemoteKeyCode.FastForward:
            if (isMediaItem) {
                setPlaylistItem(playlistIndex + 1);
                event.preventDefault();
                handledCase = true;
                key = 'FastForward';
            }
            break;

        case RemoteKeyCode.Back:
            leaveViewer();
            event.preventDefault();
            handledCase = true;
            key = 'Back';
            break;

        default:
            break;
    }

    return { handledCase: handledCase, key: key };
}

export function targetKeyUpEventListener(event: KeyboardEvent): { handledCase: boolean, key: string } {
    return common.targetKeyUpEventListener(event);
}

if (window.tizenOSAPI.pendingPlay !== null) {
    const pendingPlay = window.tizenOSAPI.pendingPlay;
    if (pendingPlay.rendererEvent === 'play-playlist') {
        onPlayPlaylist(null, pendingPlay.rendererMessage);
    }
    else {
        onPlay(null, pendingPlay.rendererMessage, pendingPlay.proxyUrl);
    }
}
