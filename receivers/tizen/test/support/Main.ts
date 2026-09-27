import { PlaybackUpdateMessage, PlayMessage } from 'common/Packets';

// Stand-in for service/Main.ts: the getters the shared backend code imports from `src/Main`,
// backed by state the tests control.
export const testState = {
    playMessage: null as PlayMessage,
    playbackUpdate: null as PlaybackUpdateMessage,
    playerVolume: 1 as number,
};

export function getComputerName(): string {
    return 'Test TV';
}

export function getAppName(): string {
    return 'BrewCast';
}

export function getAppVersion(): string {
    return '0.0.0-test';
}

export function getPlayMessage(): PlayMessage {
    return testState.playMessage;
}

export function getPlaybackUpdateMessage(): PlaybackUpdateMessage {
    return testState.playbackUpdate;
}

export function getPlayerVolume(): number {
    return testState.playerVolume;
}

export function errorHandler(err: Error) {
    throw err;
}
