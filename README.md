# GIC — AI-Powered Parametric Income Insurance for India's Gig Economy

<div align="center">

**Guidewire DEVTrails 2026 | Phase 1 Submission**

</div>

---

## The Problem

A Zomato or Swiggy delivery partner in Chennai typically earns **Rs. 600–900** on a productive day. Most of this income—about **75%**—comes from two key time windows: **lunch (12:00–14:00)** and **dinner (19:00–22:00)**. When heavy rain, a spike in air pollution, or a curfew hits, these windows disappear. There's no insurance to cover this, and no platform compensates for the loss. The worker bears the full impact.

**GIC** changes that by automatically paying out when a worker's earning window is disrupted by a verified external event. No claims to file. No waiting period. No adjusters involved.

---

## Persona

### Food Delivery Partner — Zomato / Swiggy, Chennai

| Attribute | Detail |
|---|---|
| Weekly Earnings | Rs. 4,200–5,500 across two daily peak windows |
| Payment Method | UPI, weekly platform payouts |
| Insurance Need | Simple, background coverage — no complex forms or processes |

> **Real Scenario:** It's Friday evening in Adyar. Ravi starts his dinner shift at 19:20. Rainfall in his zone exceeds 18mm/hr. At the same time, his order acceptance rate drops sharply from his usual 7.2 orders/hr to zero. Both conditions trigger a claim. GIC calculates his expected earnings for the dinner window based on his personal baseline and pays **Rs. 310** directly to his UPI account within **4 minutes**. Ravi doesn't have to do a thing.

---

## Core Architecture — Dual-Trigger Parametric Model

Most parametric insurance platforms rely on a single external signal, which can cause false alarms, like rain falling but the worker still operating normally. GIC requires **two independent triggers** before paying out:

- **Trigger 1 (External):** A verifiable disruption in the worker's zone, such as weather, AQI, traffic, or civic alerts.
- **Trigger 2 (Behavioral):** The worker's activity drops more than **1.5 standard deviations** below their personal earnings baseline over the past 4 weeks.

If only Trigger 1 activates, the claim goes on a **2-hour soft hold** with no immediate payout. If both triggers fire, the claim is processed instantly. This approach means GIC insures **actual income loss**, not just external events. Every other feature is built around this principle.

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
| Heavy Rainfall | OpenWeather API | >15mm/hr for 30 minutes in zone | Deliveries halted |
| Extreme Heat | OpenWeather API | Temperature >42°C during shift | Order volumes drop, outdoor risk |
| Severe AQI | OpenWeather Pollution API | AQI above 300 in operating zone | Outdoor activity inadvisable |
| Zone Closure | Mock Traffic API | Route blockage index above threshold | Pickup/drop locations inaccessible |
| Civic Disruption | Mock Civic Alert Feed | Curfew, strike, or market closure in zone | Worker can't access zones |

> Triggers are **zone-specific**, not city-wide. Rain in Velachery won't trigger a payout for a worker in Anna Nagar.

---

## Weekly Premium Model

**Base premium: Rs. 79/week** covering up to 3 peak earning windows.

Premiums recalculate every Sunday night with **no manual renewal needed**.

| Factor | Adjustment |
|---|---|
| Low-risk zone (historical) | Up to Rs. 15 discount |
| High-risk zone | Up to Rs. 20 increase |
| Claim-free streak (per week) | Rs. 3 discount, capped at Rs. 18 |
| Elevated claim frequency | Up to Rs. 12 increase |
| Forecasted disruption next week | Up to Rs. 10 surcharge |
| Safe Choice recommendation followed | Rs. 5 discount |

**Premium range: Rs. 49 (floor) to Rs. 149 (ceiling)**

**Payout formula:** Worker's 4-week average earnings for the disrupted window × disruption severity multiplier (0.6–1.0 depending on trigger intensity and duration).

---

## Four Key Features

### 1. Dual-Trigger Engine
Combining external and behavioral triggers to ensure payouts reflect real income loss, not just weather events. This design integrates fraud detection, payout accuracy, and business viability seamlessly.

### 2. Safe Choice Card
When a disruption is forecast 2–48 hours ahead, workers get proactive alerts: *"Heavy rain expected in your zone tomorrow 19:00–22:00. Your dinner window is covered. Estimated payout: Rs. 310."* This helps workers plan shifts better and reduces moral hazard. Following Safe Choice recommendations earns loyalty discounts.

### 3. City Risk Heatmap
An interactive zone-level map showing current risk, active triggers, estimated payouts, and policy counts. Workers can tap their zone to view their Workability Index and coverage status. Insurers get real-time loss ratios and claim likelihood forecasts. The heatmap acts as the platform's command center.

### 4. Living Policy (Auto-Optimizing Subscription)
No renewals or manual top-ups. Every Sunday, premiums update based on zone risk, claims history, loyalty, and forecast data. Policies automatically adjust with changing weather and seasonal risks, ensuring continuous, relevant coverage.

---

## AI and ML Integration

### Premium Scoring Engine
- **Phase 1:** Rule-based weighted scoring using zone risk, worker history, and forecast data.
- **Phase 2 goal:** Gradient Boosted Tree model trained on synthetic data to predict premiums and zone risk tiers.

### Income Loss Estimator
Keeps a rolling **4-week earnings baseline** per worker per shift type. Payouts trigger only if activity drops more than **1.5 standard deviations** during confirmed disruptions, avoiding payments when workers continue earning despite adverse conditions.

### Fraud Detection
- Checks consistency between external triggers and behavioral drops.
- Cross-references GPS location against declared zones.
- Uses **Isolation Forest** to flag unusual claim patterns compared to peers.
- Prevents duplicate claims by linking each to unique event, worker, and time window IDs.

---

## Platform Choice: Progressive Web App

A PWA removes the friction of app store installs, serving both mobile workers and desktop insurers with a single codebase. Workers can access the platform instantly through a browser link.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React (TypeScript), Tailwind CSS, Leaflet.js (heatmap), PWA |
| **Backend** | Node.js, Express, PostgreSQL, Redis |
| **ML Service** | Python, FastAPI, scikit-learn, Isolation Forest |
| **Weather** | OpenWeather API (Current, Forecast, Pollution) |
| **Traffic** | Mock Traffic API |
| **Platform Activity** | Simulated Delivery Platform API |
| **Payments** | Razorpay Test Mode / Stripe Sandbox |
| **Infrastructure** | Docker, Vercel, Railway, GitHub Actions |

---

## Development Timeline

| Phase | Period | Focus |
|---|---|---|
| **Phase 1** | March 4–20 | Architecture design, schema setup, UI mockups, repository creation |
| **Phase 2** | March 21–April 4 | User onboarding, policy creation, dual-trigger engine, dynamic premiums, claims management, fraud detection, payout flow integration |
| **Phase 3** | April 5–17 | ML upgrades, enhanced fraud detection, full heatmap and dashboards, Safe Choice alerts, performance tuning, final demo and pitch deck |

---

## Business Viability

Workers pay **Rs. 79/week**. With an average payout of Rs. 280 and about 1.4 claims per quarter, the loss ratio remains sustainable through zone diversification—low-risk zones subsidize high-risk ones. Loyalty incentives reduce claims frequency.

The strongest distribution model is **B2B2C**. Delivery platforms face worker churn and reduced fulfillment during disruptions. By subsidizing Rs. 30 per worker weekly, platforms can lower worker costs to Rs. 49 and solve their retention challenges. With 10,000 active workers, weekly gross written premium hits **Rs. 7.9 lakh**, making a single-city deployment viable before scaling.

---

## Adversarial Defense and Anti-Spoofing Strategy

A worker installs a GPS spoofing app, places their location inside a high-risk weather zone on the map, and waits for the external trigger to fire. Coordinate-level verification alone cannot catch this. The defense has to come from somewhere else.

---

### 1. Differentiation — Stranded Worker vs. Bad Actor

The dual-trigger model is the first line of defense. A spoofer sitting at home is either still active on the platform — in which case the behavioral trigger never fires and no claim initiates — or they log off to fake inactivity, which the platform API records as **offline by choice** rather than **online and unable to work**. These are distinct states. The architecture handles the basic attack without any additional logic.

For more deliberate attempts, the fraud engine checks three additional signals at claim time:

- **Motion data:** A worker on a two-wheeler produces continuous accelerometer variance from road movement. A stationary phone does not. GPS spoofing fakes coordinates. It does not fake inertial sensor output.
- **Network state:** Workers in the field are on mobile data. A claim originating from a device on a home WiFi network is inconsistent with being stranded outdoors in a disrupted zone.
- **Zone history:** Each worker builds an operating zone profile over their first four weeks. A claim from a zone they have never worked in, with no movement data showing how they got there, is flagged regardless of whether the external trigger is real.

> Three concurrent anomalies are required before a claim escalates. One unusual signal — GPS drift in heavy rain, a mid-shift network switch — is a normal byproduct of working in bad weather, not evidence of fraud.

---

### 2. Data Points for Detecting a Coordinated Ring

When a cluster of workers files claims for the same trigger window in the same zone, the system compares their behavioral fingerprints against each other rather than checking each claim in isolation.

A genuine mass disruption produces varied signals across the group — different motion profiles, different order drop timings, different network transitions. **People caught in the same storm still behave differently.** A coordinated ring filing simultaneously tends to produce patterns that are too uniform to reflect individual behavior. The system flags high behavioral correlation within a zone cluster as a syndicate indicator.

Two additional checks run in parallel:

- **New account velocity:** Workers who onboard together and all file claims in the same trigger event within their first two weeks are a statistical outlier. Legitimate first-time claims distribute randomly across events, not in synchronized clusters.
- **Device fingerprinting:** Multiple accounts traced to the same physical device are flagged regardless of claim behavior.

---

### 3. UX Balance — Flagged Claims Without Penalizing Honest Workers

A worker caught in a genuine flood may have degraded GPS, a dropped connection, or an unfamiliar route that puts them outside their usual zone. These are predictable side effects of working in the exact conditions GIC covers. Binary approve-or-reject would punish the people the product exists to protect.

The system uses two states instead:

| State | Condition | Outcome |
|---|---|---|
| **Soft flag** | One or two anomalies | 2-hour grace review; most genuine claims resolve automatically |
| **Hard flag** | Three or more anomalies | Held for insurer review; worker notified with estimated resolution time |

The signals that triggered the flag are not disclosed — there is no reason to show a bad actor what they need to correct next time.

> A single flagged claim does not touch the worker's premium or standing. The risk profile only updates after a confirmed pattern across multiple events, not a single incident.

---

## Collaborators

<p align="center">
  <a href="https://github.com/Samarth230">
    <img src="https://github.com/Samarth230.png" width="80px;" alt="Samarth230"/>
  </a>
  <a href="https://github.com/AryanSingh2025">
    <img src="https://github.com/AryanSingh2025.png" width="80px;" alt="AryanSingh2025"/>
  </a>
  <a href="https://github.com/Chandroja3011">
    <img src="https://github.com/Chandroja3011.png" width="80px;" alt="Chandroja3011"/>
  </a>
  <a href="https://github.com/devu2406">
    <img src="https://github.com/devu2406.png" width="80px;" alt="devu2406"/>
  </a>
  <a href="https://github.com/rohanrpais">
    <img src="https://github.com/rohanrpais.png" width="80px;" alt="rohanrpais"/>
  </a>
</p>

<p align="center">
  <b>Samarth</b> &nbsp;&nbsp;
  <b>Aryan Singh</b> &nbsp;&nbsp;
  <b>Chandroja</b> &nbsp;&nbsp;
  <b>Devu</b> &nbsp;&nbsp;
  <b>Rohan Pais</b>
</p>

---

<div align="center">
  <sub>Guidewire DEVTrails 2026 — Phase 1 Submission</sub>
</div>
