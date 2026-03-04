import { kv } from '@vercel/kv';

const hasKv = !!process.env.KV_REST_API_URL;

export async function getVerificationTime(provider: string, username: string): Promise<number | null> {
    if (!hasKv) return Date.now(); // Mock for local dev if KV isn't configured

    try {
        const key = `verification:${provider}:${username}`;
        const data = await kv.get<{ timestamp: number }>(key);
        return data?.timestamp || null;
    } catch (err) {
        console.error('KV get error:', err);
        return null;
    }
}

export async function markVerified(provider: string, username: string): Promise<void> {
    if (!hasKv) {
        console.warn('Vercel KV is not configured. Skipping save.');
        return;
    }

    const timestamp = Date.now();
    const key = `verification:${provider}:${username}`;
    const member = `${provider}:${username}`;

    try {
        await kv.set(key, { timestamp });
        await kv.zadd('recent_verifications', { score: timestamp, member });
    } catch (err) {
        console.error('KV save error:', err);
    }
}

export async function getRecentVerifications(limit = 100): Promise<Array<{ provider: string, username: string, timestamp: number }>> {
    if (!hasKv) return [];

    try {
        // zrange using descending order (highest score first)
        const members = await kv.zrange<string[]>('recent_verifications', 0, limit - 1, { rev: true });

        const results = [];
        for (const member of members) {
            const parts = member.split(':');
            if (parts.length >= 2) {
                // handle cases where provider happens to include colons? Github shouldn't.
                // It's `provider:username`
                const provider = parts.slice(0, -1).join(':');
                const username = parts[parts.length - 1];

                // Fetch timestamp for each (or just use score if we queried with scores, but let's just get it)
                const data = await kv.get<{ timestamp: number }>(`verification:${member}`);
                if (data) {
                    results.push({ provider, username, timestamp: data.timestamp });
                }
            }
        }
        return results;
    } catch (err) {
        console.error('KV zrange error:', err);
        return [];
    }
}
