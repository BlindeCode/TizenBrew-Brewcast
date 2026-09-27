/* eslint-disable @typescript-eslint/no-explicit-any -- multicast-dns is untyped through the modules/ alias */
import * as crypto from 'crypto';
import * as os from 'os';
import makeMdns from 'modules/multicast-dns';
import { Logger, LoggerType } from 'common/Logger';
import { getAppName, getAppVersion, getComputerName } from 'src/Main';
import { TcpListenerService } from './TcpListenerService';
const logger = new Logger('DiscoveryService', LoggerType.BACKEND);

const SERVICE_TYPE = '_fcast._tcp.local';
const SERVICE_ENUMERATION = '_services._dns-sd._udp.local';
const MDNS_PORT = 5353;
// RFC 6762 10: host-related records (SRV, A) 120s, the rest 75 minutes.
const HOST_TTL = 120;
const OTHER_TTL = 4500;

// Advertises the receiver as `_fcast._tcp` over mDNS/DNS-SD. A minimal responder on top of
// multicast-dns: it answers PTR/SRV/TXT/A queries for our records, announces them on start, and
// sends a goodbye (TTL 0) on stop.
export class DiscoveryService {
    private mdns: any = null;
    private txt: { [key: string]: string } = {};
    private port = TcpListenerService.PORT;
    private instanceName: string;
    private hostName: string;

    // `txt` holds the protocol TXT records, e.g. { v: '4', fp: '<fingerprint>' }.
    start(txt: { [key: string]: string } = {}, port: number = TcpListenerService.PORT) {
        if (this.mdns) {
            return;
        }

        const name = getComputerName();
        // DNS labels are dot-separated and at most 63 bytes.
        const label = name.replace(/\./g, '-').substring(0, 63);
        const hostLabel = 'brewcast-' + crypto.createHash('sha1').update(name).digest('hex').substring(0, 8);
        this.instanceName = `${label}.${SERVICE_TYPE}`;
        this.hostName = `${hostLabel}.local`;
        this.port = port;
        // Note that txt field must be populated, otherwise certain mdns stacks have undefined behavior/issues
        // when connecting to the receiver.
        this.txt = Object.assign({ appName: getAppName(), appVersion: getAppVersion() }, txt);

        logger.info(`Discovery service started: ${name}, TXT ${JSON.stringify(this.txt)}`);

        this.mdns = makeMdns({ reuseAddr: true });
        this.mdns.on('error', (err: Error) => logger.warn('mDNS error', err));
        this.mdns.on('warning', (err: Error) => logger.warn('mDNS warning', err));
        this.mdns.on('query', (query: any, rinfo: any) => this.handleQuery(query, rinfo));

        // Announce twice, one second apart (RFC 6762 8.3).
        this.announce(false);
        setTimeout(() => this.announce(false), 1000);
    }

    stop() {
        if (this.mdns) {
            const mdns = this.mdns;
            this.announce(true);
            this.mdns = null;
            setTimeout(() => mdns.destroy(), 100);
        }
    }

    private addresses(): string[] {
        const addresses: string[] = [];
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const address of interfaces[name]) {
                if (!address.internal && (address.family === 'IPv4' || (address.family as any) === 4)) {
                    addresses.push(address.address);
                }
            }
        }
        return addresses;
    }

    private records(goodbye: boolean) {
        const ttl = (value: number) => goodbye ? 0 : value;
        const txt = Object.keys(this.txt).map((key) => `${key}=${this.txt[key]}`);

        return {
            ptr: { name: SERVICE_TYPE, type: 'PTR', ttl: ttl(OTHER_TTL), data: this.instanceName },
            srv: { name: this.instanceName, type: 'SRV', ttl: ttl(HOST_TTL), flush: true, data: { port: this.port, target: this.hostName, priority: 0, weight: 0 } },
            txt: { name: this.instanceName, type: 'TXT', ttl: ttl(OTHER_TTL), flush: true, data: txt },
            a: this.addresses().map((address) => ({ name: this.hostName, type: 'A', ttl: ttl(HOST_TTL), flush: true, data: address })),
        };
    }

    private announce(goodbye: boolean) {
        if (!this.mdns) {
            return;
        }

        const records = this.records(goodbye);
        const answers: any[] = [records.ptr, records.srv, records.txt];
        this.mdns.respond({ answers: answers.concat(records.a) });
    }

    private handleQuery(query: any, rinfo: any) {
        const records = this.records(false);
        const answers: any[] = [];
        const additionals: any[] = [];
        const add = (list: any[], record: any) => {
            if (list.indexOf(record) === -1) {
                list.push(record);
            }
        };

        for (const question of query.questions) {
            const name = question.name.toLowerCase();
            const type = question.type;

            if (name === SERVICE_ENUMERATION && (type === 'PTR' || type === 'ANY')) {
                add(answers, { name: SERVICE_ENUMERATION, type: 'PTR', ttl: OTHER_TTL, data: SERVICE_TYPE });
            } else if (name === SERVICE_TYPE && (type === 'PTR' || type === 'ANY')) {
                add(answers, records.ptr);
                const related: any[] = [records.srv, records.txt];
                related.concat(records.a).forEach((record) => add(additionals, record));
            } else if (name === this.instanceName.toLowerCase()) {
                if (type === 'SRV' || type === 'ANY') {
                    add(answers, records.srv);
                    records.a.forEach((record) => add(additionals, record));
                }
                if (type === 'TXT' || type === 'ANY') {
                    add(answers, records.txt);
                }
            } else if (name === this.hostName.toLowerCase() && (type === 'A' || type === 'ANY')) {
                records.a.forEach((record) => add(answers, record));
            }
        }

        if (answers.length === 0) {
            return;
        }

        // Legacy unicast queries (not from port 5353) get a direct reply that echoes the question.
        if (rinfo && rinfo.port !== MDNS_PORT) {
            this.mdns.respond({ id: query.id, questions: query.questions, answers: answers, additionals: additionals }, rinfo);
        } else {
            this.mdns.respond({ answers: answers, additionals: additionals });
        }
    }
}
