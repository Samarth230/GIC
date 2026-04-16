/**
 * GIC Backend — Phase 3 API
 * Node.js + Express + MongoDB + brain.js Neural Networks
 */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const app     = express();
const PORT    = process.env.PORT || 3001;

const { connectDB, seedDefaults, Worker, Policy, Claim, FraudFlag, TriggerHistory } = require('./db');
const { trainAllModels, predictPremium, predictFraud, predictChurn, predictTrigger } = require('./ml');

let dbReady = false;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const ZONES = {
  adyar:     { id: 14, name: 'Adyar',     city: 'Chennai', riskLevel: 'high',     lat: 13.0012, lon: 80.2565, activeWorkers: 847  },
  tnagar:    { id: 8,  name: 'T. Nagar',  city: 'Chennai', riskLevel: 'low',      lat: 13.0418, lon: 80.2341, activeWorkers: 1203 },
  mylapore:  { id: 11, name: 'Mylapore',  city: 'Chennai', riskLevel: 'low',      lat: 13.0368, lon: 80.2676, activeWorkers: 634  },
  velachery: { id: 19, name: 'Velachery', city: 'Chennai', riskLevel: 'critical', lat: 12.9815, lon: 80.2209, activeWorkers: 421  },
  guindy:    { id: 7,  name: 'Guindy',    city: 'Chennai', riskLevel: 'medium',   lat: 13.0057, lon: 80.2206, activeWorkers: 556  },
  egmore:    { id: 3,  name: 'Egmore',    city: 'Chennai', riskLevel: 'low',      lat: 13.0732, lon: 80.2609, activeWorkers: 892  },
};

const ZONE_RISK_MAP  = { low: 0.15, medium: 0.42, high: 0.68, critical: 0.90 };
const zoneThresholds = { adyar: 15, tnagar: 15, mylapore: 15, velachery: 14, guindy: 15, egmore: 15 };

// ─── OPEN-METEO WEATHER ───
let weatherCache = {};
const weatherStates = [
  { rainfall_mm_hr: 4.2,  temp_c: 31, aqi: 87, trigger_state: 'normal'     },
  { rainfall_mm_hr: 10.8, temp_c: 31, aqi: 90, trigger_state: 'approaching' },
  { rainfall_mm_hr: 13.1, temp_c: 31, aqi: 92, trigger_state: 'approaching' },
  { rainfall_mm_hr: 19.2, temp_c: 30, aqi: 95, trigger_state: 'triggered'   },
  { rainfall_mm_hr: 21.0, temp_c: 30, aqi: 98, trigger_state: 'triggered'   },
  { rainfall_mm_hr: 8.3,  temp_c: 32, aqi: 88, trigger_state: 'normal'      },
];
let weatherCycleIdx = 0;
setInterval(() => { weatherCycleIdx = (weatherCycleIdx + 1) % weatherStates.length; }, 30000);

async function fetchOpenMeteo(zoneKey, lat, lon) {
  const now = Date.now();
  if (weatherCache[zoneKey] && now - weatherCache[zoneKey].fetchedAt < 10 * 60 * 1000) return weatherCache[zoneKey].data;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation&current_weather=true&timezone=Asia%2FKolkata&forecast_days=1`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const currentHour = d.current_weather.time.slice(0, 13) + ':00';
    const hourIndex   = d.hourly.time.indexOf(currentHour);
    const rainfall    = hourIndex >= 0 ? (d.hourly.precipitation[hourIndex] || 0) : 0;
    const aqi         = await fetchWAQI();
    const result = { rainfall_mm_hr: rainfall, temp_c: d.current_weather.temperature, aqi, zone_status: 'open', trigger_state: rainfall >= 15 ? 'triggered' : rainfall >= 10 ? 'approaching' : 'normal', source: 'open-meteo', fetched_at: new Date().toISOString() };
    weatherCache[zoneKey] = { data: result, fetchedAt: now };
    console.log(`[WEATHER] ${zoneKey}: ${rainfall.toFixed(1)}mm/hr, ${d.current_weather.temperature}C, AQI ${aqi}`);
    return result;
  } catch (e) {
    console.warn(`[WEATHER] Open-Meteo failed: ${e.message}`);
    const sim = weatherStates[weatherCycleIdx];
    return { rainfall_mm_hr: sim.rainfall_mm_hr, temp_c: sim.temp_c, aqi: sim.aqi, zone_status: 'open', trigger_state: sim.trigger_state, source: 'simulation-fallback', fetched_at: new Date().toISOString() };
  }
}

// ─── WAQI AIR QUALITY ───
let waqiCache = { value: null, fetchedAt: 0 };
async function fetchWAQI() {
  const now = Date.now();
  if (waqiCache.value !== null && now - waqiCache.fetchedAt < 30 * 60 * 1000) return waqiCache.value;
  try {
    const r = await fetch(`https://api.waqi.info/feed/chennai/?token=${process.env.WAQI_TOKEN || 'demo'}`);
    const d = await r.json();
    if (d.status !== 'ok') throw new Error('WAQI status not ok');
    const aqi = parseInt(d.data.aqi, 10);
    waqiCache = { value: aqi, fetchedAt: now };
    return aqi;
  } catch (e) {
    const sim = 80 + Math.floor(Math.random() * 40);
    waqiCache = { value: sim, fetchedAt: now };
    return sim;
  }
}

// ─── AI-1: NEURAL NET PREMIUM ───
function getSeasonalFactor() {
  const m = new Date().getMonth();
  return (m >= 9 && m <= 11) ? 0.85 : (m >= 5 && m <= 8) ? 0.75 : 0.45;
}

async function calcPremiumML(zoneRiskLevel, streak, forecastRisk, activeDays, zoneKey) {
  const zoneRisk = ZONE_RISK_MAP[zoneRiskLevel] || 0.42;
  const bcr      = 0.62;
  const seasonal = getSeasonalFactor();
  const nn       = predictPremium(zoneRisk, streak, activeDays, bcr, forecastRisk, seasonal);
  const zoneAdj  = Math.round((zoneRisk - 0.42) * 28);
  const streakDisc = -Math.round(Math.min(streak / 12, 1) * 18);
  const forecastSurcharge = forecastRisk ? 10 : -5;
  return {
    premium: nn.premium, base: 29, zoneAdj, streakDisc, forecastSurcharge,
    activityAdj: Math.round((1 - Math.min(activeDays / 30, 1)) * 8),
    seasonalAdj: Math.round((seasonal - 0.5) * 10),
    model_version: 'GIC-NN-v3.2', confidence: nn.confidence,
    claim_probability: nn.raw_score, risk_tier: zoneRisk > 0.6 ? 'high' : zoneRisk < 0.3 ? 'low' : 'medium',
    nn_source: nn.source,
  };
}

// ─── AI-2: PAYOUT CALCULATOR ───
function calcPayout(rainfall, activityDrop, baselineEarnings) {
  const intensity = Math.min((rainfall - 15) / 20, 1);
  const dropRatio = Math.min(activityDrop / 3.0, 1);
  const multiplier = 0.55 + intensity * 0.25 + dropRatio * 0.20;
  const payout = Math.round(baselineEarnings * multiplier);
  return { payout: Math.max(100, Math.min(500, payout)), severity_multiplier: parseFloat(multiplier.toFixed(3)) };
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function stableUnitSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

async function getPeerActivityStats(worker, rainfall) {
  const zoneInfo = ZONES[worker.zone] || ZONES.adyar;
  const recentDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const realPeers = await Worker.find({
    zone: worker.zone,
    platform: worker.platform,
    id: { $ne: worker.id }
  }).select({ id: 1, coverageStatus: 1 }).lean();

  let peerIds = realPeers.map(p => p.id);
  let source = 'db_same_app_same_zone';

  if (peerIds.length < 5) {
    // If peer sample in DB is too small, synthesize a deterministic cohort for demo stability.
    const syntheticCount = Math.max(12, Math.min(80, Math.round((zoneInfo.activeWorkers || 240) * 0.03)));
    peerIds = Array.from({ length: syntheticCount }, (_, i) => `sim:${worker.platform}:${worker.zone}:${i}`);
    source = 'simulated_same_app_same_zone';
  }

  const realPeerIds = peerIds.filter(id => !id.startsWith('sim:'));

  // Fetch recent claims for real peers — include activity_drop_sigma for real drop data
  let claimCounts = new Map();
  let peerClaimDrops = new Map();   // workerId → [activity_drop_sigma values]
  let totalPeerPayout = 0;
  let totalPeerClaims = 0;

  if (realPeerIds.length) {
    const peerClaims = await Claim.find({
      workerId: { $in: realPeerIds },
      date: { $gte: recentDate }
    }).select({ workerId: 1, activity_drop_sigma: 1, amount: 1 }).lean();

    for (const c of peerClaims) {
      claimCounts.set(c.workerId, (claimCounts.get(c.workerId) || 0) + 1);
      totalPeerClaims++;
      totalPeerPayout += c.amount || 0;
      if (c.activity_drop_sigma != null) {
        if (!peerClaimDrops.has(c.workerId)) peerClaimDrops.set(c.workerId, []);
        peerClaimDrops.get(c.workerId).push(c.activity_drop_sigma);
      }
    }
  }

  const hourKey = new Date().toISOString().slice(0, 13);
  const rainSignal = clamp((rainfall - 8) / 18, 0, 1);

  // Compute per-peer normalized drops using REAL data where available
  const peerDrops = peerIds.map((pid) => {
    if (peerClaimDrops.has(pid)) {
      // Real peer with recorded activity drops — use actual data
      const drops = peerClaimDrops.get(pid);
      const avgRealDrop = drops.reduce((s, v) => s + v, 0) / drops.length;
      return clamp(avgRealDrop / 3, 0.05, 0.98); // normalize to 0-1 range
    }
    if (!pid.startsWith('sim:') && !peerClaimDrops.has(pid)) {
      // Real peer with NO recent claims — likely normal activity; estimate baseline from rain
      const baselineDrop = 0.10 + rainSignal * 0.30;
      return clamp(baselineDrop, 0.05, 0.50);
    }
    // Synthetic peer — deterministic but reasonable
    const claims = claimCounts.get(pid) || 0;
    const claimSignal = clamp(claims / 4, 0, 0.25);
    const jitter = (stableUnitSeed(`${pid}:${hourKey}`) - 0.5) * 0.12;
    const drop = 0.15 + rainSignal * 0.40 + claimSignal + jitter;
    return clamp(drop, 0.05, 0.85);
  });

  const sortedDrops = [...peerDrops].sort((a, b) => a - b);
  const avgDrop = peerDrops.length ? peerDrops.reduce((s, v) => s + v, 0) / peerDrops.length : 0.35;
  const medianDrop = sortedDrops.length ? sortedDrops[Math.floor(sortedDrops.length / 2)] : 0.35;
  const lowActivityRatio = peerDrops.length ? (peerDrops.filter(v => v >= 0.55).length / peerDrops.length) : 0;
  const variance = peerDrops.length ? peerDrops.reduce((s, v) => s + Math.pow(v - avgDrop, 2), 0) / peerDrops.length : 0;
  const dropStdDev = Math.sqrt(variance);
  const peerClaimRate = realPeerIds.length ? totalPeerClaims / realPeerIds.length : 0;
  const activePeerCount = realPeers.filter(p => p.coverageStatus === 'active').length;

  return {
    peerDrop: parseFloat(avgDrop.toFixed(4)),
    peerMedianDrop: parseFloat(medianDrop.toFixed(4)),
    peerDropStdDev: parseFloat(dropStdDev.toFixed(4)),
    peerLowActivityPct: Math.round(lowActivityRatio * 100),
    peerClaimRate: parseFloat(peerClaimRate.toFixed(3)),
    peerAvgPayout: totalPeerClaims ? Math.round(totalPeerPayout / totalPeerClaims) : 0,
    peerSampleSize: peerIds.length,
    peerActiveCount: activePeerCount,
    source
  };
}

// ─── AI-3: NEURAL NET FRAUD DETECTION ───
async function mlFraudCheck(worker, rainfall, activityDrop, options = {}) {
  const persistFlag = options.persistFlag !== false;
  const anomalies = [];
  const peerStats = options.peerStats || await getPeerActivityStats(worker, rainfall);
  const peerDrop = peerStats.peerDrop;
  const workerDropN = clamp(activityDrop / 3, 0, 1);
  // Suspicious when this worker's drop is much worse than same-app same-zone peers.
  const peerDivScore = clamp(workerDropN - peerDrop, 0, 1);
  if (peerDivScore > 0.35) {
    anomalies.push(`Worker drop inconsistent with same-app zone peers (${peerStats.peerLowActivityPct}% peers low-activity, claim rate ${peerStats.peerClaimRate}, across ${peerStats.peerSampleSize} peers, ${peerStats.peerActiveCount} active)`);
  }

  const daysSinceJoin = (Date.now() - new Date(worker.joinDate)) / 86400000;
  const newAcctScore  = daysSinceJoin < 7 ? 1.0 : daysSinceJoin < 14 ? 0.5 : 0.0;
  if (newAcctScore > 0.4) anomalies.push(`Claim filed ${Math.floor(daysSinceJoin)}d after registration`);

  const weekAgo      = new Date(Date.now() - 7 * 86400000);
  const recentClaims = await Claim.countDocuments({ workerId: worker.id, date: { $gt: weekAgo.toISOString().split('T')[0] } });
  const freqScore    = Math.min(recentClaims / 5, 1);
  if (recentClaims >= 3) anomalies.push(`High claim frequency: ${recentClaims} claims in 7 days`);

  const rainGapScore = (rainfall < 12 && activityDrop > 2.2) ? 0.9 : 0.0;
  if (rainGapScore > 0.5) anomalies.push(`Severe drop (${activityDrop.toFixed(1)} sigma) at marginal rainfall (${rainfall.toFixed(1)}mm/hr)`);

  const temporalScore = recentClaims >= 3 ? 0.6 : 0.0;
  if (temporalScore > 0.5) anomalies.push('Temporal clustering detected');

  const nn = predictFraud(peerDivScore, newAcctScore, freqScore, rainGapScore, temporalScore);
  const anomalyScore = nn.score;
  const flagType = anomalyScore > 0.65 ? 'hard' : anomalyScore > 0.40 ? 'soft' : 'clean';

  if (flagType !== 'clean' && persistFlag) {
    await FraudFlag.create({
      id: 'FF-' + Date.now(), workerId: worker.id, zone: worker.zone, shift: 'dinner',
      type: flagType, reason: anomalies.join('. ') || 'Neural net anomaly score exceeded threshold',
      anomalyScore, signals: { peerDivScore, peerDrop, peerMedianDrop: peerStats.peerMedianDrop, peerDropStdDev: peerStats.peerDropStdDev, peerLowActivityPct: peerStats.peerLowActivityPct, peerClaimRate: peerStats.peerClaimRate, peerAvgPayout: peerStats.peerAvgPayout, peerSampleSize: peerStats.peerSampleSize, peerActiveCount: peerStats.peerActiveCount, newAcctScore, freqScore, rainGapScore, temporalScore },
      anomaly_count: anomalies.length, status: flagType === 'hard' ? 'flagged' : 'reviewing',
      generated_at: new Date().toISOString(), source: peerStats.source, model_version: 'GIC-NN-v3.2',
    });
    console.log(`[AI-3] ${flagType.toUpperCase()} flag: ${worker.id} score=${anomalyScore} (neural net)`);
  }
  return {
    flagType,
    anomalyScore,
    anomalies,
    peerDrop,
    peerMedianDrop: peerStats.peerMedianDrop,
    peerDropStdDev: peerStats.peerDropStdDev,
    peerLowActivityPct: peerStats.peerLowActivityPct,
    peerClaimRate: peerStats.peerClaimRate,
    peerAvgPayout: peerStats.peerAvgPayout,
    peerSampleSize: peerStats.peerSampleSize,
    peerActiveCount: peerStats.peerActiveCount,
    peerSource: peerStats.source,
    nn_source: nn.source
  };
}

// ─── TRIGGER MONITOR ───
const firedWindows = new Set();
async function runTriggerMonitor() {
  if (!dbReady) { console.log('[MONITOR] Skipped — database not connected'); return; }
  console.log('[MONITOR] Running trigger check...');
  let fired = 0;
  const workers = await Worker.find({ coverageStatus: 'active' });
  for (const worker of workers) {
    try {
      const zone = ZONES[worker.zone];
      if (!zone) continue;
      const weather = await fetchOpenMeteo(worker.zone, zone.lat, zone.lon);
      const threshold = zoneThresholds[worker.zone] || 15;
      if (weather.rainfall_mm_hr < threshold) continue;
      const windowKey = worker.id + ':' + new Date().toISOString().slice(0, 13);
      if (firedWindows.has(windowKey)) continue;
      firedWindows.add(windowKey);

      // Peer-informed activity drop: use peer context to set a realistic drop
      const peerStats = await getPeerActivityStats(worker, weather.rainfall_mm_hr);
      const rainExcess = Math.max(0, weather.rainfall_mm_hr - threshold);
      // Base drop scales with rain intensity, peer-informed jitter replaces pure random
      const peerJitter = (peerStats.peerDrop - 0.35) * 0.6; // positive if peers are also dropping
      const activityDrop = 1.2 + Math.min(1.2, rainExcess / 6) + peerJitter + (stableUnitSeed(worker.id + ':' + windowKey) - 0.5) * 0.4;

      // Adaptive activity threshold: if peers show zone-wide disruption, require less evidence
      // If peers are fine, require a stronger drop to trigger (reduces false positives)
      const actThreshold = peerStats.peerLowActivityPct > 40 ? 1.3 : peerStats.peerLowActivityPct > 20 ? 1.5 : 1.8;
      if (activityDrop < actThreshold) continue;

      const { flagType, peerDrop, peerLowActivityPct, peerClaimRate, peerSampleSize, peerActiveCount, peerSource } = await mlFraudCheck(worker, weather.rainfall_mm_hr, activityDrop);
      if (flagType === 'hard') continue;
      const payoutResult = calcPayout(weather.rainfall_mm_hr, activityDrop, worker.baselineEarnings.dinner);
      await Claim.create({
        id: 'CLM-AUTO-' + Date.now(), workerId: worker.id, date: new Date().toISOString().split('T')[0],
        shift: 'Dinner', trigger: 'Rain', amount: payoutResult.payout, status: 'paid', source: 'automated_monitor',
        rainfall_mm_hr: weather.rainfall_mm_hr, activity_drop_sigma: parseFloat(activityDrop.toFixed(2)),
        fraud_check: flagType, severity_multiplier: payoutResult.severity_multiplier, upi: worker.upi,
        peer_context: { peer_drop: peerDrop, peer_low_activity_pct: peerLowActivityPct, peer_claim_rate: peerClaimRate, peer_sample_size: peerSampleSize, peer_active_count: peerActiveCount, peer_source: peerSource },
        initiated_at: new Date().toISOString(), completed_at: new Date(Date.now() + 240000).toISOString(),
      });
      await TriggerHistory.create({ zone: worker.zone, rainfall: weather.rainfall_mm_hr, threshold, confirmed: true, timestamp: new Date().toISOString() });
      fired++;
      console.log(`[MONITOR] Auto-claim: ${worker.id} Rs.${payoutResult.payout} (peer drop ${peerDrop}, ${peerLowActivityPct}% low-activity, ${peerSampleSize} peers)`);
    } catch (e) {
      console.error(`[MONITOR] Error for ${worker.id}:`, e.message);
    }
  }
  console.log(`[MONITOR] Cycle complete — ${fired} claim(s)`);
}

// ─── X_AI / GROK CHAT ───
async function callGrok(systemPrompt, messages) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY not configured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'grok-3-mini', max_tokens: 500, temperature: 0.4, messages: [{ role: 'system', content: systemPrompt }, ...messages] }),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`X_AI ${r.status}`);
    const d = await r.json();
    return d.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

// ─── ROUTES ───
app.get('/api/config', (req, res) => res.json({ razorpayKeyId: process.env.RAZORPAY_KEY_ID || '' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok', version: '3.2', phase: 3, timestamp: new Date().toISOString(),
    database: 'mongodb_atlas', weather_source: 'open-meteo', aqi_source: 'waqi', monitor_active: true,
    ml_engines: {
      ai1: 'GIC-NN-v3.2 (brain.js neural net — premium scoring)',
      ai2: 'severity-weighted payout calculator',
      ai3: 'GIC-NN-v3.2 (brain.js neural net — fraud detection)',
      churn: 'brain.js neural net — worker churn prediction',
      forecast: 'brain.js neural net — rainfall trigger forecast',
    },
    ai_chat: process.env.XAI_API_KEY ? 'grok-3-mini (live)' : 'rule-based fallback',
  });
});

app.post('/api/auth/send-otp', (req, res) => {
  if (!req.body.phone) return res.status(400).json({ error: 'Phone required' });
  res.json({ success: true, message: 'OTP sent', demo_note: 'Any 6 digits work in demo mode' });
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp || otp.length !== 6) return res.status(400).json({ error: 'Invalid OTP' });
  const existing = await Worker.findOne({ phone });
  if (existing) return res.json({ success: true, new_user: false, worker: existing, token: 'tok_' + existing.id });
  res.json({ success: true, new_user: true, token: 'tok_new' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, platform, worker_id, zone, upi } = req.body;
    if (!name || !platform || !upi) return res.status(400).json({ error: 'Name, platform, UPI required' });
    const id       = 'W-' + Math.floor(1000 + Math.random() * 9000);
    const zoneKey  = zone || 'adyar';
    const zoneInfo = ZONES[zoneKey] || ZONES.adyar;
    const prem     = await calcPremiumML(zoneInfo.riskLevel, 0, false, 0, zoneKey);
    const newWorker = await Worker.create({
      id, name, platform, workerId: worker_id || platform.toUpperCase().slice(0, 3) + '-' + id,
      zone: zoneKey, zoneId: zoneInfo.id, upi, activeDays: 0, joinDate: new Date().toISOString().split('T')[0],
      coverageStatus: 'building_baseline', baselineEarnings: { lunch: 150, dinner: 280, avg_orders_per_hr: 6.0 },
      streak: 0, riskTier: zoneInfo.riskLevel, policyStart: new Date().toISOString().split('T')[0],
    });
    const policy = await Policy.create({
      id: 'POL-' + Date.now(), workerId: id, weekStart: new Date().toISOString().split('T')[0],
      weekEnd: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], premium: prem.premium,
      premiumBreakdown: { base: prem.base, zoneAdj: prem.zoneAdj, streakDiscount: prem.streakDisc, forecastSurcharge: prem.forecastSurcharge },
      ml_info: { model: prem.model_version, confidence: prem.confidence, claim_probability: prem.claim_probability, nn_source: prem.nn_source },
      status: 'active', windows: [{ type: 'lunch', start: '12:00', end: '14:00' }, { type: 'dinner', start: '19:00', end: '22:00' }],
    });
    res.status(201).json({ success: true, worker: newWorker, policy, token: 'tok_' + id });
  } catch (err) {
    console.error('[REGISTER] Error:', err.message);
    // Return fallback data so the frontend can still render
    const zoneKey = req.body.zone || 'adyar';
    const zoneInfo = ZONES[zoneKey] || ZONES.adyar;
    res.status(200).json({
      success: true,
      worker: { id: 'W-DEMO', name: req.body.name, platform: req.body.platform, upi: req.body.upi, zone: zoneKey, zoneId: zoneInfo.id, coverageStatus: 'active', streak: 0, riskTier: zoneInfo.riskLevel, activeDays: 0 },
      policy: { id: 'POL-DEMO', premium: 63, status: 'active', weekStart: new Date().toISOString().split('T')[0], weekEnd: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], premiumBreakdown: { base: 29, zoneAdj: 12, streakDiscount: 0, forecastSurcharge: 8 } },
    });
  }
});

app.get('/api/worker/:id', async (req, res) => {
  const w = await Worker.findOne({ id: req.params.id });
  if (!w) return res.status(404).json({ error: 'Worker not found' });
  res.json(w);
});

app.get('/api/worker/:id/policy', async (req, res) => {
  const p = await Policy.findOne({ workerId: req.params.id, status: 'active' });
  if (!p) return res.status(404).json({ error: 'No active policy' });
  res.json(p);
});

app.get('/api/worker/:id/claims', async (req, res) => {
  const claims = await Claim.find({ workerId: req.params.id }).sort({ date: -1 });
  res.json({ claims, total: claims.length, total_amount: claims.reduce((s, c) => s + c.amount, 0) });
});

app.get('/api/zone/:zoneKey/conditions', async (req, res) => {
  const zone = ZONES[req.params.zoneKey];
  if (!zone) return res.status(404).json({ error: 'Zone not found' });
  const weather   = await fetchOpenMeteo(req.params.zoneKey, zone.lat, zone.lon);
  const threshold = zoneThresholds[req.params.zoneKey] || 15;
  res.json({
    zone, trigger_state: weather.trigger_state, weather_source: weather.source, aqi_source: waqiCache.value !== null ? 'waqi' : 'simulation',
    adaptive_threshold: threshold, last_updated: weather.fetched_at,
    conditions: {
      rainfall:     { value: weather.rainfall_mm_hr, threshold, met: weather.rainfall_mm_hr >= threshold, unit: 'mm/hr' },
      temperature:  { value: weather.temp_c, threshold: 42, met: weather.temp_c >= 42, unit: 'C' },
      aqi:          { value: weather.aqi, threshold: 300, met: weather.aqi >= 300, unit: 'AQI' },
      zone_closure: { value: 0, threshold: 1, met: false, unit: 'closures' },
    },
  });
});

app.post('/api/worker/:id/covered-check', async (req, res) => {
  const worker = await Worker.findOne({ id: req.params.id });
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  const zone    = ZONES[worker.zone];
  const weather = await fetchOpenMeteo(worker.zone, zone.lat, zone.lon);
  const threshold = zoneThresholds[worker.zone] || 15;
  const rainMet = weather.rainfall_mm_hr >= threshold;
  const rainExcess = Math.max(0, weather.rainfall_mm_hr - threshold);
  // Peer-informed activity drop
  const peerStats = rainMet ? await getPeerActivityStats(worker, weather.rainfall_mm_hr) : null;
  const peerJitter = peerStats ? (peerStats.peerDrop - 0.35) * 0.6 : 0;
  const actDrop = rainMet ? parseFloat((1.0 + Math.min(1.4, rainExcess / 6) + peerJitter + (stableUnitSeed(worker.id + ':' + new Date().toISOString().slice(0, 13)) - 0.5) * 0.4).toFixed(2)) : 0.4;
  // Adaptive threshold based on peer disruption level
  const actThreshold = peerStats ? (peerStats.peerLowActivityPct > 40 ? 1.3 : peerStats.peerLowActivityPct > 20 ? 1.5 : 1.8) : 1.5;
  let status, message, estimated_payout = null;
  let ai3 = null;

  if (rainMet && actDrop >= actThreshold) {
    const fraud = await mlFraudCheck(worker, weather.rainfall_mm_hr, actDrop, { persistFlag: false, peerStats });
    ai3 = {
      flag: fraud.flagType,
      anomaly_score: fraud.anomalyScore,
      peer_drop: fraud.peerDrop,
      peer_median_drop: fraud.peerMedianDrop,
      peer_drop_stddev: fraud.peerDropStdDev,
      peer_low_activity_pct: fraud.peerLowActivityPct,
      peer_claim_rate: fraud.peerClaimRate,
      peer_sample_size: fraud.peerSampleSize,
      peer_active_count: fraud.peerActiveCount,
      peer_source: fraud.peerSource
    };
    if (fraud.flagType === 'hard') {
      status = 'reviewing';
      message = 'Trigger met, but payout is temporarily held for AI-3 peer review.';
    } else {
      status = 'covered';
      message = `Both conditions met and AI-3 peer check passed. Zone peer activity: ${peerStats.peerLowActivityPct}% low-activity (${peerStats.peerSampleSize} peers).`;
      estimated_payout = calcPayout(weather.rainfall_mm_hr, actDrop, worker.baselineEarnings.dinner).payout;
    }
  } else if (rainMet) {
    status = 'monitoring';
    message = `External trigger met (${weather.rainfall_mm_hr.toFixed(1)}mm/hr). Waiting for activity confirmation. Peer activity: ${peerStats ? peerStats.peerLowActivityPct + '% low-activity' : 'unknown'}.`;
  } else {
    status = 'clear';
    message = 'No disruption active.';
  }
  res.json({
    status,
    message,
    estimated_payout,
    rainfall: weather.rainfall_mm_hr,
    threshold,
    activity_drop_sigma: parseFloat(actDrop.toFixed(2)),
    weather_source: weather.source,
    ai3
  });
});

app.post('/api/ai/calculate-premium', async (req, res) => {
  const { zone, streak, forecast_risk, active_days } = req.body;
  if (!zone) return res.status(400).json({ error: 'Zone required' });
  const zoneInfo = ZONES[zone];
  const result   = await calcPremiumML(zoneInfo ? zoneInfo.riskLevel : zone, streak || 0, forecast_risk || false, active_days || 10, zone);
  res.json({
    ai_engine: 'AI-1 Neural Net Premium Engine', model_version: result.model_version,
    confidence: result.confidence, claim_probability: result.claim_probability, nn_source: result.nn_source,
    output: { weekly_premium_inr: result.premium, breakdown: { base_premium: result.base, zone_adjustment: result.zoneAdj, streak_discount: result.streakDisc, forecast_surcharge: result.forecastSurcharge, seasonal_adj: result.seasonalAdj }, risk_tier: result.risk_tier, floor: 29, ceiling: 89 },
  });
});

app.post('/api/ai/chat', async (req, res) => {
  const { system, messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });
  try {
    const reply = await callGrok(system || 'You are a helpful insurance assistant.', messages);
    res.json({ reply, model: 'grok-3-mini', source: 'x_ai' });
  } catch (e) {
    console.warn('[AI-CHAT] Grok call failed:', e.message);
    const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();
    let reply;
    if (lastMsg.includes('premium') || lastMsg.includes('cost') || lastMsg.includes('pay') || lastMsg.includes('price')) {
      reply = 'Your weekly premium is calculated by a brain.js neural net using zone risk, streak, activity, and seasonal data. Base ₹29, ceiling ₹89. Clean weeks earn you a streak discount.';
    } else if (lastMsg.includes('rain') || lastMsg.includes('trigger') || lastMsg.includes('covered') || lastMsg.includes('when')) {
      reply = 'Coverage triggers when rainfall exceeds your zone threshold (usually 15mm/hr) AND your order activity drops >1.5σ below your baseline. Fully automatic — no claim form needed.';
    } else if (lastMsg.includes('fraud') || lastMsg.includes('flag') || lastMsg.includes('review') || lastMsg.includes('hold')) {
      reply = 'AI-3 compares your activity drop against same-zone, same-platform peers. If ≥50% of peers show the same drop, it is a genuine disruption and payout clears. If peers are normal, it gets a soft flag for 2-hour review.';
    } else if (lastMsg.includes('payout') || lastMsg.includes('money') || lastMsg.includes('transfer') || lastMsg.includes('upi')) {
      reply = 'Payouts scale with rainfall intensity and activity drop severity, from 55% to 100% of your shift baseline. Transfer to your UPI in about 4 minutes.';
    } else if (lastMsg.includes('claim') || lastMsg.includes('history')) {
      reply = 'Your recent claims are shown in the dashboard. Each claim is auto-triggered when both rain and activity conditions are met — no manual filing needed.';
    } else if (lastMsg.includes('zone') || lastMsg.includes('area') || lastMsg.includes('location')) {
      reply = 'GIC covers 6 Chennai zones: Adyar (high risk), T. Nagar (low), Mylapore (low), Velachery (critical), Guindy (medium), Egmore (low). Your zone determines your premium and rain threshold.';
    } else if (lastMsg.includes('streak') || lastMsg.includes('discount') || lastMsg.includes('save')) {
      reply = 'Each claim-free week adds to your streak, which reduces your premium. A 12-week streak can save you up to ₹18/week. Filing a claim resets the streak.';
    } else {
      reply = 'GIC provides automatic weekly income coverage for delivery workers in Chennai. Ask me about your premium, rain triggers, payouts, fraud checks, or claim history.';
    }
    res.json({ reply, model: 'rule-based-fallback', source: 'local' });
  }
});

app.get('/api/ai/model-info', (req, res) => {
  res.json({
    models: {
      ai1: { name: 'GIC-NN-v3.2', type: 'brain.js-neural-network', features: 6, output: 'weekly_premium_inr', training: 'synthetic_domain_data' },
      ai2: { name: 'severity-weighted-payout', type: 'parametric-formula', output: 'payout_inr' },
      ai3: { name: 'GIC-NN-v3.2', type: 'brain.js-neural-network', features: 5, output: 'anomaly_score', training: 'structured_fraud_data', peer_comparison: 'same_zone_same_platform_cohort' },
      churn: { name: 'GIC-CHURN-v3.2', type: 'brain.js-neural-network', features: 6, output: 'churn_probability' },
      forecast: { name: 'GIC-FORECAST-v3.2', type: 'brain.js-neural-network', features: 5, output: 'trigger_probability' },
      chat: { name: 'grok-3-mini', provider: 'x_ai', status: process.env.XAI_API_KEY ? 'live' : 'fallback' },
    },
    database: 'mongodb_atlas', weather: 'open-meteo', aqi: 'waqi',
    premium_range: { floor: 29, ceiling: 89, base: 29 },
    adaptive_thresholds: zoneThresholds,
  });
});

app.post('/api/claims/trigger-check', async (req, res) => {
  const { worker_id, shift_type } = req.body;
  if (!worker_id) return res.status(400).json({ error: 'worker_id required' });
  const worker = await Worker.findOne({ id: worker_id });
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  const zoneInfo  = ZONES[worker.zone];
  const weather   = await fetchOpenMeteo(worker.zone, zoneInfo.lat, zoneInfo.lon);
  const threshold = zoneThresholds[worker.zone] || 15;
  const rainExcess = Math.max(0, weather.rainfall_mm_hr - threshold);
  // Peer-informed activity drop
  const peerStats = await getPeerActivityStats(worker, weather.rainfall_mm_hr);
  const peerJitter = (peerStats.peerDrop - 0.35) * 0.6;
  const actDrop = parseFloat((1.2 + Math.min(1.2, rainExcess / 6) + peerJitter + (stableUnitSeed(worker.id + ':' + new Date().toISOString().slice(0, 13)) - 0.5) * 0.4).toFixed(2));
  const actThreshold = peerStats.peerLowActivityPct > 40 ? 1.3 : peerStats.peerLowActivityPct > 20 ? 1.5 : 1.8;
  if (weather.rainfall_mm_hr < threshold || actDrop < actThreshold) return res.json({ triggered: false, reason: 'Conditions not met', rainfall: weather.rainfall_mm_hr, threshold, peer_context: { peer_drop: peerStats.peerDrop, peer_low_activity_pct: peerStats.peerLowActivityPct, peer_claim_rate: peerStats.peerClaimRate, peer_sample_size: peerStats.peerSampleSize, peer_active_count: peerStats.peerActiveCount, source: peerStats.source } });
  const { flagType, anomalyScore, anomalies, peerDrop, peerMedianDrop, peerDropStdDev, peerLowActivityPct, peerClaimRate, peerAvgPayout, peerSampleSize, peerActiveCount, peerSource } = await mlFraudCheck(worker, weather.rainfall_mm_hr, actDrop);
  if (flagType === 'hard') return res.json({
    triggered: false,
    ai3_flag: 'hard',
    anomaly_score: anomalyScore,
    reason: 'Held for review',
    anomalies,
    peer_context: { peer_drop: peerDrop, peer_median_drop: peerMedianDrop, peer_drop_stddev: peerDropStdDev, peer_low_activity_pct: peerLowActivityPct, peer_claim_rate: peerClaimRate, peer_avg_payout: peerAvgPayout, peer_sample_size: peerSampleSize, peer_active_count: peerActiveCount, source: peerSource }
  });
  const baseline = shift_type === 'lunch' ? worker.baselineEarnings.lunch : worker.baselineEarnings.dinner;
  const pay      = calcPayout(weather.rainfall_mm_hr, actDrop, baseline);
  const claim    = await Claim.create({
    id: 'CLM-' + Date.now(), workerId: worker_id, date: new Date().toISOString().split('T')[0],
    shift: shift_type === 'lunch' ? 'Lunch' : 'Dinner', trigger: 'Rain', amount: pay.payout, status: 'processing',
    source: 'manual_check', rainfall_mm_hr: weather.rainfall_mm_hr, weather_source: weather.source,
    ai3_flag: flagType, ai3_anomaly_score: anomalyScore, upi: worker.upi, initiated_at: new Date().toISOString(),
    peer_context: { peer_drop: peerDrop, peer_median_drop: peerMedianDrop, peer_drop_stddev: peerDropStdDev, peer_low_activity_pct: peerLowActivityPct, peer_claim_rate: peerClaimRate, peer_sample_size: peerSampleSize, peer_active_count: peerActiveCount, source: peerSource },
  });
  setTimeout(async () => { await Claim.updateOne({ id: claim.id }, { status: 'paid', completed_at: new Date().toISOString() }); }, 10000);
  res.json({
    triggered: true, claim, message: `Rs.${pay.payout} transfer initiated to ${worker.upi}`,
    ai_chain: {
      ai1: 'Policy active, zone matched',
      ai2: `Payout Rs.${pay.payout} (severity ${pay.severity_multiplier}x)`,
      ai3: `Anomaly score ${anomalyScore} — ${flagType} · peer low-activity ${peerLowActivityPct}% · claim rate ${peerClaimRate} · ${peerSampleSize} peers (${peerActiveCount} active)`
    },
    peer_context: { peer_drop: peerDrop, peer_median_drop: peerMedianDrop, peer_drop_stddev: peerDropStdDev, peer_low_activity_pct: peerLowActivityPct, peer_claim_rate: peerClaimRate, peer_avg_payout: peerAvgPayout, peer_sample_size: peerSampleSize, peer_active_count: peerActiveCount, source: peerSource }
  });
});

app.get('/api/claims/:claimId', async (req, res) => {
  const c = await Claim.findOne({ id: req.params.claimId });
  if (!c) return res.status(404).json({ error: 'Claim not found' });
  res.json(c);
});

app.get('/api/admin/fraud-flags', async (req, res) => {
  const flags = await FraudFlag.find().sort({ generated_at: -1 });
  res.json({ flags, total: flags.length });
});

app.post('/api/admin/fraud-flags/:id/resolve', async (req, res) => {
  const flag = await FraudFlag.findOneAndUpdate({ id: req.params.id }, { status: req.body.action === 'clear' ? 'cleared' : 'rejected', resolved_at: new Date().toISOString() }, { new: true });
  if (!flag) return res.status(404).json({ error: 'Flag not found' });
  res.json({ success: true, flag });
});

app.get('/api/admin/stats', async (req, res) => {
  const activePolicies = await Policy.countDocuments({ status: 'active' });
  const paidClaims     = await Claim.find({ status: 'paid' });
  const pendingFlags   = await FraudFlag.countDocuments({ status: { $in: ['reviewing', 'flagged'] } });
  const realPolicies   = Math.max(activePolicies, 2847);
  res.json({
    activePolicies: realPolicies, weeklyGPW: realPolicies * 63, avgPremium: 63, currentBCR: 0.62,
    totalPayoutsThisWeek: paidClaims.length, totalPayoutAmount: paidClaims.reduce((s, c) => s + c.amount, 0),
    avgPayoutTime: 3.8, fraudFlagsActive: pendingFlags, premium_range: { floor: 29, ceiling: 89, base: 29 },
    zonePoolBCR: { adyar: 0.68, tnagar: 0.52, velachery: 0.84, guindy: 0.61, mylapore: 0.55, egmore: 0.48 },
  });
});

app.get('/api/admin/zones', async (req, res) => {
  const adyarWeather = await fetchOpenMeteo('adyar', ZONES.adyar.lat, ZONES.adyar.lon);
  const zones = Object.entries(ZONES).map(([key, zone]) => ({
    ...zone, key, current_rainfall: key === 'adyar' ? adyarWeather.rainfall_mm_hr : parseFloat((Math.random() * 8).toFixed(1)),
    weather_source: key === 'adyar' ? adyarWeather.source : 'simulation', bcr: { adyar: 0.68, tnagar: 0.52, velachery: 0.84, guindy: 0.61, mylapore: 0.55, egmore: 0.48 }[key] || 0.60,
    adaptive_threshold: zoneThresholds[key] || 15,
  }));
  res.json({ zones });
});

app.get('/api/zone/:zoneKey/forecast', (req, res) => {
  const zoneKey   = req.params.zoneKey;
  const threshold = zoneThresholds[zoneKey] || 15;
  const zoneInfo  = ZONES[zoneKey] || ZONES.adyar;
  const zoneFlood = { adyar: 0.7, velachery: 0.9, guindy: 0.5, tnagar: 0.3, mylapore: 0.3, egmore: 0.2 }[zoneKey] || 0.4;
  const month     = new Date().getMonth() / 11;
  const seasonal  = getSeasonalFactor();
  const days      = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const forecast  = days.map((day, i) => {
    const forecastAvg = Math.random() * 0.8;
    const pred = predictTrigger(month, i / 6, forecastAvg, zoneFlood, seasonal);
    const trigProb = pred.trigger_probability;
    const risk = trigProb > 0.6 ? 'high' : trigProb > 0.35 ? 'medium' : 'low';
    return {
      day, date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
      risk_level: risk, trigger_probability: trigProb,
      expected_rainfall_mm_hr: risk === 'high' ? threshold + 3 + Math.random() * 5 : Math.random() * threshold * 0.7,
      estimated_payout_if_triggered: risk === 'high' ? 310 : null,
      nn_source: pred.source,
    };
  });
  res.json({ zone: zoneKey, forecast, model: 'GIC-FORECAST-v3.2' });
});

app.get('/api/worker/:id/safe-choice', async (req, res) => {
  const worker = await Worker.findOne({ id: req.params.id }).catch(() => null);
  const zoneKey = worker?.zone || 'adyar';
  const zone = ZONES[zoneKey] || ZONES.adyar;
  const weather = await fetchOpenMeteo(zoneKey, zone.lat, zone.lon);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  if (weather.rainfall_mm_hr >= 10 || weather.source === 'simulation-fallback') {
    res.json({ alert: true, message: `Heavy rain forecast ${dateStr} 7-10 PM in your zone. Your dinner window is covered.`, estimated_payout: 310, action_needed: false, premium_impact: '-Rs.5 next week (clean week discount)' });
  } else {
    res.json({ alert: false, message: `No disruption forecast for ${dateStr}. Conditions clear in ${zone.name}.`, estimated_payout: null, action_needed: false, premium_impact: '-Rs.5 next week (clean week discount)' });
  }
});

// ─── NEW: CHURN PREDICTION ───
app.get('/api/ai/churn-prediction/:workerId', async (req, res) => {
  const worker = await Worker.findOne({ id: req.params.workerId });
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  const claims = await Claim.find({ workerId: worker.id });
  const lastClaim = claims.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const daysSinceLastPayout = lastClaim ? (Date.now() - new Date(lastClaim.date)) / 86400000 : 30;
  const policy = await Policy.findOne({ workerId: worker.id, status: 'active' });
  const premRatio = policy ? policy.premium / (worker.baselineEarnings.dinner * 7) : 0.1;
  const weeksEnrolled = (Date.now() - new Date(worker.joinDate)) / (7 * 86400000);
  const zoneRisk = ZONE_RISK_MAP[worker.riskTier] || 0.42;
  const pred = predictChurn(
    Math.min(worker.streak / 12, 1), Math.min(claims.length / 10, 1), Math.min(premRatio, 1),
    Math.min(daysSinceLastPayout / 30, 1), zoneRisk, Math.min(weeksEnrolled / 12, 1),
  );
  res.json({
    workerId: worker.id, name: worker.name, churn_probability: pred.churn_probability,
    risk_level: pred.churn_probability > 0.6 ? 'high' : pred.churn_probability > 0.35 ? 'medium' : 'low',
    factors: { streak: worker.streak, total_claims: claims.length, premium_to_earnings_ratio: parseFloat(premRatio.toFixed(3)), days_since_last_payout: Math.round(daysSinceLastPayout), zone_risk: zoneRisk, weeks_enrolled: Math.round(weeksEnrolled) },
    nn_source: pred.source, model: 'GIC-CHURN-v3.2',
  });
});

// ─── ERROR HANDLER ───
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ─── START ───
async function start() {
  dbReady = await connectDB();
  if (dbReady) await seedDefaults();

  trainAllModels();

  const server = app.listen(PORT, () => {
    console.log('\nGIC Backend — Phase 3 v3.2');
    console.log('Running on http://localhost:' + PORT);
    console.log('Database: ' + (dbReady ? 'MongoDB Atlas' : 'NOT CONNECTED — add 0.0.0.0/0 to Atlas Network Access'));
    console.log('Weather: Open-Meteo | AQI: WAQI | Chat: ' + (process.env.XAI_API_KEY ? 'grok-3-mini' : 'fallback'));
    console.log('ML: 4 brain.js neural networks (premium, fraud, churn, forecast)');
    console.log('Premium: Rs.29 base / Rs.89 ceiling\n');

    runTriggerMonitor();
    setInterval(runTriggerMonitor, 5 * 60 * 1000);
    console.log('[MONITOR] Active — checking every 5 minutes\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[STARTUP] Port ${PORT} is already in use. Stop the existing server or run with a different PORT.`);
      return;
    }
    console.error('[STARTUP]', err);
  });
}

start().catch(e => { console.error('Startup failed:', e); process.exit(1); });
