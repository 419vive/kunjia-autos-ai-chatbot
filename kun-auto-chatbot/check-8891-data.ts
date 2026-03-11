// Check full 8891 data structure for a vehicle
async function main() {
  const carId = "4075406"; // BMW X1
  const res = await fetch(`https://m.8891.com.tw/auto?id=${carId}`, {
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
      // Print all top-level keys
      console.log("=== Top-level keys ===");
      console.log(Object.keys(ds).join(", "));
      
      // Print detail section
      console.log("\n=== ds.detail ===");
      console.log(JSON.stringify(ds.detail, null, 2));
      
      // Print specs/params section
      console.log("\n=== ds.params ===");
      console.log(JSON.stringify(ds.params, null, 2));
      
      // Print carInfo
      console.log("\n=== ds.carInfo ===");
      console.log(JSON.stringify(ds.carInfo, null, 2));
      
      // Print infoList
      console.log("\n=== ds.infoList ===");
      console.log(JSON.stringify(ds.infoList, null, 2));
      
      // Print tags
      console.log("\n=== ds.tags ===");
      console.log(JSON.stringify(ds.tags, null, 2));
      
      // Print sellerInfo
      console.log("\n=== ds.sellerInfo ===");
      console.log(JSON.stringify(ds.sellerInfo, null, 2));
      
      // Print title/subtitle/price
      console.log("\n=== Basic info ===");
      console.log("title:", ds.title);
      console.log("subTitle:", ds.subTitle);
      console.log("price:", JSON.stringify(ds.price));
      console.log("isOnSale:", ds.isOnSale);
      
      // Print extended
      console.log("\n=== ds.extended ===");
      console.log(JSON.stringify(ds.extended, null, 2));
    }
  }
  process.exit(0);
}
main();
