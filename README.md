# GIC — Gig Income Coverage

### Guidewire DEVTrails 2026 · Phase 2 Submission · Unicorn Chase

> AI-powered parametric insurance for India's platform-based delivery workers.
> Zero claims. Automatic payouts. Built for the gig economy.

---

## The Problem

India's gig delivery workers (Zomato, Swiggy, Zepto, Amazon Flex) lose **20–30% of their monthly earnings** to external disruptions they cannot control — extreme rain, dangerous AQI, sudden curfews. They have no income protection, no claims process that works for them, and no safety net.

**GIC** solves this with a fully automated parametric insurance platform that:

- Pays workers **before they even know they qualify**
- Requires **zero steps** from the worker to receive a payout
- Operates on a **weekly pricing model** aligned with gig worker earnings cycles
- Covers **loss of income only** — no health, life, accident, or vehicle coverage

---

## Architecture

```mermaid
flowchart LR
    subgraph Worker
        A[📱 Registration] --> B[📍 Location Detect]
        B --> C[💳 Pay Premium]
    end

    subgraph Engine["GIC Engine"]
        D[🌧 Weather API] --> F{Dual Trigger}
        E[📉 Activity Feed] --> F
        F -->|Both met| G[AI-1 Eligibility]
        G --> H[AI-2 Payout Calc]
        H --> I[AI-3 Peer Check]
    end

    subgraph Payout
        I -->|Approved| J[💰 UPI Transfer]
        I -->|Flagged| K[🚩 Fraud Queue]
    end

    C --> D
    J --> L[✅ Worker Notified]
```

---

## Key Features

### Registration & Location Detection
- 3-step onboarding: Phone OTP → Platform + Worker ID → Zone + UPI
- **Browser Geolocation API** with Haversine distance → nearest zone auto-selected
- Detected zone shown with risk level card and color-coded dot
- Manual dropdown fallback if location is denied

### Premium Payment (Razorpay)
- "Pay Premium →" button inside the worker dashboard sidebar
- Razorpay Checkout (test mode) — real payment modal with UPI/card/netbanking
- Graceful offline fallback: simulates success when SDK unavailable
- On success: payment ID displayed, button locked to "Paid ✓", coverage status updated
- Key served at runtime via `/api/config` — never hardcoded in source

### Dynamic Premium Calculation (AI-1)

```
Weekly Premium = Base (₹39) + Zone Adj + Streak Discount + Forecast Surcharge
Floor: ₹39 / Ceiling: ₹89 / Target BCR: 0.55–0.70
```

| Factor | Example (Adyar) |
|---|---|
| Base premium | ₹29 |
| Zone adjustment (high risk) | +₹12 |
| Streak discount (4 clean weeks) | −₹16 |
| Forecast surcharge (rain expected) | +₹8 |
| **This week** | **₹33** |

### Claims Management (Automated, Zero-Touch)
4-step automated flow — no worker action required:
1. Trigger fires (OpenWeather / CPCB API)
2. Policy eligibility check (active + correct zone + no duplicate)
3. Three-AI fraud verification
4. Payout released via UPI within minutes

### Interactive Dashboard
- **Live SVG map** of Chennai with 6 zone polygons, risk-colored overlays, and worker position
- **Real-time weather cycling** — conditions evolve every 30 seconds in demo
- **"Will I be covered?"** button — instant parametric check against current conditions
- **AI Q&A chatbot** — natural language answers about policy, triggers, and payouts
- **Admin view** — BCR bars per zone, fraud flag queue, platform-wide analytics

---

## The Three-AI Fraud Defense

The most differentiated feature in GIC. No single AI can approve a payout alone.

| AI | Role | Method |
|---|---|---|
| **AI-1** | Premium Engine | Weighted scoring → weekly premium + risk tier |
| **AI-2** | Payout Calculator | Trigger intensity × duration × baseline earnings |
| **AI-3** | Peer Comparison | Cross-checks worker behavior against zone peers |

> **AI-3 is the unique signal:** If it's genuinely too rainy to work, *most* workers in that zone show the same activity drop. If peers are active but one worker claims disruption — that's a flag.

---

## Parametric Triggers

| Trigger | Source | Threshold |
|---|---|---|
| Heavy Rainfall | OpenWeather API | >15mm/hr for 30 min |
| Extreme Heat | OpenWeather API | >42°C during shift |
| Severe AQI | CPCB / OpenWeather | AQI >300 |
| Zone Closure | Traffic API (mock) | Blockage above threshold |
| Civic Disruption | Civic Alert Feed | Curfew / strike |

---

## Persona

**Food Delivery Workers — Swiggy/Zomato, Chennai**

Ravi Kumar. Adyar zone. Earns ₹175 lunch / ₹310 dinner on a good day. Loses everything when it rains.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5 · CSS3 · Vanilla JS (single-file) |
| Backend | Node.js · Express · In-memory store |
| AI / ML | Rule-based weighted scoring → Gradient Boosted Trees (planned) |
| Maps | Custom SVG (Chennai zones) → Leaflet.js (planned) |
| Weather | OpenWeather API (mock data in current phase) |
| Payments | Razorpay Checkout (test mode) · UPI |
| Location | Browser Geolocation API + Haversine distance |
| Security | dotenv · `.env.example` pattern · key_id served via API |
| Infra | Docker · Vercel · Railway · GitHub Actions |

---

## Running the Project

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/Dev_Trail.git
cd Dev_Trail
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and add your Razorpay credentials:
```
RAZORPAY_KEY_ID=rzp_test_YourKeyHere
RAZORPAY_KEY_SECRET=YourSecretHere
```

> Get keys from: [Razorpay Dashboard](https://dashboard.razorpay.com) → Settings → API Keys

### 3. Start the Server

```bash
node server.js
# API available at http://localhost:3001
```

### 4. Open the App

Open `index.html` in your browser. The frontend works standalone (mock fallbacks), but connecting to the backend enables live API features.

---

## Demo Flows

| # | Flow | How to trigger |
|---|---|---|
| 1 | **Onboarding** | Auto-plays on first visit (or click "Watch demo") |
| 2 | **Worker login** | Sign in → Phone `98765 43210` → any 6-digit OTP |
| 3 | **New registration** | Sign in → any other phone → OTP → registration form |
| 4 | **Location detect** | In registration → "Detect my location" button |
| 5 | **Dashboard** | After login → live map, conditions, risk strip |
| 6 | **Coverage check** | Dashboard → "Will I be covered?" button |
| 7 | **Pay premium** | Dashboard sidebar → "Pay Premium →" → Razorpay modal |
| 8 | **Admin dashboard** | Sign in → Admin tab → any credentials |
| 9 | **Dual-trigger demo** | Landing page → interactive sliders |

---

## API Reference

```
GET  /api/health                    Server health check
GET  /api/config                    Frontend config (Razorpay key_id)

POST /api/auth/send-otp             Send OTP to phone
POST /api/auth/verify-otp           Verify OTP, check if new/returning
POST /api/auth/register             Complete worker registration

GET  /api/worker/:id                Worker profile
GET  /api/worker/:id/policy         Active policy details
GET  /api/worker/:id/claims         Claims history
POST /api/worker/:id/covered-check  Real-time coverage check
GET  /api/worker/:id/safe-choice    Safe Choice alert

GET  /api/zone/:key/conditions      Live weather + trigger status
GET  /api/zone/:key/forecast        7-day risk forecast

POST /api/ai/calculate-premium      AI-1 premium calculation
POST /api/claims/trigger-check      Automated trigger + AI-3 check

GET  /api/admin/stats               Platform-wide metrics
GET  /api/admin/fraud-flags         AI-3 fraud flag queue
POST /api/admin/fraud-flags/:id/resolve  Resolve fraud flag
GET  /api/admin/zones               All zones with BCR
```

---

## Project Structure

```
Dev_Trail/
├── index.html          Single-file frontend (HTML + CSS + JS)
├── server.js           Express API server (mock data, 18 endpoints)
├── package.json        Node.js dependencies
├── .env                Environment variables (gitignored)
├── .env.example        Template for .env (committed)
├── .gitignore          Excludes node_modules, .env, OS files
└── README.md           This file
```

---

## For Platforms

GIC is designed as a rider benefit that costs platforms almost nothing:

- **Worker pays** the weekly premium (₹39–89)
- **Platform contributes** a small co-pay or data feed
- **Result:** improved rider retention, reduced churn during bad weather, ESG compliance

---

## Constraints Confirmed

- ✅ Coverage: **loss of income ONLY** — no health, life, accident, vehicle repair
- ✅ Pricing: **Weekly** premium model (₹39–89/week)
- ✅ Persona: **Food delivery** (Swiggy/Zomato), Chennai
- ✅ No manual claims process — fully parametric and automated
- ✅ Privacy: Location used **only** for zone detection — never stored or shared


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

**GIC** · Guidewire DEVTrails 2026 · Unicorn Chase
