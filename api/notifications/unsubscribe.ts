import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://fgvngijqikcxdrjvdzfi.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_xlhoYm36tJin5GtwYc7c-A_MLAoq2lN'
);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const endpoint = body.endpoint;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required to unsubscribe.' });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      console.warn('[Unsubscribe Warning]:', error.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Unsubscribed successfully',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to unsubscribe' });
  }
}
