import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** На Windows `localhost` иногда резолвится в IPv6 (::1), а Nest слушает только IPv4 — тогда прокси даёт ECONNREFUSED. */
const defaultApiTarget = 'http://127.0.0.1:3000';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || defaultApiTarget;

  return {
    plugins: [
      react(),
      {
        name: 'grandastra-api-proxy-hint',
        configureServer(server) {
          server.httpServer?.once('listening', () => {
            // eslint-disable-next-line no-console
            console.log(`\n  [Grand Astra] Прокси /api → ${apiTarget}`);
            // eslint-disable-next-line no-console
            console.log(
              '  [Grand Astra] Запустите API в другом терминале из корня репозитория: npm run dev -w @grandastra/api',
            );
            // eslint-disable-next-line no-console
            console.log('  [Grand Astra] Или оба сразу: npm run dev\n');
          });
        },
      },
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
