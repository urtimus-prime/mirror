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

    console.log('Fetching README from GitHub...');
    const githubRes = await fetch('https://raw.githubusercontent.com/potnoodledev/potnoodledev/main/README.md');
    if (!githubRes.ok) throw new Error('Failed to fetch from github');
    const readmeContent = await githubRes.text();

    const projectId = encodeURIComponent('potnoodledev/potnoodledev');
    const filePath = encodeURIComponent('README.md');

    const body = {
        branch: 'main',
        content: readmeContent,
        commit_message: 'Update README from GitHub profile'
    };

    console.log('Updating GitLab README...');
    let res = await fetch(`https://gitlab.crux.casa/api/v4/projects/${projectId}/repository/files/${filePath}`, {
        method: 'PUT',
        headers: { 'PRIVATE-TOKEN': pat, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        console.log('PUT failed, trying POST...');
        res = await fetch(`https://gitlab.crux.casa/api/v4/projects/${projectId}/repository/files/${filePath}`, {
            method: 'POST',
            headers: { 'PRIVATE-TOKEN': pat, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            console.error('Failed completely:', await res.text());
            process.exit(1);
        }
    }
    console.log('SUCCESS! README synced to gitlab.crux.casa.');
}
run();
