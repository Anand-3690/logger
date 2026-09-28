import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
    const subscription = body.subscription;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription payload. Endpoint is required.' });
    }

    const endpoint = subscription.endpoint;
    // Generate deterministic ID from endpoint hash
    const subId = crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
    const subJson = typeof subscription === 'string' ? subscription : JSON.stringify(subscription);

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        id: subId,
        endpoint,
        subscription_json: subJson,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[Subscribe Error]:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Subscription registered successfully',
      id: subId,
    });
  } catch (err: any) {
    console.error('[Subscribe Handler Exception]:', err);
    return res.status(500).json({ error: err.message || 'Failed to process subscription' });
  }
}
