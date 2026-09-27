import * as url from 'url';
import { http, https } from 'modules/follow-redirects';

const PROBE_TIMEOUT_MS = 5000;

export type ProbeResult = 'ok' | 'missing' | 'unknown';

// Asks for the first byte of a URL, to tell a missing resource from one the player couldn't play:
// browsers report both as the same media error.
export function probeUrl(target: string, headers: { [key: string]: string } | null): Promise<ProbeResult> {
    if (!/^https?:\/\//i.test(target || '')) {
        return Promise.resolve('unknown');
    }

    return new Promise((resolve) => {
        const protocol = /^https:/i.test(target) ? https : http;
        let done = false;
        const finish = (result: ProbeResult) => {
            if (!done) {
                done = true;
                resolve(result);
            }
        };

        const request = protocol.get({
            ...url.parse(target),
            headers: { ...(headers || {}), Range: 'bytes=0-0' },
            timeout: PROBE_TIMEOUT_MS,
        }, (response) => {
            const status = response.statusCode;
            response.destroy();
            finish(status >= 200 && status < 300 ? 'ok' : status === 404 || status === 410 ? 'missing' : 'unknown');
        });
        request.on('timeout', () => {
            request.destroy();
            finish('missing');
        });
        // Unreachable hosts are as good as missing to the sender.
        request.on('error', () => finish('missing'));
    });
}
