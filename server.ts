import express from 'express';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ override: true });

import { apiRouter } from './server/routes/api.js';
import { db } from './server/db/index.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // JSON and URL-encoded body parsers (with 50mb limit for spreadsheet buffers)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check endpoint (public, before auth)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // API Routes
  app.use('/api', apiRouter);

  // Boot-time reachability check (non-fatal warning so dev server never crashes at startup)
  try {
    await db.getAllCanonicalEntities('org_default');
    console.log('[Startup] Database reachable.');
  } catch (e: any) {
    console.warn('[Startup] Reachability check warning:', e);
  }

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Event Data Hub server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});

