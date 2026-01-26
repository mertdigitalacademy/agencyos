import path from 'path';
import net from 'node:net';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const done = (inUse: boolean) => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(inUse);
    };

    socket.setTimeout(200);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', (err: any) => {
      if (err?.code === 'ECONNREFUSED') return done(false);
      return done(true);
    });

    socket.connect(port, '127.0.0.1');
  });
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const explicit = process.env.AGENCYOS_API_URL || env.AGENCYOS_API_URL;

  const apiUrl =
    explicit ||
    (await (async () => {
      const inUse = await isPortInUse(7000);
      return `http://localhost:${inUse ? 7001 : 7000}`;
    })());

  return {
    server: {
      port: 3050,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
