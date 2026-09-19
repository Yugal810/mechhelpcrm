const mechHelpApp = require('../MechHelp/backend/src/index.js');

// Vercel Serverless Function wrapper for the MechHelp Express backend
module.exports = (req, res) => {
  // Fix the URL path so the Express router matches correctly
  // Vercel might pass the full path /mechhelp/api/..., but Express expects the sub-route.
  // Actually, since we mount it on `/api/backend` via Vercel rewrites, Vercel passes the original URL.
  // The Express app inside MechHelp/backend/src/index.js defines routes directly (e.g., /cars).
  // When running locally, server.js mounts it at app.use('/mechhelp/api', mechHelpApp).
  // Wait, in server.js it is mounted at app.use('/mechhelp', mechHelpApp), 
  // and inside index.js the routes are `/api/cars`.
  // So the full path expected by index.js is `/api/cars`, but Vercel receives `/mechhelp/api/cars`.
  // We need to strip `/mechhelp` from the URL before passing to the Express app.
  
  if (req.url.startsWith('/mechhelp')) {
    req.url = req.url.replace('/mechhelp', '');
  }

  return mechHelpApp(req, res);
};
