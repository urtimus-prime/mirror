/** @jsxImportSource hono/jsx */

import { Hono } from 'hono'
import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import sanitizeHtml from 'sanitize-html'
import { Layout } from './components/Layout.js'

// Configure marked with GitHub Flavored Markdown heading IDs
marked.use(gfmHeadingId())

const app = new Hono()



app.get('/soul/:provider/:username', async (c) => {
    const provider = c.req.param('provider')
    const username = c.req.param('username')

    if (provider !== 'github' && provider !== 'gitlab') {
        return c.notFound()
    }

    let markdownContent = ''

    try {
        if (provider === 'github') {
            let res = await fetch(`https://raw.githubusercontent.com/${username}/${username}/main/README.md`)
            if (!res.ok) {
                res = await fetch(`https://raw.githubusercontent.com/${username}/${username}/master/README.md`)
            }
            if (res.ok) {
                markdownContent = await res.text()
            } else {
                return c.text('Profile not found', 404)
            }
        } else if (provider === 'gitlab') {
            let res = await fetch(`https://gitlab.com/${username}/${username}/-/raw/main/README.md`)
            if (!res.ok) {
                res = await fetch(`https://gitlab.com/${username}/${username}/-/raw/master/README.md`)
            }
            if (res.ok) {
                markdownContent = await res.text()
            } else {
                return c.text('Profile not found', 404)
            }
        }
    } catch (error) {
        console.error('Failed to fetch profile README:', error)
        return c.text('Failed to fetch profile', 500)
    }

    // Rewrite relative image/link URLs to point to raw GitHub/GitLab content
    const baseRawUrl = provider === 'github'
        ? `https://raw.githubusercontent.com/${username}/${username}/main/`
        : `https://gitlab.com/${username}/${username}/-/raw/main/`

    const rewrittenMarkdown = markdownContent.replace(
        /!\[([^\]]*)\]\((?!https?:\/\/|\/\/)([^)]+)\)/g,
        (_, alt, path) => `![${alt}](${baseRawUrl}${path})`
    )

    // Parse markdown securely
    const rawHtml = await marked.parse(rewrittenMarkdown)
    // We sanitize the parsed HTML to avoid XSS
    const cleanHtml = sanitizeHtml(rawHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre']),
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            '*': ['class', 'id'],
            'a': ['href', 'name', 'target'],
            'img': ['src', 'alt']
        }
    })

    const ProviderAvatar = () => {
        if (provider === 'github') {
            return (
                <img
                    src={`https://github.com/${username}.png`}
                    alt={username}
                    class="w-20 h-20 rounded-full border-2 border-purple-500/50 shadow-lg shadow-purple-500/20"
                />
            )
        } else {
            return (
                <div class="w-20 h-20 rounded-full border-2 border-orange-500/50 bg-zinc-900 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <span class="text-2xl font-bold text-zinc-500">{username.charAt(0).toUpperCase()}</span>
                </div>
            )
        }
    }

    return c.html(
        <Layout title={`${username} on Apocalypse Radio`}>
            <div class="max-w-4xl mx-auto py-12 px-4 shadow-xl shadow-purple-900/10 rounded-2xl border border-zinc-800/50 bg-black/40 backdrop-blur-md">
                <div class="mb-10 flex items-center gap-6 border-b border-zinc-800 pb-6">
                    <ProviderAvatar />
                    <div>
                        <h1 class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                            {username}
                        </h1>
                        <p class="text-zinc-400 capitalize flex items-center gap-2 mt-1">
                            <span class={`w-2 h-2 rounded-full ${provider === 'github' ? 'bg-purple-500' : 'bg-orange-500'} animate-pulse`}></span>
                            {provider} Soul Entity
                        </p>
                    </div>
                </div>

                <div
                    class="prose prose-invert prose-zinc prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-a:text-purple-400 prose-a:no-underline hover:prose-a:text-purple-300 max-w-none"
                    dangerouslySetInnerHTML={{ __html: cleanHtml }}
                />
            </div>
        </Layout>
    )
})

export default app
