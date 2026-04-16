const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  id:               { type: String, required: true, unique: true },
  name:             String,
  phone:            String,
  platform:         String,
  workerId:         String,
  zone:             String,
  zoneId:           Number,
  upi:              String,
  activeDays:       { type: Number, default: 0 },
  joinDate:         String,
  coverageStatus:   { type: String, default: 'building_baseline' },
  baselineEarnings: {
    lunch:           { type: Number, default: 150 },
    dinner:          { type: Number, default: 280 },
    avg_orders_per_hr: { type: Number, default: 6.0 },
  },
  streak:    { type: Number, default: 0 },
  riskTier:  String,
  policyStart: String,
}, { timestamps: true });

const policySchema = new mongoose.Schema({
  id:               { type: String, required: true, unique: true },
  workerId:         String,
  weekStart:        String,
  weekEnd:          String,
  premium:          Number,
  premiumBreakdown: mongoose.Schema.Types.Mixed,
  ml_info:          mongoose.Schema.Types.Mixed,
  status:           { type: String, default: 'active' },
  windows:          [{ type: { type: String }, start: String, end: String }],
}, { timestamps: true });

const claimSchema = new mongoose.Schema({
  id:                  { type: String, required: true, unique: true },
  workerId:            String,
  date:                String,
  shift:               String,
  trigger:             String,
  amount:              Number,
  status:              { type: String, default: 'processing' },
  source:              String,
  payoutTime:          Number,
  upi:                 String,
  rainfall_mm_hr:      Number,
  activity_drop_sigma: Number,
  severity_multiplier: Number,
  weather_source:      String,
  fraud_check:         String,
  ai1_approved:        Boolean,
  ai2_payout:          Number,
  ai2_severity:        Number,
  ai3_approved:        Boolean,
  ai3_flag:            String,
  ai3_anomaly_score:   Number,
  peer_context:        mongoose.Schema.Types.Mixed,
  initiated_at:        String,
  completed_at:        String,
}, { timestamps: true });

const fraudFlagSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true },
  workerId:      String,
  zone:          String,
  shift:         String,
  type:          String,
  reason:        String,
  anomalyScore:  Number,
  signals:       mongoose.Schema.Types.Mixed,
  anomaly_count: Number,
  status:        { type: String, default: 'reviewing' },
  generated_at:  String,
  resolved_at:   String,
  source:        String,
  model_version: String,
}, { timestamps: true });

const triggerHistorySchema = new mongoose.Schema({
  zone:      String,
  rainfall:  Number,
  threshold: Number,
  confirmed: Boolean,
  timestamp: String,
});

const Worker         = mongoose.model('Worker',         workerSchema);
const Policy         = mongoose.model('Policy',         policySchema);
const Claim          = mongoose.model('Claim',          claimSchema);
const FraudFlag      = mongoose.model('FraudFlag',      fraudFlagSchema);
const TriggerHistory = mongoose.model('TriggerHistory', triggerHistorySchema);

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[DB] MONGODB_URI not set — using in-memory fallback');
    return false;
  }
  try {
    await mongoose.connect(uri);
    console.log('[DB] Connected to MongoDB Atlas');
    return true;
  } catch (e) {
    console.error('[DB] Connection failed:', e.message);
    return false;
  }
}

async function seedDefaults() {
  const workerCount = await Worker.countDocuments();
  if (workerCount > 0) return;

  console.log('[DB] Seeding default data...');

  await Worker.create({
    id: 'W-2947', name: 'Ravi Kumar', phone: '+91 98765 43210',
    platform: 'swiggy', workerId: 'SWY-2947583', zone: 'adyar', zoneId: 14,
    upi: 'ravi@upi', activeDays: 12, joinDate: '2026-03-03',
    coverageStatus: 'active',
    baselineEarnings: { lunch: 175, dinner: 310, avg_orders_per_hr: 7.2 },
    streak: 4, riskTier: 'medium', policyStart: '2026-03-04',
  });

  await Policy.create({
    id: 'POL-2026-00001', workerId: 'W-2947',
    weekStart: '2026-03-31', weekEnd: '2026-04-06', premium: 63,
    premiumBreakdown: { base: 29, zoneAdj: 12, streakDiscount: -16, forecastSurcharge: 8, activityAdj: 6 },
    ml_info: { model: 'GIC-GBT-v3.1', confidence: 0.88, claim_probability: 0.42 },
    status: 'active',
    windows: [{ type: 'lunch', start: '12:00', end: '14:00' }, { type: 'dinner', start: '19:00', end: '22:00' }],
  });

  await Claim.insertMany([
    { id: 'CLM-001', workerId: 'W-2947', date: '2026-03-31', shift: 'Dinner', trigger: 'Rain', amount: 310, status: 'paid', payoutTime: 4, upi: 'ravi@upi' },
    { id: 'CLM-002', workerId: 'W-2947', date: '2026-03-14', shift: 'Lunch',  trigger: 'AQI',  amount: 190, status: 'paid', payoutTime: 3, upi: 'ravi@upi' },
    { id: 'CLM-003', workerId: 'W-2947', date: '2026-03-02', shift: 'Dinner', trigger: 'Rain', amount: 280, status: 'paid', payoutTime: 5, upi: 'ravi@upi' },
  ]);

  await FraudFlag.insertMany([
    { id: 'FF-001', workerId: 'W-2947-clone', zone: 'adyar',     shift: 'dinner', type: 'soft', reason: 'Zone activity: 6.2 orders/hr (near-normal). Worker: 0 orders/hr.', anomalyScore: 0.61, status: 'reviewing', source: 'ml_ai3_isolation_forest', model_version: 'GIC-IF-v3.1' },
    { id: 'FF-002', workerId: 'W-3812',       zone: 'adyar',     shift: 'lunch',  type: 'soft', reason: 'Worker GPS inconsistent with claimed zone.', anomalyScore: 0.58, status: 'reviewing', source: 'ml_ai3_isolation_forest', model_version: 'GIC-IF-v3.1' },
    { id: 'FF-003', workerId: 'W-1055',       zone: 'guindy',    shift: 'dinner', type: 'hard', reason: 'GPS spoofing detected. Zone mismatch confirmed.', anomalyScore: 0.87, status: 'flagged', source: 'ml_ai3_isolation_forest', model_version: 'GIC-IF-v3.1' },
    { id: 'FF-004', workerId: 'W-4421',       zone: 'tnagar',    shift: 'lunch',  type: 'clear', reason: 'Legitimate zone disruption confirmed by peer data.', anomalyScore: 0.21, status: 'cleared', source: 'ml_ai3_isolation_forest', model_version: 'GIC-IF-v3.1' },
    { id: 'FF-005', workerId: 'W-2108',       zone: 'velachery', shift: 'dinner', type: 'hard', reason: 'Duplicate claim for same event window.', anomalyScore: 0.92, status: 'flagged', source: 'ml_ai3_isolation_forest', model_version: 'GIC-IF-v3.1' },
  ]);

  console.log('[DB] Seed data inserted');
}

module.exports = { connectDB, seedDefaults, Worker, Policy, Claim, FraudFlag, TriggerHistory };
