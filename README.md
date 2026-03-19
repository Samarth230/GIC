# GIC— AI-Powered Parametric Income Insurance for India's Gig Economy

**Guidewire DEVTrails 2026 | Phase 1 Submission**

---

## The Problem

A Zomato or Swiggy delivery partner in Chennai earns Rs. 600–900 on a productive day. Nearly 75% of that comes from two windows — lunch (12:00–14:00) and dinner (19:00–22:00). When heavy rain, an AQI spike, or a curfew hits, those windows are gone. No insurer covers this. No platform compensates for it. The worker absorbs the entire loss.

GIC pays out automatically when a worker's earning window is disrupted by a verifiable external event. No claim forms. No waiting period. No adjuster.

---

## Persona

**Food Delivery Partner — Zomato / Swiggy, Chennai**

- Earns Rs. 4,200–5,500 per week across two daily peak windows
- Owns a smartphone, transacts via UPI, receives platform payouts weekly
- Has zero tolerance for complex insurance UX — needs a product that works silently in the background

**Real Scenario:** It is Friday evening in Adyar. Ravi logs on for his dinner shift. At 19:20, rainfall in his zone crosses 18mm/hr. His order acceptance rate simultaneously drops from his 4-week average of 7.2 orders/hr to 0. Both conditions fire together. GIC initiates a claim, calculates his expected dinner-window earnings from his personal baseline, and pays Rs. 310 to his UPI account within 4 minutes. Ravi does not file anything.

---

## Core Architecture — Dual-Trigger Parametric Model

Most parametric platforms trigger on a single external signal. This creates false positives — it rains, but the worker continues operating normally. GIC requires two independent signals before any payout is initiated:

- **Trigger 1 (External):** Verifiable disruption in the worker's zone — weather, AQI, traffic, or civic alert API
- **Trigger 2 (Behavioral):** Worker's activity drops more than 1.5 standard deviations below their personal 4-week earnings baseline

If only Trigger 1 fires: 2-hour soft-hold, no payout. If both fire: instant automated claim. This is not just fraud prevention — it means GIC insures actual income loss, not weather events. Every other product feature in the platform connects back to this decision.

```
External Trigger (Weather / AQI / Traffic / Civic)
                    +
Behavioral Drop (Activity vs. Personal Baseline)
                    |
                    v
         Automatic Claim Initiation
                    |
                    v
          Fraud Validation Layer
                    |
                    v
       Income Loss Calculation (Baseline x Severity)
                    |
                    v
        Instant UPI / Wallet Payout
                    |
                    v
       Premium Adjusted Next Weekly Cycle
```

---

## Parametric Triggers

| Trigger | Source | Threshold | Income Loss Pathway |
|---|---|---|---|
| Heavy Rainfall | OpenWeather API | More than 15mm/hr for 30 minutes in worker's zone | Deliveries halted |
| Extreme Heat | OpenWeather API | Temperature above 42°C during active shift | Order volumes drop, outdoor risk |
| Severe AQI | OpenWeather Pollution API | AQI above 300 in operating zone | Outdoor activity inadvisable |
| Zone Closure | Mock Traffic API | Route blockage index above threshold | Pickup/drop locations inaccessible |
| Civic Disruption | Mock Civic Alert Feed | Curfew, strike, or market closure in zone | Worker cannot access assigned zones |

All triggers are zone-specific, not city-wide. Rain in Velachery does not trigger a payout for a worker in Anna Nagar.

---

## Weekly Premium Model

**Base premium: Rs. 79/week** covering up to 3 peak earning windows.

Recalculated every Sunday night. Never requires manual renewal.

| Factor | Adjustment |
|---|---|
| Low-risk zone (historically) | Up to Rs. 15 reduction |
| High-risk zone | Up to Rs. 20 increase |
| Claim-free streak (per week) | Rs. 3 reduction, capped at Rs. 18 |
| Elevated claim frequency | Up to Rs. 12 increase |
| Forecasted disruption next week | Up to Rs. 10 surcharge |
| Safe Choice recommendation followed | Rs. 5 reduction |

**Floor: Rs. 49 — Ceiling: Rs. 149**

**Payout formula:** Worker's 4-week average earnings for the disrupted window type x disruption severity multiplier (0.6–1.0 based on trigger intensity and duration).

---

## Four Differentiating Features

**1. Dual-Trigger Engine**
Described above. The architectural decision that makes fraud detection, payout accuracy, and business viability coherent rather than bolted on separately.

**2. Safe Choice Card**
When a disruption is forecast 2–48 hours ahead, the worker sees a proactive alert: "Heavy rain predicted in your zone tomorrow 19:00–22:00. Your dinner window is covered. Estimated payout if triggered: Rs. 310." Workers make informed shift decisions. Insurers reduce moral hazard. Workers who follow Safe Choice recommendations receive a loyalty discount on the next week's premium.

**3. City Risk Heatmap**
A zone-level operational map showing per tile: current risk level, whether a coverage trigger is active, estimated payout if disruption confirmed now, and active policy count. Workers tap their zone to see their Workability Index and personal coverage status. Insurers see zone-level loss ratios and predicted claim likelihood for the next 24 hours. The heatmap is the command center of the platform, not a decorative chart.

**4. Living Policy (Auto-Optimizing Subscription)**
No renewals, no manual top-ups. Every Sunday the system recalculates the worker's premium based on zone risk, claim history, loyalty, and forecast data. The worker receives one notification with their updated premium for the week. As seasons shift (monsoon onset, summer heatwaves), the policy automatically extends coverage to relevant new triggers. Insurance that manages itself.

---

## AI and ML Integration

**Premium Scoring Engine**
Phase 1: Rule-based weighted scoring across zone risk, worker history, and forecast data.
Phase 2 target: Gradient Boosted Tree model trained on synthetic disruption and earnings data.
Output: Weekly premium value and zone-level risk tier.

**Income Loss Estimator**
Rolling 4-week earnings baseline per worker per window type. Payout triggered only when activity drops below 1.5 standard deviations during a confirmed external trigger. Prevents payout when disruption occurs but worker continues earning normally.

**Fraud Detection**
- Cross-signal consistency: If external trigger fires but worker activity does not drop, claim is automatically rejected.
- Path plausibility: Worker's GPS location cross-referenced against declared operating zone at claim time.
- Claim pattern anomaly: Isolation Forest model on simulated claim history flags workers whose frequency or payout amounts deviate significantly from zone peer group.
- Duplicate prevention: Each claim tied to a unique trigger event ID, worker ID, and time window at database level.

---

## Platform Choice: Progressive Web App

A PWA removes the app store installation barrier for the target demographic while serving the same codebase to mobile workers and desktop insurers. Live demos are accessible via browser link without installation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (TypeScript), Tailwind CSS, Leaflet.js (heatmap), PWA |
| Backend | Node.js, Express, PostgreSQL, Redis |
| ML Service | Python, FastAPI, scikit-learn, Isolation Forest |
| Weather | OpenWeather API (Current, Forecast, Air Pollution) |
| Traffic | Mock Traffic API |
| Platform Activity | Simulated Delivery Platform API |
| Payments | Razorpay Test Mode / Stripe Sandbox |
| Infrastructure | Docker, Vercel, Railway, GitHub Actions |

---

## Development Timeline

**Phase 1 (March 4–20):** Architecture design, schema definition, UI mockups, repository setup.

**Phase 2 (March 21–April 4):** Functional onboarding, policy creation, dual-trigger engine, dynamic premium calculation, claims management, fraud detection, Razorpay/Stripe payout flow.

**Phase 3 (April 5–17):** ML model upgrade, advanced fraud detection, full heatmap dashboard, worker and insurer dashboards, Safe Choice forecast alerting, performance optimization, final demo and pitch deck.

---

## Business Viability

Workers pay Rs. 79/week. At an average payout of Rs. 280 and 1.4 claims per quarter, the loss ratio is manageable through zone diversification — low-risk zones subsidize high-risk ones, and the loyalty structure reduces claims frequency among consistent workers.

The stronger distribution model is B2B2C. Delivery platforms face worker churn and fulfillment drops during disruptions. A platform subsidizing Rs. 30/worker/week reduces the worker's cost to Rs. 49 while solving a retention problem the platform already has. At 10,000 active workers, weekly gross written premium is Rs. 790,000 — viable for a single-city deployment before any expansion.

---