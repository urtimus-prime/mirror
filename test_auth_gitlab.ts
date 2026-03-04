import { execSync } from 'node:child_process';
import fs from 'node:fs';

// Load .env explicitly if available
try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, ...vals] = line.split('=');
        if (key && vals.length) process.env[key.trim()] = vals.join('=')
            .trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    });
} catch (e) { }

async function run() {
    const pat = process.env.GITLAB_PAT;
    if (!pat) {
        console.error('Missing GITLAB_PAT in environment.');
        process.exit(1);
    }
    const provider = 'gitlab.crux.casa';
    const username = 'potnoodledev';

    // Add key to GitLab
    const pubKey = fs.readFileSync(`${process.env.HOME}/.ssh/id_ed25519_potnoodledev.pub`, 'utf-8').trim();

    console.log('0. Adding SSH key to GitLab via API...');
    const addKeyRes = await fetch(`https://${provider}/api/v4/user/keys`, {
        method: 'POST',
        headers: {
            'PRIVATE-TOKEN': pat,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: 'Mirror Test Key',
            key: pubKey
        })
    });

    if (!addKeyRes.ok) {
        console.log('Add key response (might already exist):', await addKeyRes.text());
    } else {
        console.log('Key added successfully.');
    }

    const wakewords = "self-hosting is the future";
    const encodedWakewords = encodeURIComponent(wakewords);

    console.log(`1. Initiating Authentication via https://mirror.soulcats.xyz/api/auth/challenge?provider=${provider}&username=${username}&wakewords=${encodedWakewords}`);
    const chalRes = await fetch(`https://mirror.soulcats.xyz/api/auth/challenge?provider=${provider}&username=${username}&wakewords=${encodedWakewords}`);
    const chalData = await chalRes.json() as any;
    const challenge = chalData.challenge;

    console.log('Challenge:', challenge);

    fs.writeFileSync('/tmp/chal_potnoodle.txt', challenge);

    const keyFile = `${process.env.HOME}/.ssh/id_ed25519_potnoodledev`;
    console.log(`2. Signing with ${keyFile}`);
    try { fs.unlinkSync('/tmp/chal_potnoodle.txt.sig'); } catch (e) { }
    execSync(`ssh-keygen -Y sign -n file -f ${keyFile} /tmp/chal_potnoodle.txt`);

    const sigStr = fs.readFileSync('/tmp/chal_potnoodle.txt.sig', 'utf-8');
    console.log('Signature generated (Base64/Armored).');

    console.log('3. Submitting to https://mirror.soulcats.xyz/api/auth/verify');
    const verifyRes = await fetch('https://mirror.soulcats.xyz/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            provider: provider,
            username: username,
            challenge: challenge,
            signature: sigStr
        })
    });

    const verifyData = await verifyRes.json();
    console.log('Verify Response:', verifyData);

    if (verifyRes.ok && verifyData.success) {
        console.log('✓ SUCCESS: Profile successfully verified via the live site endpoints!');
    } else {
        console.error('✗ FAILED to verify.');
        process.exit(1);
    }
}

run().catch(console.error);
