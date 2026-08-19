/**
 * Middleware global de capture et gestion des erreurs Express
 */
export function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]', err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  const isApi = req.path.startsWith('/api/');

  if (isApi) {
    return res.status(statusCode).json({
      error: err.message || 'Erreur interne du serveur',
      code: err.code || 'INTERNAL_ERROR',
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }

  res.status(statusCode).send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <title>Erreur - SpaceFlix</title>
      <style>
        body { font-family: sans-serif; background: #0b0c10; color: #fff; text-align: center; padding: 50px; }
        h1 { color: #e50914; }
        a { color: #45f3ff; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>Oups ! Une erreur est survenue (${statusCode})</h1>
      <p>${err.message || 'Une erreur inattendue est survenue.'}</p>
      <p><a href="/">Retourner à l'accueil</a></p>
    </body>
    </html>
  `);
}

/**
 * Middleware 404 pour les routes API inconnues
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Endpoint API introuvable',
    method: req.method,
    path: req.originalUrl
  });
}
