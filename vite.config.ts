import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 所有代码打成一个文件，体积略超默认的提醒线，对个人应用没有影响
  build: { chunkSizeWarningLimit: 800 },
  plugins: [
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
})
