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
    // Determine user namespace identifier
    // We allow any identifier, but to be clean, let's use the public key hash or just 'user'
    const identifier = 'user';

    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const tmpDir = os.tmpdir();

    const allowedSignersPath = path.join(tmpDir, `allowed_signers_${randomSuffix}`);
    const challengePath = path.join(tmpDir, `chal_${randomSuffix}`);
    const sigPath = path.join(tmpDir, `chal_${randomSuffix}.sig`);

    try {
        fs.writeFileSync(allowedSignersPath, `${identifier} ${publicKey}\n`);
        fs.writeFileSync(challengePath, challenge);
        fs.writeFileSync(sigPath, signatureRawText);

        execSync(`ssh-keygen -Y verify -f ${allowedSignersPath} -I ${identifier} -n file -s ${sigPath} < ${challengePath}`, { stdio: 'ignore' });

        return true;
    } catch (err) {
        console.error('Signature verification via ssh-keygen failed');
        return false;
    } finally {
        try { if (fs.existsSync(allowedSignersPath)) fs.unlinkSync(allowedSignersPath); } catch (e) { }
        try { if (fs.existsSync(challengePath)) fs.unlinkSync(challengePath); } catch (e) { }
        try { if (fs.existsSync(sigPath)) fs.unlinkSync(sigPath); } catch (e) { }
    }
}
