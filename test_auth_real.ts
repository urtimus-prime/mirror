import { execSync } from 'node:child_process';
import fs from 'node:fs';

async function run() {
    const wakewords = "Apocalypse Radio is sick!";
    const encodedWakewords = encodeURIComponent(wakewords);

    console.log(`1. Initiating Authentication via https://mirror.soulcats.xyz/api/auth/challenge?provider=github.com&username=urtimus-prime&wakewords=${encodedWakewords}`);
    const chalRes = await fetch(`https://mirror.soulcats.xyz/api/auth/challenge?provider=github.com&username=urtimus-prime&wakewords=${encodedWakewords}`);
    const chalData = await chalRes.json() as any;
    const challenge = chalData.challenge;

    console.log('Challenge:', challenge);

    fs.writeFileSync('/tmp/chal_urtimus.txt', challenge);

    // Use the newly generated dedicated key
    const keyFile = `${process.env.HOME}/.ssh/id_urtimus_test`;
    console.log(`2. Signing with ${keyFile}`);
    try { fs.unlinkSync('/tmp/chal_urtimus.txt.sig'); } catch (e) { }
    execSync(`ssh-keygen -Y sign -n file -f ${keyFile} /tmp/chal_urtimus.txt`);

    const sigStr = fs.readFileSync('/tmp/chal_urtimus.txt.sig', 'utf-8');
    console.log('Signature generated (Base64/Armored).');

    console.log('3. Submitting to https://mirror.soulcats.xyz/api/auth/verify');
    const verifyRes = await fetch('https://mirror.soulcats.xyz/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            provider: 'github.com',
            username: 'urtimus-prime',
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
