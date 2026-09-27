import { FCastSession, PacketOrigin } from 'common/FCastSession';
import { ErrorKind } from 'common/v4/Codec';
import { Opcode, EventSubscribeObject, EventObject, EventType, KeyEvent, KeyDownEvent, KeyUpEvent } from 'common/Packets';
import { Logger, LoggerType } from 'common/Logger';
import { deepEqual } from 'common/UtilityBackend';
import { EventEmitter } from 'events';
import { errorHandler } from 'src/Main';
const logger = new Logger('ListenerService', LoggerType.BACKEND);

export abstract class ListenerService {
    public emitter: EventEmitter = new EventEmitter();
    protected sessionMap: Map<string, FCastSession> = new Map();
    private eventSubscribers: Map<string, EventSubscribeObject[]> = new Map();

    public abstract start(): void;
    public abstract stop(): void;
    public abstract disconnect(sessionId: string): void;

    public send(opcode: number, message = null, sessionId = null) {
        // logger.info(`Sending message ${JSON.stringify(message)}`);

        if (sessionId) {
            if (opcode === Opcode.Event.valueOf() && !this.isSubscribedToEvent(sessionId, message.event)) {
                return;
            }

            try {
                this.sessionMap.get(sessionId)?.send(opcode, message);
            } catch (e) {
                logger.warn("Failed to send error.", e);
                this.sessionMap.get(sessionId)?.close();
            }
        }
        else {
            for (const session of this.sessionMap.values()) {
                if (opcode === Opcode.Event.valueOf() && !this.isSubscribedToEvent(session.sessionId, message.event)) {
                    continue;
                }

                try {
                    session.send(opcode, message);
                } catch (e) {
                    logger.warn("Failed to send error.", e);
                    session.close();
                }
            }
        }
    }

    // Sends a v4 message to v4 sessions: all of them, only one (`only`), or all but the one that
    // made the request being relayed (`exclude`).
    public sendV4(data: Uint8Array, options: { only?: string, exclude?: string } = {}) {
        for (const session of this.sessionMap.values()) {
            if (!session.isV4 || (options.only !== undefined && session.sessionId !== options.only) ||
                (options.exclude !== undefined && session.sessionId === options.exclude)) {
                continue;
            }

            try {
                session.sendV4Message(data);
            } catch (e) {
                logger.warn("Failed to send.", e);
                session.close();
            }
        }
    }

    // Answers a v4 request with an `Error` (no-op for v2/v3 senders, which have no equivalent).
    public sendV4Error(origin: PacketOrigin, kind: ErrorKind) {
        this.sessionMap.get(origin.sessionId)?.sendV4Error(kind, origin.packetNumber);
    }

    public getSession(sessionId: string): FCastSession {
        return this.sessionMap.get(sessionId);
    }

    public getV4Sessions(): FCastSession[] {
        return [...this.sessionMap.values()].filter((session) => session.isV4);
    }

    public subscribeEvent(sessionId: string, event: EventSubscribeObject) {
        if (!this.eventSubscribers.has(sessionId)) {
            this.eventSubscribers.set(sessionId, []);
        }

        let sessionSubscriptions = this.eventSubscribers.get(sessionId);
        sessionSubscriptions.push(event);
        this.eventSubscribers.set(sessionId, sessionSubscriptions);
    }

    public unsubscribeEvent(sessionId: string, event: EventSubscribeObject) {
        if (this.eventSubscribers.has(sessionId)) {
            let sessionSubscriptions = this.eventSubscribers.get(sessionId);

            const index = sessionSubscriptions.findIndex((obj) => deepEqual(obj, event));
            if (index != -1) {
                sessionSubscriptions.splice(index, 1);
            }

            this.eventSubscribers.set(sessionId, sessionSubscriptions);
        }
    }

    public getSessions(): string[] {
        return [...this.sessionMap.keys()];
    }

    public getSessionProtocolVersion(sessionId: string) {
        return this.sessionMap.get(sessionId)?.protocolVersion;
    }

    public getAllSubscribedKeys(): { keyDown: Set<string>, keyUp: Set<string> } {
        let keyDown = new Set<string>();
        let keyUp = new Set<string>();

        for (const session of this.eventSubscribers.values()) {
            for (const event of session) {
                switch (event.type) {
                    case EventType.KeyDown:
                        keyDown = new Set([...keyDown, ...(event as KeyDownEvent).keys]);
                        break;

                    case EventType.KeyUp:
                        keyUp = new Set([...keyUp, ...(event as KeyUpEvent).keys]);
                        break;

                    default:
                        break;
                }
            }
        }

        return { keyDown: keyDown, keyUp: keyUp };
    }

    private isSubscribedToEvent(sessionId: string, event: EventObject): boolean {
        let isSubscribed = false;

        if (this.eventSubscribers.has(sessionId)) {
            for (const e of this.eventSubscribers.get(sessionId).values()) {
                if (e.type === event.type) {
                    if (e.type === EventType.KeyDown.valueOf() || e.type === EventType.KeyUp.valueOf()) {
                        const subscribeEvent = e.type === EventType.KeyDown.valueOf() ? e as KeyDownEvent : e as KeyUpEvent;
                        const keyEvent = event as KeyEvent;

                        if (!subscribeEvent.keys.includes(keyEvent.key)) {
                            continue;
                        }
                    }

                    isSubscribed = true;
                    break;
                }
            }
        }

        return isSubscribed;
    }

    protected async handleServerError(err: NodeJS.ErrnoException) {
        errorHandler(err);
    }
}
