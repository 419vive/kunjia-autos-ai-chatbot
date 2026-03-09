// Explore 8891 shop page data to find all vehicle IDs

async function main() {
  // Strategy 1: Shop index page
  console.log("=== Strategy 1: Shop Index Page ===");
  const res1 = await fetch('https://m.8891.com.tw/shop?id=1726&navType=index', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-TW,zh;q=0.9',
    },
  });
  const html1 = await res1.text();
  const match1 = html1.match(/__NEXT_DATA__[\s\S]*?type="application\/json">([\s\S]*?)<\/script>/);
  if (match1) {
    const data = JSON.parse(match1[1]);
    const ds = data.props?.pageProps?.dataSource;
    const sid = data.props?.pageProps?.shopIndexData;
    console.log("onSaleCount:", ds?.onSaleCount);
    
    // Extract all itemIds from shopIndexData
    const json = JSON.stringify(sid);
    const itemIdMatches = json.match(/"itemId":(\d+)/g);
    if (itemIdMatches) {
      const ids = new Set(itemIdMatches.map(m => m.replace('"itemId":', '')));
      console.log("itemIds from shopIndexData:", ids.size, Array.from(ids));
    }
  }

  // Strategy 2: Try XHR/API that the mobile page uses for lazy loading
  console.log("\n=== Strategy 2: Shop usedCar API ===");
  const apiUrls = [
    `https://m.8891.com.tw/api/v1/shop/1726/usedCar?rows=30&page=1`,
    `https://m.8891.com.tw/api/v2/shop/1726/usedCar?rows=30&page=1`,
    `https://m.8891.com.tw/_next/data/shop/1726/usedCar.json?id=1726&navType=usedCar`,
  ];
  
  for (const url of apiUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-TW,zh;q=0.9',
          'Referer': 'https://m.8891.com.tw/shop?id=1726&navType=usedCar',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      const ct = res.headers.get('content-type') || '';
      console.log(`${url} → ${res.status} (${ct.substring(0, 30)})`);
      if (res.ok && ct.includes('json')) {
        const data = await res.json();
        console.log("  keys:", Object.keys(data));
        console.log("  sample:", JSON.stringify(data).substring(0, 300));
      }
    } catch (e) {
      console.log(`${url} → error:`, e.message);
    }
  }

  // Strategy 3: Try _next/data endpoint (Next.js SSR data)
  console.log("\n=== Strategy 3: Next.js _next/data ===");
  // First get buildId from the page
  const buildIdMatch = html1.match(/"buildId":"([^"]+)"/);
  if (buildIdMatch) {
    const buildId = buildIdMatch[1];
    console.log("buildId:", buildId);
    
    const nextDataUrl = `https://m.8891.com.tw/_next/data/${buildId}/shop.json?id=1726&navType=usedCar`;
    try {
      const res = await fetch(nextDataUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'application/json',
          'Referer': 'https://m.8891.com.tw/shop?id=1726',
        },
      });
      console.log(`_next/data → ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        const pp = data.pageProps;
        console.log("pageProps keys:", Object.keys(pp || {}));
        
        // Check for shopUsedCarData
        if (pp?.shopUsedCarData) {
          console.log("shopUsedCarData keys:", Object.keys(pp.shopUsedCarData));
          if (pp.shopUsedCarData.items) {
            console.log("items count:", pp.shopUsedCarData.items.length);
            for (const v of pp.shopUsedCarData.items) {
              console.log(`  ID: ${v.itemId} | ${v.brandEnName} ${v.kindEnName} | Price: ${v.price}`);
            }
          }
          if (pp.shopUsedCarData.totalCount !== undefined) {
            console.log("totalCount:", pp.shopUsedCarData.totalCount);
          }
        }
        
        // Check all itemIds in the response
        const json = JSON.stringify(data);
        const itemIdMatches = json.match(/"itemId":(\d+)/g);
        if (itemIdMatches) {
          const ids = new Set(itemIdMatches.map(m => m.replace('"itemId":', '')));
          console.log("All itemIds found:", ids.size, Array.from(ids));
        }
      }
    } catch (e) {
      console.log("_next/data error:", e.message);
    }
  }

  // Strategy 4: Try desktop search with shop filter
  console.log("\n=== Strategy 4: Desktop Search with Shop Filter ===");
  try {
    const res = await fetch('https://auto.8891.com.tw/usedauto-list.html?shopId=1726&firstRow=0&totalRows=30', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    const html = await res.text();
    // Find all vehicle IDs in links
    const matches = html.match(/usedauto-infos-(\d+)/g);
    if (matches) {
      const ids = new Set(matches.map(m => m.replace('usedauto-infos-', '')));
      console.log("Vehicle IDs from desktop search:", ids.size, Array.from(ids));
    } else {
      console.log("No vehicle links found in desktop search");
    }
    
    // Also check for JSON data
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
    if (jsonMatch) {
      const state = JSON.parse(jsonMatch[1]);
      console.log("__INITIAL_STATE__ keys:", Object.keys(state));
    }
  } catch (e) {
    console.log("Desktop search error:", e.message);
  }

  process.exit(0);
}

main();
