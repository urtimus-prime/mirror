import fs from 'node:fs/promises';
import path from 'node:path';

const STORE_FILE = path.join(process.cwd(), 'vlogs.txt');

export async function getVerificationTime(provider: string, username: string): Promise<number | null> {
    try {
        const data = await fs.readFile(STORE_FILE, 'utf-8');
        const lines = data.split('\n');

        let latestTime = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
                const entry = JSON.parse(trimmed);
                if (entry.provider === provider && entry.username === username && entry.action === 'verified') {
                    if (!latestTime || entry.timestamp > latestTime) {
                        latestTime = entry.timestamp;
                    }
                }
            } catch (err) {
                // Ignore parse errors on individual lines
            }
        }
        return latestTime;
    } catch (err: any) {
        if (err.code === 'ENOENT') return null;
        console.error('Error reading store:', err);
        return null;
    }
}

export async function markVerified(provider: string, username: string): Promise<void> {
    const entry = {
        action: 'verified',
        provider,
        username,
        timestamp: Date.now()
    };

    try {
        await fs.appendFile(STORE_FILE, JSON.stringify(entry) + '\n');
    } catch (err) {
        console.error('Error writing to store:', err);
    }
}
