import mysql from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Car ID mapping: 8891 car_id -> database vehicle id
// We need to match by source_url or car_id
const CAR_ID_TO_DB_MAP = {
  "4075406": 1,   // BMW X1
  "4355054": 2,   // Ford Tourneo Connect
  "4488564": 3,   // Honda CR-V
  "4517022": 4,   // Hyundai Tucson
  "4544303": 5,   // Kia Carens
  "4558087": 6,   // Kia Stonic
  "4475535": 7,   // Mitsubishi Colt Plus (2023)
  "4590033": 8,   // Mitsubishi Colt Plus (2024)
  "4477851": 9,   // Suzuki Vitara
  "4390075": 10,  // Toyota Corolla Cross
  "4472478": 11,  // Toyota Vios
  "3699687": 12,  // Volkswagen Tiguan
};

async function main() {
  const filteredPhotos = JSON.parse(fs.readFileSync('/home/ubuntu/car_photos_reordered.json', 'utf-8'));
  
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  for (const [carId, photos] of Object.entries(filteredPhotos)) {
    const dbId = CAR_ID_TO_DB_MAP[carId];
    if (!dbId) {
      console.log(`No DB mapping for car ${carId}, skipping`);
      continue;
    }
    
    if (!photos || photos.length === 0) {
      console.log(`No photos for car ${carId} (DB ID: ${dbId}), skipping`);
      continue;
    }
    
    const photoUrlsStr = photos.join('|');
    const mainPhoto = photos[0];
    
    await conn.execute(
      'UPDATE vehicles SET photoUrls = ?, photoCount = ? WHERE id = ?',
      [photoUrlsStr, photos.length, dbId]
    );
    
    console.log(`Updated DB ID ${dbId} (car ${carId}): ${photos.length} photos, main=${mainPhoto.substring(0, 80)}`);
  }
  
  // Verify
  const [rows] = await conn.execute('SELECT id, brand, model, LEFT(photoUrls, 100) as photo, photoCount FROM vehicles ORDER BY id');
  console.log('\n=== VERIFICATION ===');
  for (const r of rows) {
    console.log(`${r.id} ${r.brand} ${r.model}: ${r.photo || 'NO PHOTO'}`);
  }
  
  await conn.end();
  console.log('\nDone!');
}

main().catch(console.error);
