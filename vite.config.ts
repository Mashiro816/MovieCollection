import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createTmdbHandler } from './server/tmdb-proxy.js'

/** 本地运行时没有 Vercel，由 Vite 的服务器代为处理 /api/tmdb。key 从 .env.local 读取，不会进入前端代码 */
function tmdbDevProxy(mode: string): Plugin {
  const handler = createTmdbHandler(() => ({ ...loadEnv(mode, process.cwd(), ''), ...process.env }))
  return {
    name: 'tmdb-dev-proxy',
    configureServer: (server) => void server.middlewares.use('/api/tmdb', handler),
    configurePreviewServer: (server) => void server.middlewares.use('/api/tmdb', handler),
  }
}

export default defineConfig(({ mode }) => ({
  // 所有代码打成一个文件，体积略超默认的提醒线，对个人应用没有影响
  build: { chunkSizeWarningLimit: 800 },
  plugins: [
    tmdbDevProxy(mode),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png'],
      manifest: {
        name: '午夜片单',
        short_name: '午夜片单',
        description: '记录看过和想看的恐怖电影',
        lang: 'zh-CN',
        display: 'standalone',
        background_color: '#0a090c',
        theme_color: '#0a090c',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        // 海报缓存到本地，断网时片单仍能显示
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/t/p/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'posters',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}))
