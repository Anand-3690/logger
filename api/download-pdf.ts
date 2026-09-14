export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let filename = 'document.pdf';
    let base64 = '';

    if (req.headers['content-type']?.includes('application/json')) {
      filename = req.body?.filename || filename;
      base64 = req.body?.base64 || '';
    } else if (typeof req.body === 'object') {
      filename = req.body?.filename || filename;
      base64 = req.body?.base64 || '';
    }

    if (!base64) {
      return res.status(400).json({ error: 'Missing base64 PDF payload' });
    }

    // Strip Data URI scheme if present
    if (base64.includes(',')) {
      base64 = base64.split(',')[1];
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const buffer = Buffer.from(base64, 'base64');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.status(200).send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to process PDF download' });
  }
}
