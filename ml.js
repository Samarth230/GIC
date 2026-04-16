const brain = require('brain.js');

let premiumNet  = null;
let fraudNet    = null;
let churnNet    = null;
let forecastNet = null;

function generatePremiumTrainingData() {
  const data = [];
  const zones   = [0.15, 0.42, 0.68, 0.90];
  const streaks = [0, 0.08, 0.17, 0.33, 0.5, 0.67, 1.0];
  const days    = [0, 0.17, 0.33, 0.5, 0.83, 1.0];
  const bcrs    = [0.4, 0.55, 0.65, 0.75, 0.85];

  for (const z of zones) {
    for (const s of streaks) {
      for (const d of days) {
        for (const b of bcrs) {
          for (const f of [0, 1]) {
            for (const season of [0.3, 0.5, 0.8]) {
              const risk = z * 0.25 + b * 0.20 + (1 - s) * 0.15 + f * 0.15 + season * 0.10 + (1 - d) * 0.10 + (Math.random() - 0.5) * 0.04;
              data.push({
                input:  [z, s, d, b, f, season],
                output: [Math.max(0, Math.min(1, risk))],
              });
            }
          }
        }
      }
    }
  }
  return data;
}

function generateFraudTrainingData() {
  const data = [];
  for (let i = 0; i < 800; i++) {
    const features = [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()];
    const score = features[0] * 0.30 + features[1] * 0.20 + features[2] * 0.22 + features[3] * 0.16 + features[4] * 0.12 + (Math.random() - 0.5) * 0.06;
    data.push({ input: features, output: [Math.max(0, Math.min(1, score))] });
  }
  return data;
}

function generateChurnTrainingData() {
  const data = [];
  for (let i = 0; i < 600; i++) {
    const features = [Math.random(), Math.random(), Math.random(), Math.random(), Math.random(), Math.random()];
    const churn = (1 - features[0]) * 0.25 + (1 - features[1]) * 0.10 + features[2] * 0.20 + features[3] * 0.20 + (1 - features[4]) * 0.10 + (1 - features[5]) * 0.15 + (Math.random() - 0.5) * 0.06;
    data.push({ input: features, output: [Math.max(0, Math.min(1, churn))] });
  }
  return data;
}

function generateForecastTrainingData() {
  const data = [];
  for (let i = 0; i < 500; i++) {
    const features = [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()];
    const trigger = features[2] * 0.35 + features[3] * 0.20 + features[4] * 0.25 + features[0] * 0.10 + features[1] * 0.05 + (Math.random() - 0.5) * 0.05;
    data.push({ input: features, output: [Math.max(0, Math.min(1, trigger))] });
  }
  return data;
}

function trainAllModels() {
  const netConfig = { hiddenLayers: [8, 6], learningRate: 0.01, iterations: 300, errorThresh: 0.01, log: false };

  console.log('[ML] Training AI-1 premium neural network...');
  premiumNet = new brain.NeuralNetwork(netConfig);
  const premData = generatePremiumTrainingData();
  const premResult = premiumNet.train(premData.slice(0, 500));
  console.log('[ML] AI-1 trained: error=' + (premResult.error || 0).toFixed(5) + ' iterations=' + (premResult.iterations || 0));

  console.log('[ML] Training AI-3 fraud detection neural network...');
  fraudNet = new brain.NeuralNetwork(netConfig);
  const fraudResult = fraudNet.train(generateFraudTrainingData());
  console.log('[ML] AI-3 trained: error=' + (fraudResult.error || 0).toFixed(5) + ' iterations=' + (fraudResult.iterations || 0));

  console.log('[ML] Training churn prediction neural network...');
  churnNet = new brain.NeuralNetwork(netConfig);
  const churnResult = churnNet.train(generateChurnTrainingData());
  console.log('[ML] Churn trained: error=' + (churnResult.error || 0).toFixed(5) + ' iterations=' + (churnResult.iterations || 0));

  console.log('[ML] Training rainfall forecast neural network...');
  forecastNet = new brain.NeuralNetwork(netConfig);
  const forecastResult = forecastNet.train(generateForecastTrainingData());
  console.log('[ML] Forecast trained: error=' + (forecastResult.error || 0).toFixed(5) + ' iterations=' + (forecastResult.iterations || 0));

  console.log('[ML] All 4 neural networks trained and ready');
}

function predictPremium(zoneRisk, streak, activeDays, bcr, forecastRisk, seasonal) {
  if (!premiumNet) return { premium: 55, confidence: 0, source: 'fallback' };
  const output = premiumNet.run([zoneRisk, Math.min(streak / 12, 1), activeDays / 30, bcr, forecastRisk ? 1 : 0, seasonal]);
  const raw = Number(Array.isArray(output) ? output[0] : (output[0] !== undefined ? output[0] : output));
  const premium = Math.round(29 + (89 - 29) * raw);
  return { premium: Math.max(29, Math.min(89, premium)), raw_score: parseFloat(raw.toFixed(4)), confidence: parseFloat((0.80 + raw * 0.15).toFixed(2)), source: 'brain_js_neural_net' };
}

function predictFraud(peerDiv, newAcct, claimFreq, rainGap, temporal) {
  if (!fraudNet) return { score: 0, source: 'fallback' };
  const output = fraudNet.run([peerDiv, newAcct, claimFreq, rainGap, temporal]);
  const raw = Array.isArray(output) ? output[0] : output;
  return { score: parseFloat(raw.toFixed(4)), source: 'brain_js_neural_net' };
}

function predictChurn(streak, totalClaims, premRatio, daysSincePayout, zoneRisk, weeksEnrolled) {
  if (!churnNet) return { churn_probability: 0, source: 'fallback' };
  const output = churnNet.run([streak, totalClaims, premRatio, daysSincePayout, zoneRisk, weeksEnrolled]);
  const raw = Array.isArray(output) ? output[0] : output;
  return { churn_probability: parseFloat(raw.toFixed(4)), source: 'brain_js_neural_net' };
}

function predictTrigger(month, dayOfWeek, forecastAvg, zoneFlood, seasonal) {
  if (!forecastNet) return { trigger_probability: 0, source: 'fallback' };
  const output = forecastNet.run([month, dayOfWeek, forecastAvg, zoneFlood, seasonal]);
  const raw = Array.isArray(output) ? output[0] : output;
  return { trigger_probability: parseFloat(raw.toFixed(4)), source: 'brain_js_neural_net' };
}

module.exports = { trainAllModels, predictPremium, predictFraud, predictChurn, predictTrigger };
