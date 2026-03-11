import { getDb } from './server/db';
import { vehicles } from './drizzle/schema';

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }

  const allVehicles = await db.select().from(vehicles);
  
  console.log(`\n=== DB has ${allVehicles.length} vehicles ===\n`);
  
  for (const v of allVehicles) {
    console.log(`--- ${v.brand} ${v.model} (ID: ${v.externalId}) ---`);
    console.log(`  Status: ${v.status}`);
    console.log(`  Price: ${v.price} (${v.priceDisplay})`);
    console.log(`  Year: ${v.modelYear}`);
    console.log(`  Color: ${v.color}`);
    console.log(`  Mileage: ${v.mileage}`);
    console.log(`  Transmission: ${v.transmission}`);
    console.log(`  FuelType: ${v.fuelType}`);
    console.log(`  Displacement: ${v.displacement}`);
    console.log(`  Title: ${v.title}`);
    console.log(`  Photos: ${v.photoCount} photos`);
    console.log(`  Source: ${v.sourceUrl}`);
    console.log(`  Description: ${v.description?.substring(0, 80)}`);
    console.log();
  }

  // Now fetch one vehicle from 8891 to compare
  const testId = allVehicles[0]?.externalId;
  if (testId) {
    console.log(`\n=== Fetching 8891 data for vehicle ${testId} ===\n`);
    const res = await fetch(`https://m.8891.com.tw/auto?id=${testId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-TW,zh;q=0.9",
      },
    });
    const html = await res.text();
    const match = html.match(/__NEXT_DATA__[\s\S]*?type="application\/json">([\s\S]*?)<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      const ds = data.props?.pageProps?.dataSource;
      if (ds) {
        console.log(`  8891 Title: ${ds.title}`);
        console.log(`  8891 SubTitle: ${ds.subTitle}`);
        console.log(`  8891 Price: ${JSON.stringify(ds.price)}`);
        console.log(`  8891 isOnSale: ${ds.isOnSale}`);
        console.log(`  8891 Extended: ${JSON.stringify(ds.extended)}`);
        console.log(`  8891 Images thumbnails: ${(ds.images?.thumbnail || []).length} photos`);
        console.log(`  8891 Mileage: ${ds.extended?.mileage}`);
        console.log(`  8891 Transmission: ${ds.extended?.transmission}`);
        console.log(`  8891 FuelType: ${ds.extended?.fuelType}`);
        console.log(`  8891 BodyType: ${ds.extended?.bodyType}`);
        
        // Compare with DB
        const dbV = allVehicles[0];
        console.log(`\n=== DIFF for ${testId} ===`);
        if (dbV.price !== ds.price?.price?.replace(/[^\d.]/g, "")) console.log(`  PRICE DIFF: DB="${dbV.price}" vs 8891="${ds.price?.price}"`);
        if (dbV.mileage !== (ds.extended?.mileage || "")) console.log(`  MILEAGE DIFF: DB="${dbV.mileage}" vs 8891="${ds.extended?.mileage}"`);
        if (dbV.transmission !== (ds.extended?.transmission || "")) console.log(`  TRANSMISSION DIFF: DB="${dbV.transmission}" vs 8891="${ds.extended?.transmission}"`);
        if (dbV.fuelType !== (ds.extended?.fuelType || "")) console.log(`  FUELTYPE DIFF: DB="${dbV.fuelType}" vs 8891="${ds.extended?.fuelType}"`);
        if (dbV.bodyType !== (ds.extended?.bodyType || "")) console.log(`  BODYTYPE DIFF: DB="${dbV.bodyType}" vs 8891="${ds.extended?.bodyType}"`);
      }
    }
  }
  
  process.exit(0);
}
main();
