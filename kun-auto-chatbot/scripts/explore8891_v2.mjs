// Strategy 5: Try the _next/data with correct buildId format
// Strategy 6: Try fetching usedCar navType page and look for lazy-load data
// Strategy 7: Try range scanning vehicle IDs around known ones

async function main() {
  // Strategy 5: Correct _next/data URL format
  console.log("=== Strategy 5: Correct _next/data format ===");
  // Get buildId from usedCar page
  const res5 = await fetch('https://m.8891.com.tw/shop?id=1726&navType=usedCar', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'text/html',
      'Accept-Language': 'zh-TW,zh;q=0.9',
    },
  });
  const html5 = await res5.text();
  const buildIdMatch = html5.match(/"buildId":"([^"]+)"/);
  const buildId = buildIdMatch ? buildIdMatch[1] : null;
  console.log("buildId:", buildId);
  
  if (buildId) {
    // Try various _next/data URL patterns
    const patterns = [
      `https://m.8891.com.tw/_next/data/${buildId}/shop.json?id=1726&navType=usedCar`,
      `https://m.8891.com.tw/_next/data/${buildId}/shop.json?id=1726`,
      `https://m.8891.com.tw/_next/data/${buildId}/shop/${1726}/usedCar.json`,
      `https://m.8891.com.tw/_next/data/${buildId}/shop/usedCar.json?id=1726`,
    ];
    for (const url of patterns) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
            'Accept': 'application/json',
            'Referer': 'https://m.8891.com.tw/shop?id=1726&navType=usedCar',
          },
        });
        console.log(`  ${url.replace(buildId, 'BUILD')} → ${res.status}`);
        if (res.ok) {
          const text = await res.text();
          if (text.startsWith('{')) {
            const data = JSON.parse(text);
            const pp = data.pageProps;
            if (pp) {
              console.log("    pageProps keys:", Object.keys(pp));
              if (pp.shopUsedCarData) {
                console.log("    shopUsedCarData:", JSON.stringify(pp.shopUsedCarData).substring(0, 200));
              }
            }
          }
        }
      } catch (e) {
        // skip
      }
    }
  }

  // Strategy 6: Look for XHR endpoints in the HTML source
  console.log("\n=== Strategy 6: Find API endpoints in HTML ===");
  const apiMatches = html5.match(/api\/[a-zA-Z0-9/]+/g);
  if (apiMatches) {
    const apis = new Set(apiMatches);
    console.log("API paths found:", Array.from(apis));
  }
  
  // Look for fetch/axios calls
  const fetchMatches = html5.match(/fetch\(["']([^"']+)["']/g);
  if (fetchMatches) {
    console.log("Fetch URLs:", fetchMatches);
  }

  // Strategy 7: Range scan around known vehicle IDs to find missing ones
  console.log("\n=== Strategy 7: Range scan vehicle IDs ===");
  const knownIds = [3699687, 4075406, 4355054, 4475535, 4477851, 4488564, 4517022, 4544303, 4558087, 4590033, 4390075, 4472478];
  const maxKnown = Math.max(...knownIds);
  
  // Scan IDs above the highest known ID (likely new vehicles)
  console.log(`Highest known ID: ${maxKnown}, scanning ${maxKnown + 1} to ${maxKnown + 50}...`);
  const newIds = [];
  
  for (let id = maxKnown + 1; id <= maxKnown + 50; id++) {
    try {
      const res = await fetch(`https://m.8891.com.tw/auto?id=${id}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          'Accept': 'text/html',
        },
        redirect: 'manual',
      });
      
      if (res.status === 200) {
        const html = await res.text();
        const match = html.match(/"shopId":(\d+)/);
        const shopId = match ? parseInt(match[1]) : null;
        const titleMatch = html.match(/"title":"([^"]+)"/);
        const title = titleMatch ? titleMatch[1] : 'unknown';
        const onSaleMatch = html.match(/"isOnSale":(\d)/);
        const isOnSale = onSaleMatch ? parseInt(onSaleMatch[1]) : null;
        
        if (shopId === 1726) {
          console.log(`  ✅ ID ${id}: shopId=1726, onSale=${isOnSale}, title=${title.substring(0, 50)}`);
          newIds.push(id);
        }
      }
      // Small delay
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      // skip
    }
  }
  
  if (newIds.length > 0) {
    console.log(`\nFound ${newIds.length} new vehicles for 崑家汽車:`, newIds);
  } else {
    console.log("\nNo new vehicles found in range scan");
  }

  // Strategy 8: Try broader search on 8891 for 崑家
  console.log("\n=== Strategy 8: Search 8891 for 崑家 ===");
  try {
    const res = await fetch('https://m.8891.com.tw/usedauto-list.html?keyword=%E5%B4%91%E5%AE%B6', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Accept': 'text/html',
      },
    });
    const html = await res.text();
    const match = html.match(/__NEXT_DATA__[\s\S]*?type="application\/json">([\s\S]*?)<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      const items = data.props?.pageProps?.listData?.items;
      if (items) {
        console.log(`Search results: ${items.length} vehicles`);
        for (const v of items) {
          console.log(`  ID: ${v.itemId} | ${v.brandEnName} ${v.kindEnName} | Shop: ${v.shopId || 'personal'} | Price: ${v.price}`);
        }
      }
    }
  } catch (e) {
    console.log("Search error:", e.message);
  }

  process.exit(0);
}

main();
