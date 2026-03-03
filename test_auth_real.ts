import { execSync } from 'node:child_process';
import fs from 'node:fs';

async function run() {
    const challenge = "github.com:voxxelle:1772575410213:f7a9289eb60a58cdc55e32";
    
    // Write just exactly the challenge string
    fs.writeFileSync('/tmp/chal.txt', challenge);
    
    const keyFile = `${process.env.HOME}/.ssh/id_ed25519`;
    execSync(`ssh-keygen -Y sign -n file -f ${keyFile} /tmp/chal.txt`);
    
    const localPubKey = fs.readFileSync(`${keyFile}.pub`, 'utf-8').trim();
    
    try {
        const allowedSigners = `user ${localPubKey}\n`;
        fs.writeFileSync('/tmp/allowed_signers', allowedSigners);
        // Let's run verify natively here to see the actual error output instead of hiding it in auth.ts
        execSync(`ssh-keygen -Y verify -f /tmp/allowed_signers -I user -n file -s /tmp/chal.txt.sig < /tmp/chal.txt`);
        console.log('NATIVE VERIFY SUCCESS');
    } catch (e: any) {
        console.error('NATIVE VERIFY ERROR:', e.message);
    }
}

run().catch(console.error);
