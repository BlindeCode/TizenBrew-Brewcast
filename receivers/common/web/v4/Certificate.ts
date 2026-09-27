import * as crypto from 'crypto';
import * as fs from 'fs';
import * as tls from 'tls';
import { Logger, LoggerType } from 'common/Logger';
const logger = new Logger('V4Certificate', LoggerType.BACKEND);

// TLS identity for protocol v4. Senders pin the SHA-256 of the certificate's SubjectPublicKeyInfo
// (the `fp` mDNS TXT record), so only the key pair matters. Like the reference receiver (rcgen
// defaults) the certificate is a self-signed ECDSA P-256 one with an empty subject and issuer,
// valid from 1975 to 4096. Node has no certificate builder, hence the minimal DER encoder below.

export interface V4Identity {
    keyPem: string;
    certPem: string;
    // base64(SHA-256(DER SubjectPublicKeyInfo)), the `fp` TXT record value
    fingerprint: string;
    secureContext: tls.SecureContext;
}

// Returns why protocol v4 can't run on this Node runtime, or null when it can. v4 needs TLS 1.3
// (Node 12+), the KeyObject/crypto.sign APIs used below, and BigInt plus TextEncoder/TextDecoder for
// FlatBuffers.
export function v4UnsupportedReason(): string | null {
    if (typeof BigInt !== 'function') {
        return 'BigInt is not available';
    }
    if (typeof TextEncoder !== 'function' || typeof TextDecoder !== 'function') {
        return 'TextEncoder/TextDecoder are not available';
    }
    if (typeof crypto.generateKeyPairSync !== 'function' || typeof crypto.sign !== 'function' || typeof crypto.createPrivateKey !== 'function') {
        return 'crypto key APIs are not available';
    }
    if (typeof tls.DEFAULT_MAX_VERSION !== 'string') {
        return 'TLS 1.3 is not available';
    }
    return null;
}

function derLength(length: number): Buffer {
    if (length < 0x80) {
        return Buffer.from([length]);
    }

    const bytes: number[] = [];
    for (let n = length; n > 0; n = Math.floor(n / 256)) {
        bytes.unshift(n % 256);
    }
    return Buffer.from([0x80 | bytes.length].concat(bytes));
}

function der(tag: number, ...content: Buffer[]): Buffer {
    const body = Buffer.concat(content);
    return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
}

function derSequence(...content: Buffer[]): Buffer {
    return der(0x30, ...content);
}

// Unsigned big-endian integer from `value`.
function derInteger(value: Buffer): Buffer {
    let start = 0;
    while (start < value.length - 1 && value[start] === 0) {
        start++;
    }

    let bytes = value.subarray(start);
    if (bytes[0] & 0x80) {
        bytes = Buffer.concat([Buffer.from([0]), bytes]);
    }
    return der(0x02, bytes);
}

// RFC 5280 4.1.2.5: UTCTime for years 1950-2049, GeneralizedTime otherwise.
function derTime(date: Date): Buffer {
    const pad = (n: number, width = 2) => n.toString().padStart(width, '0');
    const year = date.getUTCFullYear();
    const rest = pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + pad(date.getUTCHours()) +
        pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + 'Z';

    if (year >= 1950 && year < 2050) {
        return der(0x17, Buffer.from(pad(year % 100) + rest, 'ascii'));
    }
    return der(0x18, Buffer.from(pad(year, 4) + rest, 'ascii'));
}

function toPem(label: string, derBytes: Buffer): string {
    const lines = derBytes.toString('base64').match(/.{1,64}/g);
    return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

// AlgorithmIdentifier for ecdsa-with-SHA256 (1.2.840.10045.4.3.2), parameters absent.
const ECDSA_WITH_SHA256 = derSequence(Buffer.from('06082a8648ce3d040302', 'hex'));
const EMPTY_NAME = derSequence();

export function spkiFingerprint(publicKey: crypto.KeyObject): string {
    const spki = publicKey.export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(spki).digest('base64');
}

export function createSelfSignedCertificate(privateKey: crypto.KeyObject): Buffer {
    const publicKey = crypto.createPublicKey(privateKey);
    const serial = crypto.randomBytes(16);
    serial[0] &= 0x7f;

    const tbsCertificate = derSequence(
        der(0xa0, derInteger(Buffer.from([2]))), // version: v3
        derInteger(serial),
        ECDSA_WITH_SHA256,
        EMPTY_NAME, // issuer
        derSequence(derTime(new Date(Date.UTC(1975, 0, 1))), derTime(new Date(Date.UTC(4096, 0, 1)))),
        EMPTY_NAME, // subject
        publicKey.export({ type: 'spki', format: 'der' }),
    );

    // Node's ECDSA signatures are DER-encoded Ecdsa-Sig-Value, as X.509 expects.
    const signature = crypto.sign('sha256', tbsCertificate, privateKey);
    return derSequence(tbsCertificate, ECDSA_WITH_SHA256, der(0x03, Buffer.from([0]), signature));
}

export function identityFromKey(privateKey: crypto.KeyObject): V4Identity {
    const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const certPem = toPem('CERTIFICATE', createSelfSignedCertificate(privateKey));

    return {
        keyPem: keyPem,
        certPem: certPem,
        fingerprint: spkiFingerprint(crypto.createPublicKey(privateKey)),
        secureContext: tls.createSecureContext({
            key: keyPem,
            cert: certPem,
            minVersion: 'TLSv1.3',
            maxVersion: 'TLSv1.3',
        }),
    };
}

// Loads the private key from `keyPath`, or creates one and tries to store it there, so the
// fingerprint stays stable across restarts. Only the key is stored; the certificate is re-issued
// on every start (senders pin the key, not the certificate). Pass null for an ephemeral key.
export function loadOrCreateV4Identity(keyPath: string | null): V4Identity {
    if (keyPath !== null) {
        try {
            if (fs.existsSync(keyPath)) {
                return identityFromKey(crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8')));
            }
        } catch (e) {
            logger.warn(`Could not load the v4 key from ${keyPath}, creating a new one`, e);
        }
    }

    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const identity = identityFromKey(privateKey);

    if (keyPath !== null) {
        try {
            fs.writeFileSync(keyPath, identity.keyPem, { mode: 0o600 });
        } catch (e) {
            logger.warn(`Could not store the v4 key at ${keyPath}; the fingerprint will change on restart`, e);
        }
    }

    return identity;
}
