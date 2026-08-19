import express from 'express';
import { DB, CACHE_STORE } from '../db.js';
import { isSupabaseConfigured } from '../config/supabase.js';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SpaceFlix API',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    supabaseConfigured: isSupabaseConfigured(),
    database: {
      usersCount: DB.users.size,
      activeSessions: DB.sessions.size,
      reportsCount: DB.reports.length
    }
  });
});

router.get('/cache/stats', (req, res) => {
  res.json({
    totalEntries: CACHE_STORE.size,
    uptimeSeconds: Math.round(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  });
});

export default router;
