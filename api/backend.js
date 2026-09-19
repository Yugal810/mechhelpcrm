import mechHelpApp from '../MechHelp/backend/src/index.js';

export default function handler(req, res) {
  if (req.url.startsWith('/mechhelp')) {
    req.url = req.url.replace('/mechhelp', '');
  }
  return mechHelpApp(req, res);
}
