import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'file-logger',
          configureServer(server) {
            const logsDir = path.resolve(__dirname, 'logs');
            if (!fs.existsSync(logsDir)) {
              fs.mkdirSync(logsDir, { recursive: true });
            }
            server.middlewares.use((req, res, next) => {
              if (req.method === 'POST' && req.url === '/__log') {
                let body = '';
                req.on('data', (chunk) => (body += chunk));
                req.on('end', () => {
                  try {
                    const payload = JSON.parse(body || '{}') as {
                      level?: string;
                      message?: string;
                      data?: any;
                      timestamp?: string;
                    };
                    const ts = payload.timestamp || new Date().toISOString();
                    const date = ts.slice(0, 10);
                    const file = path.resolve(logsDir, `${date}.log`);
                    const line =
                      `[${ts}] [${payload.level || 'INFO'}] ${payload.message || ''}` +
                      (payload.data !== undefined ? ` ${JSON.stringify(payload.data)}\n` : '\n');
                    fs.appendFile(file, line, () => {});
                    res.statusCode = 200;
                    res.end('ok');
                  } catch {
                    res.statusCode = 400;
                    res.end('bad request');
                  }
                });
                return;
              }
              next();
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
