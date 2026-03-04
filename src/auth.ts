import crypto from 'node:crypto';
import sshpk from 'sshpk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
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

export function verifySignature(challenge: string, signatureRawText: string, publicKey: string): boolean {
    try {
        const lines = signatureRawText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('-----'));
        const sigBuffer = Buffer.from(lines.join(''), 'base64');

        let offset = 0;
        function readString() {
            const len = sigBuffer.readUInt32BE(offset);
            offset += 4;
            const buf = sigBuffer.subarray(offset, offset + len);
            offset += len;
            return buf;
        }

        const magic = sigBuffer.subarray(offset, offset + 6).toString('utf8');
        if (magic !== 'SSHSIG') {
            console.log("[VERIFY_DEBUG] FAILED MAGIC:", magic);
            return false;
        }
        offset += 6;

        const version = sigBuffer.readUInt32BE(offset);
        if (version !== 1) {
            console.log("[VERIFY_DEBUG] FAILED VERSION:", version);
            return false;
        }
        offset += 4;

        readString(); // pubKey
        const namespace = readString();
        const reserved = readString();
        const hashAlg = readString();
        const hashAlgStr = hashAlg.toString('utf8');

        const signatureBlob = readString();
        let sigBlobOffset = 0;
        const sigTypeLen = signatureBlob.readUInt32BE(sigBlobOffset);
        sigBlobOffset += 4;
        const sigType = signatureBlob.subarray(sigBlobOffset, sigBlobOffset + sigTypeLen).toString('utf8');
        sigBlobOffset += sigTypeLen;
        const rawSigLen = signatureBlob.readUInt32BE(sigBlobOffset);
        sigBlobOffset += 4;
        const rawSig = signatureBlob.subarray(sigBlobOffset, sigBlobOffset + rawSigLen);

        const hashValue = crypto.createHash(hashAlgStr).update(Buffer.from(challenge, 'utf8')).digest();

        const signedDataParts = [];
        signedDataParts.push(Buffer.from('SSHSIG', 'utf8'));

        function encodeString(buf: Buffer) {
            const lenBuf = Buffer.alloc(4);
            lenBuf.writeUInt32BE(buf.length, 0);
            return Buffer.concat([lenBuf, buf]);
        }

        signedDataParts.push(encodeString(namespace));
        signedDataParts.push(encodeString(reserved));
        signedDataParts.push(encodeString(hashAlg));
        signedDataParts.push(encodeString(hashValue));

        const signedData = Buffer.concat(signedDataParts);

        const parsedKey = sshpk.parseKey(publicKey.trim(), 'ssh');
        let isVerified = false;

        if (sigType === 'ssh-ed25519') {
            const keyObj = crypto.createPublicKey({
                key: parsedKey.toBuffer('pem'),
                format: 'pem'
            });
            isVerified = crypto.verify(undefined, signedData, keyObj, rawSig);
        } else if (sigType.includes('rsa')) {
            const keyObj = crypto.createPublicKey({
                key: parsedKey.toBuffer('pem'),
                format: 'pem'
            });
            isVerified = crypto.verify(hashAlgStr, signedData, keyObj, rawSig);
        } else {
            return false;
        }

        return isVerified;
    } catch (err) {
        console.error('Native signature verification failed:', err);
        return false;
    }
}
