/* eslint-disable @typescript-eslint/no-explicit-any -- the TizenBrew sandbox's `tizen` global is untyped */
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { Logger, LoggerType } from 'common/Logger';
const logger = new Logger('Platform', LoggerType.BACKEND);

// How this module is listed in TizenBrew, e.g. `gh/BlindeCode/tizenbrew-brewcast` (set at build
// time, see webpack.config.js), split into TizenBrew's module type and name.
declare const MODULE: string;
export const MODULE_TYPE = MODULE.substring(0, MODULE.indexOf('/'));
export const MODULE_NAME = MODULE.substring(MODULE.indexOf('/') + 1);

// TizenBrew runs this service with its own `tizen` object in scope. Plain Node (tests, local
// runs) has none, and everything here then falls back to generic behaviour.
declare const tizen: any;

function tizenApi(): any {
    return typeof tizen !== 'undefined' ? tizen : null;
}

export function isTizen(): boolean {
    return tizenApi() !== null;
}

// Where state such as the v4 key is kept: TizenBrew's own writable directory on the TV, or
// BREWCAST_DATA_DIR elsewhere. Null means nothing is persisted.
export function dataDirectory(): string | null {
    const candidates = [process.env.BREWCAST_DATA_DIR, '/home/owner/share'];
    for (const dir of candidates) {
        if (dir && fs.existsSync(dir)) {
            return dir;
        }
    }
    return null;
}

export function dataPath(file: string): string | null {
    const dir = dataDirectory();
    return dir !== null ? path.join(dir, file) : null;
}

// Receiver name shown in sender apps: the TV's own name from Samsung's local REST API when
// available ("[TV] Samsung Q80 Series (55)" style), else manufacturer and model, else hostname.
export function fetchDeviceName(): Promise<string> {
    const fallback = () => {
        const api = tizenApi();
        if (api) {
            try {
                const manufacturer = api.systeminfo.getCapability('http://tizen.org/system/manufacturer');
                const model = api.systeminfo.getCapability('http://tizen.org/system/model_name');
                return `${manufacturer} ${model}`;
            } catch (e) {
                logger.warn('Could not read the TV model', e);
            }
        }
        return `BrewCast ${os.hostname()}`;
    };

    if (!isTizen()) {
        return Promise.resolve(fallback());
    }

    return new Promise((resolve) => {
        const req = http.get({ host: '127.0.0.1', port: 8001, path: '/api/v2/', timeout: 2000 }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => { body += chunk; });
            res.on('end', () => {
                try {
                    const name = JSON.parse(body).device.name;
                    resolve(typeof name === 'string' && name.length > 0 ? name : fallback());
                } catch {
                    resolve(fallback());
                }
            });
        });
        req.on('timeout', () => req.destroy());
        req.on('error', () => resolve(fallback()));
    });
}

// Asks TizenBrew to open this module, used when a sender starts playback while no page of ours
// is open. TizenBrew reads `{ moduleName, moduleType, args }` from the first AppControl data
// entry and navigates to the module's page with `args` as the query string.
export function launchModule(args: string) {
    const api = tizenApi();
    if (!api) {
        logger.info(`Not on Tizen; would launch the module with ${args}`);
        return;
    }

    try {
        const appId = `${api.application.getAppInfo().packageId}.TizenBrewStandalone`;
        const data = [new api.ApplicationControlData('module', [JSON.stringify({ moduleName: MODULE_NAME, moduleType: MODULE_TYPE, args: args })])];
        const control = new api.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
        api.application.launchAppControl(control, appId,
            () => logger.info('Asked TizenBrew to open the module'),
            (error: any) => logger.error(`Could not open the module: ${error && error.message}`));
    } catch (e) {
        logger.error('Could not open the module', e);
    }
}
