import { html } from 'hono/html'

export const Layout = (props: { children: any; title: string }) => {
    return html`
    <!DOCTYPE html>
    <html lang="en" class="dark">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${props.title}</title>
        <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
        <script>
          tailwind.config = {
            darkMode: 'class',
            theme: {
              extend: {}
            }
          }
        </script>
        <style>
          body {
            background-color: black;
            color: white;
            min-height: 100vh;
          }
          /* Custom typography overrides to match Next.js original */
          .prose {
             --tw-prose-body: #d4d4d8;
             --tw-prose-headings: #fff;
             --tw-prose-links: #c084fc;
             --tw-prose-bold: #fff;
             --tw-prose-counters: #a1a1aa;
             --tw-prose-bullets: #52525b;
             --tw-prose-hr: #3f3f46;
             --tw-prose-quotes: #f4f4f5;
             --tw-prose-quote-borders: #3f3f46;
             --tw-prose-captions: #a1a1aa;
             --tw-prose-code: #fff;
             --tw-prose-pre-code: #e4e4e7;
             --tw-prose-pre-bg: #18181b;
             --tw-prose-th-borders: #52525b;
             --tw-prose-td-borders: #3f3f46;
          }
          .prose a:hover {
            color: #d8b4fe;
          }
        </style>
      </head>
      <body>
        <main class="max-w-6xl mx-auto px-4 py-8 pb-24">
          ${props.children}
        </main>
      </body>
    </html>
  `
}
