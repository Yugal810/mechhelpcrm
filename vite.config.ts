import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';
import path from 'path';

function backendPlugin() {
  let backendProcess: any = null;
  return {
    name: 'backend-plugin',
    configureServer() {
      if (!backendProcess) {
        const serverPath = path.resolve(__dirname, 'backend/src/server.js');
        backendProcess = spawn('node', [serverPath], {
          stdio: 'inherit',
          env: process.env,
        });

        process.on('exit', () => {
          if (backendProcess) backendProcess.kill();
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), backendPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
