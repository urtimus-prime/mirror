import crypto from 'node:crypto';
import sshpk from 'sshpk';

const SECRET_KEY = process.env.CHALLENGE_SECRET || crypto.randomBytes(32).toString('hex');

export function generateChallenge(provider: string, username: string): string {
    const timestamp = Date.now().toString();
    const payload = `${provider}:${username}:${timestamp}`;
    const hmac = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
    return `${payload}:${hmac}`;
}

export function verifyChallenge(challenge: string, provider: string, username: string, maxAgeMs = 5 * 60 * 1000): boolean {
    const parts = challenge.split(':');
    if (parts.length !== 4) return false;

    const [cProvider, cUsername, cTimestamp, cHmac] = parts;
    if (cProvider !== provider || cUsername !== username) return false;

    const timestamp = parseInt(cTimestamp, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > maxAgeMs) return false;

    const payload = `${cProvider}:${cUsername}:${cTimestamp}`;
    const expectedHmac = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');

    const challengeHmacBuffer = Buffer.from(cHmac, 'hex');
    const expectedHmacBuffer = Buffer.from(expectedHmac, 'hex');

    if (challengeHmacBuffer.length !== expectedHmacBuffer.length) return false;

    return crypto.timingSafeEqual(challengeHmacBuffer, expectedHmacBuffer);
}

/**
 * Verifies a signature produced by `ssh-keygen -Y sign`.
 * Note: OpenSSH signatures have a specific armored format.
 * We might need an external library to parse them properly if they use the raw ASCII armor.
 * For now, we assume standard sshpk verification if they provide an RFC5656 signature 
 * or similar easily parseable base64 blob.
 */
export function verifySignature(challenge: string, signatureBase64: string, publicKey: string): boolean {
    try {
        const key = sshpk.parseKey(publicKey, 'ssh');

        const verifier = key.createVerify('sha512');
        verifier.update(challenge);

        let sig: sshpk.Signature;
        try {
            // First try parsing as an 'ssh' format signature
            sig = sshpk.parseSignature(signatureBase64, key.type as sshpk.AlgorithmType, 'ssh');
        } catch (e1) {
            try {
                // If it's a raw ASN.1 signature (default output of crypto.sign)
                sig = sshpk.parseSignature(signatureBase64, key.type as sshpk.AlgorithmType, 'asn1');
            } catch (e2) {
                // If it's pure raw bytes (like an ed25519 64-byte signature)
                const buf = Buffer.from(signatureBase64, 'base64');
                // For raw ed25519 the signature is just the 64 bytes. sshpk doesn't natively have a 'raw' format to pass directly, but we can construct it manually, or we can try 'ssh' after wrapping.
                // However, the sshpk library does fall back to raw if we pass an explicit `sshpk.Signature` object.
                // Or we can just use `crypto.verify` directly for raw ed25519 since node v12+
                sig = sshpk.parseSignature(buf, key.type as sshpk.AlgorithmType, 'asn1');
            }
        }

        return verifier.verify(sig);
    } catch (err) {
        console.error('Signature verification failed:', err);
        return false;
    }
}
