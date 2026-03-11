import { detectVehicleFromMessage, detectCustomerIntents, BRAND_ALIASES } from './server/vehicleDetectionService';

// Simulate the vehicles in DB
const mockVehicles = [
  { id: 1, brand: 'Ford', model: 'Tourneo Connect', modelYear: 2022, price: 62.8, priceDisplay: '62.8萬', displacement: '2.0L', mileage: '6.6萬公里', status: 'available' },
  { id: 2, brand: 'BMW', model: 'X1', modelYear: 2015, price: 37.8, priceDisplay: '37.8萬', displacement: '2.0L', status: 'available' },
  { id: 3, brand: 'Honda', model: 'CR-V', modelYear: 2023, price: 103.8, priceDisplay: '103.8萬', displacement: '1.5L', status: 'available' },
];

const msg = '想去看 ford 那台，你們地址在哪';
const lower = msg.toLowerCase();

console.log('=== Testing: "' + msg + '" ===\n');

// Step 1: Normalize
let normalized = msg;
for (const [alias, brand] of Object.entries(BRAND_ALIASES)) {
  normalized = normalized.replace(new RegExp(alias, 'gi'), brand);
}
console.log('1. Normalized:', normalized);
console.log('   Normalized upper:', normalized.toUpperCase());

// Step 2: Check brand matching
for (const v of mockVehicles) {
  const brandUpper = v.brand.toUpperCase();
  const modelUpper = v.model.toUpperCase();
  const normalizedUpper = normalized.toUpperCase();
  console.log(`\n2. Checking ${v.brand} ${v.model}:`);
  console.log(`   Brand "${brandUpper}" in "${normalizedUpper}": ${normalizedUpper.includes(brandUpper)}`);
  console.log(`   Model "${modelUpper}" in "${normalizedUpper}": ${normalizedUpper.includes(modelUpper)}`);
}

// Step 3: Check carKeywords
const carKeywords = /車|多少|價格|cc|排氣|配備|里程|油耗|還在|照片|看看|那台|這台|那個|這個|來看|去看|想看|要看|看車|預約|時間|方便|地址|在哪|店裡|店面|試駕|買|要買|想買|要|想要|嗜|感興趣|有興趣|下訂|訂車/;
console.log('\n3. carKeywords match:', carKeywords.test(msg));
console.log('   "那台" in msg:', msg.includes('那台'));
console.log('   "去看" in msg:', msg.includes('去看'));
console.log('   "地址" in msg:', msg.includes('地址'));
console.log('   "在哪" in msg:', msg.includes('在哪'));

// Step 4: Full detection
const result = detectVehicleFromMessage(msg, mockVehicles);
console.log('\n4. Full detection result:', JSON.stringify(result, null, 2));

// Step 5: Intent detection
const intents = detectCustomerIntents(msg);
console.log('\n5. Intents:', intents);
