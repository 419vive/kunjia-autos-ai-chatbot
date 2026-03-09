import { getDb } from "./server/db";
import { vehicles } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function check() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }
  const result = await db.select().from(vehicles).where(eq(vehicles.brand, "BMW")).limit(1);
  if (result.length > 0) {
    const v = result[0];
    console.log("=== BMW X1 完整資料 ===");
    console.log("Brand:", v.brand);
    console.log("Model:", v.model);
    console.log("Displacement (排氣量/cc數):", JSON.stringify(v.displacement));
    console.log("Transmission:", v.transmission);
    console.log("FuelType:", v.fuelType);
    console.log("Mileage:", v.mileage);
    console.log("Color:", v.color);
    console.log("Features:", v.features ? v.features.substring(0, 500) : "NULL");
    console.log("Description:", v.description ? v.description.substring(0, 500) : "NULL");
    console.log("PriceDisplay:", v.priceDisplay);
    console.log("ModelYear:", v.modelYear);
  } else {
    console.log("No BMW found");
  }
  process.exit(0);
}
check();
