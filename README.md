# GIC — Gig Income Coverage
### Automatic Parametric Income Protection for Delivery Workers · Phase 3 v3.2

> **No claim forms. No human adjusters. No waiting.**
> GIC monitors weather, peer activity, and fraud signals in real-time — and pays out to UPI in under 4 minutes when a disruption is confirmed.

---

## Table of Contents

1. [What is GIC?](#what-is-gic)
2. [Screenshots](#screenshots)
3. [Architecture Overview](#architecture-overview)
4. [The GIC AI Engine](#the-gic-ai-engine)
5. [The Traffic System](#the-traffic-system)
6. [External APIs](#external-apis)
7. [API Reference](#api-reference)
8. [Admin Dashboard](#admin-dashboard)
9. [Database Models](#database-models)
10. [Getting Started](#getting-started)
11. [Environment Variables](#environment-variables)
12. [What Sets GIC Apart](#what-sets-gic-apart)
13. [Pitch](#pitch)
14. [Collaborators](#collaborators)


---

## What is GIC?

GIC (Gig Income Coverage) is a **parametric income insurance platform** built specifically for food delivery workers in Chennai. Instead of the traditional insurance model — file a claim, wait for an adjuster, maybe get paid weeks later — GIC works on a trigger-based, fully automated pipeline:

1. Rain crosses your zone's threshold (≥15 mm/hr by default)
2. Your order activity drops >1.5σ below your personal baseline
3. 80+ zone peers on the same platform confirm the disruption
4. AI-3 runs a fraud check in milliseconds
5. **₹100–500 is transferred to your UPI in ~4 minutes**

Coverage costs between **₹29 and ₹89/week**, computed fresh each week by a neural network that weighs zone flood risk, your streak, seasonal patterns, and a 7-day rainfall forecast.

---

## Screenshots

### Admin Dashboard — Overview

> _Add screenshot here: the full admin overview panel showing active policies, weekly GPW, BCR by zone, fraud flags, and payout stats_

<img width="1600" height="757" alt="image" src="https://github.com/user-attachments/assets/56e8c9de-b800-489d-b0f7-a819afac4dea" />

---

### Admin Dashboard — AI Model Info Panel

> _Add screenshot here: the AI model info card showing all 5 neural net models, their feature counts, training approach, and live status_

`docs/screenshots/admin-model-info.png`
<img width="1253" height="674" alt="image" src="https://github.com/user-attachments/assets/b58ac8df-ece3-49d6-9c59-8fd4a280a973" />

---

### AI Chat Assistant

> _Add screenshot here: the in-app Grok-3-mini chat showing a worker asking about their premium and receiving a contextual breakdown_

`docs/screenshots/ai-chat.png`
<img width="223" height="247" alt="image" src="https://github.com/user-attachments/assets/03767df3-31f8-4e88-9d7b-ac9db6e78af7" />


<img width="259" height="741" alt="image" src="https://github.com/user-attachments/assets/22ef27db-a3b0-4ac4-b284-fba35a8ca5aa" />


---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  index.html                      │
│         Worker App + Admin Dashboard             │
└──────────────┬──────────────────────────────────┘
               │ REST API
┌──────────────▼──────────────────────────────────┐
│               server.js  (Express v4)            │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │  Auth    │  │  Worker  │  │  Claims        │ │
│  │  Routes  │  │  Routes  │  │  + Trigger     │ │
│  └──────────┘  └──────────┘  └────────────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │  Admin   │  │  Zone /  │  │  AI Chat       │ │
│  │  Routes  │  │ Forecast │  │  (Grok-3-mini) │ │
│  └──────────┘  └──────────┘  └────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │              ml.js — 4 Neural Nets          │ │
│  │  AI-1 Premium · AI-3 Fraud · Churn · Fcst  │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────┐   ┌───────────┐  ┌──────────┐  │
│  │  Open-Meteo │   │   WAQI    │  │  X.AI    │  │
│  │   Weather   │   │    AQI    │  │  Grok    │  │
│  └─────────────┘   └───────────┘  └──────────┘  │
└──────────────┬──────────────────────────────────┘
               │ mongoose
┌──────────────▼──────────────────────────────────┐
│              MongoDB Atlas                        │
│   Workers · Policies · Claims · FraudFlags       │
│   TriggerHistory                                 │
└─────────────────────────────────────────────────┘
```

---

## The GIC AI Engine

GIC runs **five purpose-trained neural networks** via `brain.js`, plus a parametric payout formula and an LLM chat layer.

---

### AI-1 · Neural Net Premium Engine (`GIC-NN-v3.2`)

**What it does:** Calculates each worker's weekly premium from scratch, personalised to their risk profile.

**Inputs (6 features):**
| Feature | Description |
|---|---|
| `zone_risk` | Flood risk score for the worker's zone (0.15 low → 0.90 critical) |
| `streak` | Claim-free streak, normalised (0–1 over 12 weeks) |
| `active_days` | Days active in the last 30, normalised |
| `bcr` | Baseline Claim Ratio — historical payout frequency for the zone pool |
| `forecast_risk` | Binary: does the 7-day forecast show high trigger probability? |
| `seasonal` | Month-adjusted seasonal weight (monsoon season = 0.85) |

**Output:** A raw score (0–1) mapped to **₹29 floor → ₹89 ceiling**.

**Premium breakdown shown to workers:**
- Base: ₹29
- Zone adjustment: ±₹28 (Velachery critical adds the most)
- Streak discount: up to −₹18 for a 12-week clean run
- Forecast surcharge: +₹10 if heavy rain is forecast, −₹5 if skies are clear
- Seasonal adjustment: +₹7 in October–November (northeast monsoon peak)

**Training:** ~500 synthetic samples generated from domain-rule combinations across all zone/streak/seasonal/BCR combinations, with controlled noise.

---

### AI-2 · Severity-Weighted Payout Calculator

**What it does:** Computes the exact rupee payout the moment a claim is confirmed. No neural net — this is a transparent parametric formula so every payout is fully auditable.

**Formula:**
```
intensity   = clamp((rainfall_mm_hr − 15) / 20, 0, 1)
drop_ratio  = clamp(activity_drop_sigma / 3.0, 0, 1)
multiplier  = 0.55 + intensity × 0.25 + drop_ratio × 0.20
payout      = round(shift_baseline_earnings × multiplier)
payout      = clamp(payout, ₹100, ₹500)
```

A worker with a ₹310 dinner baseline in a 21mm/hr storm with a 2.5σ activity drop gets approximately **₹310 × 0.85 = ₹264**, floored at ₹100 and capped at ₹500. Workers can verify this themselves.

---

### AI-3 · Neural Net Fraud Detection (`GIC-NN-v3.2` — fraud head)

This is GIC's most sophisticated component. It combines **peer cohort comparison** with a **neural anomaly scorer** to distinguish genuine zone-wide disruptions from individual bad actors.

**Step 1 — Peer Activity Stats**

Before any fraud scoring, the system pulls the real-time activity of all same-platform, same-zone workers from MongoDB. If fewer than 5 real peers exist, it synthesises a deterministic cohort (seeded by zone, platform, and hour) for demo stability.

Peer metrics computed:
- `peerDrop` — average normalised activity drop across the cohort
- `peerMedianDrop` — median (robust to outliers)
- `peerDropStdDev` — standard deviation
- `peerLowActivityPct` — % of peers with a severe drop (≥0.55 normalised)
- `peerClaimRate` — claims per peer in the last 7 days
- `peerAvgPayout` — average payout across confirmed peer claims

**Step 2 — Five Fraud Signals (inputs to neural net):**
| Signal | Description | Weight in training |
|---|---|---|
| `peerDivScore` | How much worse is *this* worker vs zone peers? | 35% |
| `newAcctScore` | Account age at claim time (< 7 days = high risk) | 20% |
| `freqScore` | Claims filed in the past 7 days | 20% |
| `rainGapScore` | Severe activity drop at marginal rainfall | 15% |
| `temporalScore` | Temporal clustering of claims | 10% |

**Output:** Anomaly score 0–1, mapped to:
- `clean` (< 0.40) → payout proceeds immediately
- `soft` (0.40–0.65) → flagged for 2-hour review, payout held
- `hard` (> 0.65) → blocked, escalated to admin queue

All flags are persisted to MongoDB with full signal breakdown for audit. The admin can clear or reject each flag from the dashboard.

---

### Churn Prediction Neural Net (`GIC-CHURN-v3.2`)

**What it does:** Predicts the probability that a worker will stop renewing their policy.

**Inputs (6 features):** streak, total claims filed, premium-to-earnings ratio, days since last payout, zone risk, weeks enrolled.

**Used for:** Admin retention dashboards and proactive outreach to at-risk workers.

**Endpoint:** `GET /api/ai/churn-prediction/:workerId`

---

### Rainfall Trigger Forecast Neural Net (`GIC-FORECAST-v3.2`)

**What it does:** Predicts the probability of a triggering rainfall event for each day in the coming 7-day window, per zone.

**Inputs (5 features):** month (0–1), day of week (0–1), forecast rainfall average, zone flood propensity, seasonal weight.

**Output:** `trigger_probability` (0–1) mapped to `low / medium / high` risk, with expected rainfall and estimated payout if triggered.

**Used for:** The 7-day forecast panel in the admin dashboard, and the `safe-choice` proactive alert sent to workers the evening before a predicted disruption.

---

## The Traffic System

GIC's automated trigger monitor runs as a background daemon inside the Express process and is the heart of the "zero manual claims" promise.

### Trigger Monitor Loop

```
Runs on startup → then every 5 minutes
```

**For each active worker in MongoDB:**

1. **Fetch live weather** for the worker's zone from Open-Meteo (10-minute cache per zone)
2. **Check rain threshold** — if rainfall < zone threshold, skip worker this cycle
3. **Deduplicate by window** — `firedWindows` Set keyed by `workerId:YYYY-MM-DDTHH` prevents double-payout in the same hour
4. **Compute peer-informed activity drop:**
   - Pulls peer cohort activity (real DB data or deterministic synthetic)
   - `activityDrop = 1.2 + min(1.2, rainExcess/6) + peerJitter + stableNoise`
   - `stableNoise` uses FNV-1a hash of `workerId + windowKey` — same worker always gets the same noise for the same hour, preventing drift between monitor runs
5. **Adaptive activity threshold:**
   - >40% of peers low-activity → threshold drops to 1.3σ (zone-wide event confirmed)
   - 20–40% peers → 1.5σ threshold
   - <20% peers → 1.8σ threshold (requires stronger individual signal)
6. **Run AI-3 fraud check** — hard flags block auto-payout
7. **Create claim in MongoDB** with full peer context, rainfall, severity, and 4-minute auto-completion
8. **Log trigger history** to `TriggerHistory` collection

### Trigger State Machine

```
        ┌─────────┐
        │  CLEAR  │ ← rainfall < threshold
        └────┬────┘
             │ rainfall ≥ threshold
        ┌────▼──────────┐
        │  APPROACHING  │ ← 10–14.9 mm/hr
        └────┬──────────┘
             │ rainfall ≥ threshold AND activity drop confirmed
        ┌────▼──────────┐
        │   TRIGGERED   │ ← AI-3 evaluates
        └────┬──────────┘
          ┌──┴──┐
     clean/soft  hard
          │       │
        PAID    REVIEW
```

### Weather Caching Strategy

| Source | Cache TTL | Fallback |
|---|---|---|
| Open-Meteo (rainfall, temperature) | 10 minutes per zone | Rotating 6-state simulation cycle (30s intervals) |
| WAQI (AQI Chennai) | 30 minutes | Random 80–120 simulation |

The simulation fallback cycles through realistic weather states (4.2mm/hr normal → 21mm/hr triggered) to ensure the UI and trigger logic remain demonstrable without live API connectivity.

---

## External APIs

| Service | Purpose | Env Variable | Fallback |
|---|---|---|---|
| **Open-Meteo** | Live hourly rainfall (mm/hr) and temperature per zone | None (free, no key) | 6-state rotating simulation |
| **WAQI** | Chennai AQI for air quality trigger | `WAQI_TOKEN` | Random AQI 80–120 |
| **X.AI / Grok-3-mini** | In-app worker AI chat assistant | `XAI_API_KEY` | 8-intent rule-based fallback |
| **MongoDB Atlas** | Primary database for all collections | `MONGODB_URI` | None — app requires DB for prod |

### Open-Meteo Integration

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={zone_lat}&longitude={zone_lon}
  &hourly=precipitation
  &current_weather=true
  &timezone=Asia/Kolkata
  &forecast_days=1
```

The server extracts the current hour's precipitation bucket from the hourly array by matching the ISO timestamp to `current_weather.time`. No API key required.

### WAQI Integration

```
GET https://api.waqi.info/feed/chennai/?token={WAQI_TOKEN}
```

Returns `data.aqi` (integer). Used as a secondary trigger condition (AQI ≥ 300 is an air-quality disruption event). Currently displayed but not yet used as an independent payout trigger — planned for Phase 4.

### X.AI / Grok Chat Integration

```
POST https://api.x.ai/v1/chat/completions
{
  "model": "grok-3-mini",
  "max_tokens": 500,
  "temperature": 0.4,
  "messages": [{ "role": "system", ... }, ...conversation]
}
```

12-second timeout with AbortController. Falls back to a rule-based intent matcher covering 8 categories: premium, rain/triggers, fraud/flags, payouts, claims, zones, streaks, and general.

---

## API Reference

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/send-otp` | Initiate OTP login via phone number |
| `POST` | `/api/auth/verify-otp` | Verify OTP, return worker profile + JWT token |
| `POST` | `/api/auth/register` | Register new worker, creates Worker + Policy in DB |

### Worker

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/worker/:id` | Fetch worker profile |
| `GET` | `/api/worker/:id/policy` | Fetch active weekly policy |
| `GET` | `/api/worker/:id/claims` | Fetch full claim history with totals |
| `GET` | `/api/worker/:id/safe-choice` | Next-day proactive disruption alert |

### Coverage & Claims

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/worker/:id/covered-check` | Live "am I covered right now?" — runs full AI-3 peer check |
| `POST` | `/api/claims/trigger-check` | Manually trigger a claim evaluation (for testing or worker app) |
| `GET` | `/api/claims/:claimId` | Fetch individual claim details |

### Zone & Weather

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/zone/:zoneKey/conditions` | Live weather conditions for a zone with trigger state |
| `GET` | `/api/zone/:zoneKey/forecast` | 7-day neural net trigger probability forecast |

### AI Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai/calculate-premium` | Run AI-1 premium calculation for given inputs |
| `POST` | `/api/ai/chat` | AI chat assistant (Grok-3-mini or rule-based fallback) |
| `GET` | `/api/ai/model-info` | Full model registry: versions, features, training approach |
| `GET` | `/api/ai/churn-prediction/:workerId` | Churn probability for a worker |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/stats` | Platform-wide KPIs: policies, GPW, BCR, payouts, fraud flags |
| `GET` | `/api/admin/zones` | All 6 zones with live weather, BCR, worker count, threshold |
| `GET` | `/api/admin/fraud-flags` | Full fraud flag queue sorted by recency |
| `POST` | `/api/admin/fraud-flags/:id/resolve` | Resolve a flag: `{ "action": "clear" \| "reject" }` |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Full system health: DB, weather, ML engine status |
| `GET` | `/api/config` | Client config (Razorpay key ID for payment integration) |

---

## Admin Dashboard

The admin dashboard is embedded in `index.html` and provides full operational visibility over the GIC platform.

### Overview Panel

Shows live platform KPIs pulled from `/api/admin/stats`:
- **Active Policies** — total workers currently covered
- **Weekly GPW** — gross premium written (active policies × avg premium)
- **Average Premium** — ₹63 current blended average
- **Current BCR** — 62% baseline claim ratio across the pool
- **Total Payouts This Week** — count and rupee total
- **Avg Payout Time** — currently 3.8 minutes
- **Active Fraud Flags** — flags in `reviewing` or `flagged` status

### Zone Panel

Pulls from `/api/admin/zones` and displays all 6 Chennai zones:

| Zone | Risk Level | Active Workers |
|---|---|---|
| Velachery | 🔴 Critical | 421 |
| Adyar | 🟠 High | 847 |
| Guindy | 🟡 Medium | 556 |
| T. Nagar | 🟢 Low | 1,203 |
| Mylapore | 🟢 Low | 634 |
| Egmore | 🟢 Low | 892 |

Each zone card shows: live rainfall, BCR, adaptive threshold, weather source (Open-Meteo vs simulation).

### Fraud Flag Queue

Pulled from `/api/admin/fraud-flags`. Each flag shows:
- Worker ID and zone
- Anomaly score (0–1)
- Flag type: `soft` (yellow) / `hard` (red) / `cleared` (green)
- Full AI-3 signal breakdown: peerDiv, newAcct, frequency, rainGap, temporal
- Peer context: sample size, active count, low-activity %, claim rate
- **Clear** / **Reject** action buttons → `POST /api/admin/fraud-flags/:id/resolve`

### AI Model Info

Displays the full model registry from `/api/ai/model-info`:
- All 5 neural networks with feature counts and training approach
- Grok-3-mini chat status (live key vs fallback)
- Premium floor/ceiling
- Adaptive zone thresholds

---

## Database Models

### Worker
```
id, name, phone, platform (swiggy/zomato/etc), workerId, zone, zoneId,
upi, activeDays, joinDate, coverageStatus (building_baseline | active),
baselineEarnings { lunch, dinner, avg_orders_per_hr },
streak, riskTier, policyStart
```

### Policy
```
id, workerId, weekStart, weekEnd, premium, premiumBreakdown {
  base, zoneAdj, streakDiscount, forecastSurcharge, activityAdj
}, ml_info { model, confidence, claim_probability },
status, windows [ { type, start, end } ]
```

### Claim
```
id, workerId, date, shift, trigger, amount, status (processing | paid),
source (automated_monitor | manual_check), payoutTime, upi,
rainfall_mm_hr, activity_drop_sigma, severity_multiplier, weather_source,
fraud_check, ai1_approved, ai2_payout, ai2_severity,
ai3_approved, ai3_flag, ai3_anomaly_score,
peer_context { peer_drop, peer_low_activity_pct, peer_claim_rate,
  peer_sample_size, peer_active_count, source },
initiated_at, completed_at
```

### FraudFlag
```
id, workerId, zone, shift, type (soft | hard | clear),
reason, anomalyScore, signals {
  peerDivScore, peerDrop, peerMedianDrop, peerDropStdDev,
  peerLowActivityPct, peerClaimRate, peerAvgPayout,
  peerSampleSize, peerActiveCount, newAcctScore, freqScore,
  rainGapScore, temporalScore
},
anomaly_count, status (reviewing | flagged | cleared | rejected),
generated_at, resolved_at, source, model_version
```

### TriggerHistory
```
zone, rainfall, threshold, confirmed, timestamp
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18.0.0
- MongoDB Atlas cluster (free tier works)
- Optional: WAQI token, X.AI API key

### Install

```bash
git clone https://github.com/your-org/gic-backend
cd gic-backend
npm install
```

### Environment Setup

```bash
cp .env.example .env
# Fill in MONGODB_URI, WAQI_TOKEN, XAI_API_KEY
```

### Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

On startup the server will:
1. Connect to MongoDB Atlas and seed default worker/policy/claim/fraud data if the DB is empty
2. Train all 4 `brain.js` neural networks (takes ~5–10 seconds)
3. Start the trigger monitor daemon (runs every 5 minutes)
4. Listen on `http://localhost:3001`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ Yes | MongoDB Atlas connection string |
| `WAQI_TOKEN` | Optional | WAQI air quality API token — get free at [waqi.info](https://waqi.info/api) |
| `XAI_API_KEY` | Optional | X.AI API key for Grok-3-mini chat — get at [x.ai](https://x.ai) |
| `RAZORPAY_KEY_ID` | Optional | Razorpay key for payment integration (Phase 4) |
| `PORT` | Optional | Server port (default: 3001) |

---

## What Sets GIC Apart

**1. Fully Parametric — No Claim Forms**
Most gig worker insurance products still require manual filing and human adjudication. GIC is end-to-end automatic. A worker never touches the claims process.

**2. Peer-Validated Triggers**
GIC doesn't just look at one worker's activity. It benchmarks against a same-platform, same-zone cohort in real time. If 60% of Swiggy workers in Adyar show a drop, that's a zone event — not fraud. This is what makes the fraud detection genuinely smart rather than just a rule engine.

**3. Five Purpose-Built Neural Networks**
AI-1, AI-3, Churn, and Forecast are separate `brain.js` networks trained on domain-specific synthetic data. Each model's feature weights reflect real insurance actuarial logic, not generic ML scaffolding.

**4. Adaptive Zone Thresholds**
Velachery (chronic flooding) and Adyar (coastal) have different rain thresholds from T. Nagar. The trigger system knows this and adjusts automatically.

**5. Transparent Payout Math**
AI-2 is a published formula, not a black box. Workers can independently verify their payout by checking the rainfall value and their activity drop — every figure is surfaced in the claim response.

**6. Honest Fallbacks**
Every external dependency — weather, AQI, LLM chat — has a graceful, clearly labelled fallback. The `source` field in every API response tells you exactly whether the data is live or simulated.

**7. Sub-5-Minute Payouts**
The auto-claim pipeline targets ~4 minutes from trigger detection to UPI transfer. Manual insurance typically takes 2–4 weeks.

**8. Full Audit Trail**
Every claim stores its full AI-3 signal vector, peer context, rainfall reading, weather source, and timestamp. Every fraud flag stores its full signal breakdown. Nothing is a black box to the admin.

---

## Pitch Deck

Link for Pitch Deck - https://docs.google.com/presentation/d/1gg-y3pf1Vrq_z-IqS6rlKz-l2R6qjkZR/edit?usp=sharing&ouid=115617659625771048360&rtpof=true&sd=true

---

## Collaborators

<table align="center">
  <tr>
    <td align="center">
      <a href="https://github.com/Samarth230">
        <img src="https://github.com/Samarth230.png" width="80px"/><br/>
        <sub><b>Samarth230</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/rohanrpais">
        <img src="https://github.com/rohanrpais.png" width="80px"/><br/>
        <sub><b>rohanrpais</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/devu2406">
        <img src="https://github.com/devu2406.png" width="80px"/><br/>
        <sub><b>devu2406</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/Chandroja3011">
        <img src="https://github.com/Chandroja3011.png" width="80px"/><br/>
        <sub><b>Chandroja3011</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/AryanSingh2025">
        <img src="https://github.com/AryanSingh2025.png" width="80px"/><br/>
        <sub><b>AryanSingh2025</b></sub>
      </a>
    </td>
  </tr>
</table>

---

## Team

**CARDS** · Guidewire DEVTrails 2026 · Unicorn Chase
*GIC — Built for the 12 million gig workers in India who lose income every monsoon season with no recourse.*

