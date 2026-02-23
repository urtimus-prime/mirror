import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import sanitizeHtml from 'sanitize-html'

marked.use(gfmHeadingId())

export default async function handler(req: any, res: any) {
    try {
        const urlStr = req.url || ''
        const parts = urlStr.split('?')[0].split('/').filter(Boolean)
        // Example: ['soul', 'github', 'voxxelle']

        if (parts.length < 3) {
            return res.status(404).send('Not Found')
        }

        const provider = parts[1]
        const username = parts[2]

        if (provider !== 'github' && provider !== 'gitlab') {
            return res.status(404).send('Not Found')
        }

        let markdownContent = ''

        if (provider === 'github') {
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
            let r = await fetch(`https://gitlab.com/${username}/${username}/-/raw/main/README.md`)
            if (!r.ok) {
                r = await fetch(`https://gitlab.com/${username}/${username}/-/raw/master/README.md`)
            }
            if (r.ok) {
                markdownContent = await r.text()
            } else {
                return res.status(404).send('Profile not found on GitLab')
            }
        }

        const rawHtml = await marked.parse(markdownContent)
        const cleanHtml = sanitizeHtml(rawHtml, {
            allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre']),
            allowedAttributes: {
                ...sanitizeHtml.defaults.allowedAttributes,
                '*': ['class', 'id'],
                'a': ['href', 'name', 'target', 'rel'],
                'img': ['src', 'alt']
            }
        })

        const dotColor = provider === 'github' ? 'bg-purple-500' : 'bg-orange-500'
        const avatarHtml = provider === 'github'
            ? `<img src="https://github.com/${username}.png" alt="${username}" class="w-20 h-20 rounded-full border-2 border-purple-500/50 shadow-lg shadow-purple-500/20" />`
            : `<div class="w-20 h-20 rounded-full border-2 border-orange-500/50 bg-zinc-900 flex items-center justify-center shadow-lg shadow-orange-500/20"><span class="text-2xl font-bold text-zinc-500">${username.charAt(0).toUpperCase()}</span></div>`

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
        <div>
          <h1 class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            ${username}
          </h1>
          <p class="text-zinc-400 capitalize flex items-center gap-2 mt-1">
            <span class="w-2 h-2 rounded-full ${dotColor} animate-pulse"></span>
            ${provider} Soul Entity
          </p>
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
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
        return res.status(200).send(html)

    } catch (error) {
        console.error('Render error:', error)
        return res.status(500).send('Internal Server Error')
    }
}
