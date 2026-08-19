import express from 'express';
import crypto from 'crypto';
import { DB, persistDatabase } from '../db.js';

const router = express.Router();

router.post('/', (req, res) => {
  const { tmdb_id, media_title, server_name, server_index, error_type, details } = req.body;

  const report = {
    id: `rep_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    tmdb_id: tmdb_id || 'unknown',
    media_title: media_title || 'Titre inconnu',
    server_name: server_name || 'Serveur 1',
    server_index: Number(server_index || 0),
    error_type: error_type || 'broken_stream',
    details: details || 'Le flux vidéo ne charge pas',
    reportedAt: new Date().toISOString()
  };

  DB.reports.unshift(report);
  if (DB.reports.length > 200) DB.reports.pop();
  persistDatabase();

  console.log(`[RAPPORT SERVEUR] Signalement reçu pour "${report.media_title}" sur ${report.server_name}`);

  const fallbackIndex = (Number(server_index || 0) + 1) % 5;

  res.status(201).json({
    success: true,
    message: 'Merci ! Votre signalement a été enregistré. Basculement automatique suggéré.',
    reportId: report.id,
    recommendedServerIndex: fallbackIndex
  });
});

router.get('/list', (req, res) => {
  res.json({ reports: DB.reports.slice(0, 20), total: DB.reports.length });
});

export default router;
