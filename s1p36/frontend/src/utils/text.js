export function refreshHint() {
  const dev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  return dev
    ? 'In the backend folder run main.py and then export_for_frontend.py, then run npm run check in this folder.'
    : 'The analysis data for this section was not published with this site. Run the backend steps again and publish a new version.';
}
