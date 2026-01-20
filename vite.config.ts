import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 部署时使用仓库名作为 base path
  // 如果部署到自定义域名，可以改为 '/'
  base: process.env.NODE_ENV === 'production' ? '/solana-caller/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util'],
      globals: {
        Buffer: true,
      },
    }),
  ],
  define: {
    'process.env': {},
  },
})
