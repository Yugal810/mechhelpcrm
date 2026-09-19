import { defineConfig, transformWithOxc } from 'vite'
import react from '@vitejs/plugin-react'

const jsxInJsPlugin = () => ({
  name: 'jsx-in-js-plugin',
  enforce: 'pre',
  async transform(code, id) {
    const cleanId = id.split('?')[0];
    if (cleanId.includes('/src/') && cleanId.endsWith('.js')) {
      return transformWithOxc(code, id, {
        lang: 'tsx',
        jsx: {
          runtime: 'automatic',
        },
      });
    }
  },
})

export default defineConfig({
  plugins: [
    jsxInJsPlugin(),
    react(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
