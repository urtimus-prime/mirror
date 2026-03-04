import fs from 'node:fs';
import crypto from 'node:crypto';
import sshpk from 'sshpk';

const sigRaw = fs.readFileSync('/tmp/chal_urtimus.txt.sig', 'utf8');

const lines = sigRaw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('-----'));
const sigBuffer = Buffer.from(lines.join(''), 'base64');

console.log('SigBuffer Length:', sigBuffer.length);

let offset = 0;
function readString() {
    const len = sigBuffer.readUInt32BE(offset);
    offset += 4;
    const buf = sigBuffer.subarray(offset, offset + len);
    offset += len;
    return buf;
}

sigBuffer.subarray(offset, offset + 6); offset += 6;
sigBuffer.readUInt32BE(offset); offset += 4;
readString();
const namespace = readString();
const reserved = readString();
const hashAlg = readString();
const hashAlgStr = hashAlg.toString('utf8');

const signatureBlob = readString();
let sigBlobOffset = 0;
const sigTypeLen = signatureBlob.readUInt32BE(sigBlobOffset); sigBlobOffset += 4;
const sigType = signatureBlob.subarray(sigBlobOffset, sigBlobOffset + sigTypeLen).toString('utf8'); sigBlobOffset += sigTypeLen;
const rawSigLen = signatureBlob.readUInt32BE(sigBlobOffset); sigBlobOffset += 4;
const rawSig = signatureBlob.subarray(sigBlobOffset, sigBlobOffset + rawSigLen);

// The difference is here: fs.readFileSync versus string 'utf8' encoding.
const challengeBufferLiteral = fs.readFileSync('/tmp/chal_urtimus.txt');
const challengeString = fs.readFileSync('/tmp/chal_urtimus.txt', 'utf8');
const challengeBufferFromUtf8 = Buffer.from(challengeString, 'utf8');

console.log('CHAL BUFFER LITERAL LENGTH:', challengeBufferLiteral.length);
console.log('CHAL BUFFER UTF8 STRING LENGTH:', challengeBufferFromUtf8.length);
if (challengeBufferLiteral.compare(challengeBufferFromUtf8) !== 0) {
     console.log('BUFFERS DIFFER!');
} else {
     console.log('BUFFERS EXACTLY MATCH');
}

const hashValue = crypto.createHash(hashAlgStr).update(challengeBufferLiteral).digest();
const hashValueStr = crypto.createHash(hashAlgStr).update(challengeBufferFromUtf8).digest();

const signedDataParts = [];
signedDataParts.push(Buffer.from('SSHSIG', 'utf8'));

function encodeString(buf) {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(buf.length, 0);
    return Buffer.concat([lenBuf, buf]);
}

signedDataParts.push(encodeString(namespace));
signedDataParts.push(encodeString(reserved));
signedDataParts.push(encodeString(hashAlg));
signedDataParts.push(encodeString(hashValue));

const signedData = Buffer.concat(signedDataParts);

const githubPubKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHdW3TzzrYA9A1V2zoTnMlGt50n6PHQKQY2P6wT0yR/M';
const parsedKey = sshpk.parseKey(githubPubKey, 'ssh');

const keyObj = crypto.createPublicKey({
    key: parsedKey.toBuffer('pem'),
    format: 'pem'
});

const isValid = crypto.verify(undefined, signedData, keyObj, rawSig);
console.log('NATIVE NODE.JS USING LITERAL BUFFER:', isValid);

const signedDataPartsStr = [];
signedDataPartsStr.push(Buffer.from('SSHSIG', 'utf8'));
signedDataPartsStr.push(encodeString(namespace));
signedDataPartsStr.push(encodeString(reserved));
signedDataPartsStr.push(encodeString(hashAlg));
signedDataPartsStr.push(encodeString(hashValueStr));
const signedDataStr = Buffer.concat(signedDataPartsStr);
const isValidStr = crypto.verify(undefined, signedDataStr, keyObj, rawSig);
console.log('NATIVE NODE.JS USING BUFFER FROM UTF8 STRING:', isValidStr);

