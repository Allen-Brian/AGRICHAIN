// backend-server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { Client, PrivateKey, AccountId, TopicCreateTransaction, TopicMessageSubmitTransaction } = require('@hashgraph/sdk');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;
const baseUrl = process.env.EXPO_API_URL || Constants.expoConfig.extra.EXPO_API_URL;

// Sanity checks
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
  console.error('Missing Hedera creds in .env');
  process.exit(1);
}
if (!process.env.API_KEY) {
  console.error('Missing API_KEY in .env');
  process.exit(1);
}

// Supabase client (service role)
const supabase = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Node-fetch polyfill
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Hedera client
const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
const operatorKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);
const hederaNetwork = (process.env.HEDERA_NETWORK || 'testnet').toLowerCase();
const hederaClient = hederaNetwork === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
hederaClient.setOperator(operatorId, operatorKey);

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Simple API key middleware
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const key = req.header('x-api-key') || req.query.apiKey;
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid API key' });
  }
  next();
});

// Helpers
function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function getLatestTopicId() {
  try {
    const { data, error } = await supabase
      .from('hedera_topics')
      .select('topic_id')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0].topic_id;
  } catch (err) {
    console.error('getLatestTopicId error:', err);
    return null;
  }
}

async function persistTopic(topicId, memo = null) {
  try {
    await supabase.from('hedera_topics').insert([{ topic_id: topicId, memo }]);
    console.log('Persisted topic to Supabase:', topicId);
  } catch (err) {
    console.error('persistTopic error:', err);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    hederaNetwork,
    node: !!hederaClient ? 'connected' : 'not-connected'
  });
});

// Create Hedera topic
app.post('/api/hedera/create-topic', async (req, res) => {
  try {
    const memo = req.body.memo || 'Farmer Harvest Logs';
    const tx = await new TopicCreateTransaction().setTopicMemo(memo).execute(hederaClient);
    const receipt = await tx.getReceipt(hederaClient);
    const topicId = receipt.topicId.toString();
    await persistTopic(topicId, memo);
    res.json({ success: true, topicId, transactionId: tx.transactionId.toString(), status: receipt.status.toString() });
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({ success: false, error: error.message || error.toString() });
  }
});

// Submit harvest
app.post('/api/hedera/submit-harvest', async (req, res) => {
  try {
    const payload = req.body?.data;
    let topicId = req.body?.topicId;

    if (!payload || !payload.farmer_id || !payload.crop_type) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    if (!topicId) topicId = await getLatestTopicId();
    if (!topicId) return res.status(400).json({ success: false, error: 'No Hedera topic configured' });

    const canonical = {
      farmer_id: payload.farmer_id,
      crop_type: payload.crop_type,
      estimated_weight_kg: payload.estimated_weight_kg || null,
      gps_lat: payload.gps_lat || null,
      gps_long: payload.gps_long || null,
      photo_urls: payload.photo_urls || [],
      created_at: new Date().toISOString()
    };
    const canonicalJson = JSON.stringify(canonical);
    const hash = sha256Hex(canonicalJson);

    const messageObj = { type: 'harvest', hash, farmerId: canonical.farmer_id, cropType: canonical.crop_type, timestamp: canonical.created_at };
    const tx = await new TopicMessageSubmitTransaction({ topicId, message: JSON.stringify(messageObj) }).execute(hederaClient);
    const receipt = await tx.getReceipt(hederaClient);

    const harvestId = crypto.randomUUID();
    const insertRow = {
      farmer_id: canonical.farmer_id,
      crop_type: canonical.crop_type,
      estimated_weight_kg: canonical.estimated_weight_kg,
      photo_url: payload.photo_url || '',
      gps_lat: canonical.gps_lat,
      gps_long: canonical.gps_long,
      photo_urls: canonical.photo_urls || null,
      hedera_hash: hash,
      hedera_tx_id: tx.transactionId.toString(),
      harvest_id: harvestId,
      status: 'SUBMITTED'
    };

    const { data: inserted, error: insertErr } = await supabase.from('harvest_logs').insert([insertRow]).select().single();
    if (insertErr) return res.status(500).json({ success: false, error: insertErr.message || insertErr });

    const qrPayload = { harvestId, hash, topicId, farmerId: canonical.farmer_id, txId: tx.transactionId.toString() };
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload));

    await supabase.from('harvest_logs').update({ photo_urls: insertRow.photo_urls }).eq('harvest_id', harvestId);

    res.json({ success: true, harvestId, topicId, hash, hederaTxId: tx.transactionId.toString(), hederaStatus: receipt.status.toString(), qrDataUrl });
  } catch (error) {
    console.error('submit-harvest error:', error);
    res.status(500).json({ success: false, error: error.message || error.toString() });
  }
});

// Transport start
app.post('/api/transport/start', async (req, res) => {
  try {
    const { harvestId, transporter_id, pickup_location, delivery_location, scheduled_pickup_time, scheduled_delivery_time } = req.body;
    if (!harvestId || !transporter_id || !pickup_location || !delivery_location || !scheduled_pickup_time || !scheduled_delivery_time) {
      return res.status(400).json({ success: false, error: 'Missing required transport fields' });
    }

    const { data: harvest } = await supabase.from('harvest_logs').select('*').eq('harvest_id', harvestId).single();
    if (!harvest) return res.status(404).json({ success: false, error: 'Harvest not found' });

    const startTime = new Date().toISOString();
    const payload = { harvestId, transporter_id, pickup_location, delivery_location, scheduled_pickup_time, scheduled_delivery_time, startTime };
    const hash = sha256Hex(JSON.stringify(payload));
    const topicId = harvest.topic_id || await getLatestTopicId();

    const tx = await new TopicMessageSubmitTransaction({ topicId, message: JSON.stringify({ type: 'transport_start', hash, harvestId, transporter_id, timestamp: startTime }) }).execute(hederaClient);
    const receipt = await tx.getReceipt(hederaClient);

    const insertJob = {
      harvest_id: harvestId,
      transporter_id,
      pickup_location,
      delivery_location,
      scheduled_pickup_time,
      scheduled_delivery_time,
      actual_pickup_time: startTime,
      status: 'IN_TRANSIT',
      hedera_tx_id: tx.transactionId.toString()
    };

    const { data: newJob, error: jobErr } = await supabase.from('transport_jobs').insert([insertJob]).select().single();
    if (jobErr) return res.status(500).json({ success: false, error: jobErr.message || jobErr });

    await supabase.from('harvest_logs').update({ status: 'IN_TRANSIT' }).eq('harvest_id', harvestId);

    res.json({ success: true, transportJobId: newJob.job_id, hederaTxId: tx.transactionId.toString(), hederaStatus: receipt.status.toString(), hash });
  } catch (error) {
    console.error('transport/start error:', error);
    res.status(500).json({ success: false, error: error.message || error.toString() });
  }
});

// Transport complete
app.post('/api/transport/complete', async (req, res) => {
  try {
    const { transportJobId, actual_delivery_time } = req.body;
    if (!transportJobId || !actual_delivery_time) return res.status(400).json({ success: false, error: 'Missing required fields' });

    const { data: job } = await supabase.from('transport_jobs').select('*').eq('job_id', transportJobId).single();
    if (!job) return res.status(404).json({ success: false, error: 'Transport job not found' });

    const payload = { transportJobId, actual_delivery_time };
    const hash = sha256Hex(JSON.stringify(payload));
    const topicId = await getLatestTopicId();

    const tx = await new TopicMessageSubmitTransaction({ topicId, message: JSON.stringify({ type: 'transport_complete', hash, transportJobId, timestamp: actual_delivery_time }) }).execute(hederaClient);
    const receipt = await tx.getReceipt(hederaClient);

    await supabase.from('transport_jobs').update({ status: 'DELIVERED', actual_delivery_time, hedera_tx_id: tx.transactionId.toString() }).eq('job_id', transportJobId);
    await supabase.from('harvest_logs').update({ status: 'DELIVERED' }).eq('harvest_id', job.harvest_id);

    res.json({ success: true, transportJobId, hederaTxId: tx.transactionId.toString(), hederaStatus: receipt.status.toString(), hash });
  } catch (error) {
    console.error('transport/complete error:', error);
    res.status(500).json({ success: false, error: error.message || error.toString() });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Backend running on port ${port}`);
  console.log(`Health: GET http://172.20.10.12:${port}/health`);
  console.log(`Create topic: POST http://172.20.10.12:${port}/api/hedera/create-topic`);
  console.log(`Submit harvest: POST http://172.20.10.12:${port}/api/hedera/submit-harvest`);
  console.log(`Transport start: POST http://172.20.10.12:${port}/api/transport/start`);
  console.log(`Transport complete: POST http://172.20.10.12:${port}/api/transport/complete`);
});
