/**
 * GIC Backend — Phase 2 Mock API
 * Node.js + Express — no real DB yet, all mock data
 * Run: node server.js
 */

require('dotenv').config(); // loads .env — never commit .env

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── MOCK DATA STORE (in-memory) ───
const store = {
  workers: [
    {
      id: 'W-2947',
      name: 'Ravi Kumar',
      phone: '+91 98765 43210',
      platform: 'swiggy',
      workerId: 'SWY-2947583',
      zone: 'adyar',
      zoneId: 14,
      upi: 'ravi@upi',
      activeDays: 12,
      joinDate: '2026-03-03',
      coverageStatus: 'active',
      baselineEarnings: { lunch: 175, dinner: 310, avg_orders_per_hr: 7.2 },
      streak: 4,
      riskTier: 'medium',
      policyStart: '2026-03-04',
    },
  ],

  policies: [
    {
      id: 'POL-2026-00001',
      workerId: 'W-2947',
      weekStart: '2026-03-31',
      weekEnd: '2026-04-06',
      premium: 83,
      premiumBreakdown: {
        base: 79,
        zoneAdj: 12,
        streakDiscount: -16,
        forecastSurcharge: 8,
      },
      status: 'active',
      windows: [
        { type: 'lunch', start: '12:00', end: '14:00' },
        { type: 'dinner', start: '19:00', end: '22:00' },
      ],
    },
  ],

  claims: [
    { id: 'CLM-001', workerId: 'W-2947', date: '2026-03-31', shift: 'Dinner', trigger: 'Rain', amount: 310, status: 'paid', payoutTime: 4, upi: 'ravi@upi' },
    { id: 'CLM-002', workerId: 'W-2947', date: '2026-03-14', shift: 'Lunch', trigger: 'AQI', amount: 190, status: 'paid', payoutTime: 3, upi: 'ravi@upi' },
    { id: 'CLM-003', workerId: 'W-2947', date: '2026-03-02', shift: 'Dinner', trigger: 'Rain', amount: 280, status: 'paid', payoutTime: 5, upi: 'ravi@upi' },
  ],

  zones: {
    adyar: { id: 14, name: 'Adyar', city: 'Chennai', riskLevel: 'high', lat: 13.0012, lon: 80.2565, activeWorkers: 847 },
    tnagar: { id: 8, name: 'T. Nagar', city: 'Chennai', riskLevel: 'low', lat: 13.0418, lon: 80.2341, activeWorkers: 1203 },
    mylapore: { id: 11, name: 'Mylapore', city: 'Chennai', riskLevel: 'low', lat: 13.0368, lon: 80.2676, activeWorkers: 634 },
    velachery: { id: 19, name: 'Velachery', city: 'Chennai', riskLevel: 'critical', lat: 12.9815, lon: 80.2209, activeWorkers: 421 },
    guindy: { id: 7, name: 'Guindy', city: 'Chennai', riskLevel: 'medium', lat: 13.0057, lon: 80.2206, activeWorkers: 556 },
    egmore: { id: 3, name: 'Egmore', city: 'Chennai', riskLevel: 'low', lat: 13.0732, lon: 80.2609, activeWorkers: 892 },
  },

  fraudFlags: [
    { id: 'FF-001', workerId: 'W-2947-clone', zone: 'adyar', shift: 'dinner', type: 'soft', reason: 'Zone activity: 6.2 orders/hr (near-normal). Worker: 0 orders/hr.', status: 'reviewing' },
    { id: 'FF-002', workerId: 'W-3812', zone: 'adyar', shift: 'lunch', type: 'soft', reason: 'Worker GPS inconsistent with claimed zone.', status: 'reviewing' },
    { id: 'FF-003', workerId: 'W-1055', zone: 'guindy', shift: 'dinner', type: 'hard', reason: 'GPS spoofing detected. Zone mismatch confirmed.', status: 'flagged' },
    { id: 'FF-004', workerId: 'W-4421', zone: 'tnagar', shift: 'lunch', type: 'clear', reason: 'Legitimate zone disruption confirmed by peer data.', status: 'cleared' },
    { id: 'FF-005', workerId: 'W-2108', zone: 'velachery', shift: 'dinner', type: 'hard', reason: 'Duplicate claim for same event window.', status: 'flagged' },
  ],

  adminStats: {
    activePolicies: 2847,
    weeklyGPW: 224913,
    avgPremium: 79,
    currentBCR: 0.62,
    totalPayoutsThisWeek: 48,
    totalPayoutAmount: 14880,
    avgPayoutTime: 3.8,
    failedTransfers: 2,
    fraudFlagsActive: 7,
    zonePoolBCR: { adyar: 0.68, tnagar: 0.52, velachery: 0.84, guindy: 0.61, mylapore: 0.55, egmore: 0.48 },
  },
};

// Mock live weather data (cycles through states to simulate live)
let weatherCycleIdx = 0;
const weatherStates = [
  { rainfall_mm_hr: 4.2, temp_c: 31, aqi: 87, zone_status: 'open', trigger_state: 'normal' },
  { rainfall_mm_hr: 10.8, temp_c: 31, aqi: 90, zone_status: 'open', trigger_state: 'approaching' },
  { rainfall_mm_hr: 13.1, temp_c: 31, aqi: 92, zone_status: 'open', trigger_state: 'approaching' },
  { rainfall_mm_hr: 19.2, temp_c: 30, aqi: 95, zone_status: 'open', trigger_state: 'triggered' },
  { rainfall_mm_hr: 21.0, temp_c: 30, aqi: 98, zone_status: 'open', trigger_state: 'triggered' },
  { rainfall_mm_hr: 8.3, temp_c: 32, aqi: 88, zone_status: 'open', trigger_state: 'normal' },
];

setInterval(() => { weatherCycleIdx = (weatherCycleIdx + 1) % weatherStates.length; }, 30000);

// ─── HELPER ───
function calcPremium(zone, streak, forecastRisk) {
  const base = 79;
  const zoneAdj = { low: -10, medium: 0, high: 12, critical: 20 }[zone] || 0;
  const streakDisc = [8, 4, 2, 0, -8, -12, -16, -18][Math.min(streak, 7)] || 0;
  const forecastAdj = forecastRisk ? 12 : -8;
  const premium = Math.max(49, Math.min(149, base + zoneAdj + streakDisc + forecastAdj));
  return { premium, base, zoneAdj, streakDisc, forecastAdj };
}

function calcPayout(rainfall, activityDrop, baselineEarnings) {
  const intensity = Math.min((rainfall - 15) / 15, 1); // 0 to 1
  const severityMultiplier = 0.6 + (intensity * 0.4); // 0.6 to 1.0
  const payout = Math.round(baselineEarnings * severityMultiplier);
  return Math.max(100, Math.min(500, payout));
}

// ─── ROUTES ───

// Config — serves non-secret env vars to the frontend
// RAZORPAY_KEY_ID is a public client-side key (by Razorpay's design)
// RAZORPAY_KEY_SECRET is never sent here — stays server-side only
app.get('/api/config', (req, res) => {
  res.json({
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0', phase: 2, timestamp: new Date().toISOString() });
});

// --- Auth ---
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  res.json({ success: true, message: 'OTP sent', otp_length: 6, expires_in: 300, demo_note: 'Any 6 digits work in demo mode' });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp || otp.length !== 6) return res.status(400).json({ error: 'Invalid OTP' });
  
  const existing = store.workers.find(w => w.phone === phone);
  if (existing) {
    return res.json({ success: true, new_user: false, worker: existing, token: 'mock_token_' + existing.id });
  }
  res.json({ success: true, new_user: true, token: 'mock_token_new', message: 'New user — complete registration' });
});

app.post('/api/auth/register', (req, res) => {
  const { name, platform, worker_id, zone, upi, token } = req.body;
  if (!name || !platform || !upi) return res.status(400).json({ error: 'Name, platform, and UPI required' });

  const id = 'W-' + Math.floor(1000 + Math.random() * 9000);
  const zoneKey = zone || 'adyar';
  const zoneInfo = store.zones[zoneKey] || store.zones.adyar;
  const premCalc = calcPremium(zoneInfo.riskLevel, 0, false);

  const newWorker = {
    id,
    name,
    platform,
    workerId: worker_id || platform.toUpperCase().slice(0,3) + '-' + id,
    zone: zoneKey,
    zoneId: zoneInfo.id,
    upi,
    activeDays: 0,
    joinDate: new Date().toISOString().split('T')[0],
    coverageStatus: 'building_baseline',
    baselineEarnings: { lunch: 150, dinner: 280, avg_orders_per_hr: 6.0 },
    streak: 0,
    riskTier: zoneInfo.riskLevel,
    policyStart: new Date().toISOString().split('T')[0],
  };

  store.workers.push(newWorker);

  const policy = {
    id: 'POL-' + Date.now(),
    workerId: id,
    weekStart: new Date().toISOString().split('T')[0],
    weekEnd: new Date(Date.now() + 7*86400000).toISOString().split('T')[0],
    premium: premCalc.premium,
    premiumBreakdown: { base: premCalc.base, zoneAdj: premCalc.zoneAdj, streakDiscount: premCalc.streakDisc, forecastSurcharge: premCalc.forecastAdj },
    status: 'active',
    windows: [
      { type: 'lunch', start: '12:00', end: '14:00' },
      { type: 'dinner', start: '19:00', end: '22:00' },
    ],
  };
  store.policies.push(policy);

  res.status(201).json({ success: true, worker: newWorker, policy, token: 'mock_token_' + id, message: 'Coverage activated! Building earnings baseline for 7 days.' });
});

// --- Worker ---
app.get('/api/worker/:id', (req, res) => {
  const w = store.workers.find(w => w.id === req.params.id);
  if (!w) return res.status(404).json({ error: 'Worker not found' });
  res.json(w);
});

app.get('/api/worker/:id/policy', (req, res) => {
  const p = store.policies.find(p => p.workerId === req.params.id && p.status === 'active');
  if (!p) return res.status(404).json({ error: 'No active policy' });
  res.json(p);
});

app.get('/api/worker/:id/claims', (req, res) => {
  const claims = store.claims.filter(c => c.workerId === req.params.id);
  res.json({ claims, total: claims.length, total_amount: claims.reduce((s,c) => s+c.amount, 0) });
});

// --- Triggers / Live Conditions ---
app.get('/api/zone/:zoneKey/conditions', (req, res) => {
  const zone = store.zones[req.params.zoneKey];
  if (!zone) return res.status(404).json({ error: 'Zone not found' });
  
  const weather = weatherStates[weatherCycleIdx];
  const thresholds = {
    rainfall: { value: weather.rainfall_mm_hr, threshold: 15, met: weather.rainfall_mm_hr >= 15, unit: 'mm/hr' },
    temperature: { value: weather.temp_c, threshold: 42, met: weather.temp_c >= 42, unit: '°C' },
    aqi: { value: weather.aqi, threshold: 300, met: weather.aqi >= 300, unit: 'AQI' },
    zone_closure: { value: 0, threshold: 1, met: false, unit: 'closures' },
  };

  res.json({
    zone,
    conditions: thresholds,
    trigger_state: weather.trigger_state,
    any_trigger_met: Object.values(thresholds).some(t => t.met),
    all_triggers_met: weather.rainfall_mm_hr >= 15,
    last_updated: new Date().toISOString(),
    next_refresh_in_sec: 300,
  });
});

// --- Covered check ---
app.post('/api/worker/:id/covered-check', (req, res) => {
  const worker = store.workers.find(w => w.id === req.params.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  const weather = weatherStates[weatherCycleIdx];
  const rainMet = weather.rainfall_mm_hr >= 15;
  const activityDrop = rainMet ? (Math.random() > 0.3 ? 2.5 : 0.8) : 0.4; // simulate
  const dropMet = activityDrop >= 1.5;

  let status, message, estimated_payout = null;
  if (rainMet && dropMet) {
    status = 'covered';
    message = 'Both conditions met — payout initiating.';
    estimated_payout = calcPayout(weather.rainfall_mm_hr, activityDrop, worker.baselineEarnings.dinner);
  } else if (rainMet) {
    status = 'monitoring';
    message = `External trigger met (${weather.rainfall_mm_hr}mm/hr). Waiting for activity drop confirmation.`;
  } else if (weather.rainfall_mm_hr >= 10) {
    status = 'approaching';
    message = `Rainfall ${weather.rainfall_mm_hr}mm/hr — ${(15 - weather.rainfall_mm_hr).toFixed(1)}mm/hr from threshold.`;
  } else {
    status = 'clear';
    message = 'No disruption active in your zone. Keep working.';
  }

  res.json({ status, message, estimated_payout, rainfall: weather.rainfall_mm_hr, activity_drop_sigma: activityDrop });
});

// --- AI Premium Engine ---
app.post('/api/ai/calculate-premium', (req, res) => {
  const { zone, streak, forecast_risk, city } = req.body;
  if (!zone) return res.status(400).json({ error: 'Zone required' });

  const result = calcPremium(zone, streak || 0, forecast_risk || false);

  res.json({
    ai_engine: 'AI-1 Premium Engine v2.0',
    input: { zone, streak, forecast_risk, city },
    output: {
      weekly_premium_inr: result.premium,
      breakdown: {
        base_premium: result.base,
        zone_adjustment: result.zoneAdj,
        streak_discount: result.streakDisc,
        forecast_surcharge: result.forecastAdj,
      },
      floor: 49,
      ceiling: 149,
      bcr_target: '0.55–0.70',
      risk_tier: zone === 'high' || zone === 'critical' ? 'high' : zone === 'low' ? 'low' : 'medium',
    },
    next_recalculation: 'Sunday midnight IST',
  });
});

// --- Claims (automated trigger) ---
app.post('/api/claims/trigger-check', (req, res) => {
  const { worker_id, zone, shift_type } = req.body;
  const worker = store.workers.find(w => w.id === worker_id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  const weather = weatherStates[weatherCycleIdx];
  const rainMet = weather.rainfall_mm_hr >= 15;
  const activityDrop = 2.3;
  const dropMet = activityDrop >= 1.5;

  if (!rainMet || !dropMet) {
    return res.json({ triggered: false, reason: 'Conditions not met', rainfall: weather.rainfall_mm_hr, activity_drop: activityDrop });
  }

  // AI-3 Peer comparison
  const zoneWorkers = store.zones[worker.zone]?.activeWorkers || 500;
  const peerActivityDrop = 0.54; // 54% zone-wide drop — genuine disruption
  const ai3_approved = peerActivityDrop > 0.3; // zone genuinely disrupted

  if (!ai3_approved) {
    return res.json({ triggered: false, ai3_flag: 'soft', reason: 'Worker behavior inconsistent with zone peers — entering 2hr grace review' });
  }

  const baseline = shift_type === 'lunch' ? worker.baselineEarnings.lunch : worker.baselineEarnings.dinner;
  const payout = calcPayout(weather.rainfall_mm_hr, activityDrop, baseline);

  const claim = {
    id: 'CLM-' + Date.now(),
    workerId: worker_id,
    date: new Date().toISOString().split('T')[0],
    shift: shift_type === 'lunch' ? 'Lunch' : 'Dinner',
    trigger: 'Rain',
    amount: payout,
    status: 'processing',
    ai1_approved: true,
    ai2_calculated: payout,
    ai3_approved: ai3_approved,
    upi: worker.upi,
    initiated_at: new Date().toISOString(),
  };

  store.claims.push(claim);

  setTimeout(() => {
    claim.status = 'paid';
    claim.completed_at = new Date().toISOString();
  }, 10000); // 10s for demo (would be 4min real)

  res.json({
    triggered: true,
    claim,
    message: `₹${payout} transfer initiated to ${worker.upi}`,
    ai_chain: {
      ai1: 'Worker eligible — policy active ✓',
      ai2: `Payout calculated: ₹${payout} ✓`,
      ai3: `Zone-wide activity drop ${(peerActivityDrop*100).toFixed(0)}% — disruption confirmed ✓`,
    },
    estimated_transfer_minutes: 4,
  });
});

app.get('/api/claims/:claimId', (req, res) => {
  const claim = store.claims.find(c => c.id === req.params.claimId);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  res.json(claim);
});

// --- Fraud flags ---
app.get('/api/admin/fraud-flags', (req, res) => {
  res.json({ flags: store.fraudFlags, total: store.fraudFlags.length });
});

app.post('/api/admin/fraud-flags/:id/resolve', (req, res) => {
  const flag = store.fraudFlags.find(f => f.id === req.params.id);
  if (!flag) return res.status(404).json({ error: 'Flag not found' });
  flag.status = req.body.action === 'clear' ? 'cleared' : 'rejected';
  flag.resolved_at = new Date().toISOString();
  res.json({ success: true, flag });
});

// --- Admin dashboard ---
app.get('/api/admin/stats', (req, res) => {
  const stats = { ...store.adminStats };
  stats.activePolicies += Math.floor(Math.random() * 5);
  stats.weeklyGPW = stats.activePolicies * 79;
  res.json(stats);
});

app.get('/api/admin/zones', (req, res) => {
  const weather = weatherStates[weatherCycleIdx];
  const zones = Object.entries(store.zones).map(([key, zone]) => ({
    ...zone,
    key,
    current_rainfall: zone.id === 14 ? weather.rainfall_mm_hr : Math.random() * 10,
    bcr: store.adminStats.zonePoolBCR[key] || 0.60,
    new_enrollments_this_week: Math.floor(10 + Math.random() * 50),
  }));
  res.json({ zones });
});

// --- 7-day forecast ---
app.get('/api/zone/:zoneKey/forecast', (req, res) => {
  const riskLevels = ['low','low','high','high','medium','low','low'];
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const forecast = days.map((day, i) => ({
    day,
    date: new Date(Date.now() + i*86400000).toISOString().split('T')[0],
    risk_level: riskLevels[i],
    expected_rainfall_mm_hr: riskLevels[i]==='high' ? 18+Math.random()*5 : riskLevels[i]==='medium' ? 8+Math.random()*5 : Math.random()*6,
    estimated_payout_if_triggered: riskLevels[i]==='high' ? 310 : null,
  }));
  res.json({ zone: req.params.zoneKey, forecast });
});

// --- Safe choice alerts ---
app.get('/api/worker/:id/safe-choice', (req, res) => {
  res.json({
    alert: true,
    message: 'Heavy rain forecast tomorrow 7–10 PM in your zone. Your dinner window is covered.',
    estimated_payout: 310,
    forecast_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    action_needed: false,
    premium_impact: '−₹5 next week (clean week discount still applies)',
  });
});

// ─── START ───
app.listen(PORT, () => {
  console.log(`\n🏦 GIC Backend — Phase 2 Mock API`);
  console.log(`📡 Running on http://localhost:${PORT}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`  POST /api/auth/send-otp`);
  console.log(`  POST /api/auth/verify-otp`);
  console.log(`  POST /api/auth/register`);
  console.log(`  GET  /api/worker/:id`);
  console.log(`  GET  /api/worker/:id/policy`);
  console.log(`  GET  /api/worker/:id/claims`);
  console.log(`  POST /api/worker/:id/covered-check`);
  console.log(`  GET  /api/zone/:key/conditions`);
  console.log(`  GET  /api/zone/:key/forecast`);
  console.log(`  GET  /api/worker/:id/safe-choice`);
  console.log(`  POST /api/ai/calculate-premium`);
  console.log(`  POST /api/claims/trigger-check`);
  console.log(`  GET  /api/admin/stats`);
  console.log(`  GET  /api/admin/fraud-flags`);
  console.log(`  GET  /api/admin/zones`);
  console.log(`\n💡 Demo worker: W-2947 (Ravi Kumar)`);
  console.log(`🔑 Auth: any 6-digit OTP works in demo mode\n`);
});
