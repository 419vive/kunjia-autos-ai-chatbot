import { detectCustomerIntents, detectVehicleFromMessage } from './server/vehicleDetectionService';

const testMessages = [
  '想去看 ford 那台，你們地址在哪',
  '怎麼看？',
  '怎麼看車',
  '在哪看車',
  '我想平日上午去看車',
  '我的電話是0961014789',
];

for (const msg of testMessages) {
  const intents = detectCustomerIntents(msg);
  const vehicle = detectVehicleFromMessage(msg, []);
  console.log(`\n"${msg}"`);
  console.log(`  intents: [${intents.join(', ')}]`);
  console.log(`  vehicle: type=${vehicle.type}, vehicle=${vehicle.vehicleName || 'none'}`);
}
