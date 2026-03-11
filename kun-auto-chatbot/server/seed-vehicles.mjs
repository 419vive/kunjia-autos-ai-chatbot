/**
 * Seed script to import vehicle data from scraped JSON into the database.
 * Run: node server/seed-vehicles.mjs
 */
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Read scraped data
const rawData = JSON.parse(readFileSync('/home/ubuntu/崑家汽車_8891車輛資料.json', 'utf-8'));

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const match = priceStr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

async function seed() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log(`Connected. Seeding ${rawData.length} vehicles...`);

  for (const car of rawData) {
    const price = parsePrice(car.price);
    
    // Filter out placeholder/invalid photo URLs
    let photoUrls = '';
    if (car.photo_urls) {
      const urls = car.photo_urls.split('|').filter(u => 
        u.trim() && 
        !u.includes('common/img-1.png') &&
        u.startsWith('http')
      );
      const unique = [...new Set(urls)];
      photoUrls = unique.join('|');
    }

    try {
      await conn.execute(
        `INSERT INTO vehicles (externalId, sourceUrl, title, brand, model, modelYear, manufactureYear, color, price, priceDisplay, mileage, displacement, transmission, fuelType, bodyType, licenseDate, location, description, features, guarantees, photoUrls, photoCount, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           title=VALUES(title), brand=VALUES(brand), model=VALUES(model), price=VALUES(price),
           priceDisplay=VALUES(priceDisplay), mileage=VALUES(mileage), features=VALUES(features),
           description=VALUES(description), photoUrls=VALUES(photoUrls), photoCount=VALUES(photoCount)`,
        [
          car.car_id, car.source_url || null, car.title || null, car.brand, car.model,
          car.model_year || null, car.manufacture_year || null, car.color || null,
          price, car.price || null, car.mileage || null, car.displacement || null,
          car.transmission || null, car.fuel_type || null, car.body_type || null,
          car.license_date || null, car.location || null, car.description || null,
          car.features || null, car.guarantees || null, photoUrls || null,
          typeof car.photo_count === 'number' ? car.photo_count : 0, 'available'
        ]
      );
      console.log(`  ✓ ${car.brand} ${car.model} (${car.car_id})`);
    } catch (err) {
      console.error(`  ✗ ${car.brand} ${car.model}: ${err.message}`);
    }
  }

  await conn.end();
  console.log('\nDone!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
