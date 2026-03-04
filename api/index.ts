import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { markedEmoji } from 'marked-emoji'
import { gemoji } from 'gemoji'
import sanitizeHtml from 'sanitize-html'
import { README_CONTENT } from '../src/readme.js'

// Build unicode emoji map from gemoji: { "joy": "😂", "heart": "❤️", ... }
const emojis: Record<string, string> = {}
for (const gem of gemoji) {
  for (const name of gem.names) {
    emojis[name] = gem.emoji
  }
}

marked.use(gfmHeadingId())
marked.use(markedEmoji({ emojis, renderer: (token) => token.emoji }))

export default async function handler(req: any, res: any) {
  try {
    const urlStr = req.url || ''
    const parts = urlStr.split('?')[0].split('/').filter(Boolean)
    // Example: ['soul', 'github', 'voxxelle']

    console.log('Incoming Vercel URL:', urlStr)
    console.log('Extracted Parts:', parts)

    if (parts.length === 0) {
      const { getRecentVerifications } = await import('../src/store.js');
      const recentSouls = await getRecentVerifications(100);

      // Parse README content
      const rawReadmeHtml = await marked.parse(README_CONTENT);
      const cleanReadmeHtml = sanitizeHtml(rawReadmeHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          '*': ['class', 'id'],
          'a': ['href', 'name', 'target', 'rel'],
          'img': ['src', 'alt']
        }
      });

      // We'll statically render the cards, then use client-side JS to filter them
      const cardsHtml = recentSouls.map(soul => {
        const isGithub = soul.provider === 'github.com';
        const dotColor = isGithub ? 'bg-purple-500' : 'bg-orange-500';
        const providerName = isGithub ? 'GitHub' : soul.provider;
        const avatarUrl = isGithub
          ? `https://github.com/${soul.username}.png`
          : `https://ui-avatars.com/api/?name=${soul.username}&background=random&color=fff`;

        return `
        <a href="/soul/${soul.provider}/${soul.username}" class="soul-card flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/80 transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-purple-900/20 group" data-username="${soul.username.toLowerCase()}" data-provider="${soul.provider.toLowerCase()}">
          <img src="${avatarUrl}" alt="${soul.username}" class="w-14 h-14 rounded-full border border-zinc-700 group-hover:border-${isGithub ? 'purple' : 'orange'}-500/50 transition-colors" loading="lazy" />
          <div class="flex-1 min-w-0">
            <h3 class="text-white font-bold truncate text-lg group-hover:text-purple-300 transition-colors">${soul.username}</h3>
            <div class="flex items-center justify-between mt-1">
              <p class="text-xs text-zinc-400 flex items-center gap-1.5 truncate">
                <span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>
                ${providerName}
              </p>
              <p class="text-[10px] items-center gap-1 text-zinc-500 whitespace-nowrap hidden sm:flex">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                ${new Date(soul.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
        </a>
        `;
      }).join('');

      const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mirror | Apocalypse Radio</title>
  <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
  <script>
    tailwind.config = { darkMode: 'class', theme: { extend: {} } }
  </script>
  <style>
    body { background-color: black; color: white; min-height: 100vh; }
    .prose {
      --tw-prose-body: #d4d4d8; --tw-prose-headings: #fff;
      --tw-prose-links: #c084fc; --tw-prose-bold: #fff;
      --tw-prose-counters: #a1a1aa; --tw-prose-bullets: #52525b;
      --tw-prose-hr: #3f3f46; --tw-prose-quotes: #f4f4f5;
      --tw-prose-quote-borders: #3f3f46; --tw-prose-captions: #a1a1aa;
      --tw-prose-code: #fff; --tw-prose-pre-code: #e4e4e7;
      --tw-prose-pre-bg: #18181b; --tw-prose-th-borders: #52525b;
      --tw-prose-td-borders: #3f3f46;
    }
    .prose a:hover { color: #d8b4fe; }
  </style>
</head>
<body class="bg-black text-white antialiased selection:bg-purple-900 selection:text-white">
  
  <div class="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-80"></div>

  <main class="max-w-6xl mx-auto px-4 py-12 pb-24">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 mb-6 shadow-sm">
        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        Systems Online
      </div>
      <h1 class="text-5xl md:text-6xl font-bold mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-500">
        Apocalypse Mirror
      </h1>
      <p class="text-lg text-zinc-400 leading-relaxed font-light">
        A decentralized directory of cryptographically verified souls. Establish your presence by mirroring your digital identity.
      </p>
    </div>

    <div class="max-w-5xl mx-auto mb-16">
      <!-- Controls -->
      <div class="flex flex-col sm:flex-row gap-4 mb-8 bg-zinc-900/40 p-2 rounded-2xl border border-zinc-800/50 backdrop-blur-sm">
        <div class="relative flex-1">
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            id="searchInput" 
            placeholder="Search verified souls..." 
            class="w-full bg-transparent text-white pl-11 pr-4 py-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-purple-500 transition-shadow placeholder:text-zinc-600"
          />
        </div>
        <div class="w-px bg-zinc-800 hidden sm:block"></div>
        <select id="providerFilter" class="bg-transparent text-white px-4 py-3 sm:w-48 appearance-none border-none outline-none focus:ring-2 focus:ring-purple-500 transition-shadow rounded-xl cursor-pointer">
          <option value="all" class="bg-zinc-900">All Providers</option>
          <option value="github.com" class="bg-zinc-900">GitHub</option>
          <option value="gitlab.com" class="bg-zinc-900">GitLab</option>
        </select>
      </div>

      <!-- Grid -->
      <div id="soulsGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${cardsHtml || '<div class="col-span-full py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">No verified souls found yet.</div>'}
      </div>
      
      <div id="emptyState" class="hidden py-16 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl mt-4">
        No souls matching your filters.
      </div>
    </div>

    <div class="max-w-4xl mx-auto mt-24 pt-12 border-t border-zinc-800/50">
      <div class="prose prose-invert prose-zinc prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-a:text-purple-400 prose-a:no-underline hover:prose-a:text-purple-300 max-w-none">
        ${cleanReadmeHtml}
      </div>
    </div>
  </main>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const searchInput = document.getElementById('searchInput');
      const providerFilter = document.getElementById('providerFilter');
      const cards = document.querySelectorAll('.soul-card');
      const emptyState = document.getElementById('emptyState');

      function filterCards() {
        const query = searchInput.value.toLowerCase();
        const provider = providerFilter.value;
        let visibleCount = 0;

        cards.forEach(card => {
          const cardUsername = card.getAttribute('data-username');
          const cardProvider = card.getAttribute('data-provider');
          
          const matchesQuery = cardUsername.includes(query);
          const matchesProvider = provider === 'all' || cardProvider === provider;

          if (matchesQuery && matchesProvider) {
            card.style.display = 'flex';
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });

        if (visibleCount === 0 && cards.length > 0) {
          emptyState.classList.remove('hidden');
        } else {
          emptyState.classList.add('hidden');
        }
      }

      searchInput.addEventListener('input', filterCards);
      providerFilter.addEventListener('change', filterCards);
    });
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');
      return res.status(200).send(html);
    }

    if (parts.length < 3) {
      return res.status(404).send('Not Found')
    }

    const provider = parts[1] // Can be github.com, gitlab.com, gitlab.crux.casa, etc.
    const username = parts[2]

    // Auth Routes Native Handling
    if (provider === 'auth' && username === 'challenge' && req.method === 'GET') {
      const urlObj = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);
      const qProvider = urlObj.searchParams.get('provider');
      const qUsername = urlObj.searchParams.get('username');

      if (!qProvider || !qUsername) {
        return res.status(400).json({ error: 'provider and username are required' });
      }

      const { generateChallenge } = await import('../src/auth.js');
      const normalizedProvider = qProvider === 'github' ? 'github.com' : qProvider;
      const challenge = generateChallenge(normalizedProvider, qUsername);
      return res.status(200).json({ challenge });
    }

    if (provider === 'auth' && username === 'verify' && req.method === 'POST') {
      let body = req.body;
      // Depending on Vercel environment, req.body might already be parsed
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { }
      }

      const { provider: bodyProvider, username: bodyUsername, challenge, signature } = body || {};

      if (!bodyProvider || !bodyUsername || !challenge || !signature) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const normalizedProvider = bodyProvider === 'github' ? 'github.com' : bodyProvider;
      const { verifyChallenge, verifySignature } = await import('../src/auth.js');
      const { markVerified } = await import('../src/store.js');

      if (!verifyChallenge(challenge, normalizedProvider, bodyUsername)) {
        return res.status(400).json({ error: 'Invalid or expired challenge' });
      }

      let keysUrl = '';
      if (normalizedProvider === 'github.com') {
        keysUrl = `https://github.com/${bodyUsername}.keys`;
      } else {
        keysUrl = `https://${normalizedProvider}/${bodyUsername}.keys`;
      }

      const keysRes = await fetch(keysUrl);
      if (!keysRes.ok) {
        return res.status(404).json({ error: 'Could not fetch public keys for user' });
      }

      const keysText = await keysRes.text();
      const keys = keysText.split('\n').filter(k => k.trim().length > 0);

      if (keys.length === 0) {
        return res.status(404).json({ error: 'No public keys found for user' });
      }

      let isValid = false;
      for (const key of keys) {
        if (verifySignature(challenge, signature, key)) {
          isValid = true;
          break;
        }
      }

      if (!isValid) {
        return res.status(401).json({ error: 'Signature verification failed' });
      }

      await markVerified(normalizedProvider, bodyUsername);
      return res.status(200).json({ success: true, message: 'Identity verified' });
    }

    if (provider === 'github') return res.redirect('/soul/github.com/' + username)
    if (provider === 'gitlab') return res.redirect('/soul/gitlab.com/' + username)

    // Allow any .com, .org, .net, .casa etc
    if (!provider.includes('.')) {
      return res.status(404).send('Invalid Provider Hostname')
    }

    let markdownContent = ''
    let profileImageUrl = ''

    if (provider === 'github.com') {
      let r = await fetch(`https://raw.githubusercontent.com/${username}/${username}/main/README.md`)
      if (!r.ok) {
        r = await fetch(`https://raw.githubusercontent.com/${username}/${username}/master/README.md`)
      }
      if (r.ok) {
        markdownContent = await r.text()
      } else {
        return res.status(404).send('Profile not found on GitHub')
      }
    } else {
      // It's a gitlab instance (e.g. gitlab.com, gitlab.crux.casa)

      // 1. Fetch the user's HTML profile page to scrape their avatar using `og:image`
      try {
        const profileRes = await fetch(`https://${provider}/${username}`)
        if (profileRes.ok) {
          const htmlText = await profileRes.text()
          const match = htmlText.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
            htmlText.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i)
          if (match && match[1]) {
            profileImageUrl = match[1]
          }
        }
      } catch (err) {
        console.error('Failed to parse gitlab avatar', err)
      }

      // 2. Fetch the actual README
      let r = await fetch(`https://${provider}/${username}/${username}/-/raw/main/README.md`)
      if (!r.ok) {
        r = await fetch(`https://${provider}/${username}/${username}/-/raw/master/README.md`)
      }
      if (r.ok) {
        markdownContent = await r.text()
      } else {
        return res.status(404).send(`Profile not found on ${provider}`)
      }
    }

    // Rewrite relative image URLs to point to raw content on the provider
    let baseRawUrl = ''
    if (provider === 'github.com') {
      baseRawUrl = `https://raw.githubusercontent.com/${username}/${username}/main/`
    } else {
      baseRawUrl = `https://${provider}/${username}/${username}/-/raw/main/`
    }
    const rewrittenMarkdown = markdownContent.replace(
      /!\[([^\]]*)\]\((?!https?:\/\/|\/\/)([^)]+)\)/g,
      (_, alt, path) => `![${alt}](${baseRawUrl}${path})`
    )

    const rawHtml = await marked.parse(rewrittenMarkdown)
    const cleanHtml = sanitizeHtml(rawHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        '*': ['class', 'id'],
        'a': ['href', 'name', 'target', 'rel'],
        'img': ['src', 'alt']
      }
    })

    const isGithub = provider === 'github.com'
    const dotColor = isGithub ? 'bg-purple-500' : 'bg-orange-500'

    let avatarHtml = `<div class="w-20 h-20 rounded-full border-2 border-orange-500/50 bg-zinc-900 flex items-center justify-center shadow-lg shadow-orange-500/20"><span class="text-2xl font-bold text-zinc-500">${username.charAt(0).toUpperCase()}</span></div>`

    if (isGithub) {
      avatarHtml = `<img src="https://github.com/${username}.png" alt="${username}" class="w-20 h-20 rounded-full border-2 border-purple-500/50 shadow-lg shadow-purple-500/20" />`
    } else if (profileImageUrl) {
      avatarHtml = `<img src="${profileImageUrl}" alt="${username}" class="w-20 h-20 rounded-full border-2 border-orange-500/50 shadow-lg shadow-orange-500/20 object-cover" />`
    }

    const { getVerificationTime } = await import('../src/store.js');
    const normalizedProviderRaw = provider === 'github' ? 'github.com' : provider;
    const verifiedTime = await getVerificationTime(normalizedProviderRaw, username);

    let authSectionHtml = '';
    let nameHtml = username;

    if (verifiedTime) {
      nameHtml = `${username}
      <span class="bg-green-500/20 text-green-400 text-xs font-semibold px-2 py-1 rounded-full border border-green-500/30 flex items-center gap-1 shadow-sm shadow-green-500/10 cursor-help ml-3" title="Verified on: ${new Date(verifiedTime).toLocaleString()}">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Soul Verified
      </span>`;
    } else {
      authSectionHtml = `
      <div class="mt-4">
        <button id="auth-btn" class="bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-2 px-4 rounded-lg border border-zinc-700 transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          Authenticate Soul via SSH
        </button>
        <div id="auth-status" class="text-sm mt-3 text-zinc-400 hidden"></div>
      </div>
      <script>
        document.getElementById('auth-btn').addEventListener('click', async () => {
          const statusEl = document.getElementById('auth-status');
          const btn = document.getElementById('auth-btn');
          
          btn.disabled = true;
          btn.style.opacity = '0.5';
          statusEl.classList.remove('hidden');
          statusEl.innerHTML = '<span class="animate-pulse">Fetching cryptographic challenge...</span>';
          
          try {
            const provider = '${provider}';
            const username = '${username}';
            const res = await fetch(\`/api/auth/challenge?provider=\${provider}&username=\${username}\`);
            
            if (!res.ok) throw new Error('Challenge fetch failed');
            const data = await res.json();
            const challenge = data.challenge;
            
            statusEl.innerHTML = \`<div class="bg-zinc-900 border border-zinc-800 p-4 rounded-lg mt-2">
              <p class="mb-2 font-medium text-white">1. Save this challenge to a file:</p>
              <code class="block bg-black p-2 rounded text-xs break-all text-green-400 border border-zinc-800 select-all mb-3">\${challenge}</code>
              <p class="mb-2 font-medium text-white">2. Sign it using your SSH key:</p>
              <code class="block bg-black p-2 rounded text-xs break-all text-zinc-400 border border-zinc-800 select-all mb-3">ssh-keygen -Y sign -n file -f ~/.ssh/id_ed25519 challenge.txt</code>
              <p class="mb-2 font-medium text-white">3. Paste the generated Signature here:</p>
              <textarea id="sig-input" class="w-full bg-black border border-zinc-800 rounded p-2 text-xs text-white h-24 outline-none focus:border-purple-500 font-mono" placeholder="-----BEGIN SSH SIGNATURE-----\n..."></textarea>
              <button id="submit-sig" class="mt-4 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold py-1.5 px-4 rounded-md transition-colors w-full">Verify Signature</button>
            </div>\`;
            
            document.getElementById('submit-sig').addEventListener('click', async () => {
              const sig = document.getElementById('sig-input').value.trim();
              if (!sig) return alert('Please enter a signature');
              
              document.getElementById('submit-sig').innerText = 'Verifying...';
              document.getElementById('submit-sig').disabled = true;
              
              try {
                const vRes = await fetch('/api/auth/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ provider, username, challenge, signature: sig })
                });
                
                if (vRes.ok) {
                   statusEl.innerHTML = '<p class="text-green-400 font-medium">✓ Soul successfully verified. Reloading...</p>';
                   setTimeout(() => window.location.reload(), 1500);
                } else {
                   const errData = await vRes.json();
                   statusEl.innerHTML = \`<p class="text-red-400 font-medium">✗ Verification failed: \${errData.error}</p>\`;
                   btn.disabled = false;
                   btn.style.opacity = '1';
                }
              } catch (e) {
                 statusEl.innerHTML = '<p class="text-red-400 font-medium">✗ Network error during verification.</p>';
                 btn.disabled = false;
                 btn.style.opacity = '1';
              }
            });
            
          } catch (e) {
            statusEl.innerHTML = '<p class="text-red-400 font-medium">✗ Failed to initiate authentication.</p>';
            btn.disabled = false;
            btn.style.opacity = '1';
          }
        });
      </script>`;
    }

    const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${username} on Apocalypse Radio</title>
  <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
  <script>
    tailwind.config = { darkMode: 'class', theme: { extend: {} } }
  </script>
  <style>
    body { background-color: black; color: white; min-height: 100vh; }
    .prose {
      --tw-prose-body: #d4d4d8; --tw-prose-headings: #fff;
      --tw-prose-links: #c084fc; --tw-prose-bold: #fff;
      --tw-prose-counters: #a1a1aa; --tw-prose-bullets: #52525b;
      --tw-prose-hr: #3f3f46; --tw-prose-quotes: #f4f4f5;
      --tw-prose-quote-borders: #3f3f46; --tw-prose-captions: #a1a1aa;
      --tw-prose-code: #fff; --tw-prose-pre-code: #e4e4e7;
      --tw-prose-pre-bg: #18181b; --tw-prose-th-borders: #52525b;
      --tw-prose-td-borders: #3f3f46;
    }
    .prose a:hover { color: #d8b4fe; }
  </style>
</head>
<body>
  <main class="max-w-6xl mx-auto px-4 py-8 pb-24">
    <div class="max-w-4xl mx-auto py-12 px-4 shadow-xl shadow-purple-900/10 rounded-2xl border border-zinc-800/50 bg-black/40 backdrop-blur-md">
      <div class="mb-10 flex items-center gap-6 border-b border-zinc-800 pb-6">
        ${avatarHtml}
        <div class="flex-1">
          <h1 class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 flex items-center">
            ${nameHtml}
          </h1>
          <p class="text-zinc-400 capitalize flex items-center gap-2 mt-1">
            <span class="w-2 h-2 rounded-full ${dotColor} animate-pulse"></span>
            ${provider === 'github.com' ? 'GitHub' : provider} Soul Entity
          </p>
          ${authSectionHtml}
        </div>
      </div>
      <div class="prose prose-invert prose-zinc prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-a:text-purple-400 prose-a:no-underline hover:prose-a:text-purple-300 max-w-none">
        ${cleanHtml}
      </div>
    </div>
  </main>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate')
    return res.status(200).send(html)

  } catch (error) {
    console.error('Render error:', error)
    return res.status(500).send('Internal Server Error')
  }
}
