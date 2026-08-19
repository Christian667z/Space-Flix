/**
 * Middleware global de capture et gestion des erreurs Express
 * Renvoie un JSON propre { success: false, message: ... } au lieu de faire crasher le serveur Node.js
 */
export function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]', err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  const isApi = req.path.startsWith('/api/');

  if (isApi) {
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'Une erreur interne est survenue sur le serveur.',
      code: err.code || 'INTERNAL_SERVER_ERROR',
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }

  res.status(statusCode).send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Erreur - SpaceFlix</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #07090e; color: #fff; text-align: center; padding: 60px 20px; }
        h1 { color: #e50914; font-size: 28px; }
        p { color: #9ca3af; font-size: 16px; margin: 15px 0; }
        a { display: inline-block; margin-top: 20px; padding: 10px 24px; background: #e50914; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Erreur ${statusCode}</h1>
      <p>${err.message || 'Une erreur inattendue est survenue.'}</p>
      <a href="/">Retourner à l'accueil SpaceFlix</a>
    </body>
    </html>
  `);
}

/**
 * Middleware 404 pour les routes API inconnues
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `La route API demandée n'existe pas : ${req.method} ${req.originalUrl}`,
    path: req.originalUrl
  });
}
