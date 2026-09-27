import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { identityFromKey, loadOrCreateV4Identity, v4UnsupportedReason } from 'common/v4/Certificate';

describe('v4 certificate', () => {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const identity = identityFromKey(privateKey);
    const certificate = new crypto.X509Certificate(identity.certPem);

    test('this runtime supports v4', () => {
        expect(v4UnsupportedReason()).toBeNull();
    });

    test('is a valid self-signed ECDSA P-256 certificate', () => {
        expect(certificate.verify(certificate.publicKey)).toBe(true);
        expect(certificate.publicKey.asymmetricKeyDetails.namedCurve).toBe('prime256v1');
        // Empty subject and issuer, like the reference receiver's certificates.
        expect(certificate.subject || '').toBe('');
        expect(certificate.issuer || '').toBe('');
        expect(new Date(certificate.validFrom).getUTCFullYear()).toBe(1975);
        expect(new Date(certificate.validTo).getUTCFullYear()).toBe(4096);
    });

    test('parses with the OpenSSL CLI', () => {
        const text = execFileSync('openssl', ['x509', '-noout', '-text'], { input: identity.certPem }).toString();
        expect(text).toContain('ecdsa-with-SHA256');
        expect(text).toContain('Version: 3');
    });

    test('fingerprint is the base64 SHA-256 of the SPKI', () => {
        const spki = certificate.publicKey.export({ type: 'spki', format: 'der' });
        expect(identity.fingerprint).toBe(crypto.createHash('sha256').update(spki).digest('base64'));
        expect(Buffer.from(identity.fingerprint, 'base64')).toHaveLength(32);
    });

    test('a stored key keeps the fingerprint across restarts', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brewcast-v4-'));
        const keyPath = path.join(dir, 'key.pem');
        try {
            const first = loadOrCreateV4Identity(keyPath);
            expect(fs.existsSync(keyPath)).toBe(true);
            const second = loadOrCreateV4Identity(keyPath);
            expect(second.fingerprint).toBe(first.fingerprint);
            // Certificates are re-issued (new serial) but pin the same key.
            expect(second.certPem).not.toBe(first.certPem);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('without a key path the identity is ephemeral', () => {
        expect(loadOrCreateV4Identity(null).fingerprint).not.toBe(loadOrCreateV4Identity(null).fingerprint);
    });
});
