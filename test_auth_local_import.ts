import { verifySignature } from './src/auth.js';
import fs from 'node:fs';
import * as tty from 'node:tty';
const t = console.log;

const challenge = fs.readFileSync('/tmp/chal_urtimus.txt', 'utf8');
const sigStr = fs.readFileSync('/tmp/chal_urtimus.txt.sig', 'utf8');

async function run() {
    const res = await fetch('https://github.com/urtimus-prime.keys');
    const text = await res.text();
    const keys = text.split('\n').filter(k => k.trim().length > 0);
    
    // OVERRIDE the console.error to print error details
    let isValid = false;
    for (const key of keys) {
        console.log("Testing with key:", key);
        if (verifySignature(challenge, sigStr, key)) {
            isValid = true;
            break;
        }
    }
    console.log("IsValid locally:", isValid);
}
run();
