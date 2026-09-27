import { toast, ToastIcon } from 'common/components/Toast';

// Page side of the channel to the BrewCast service (service/Ipc.ts): service events arrive as
// Server-Sent Events, calls go out as POSTs. Both are local to the TV.
const SERVICE_URL = 'http://127.0.0.1:46897';
// EventSource retries every second (the service sets `retry`); warn once if it stays unreachable.
const UNREACHABLE_WARNING_AFTER = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- event payloads are JSON
type EventHandler = (value: any) => void;

export class ServiceClient {
    private source: EventSource = null;
    private handlers: { [event: string]: EventHandler } = {};
    private failures = 0;
    private warned = false;

    on(event: string, handler: EventHandler) {
        this.handlers[event] = handler;
    }

    connect() {
        this.source = new EventSource(`${SERVICE_URL}/events`);

        Object.keys(this.handlers).forEach((event) => {
            this.source.addEventListener(event, (message: MessageEvent) => {
                try {
                    this.handlers[event](JSON.parse(message.data));
                } catch (e) {
                    console.error(`ServiceClient: error handling '${event}'`, e);
                }
            });
        });

        this.source.onopen = () => {
            this.failures = 0;
        };
        this.source.onerror = () => {
            this.failures += 1;
            if (this.failures >= UNREACHABLE_WARNING_AFTER && !this.warned) {
                this.warned = true;
                toast('The BrewCast service is not running. In TizenBrew, check that the BrewCast service is started.', ToastIcon.ERROR, 15000);
            }
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- results are JSON
    call(method: string, value: unknown = null): Promise<any> {
        // text/plain keeps this a "simple" cross-origin request (no CORS preflight).
        return fetch(`${SERVICE_URL}/call/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(value),
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.error) {
                    throw new Error(result.error);
                }
                return result.value;
            });
    }
}
