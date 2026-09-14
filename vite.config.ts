import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'pdf-download-middleware',
        configureServer(server) {
          server.middlewares.use('/api/download-pdf', (req, res) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  let filename = 'document.pdf';
                  let base64 = '';

                  const contentType = req.headers['content-type'] || '';
                  if (contentType.includes('application/json')) {
                    const parsed = JSON.parse(body || '{}');
                    filename = parsed.filename || filename;
                    base64 = parsed.base64 || '';
                  } else {
                    const params = new URLSearchParams(body);
                    filename = params.get('filename') || filename;
                    base64 = params.get('base64') || '';
                  }

                  if (base64.includes(',')) {
                    base64 = base64.split(',')[1];
                  }

                  const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
                  const buffer = Buffer.from(base64, 'base64');

                  res.setHeader('Content-Type', 'application/pdf');
                  res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
                  res.setHeader('Content-Length', buffer.length);
                  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                  res.statusCode = 200;
                  res.end(buffer);
                } catch (e: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: e?.message || 'Download failed' }));
                }
              });
            } else {
              res.statusCode = 405;
              res.end('Method Not Allowed');
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
    },
    preview: {
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
    },
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('fflate') || id.includes('canvg')) {
                return 'vendor-pdf';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('dexie')) {
                return 'vendor-db';
              }
              if (id.includes('react') || id.includes('scheduler')) {
                return 'vendor-react';
              }
            }
          },
        },
      },
    },
  };
});
