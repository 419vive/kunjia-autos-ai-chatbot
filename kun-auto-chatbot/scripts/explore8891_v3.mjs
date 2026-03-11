// Deep analysis of 8891 shop usedCar page data structure

async function main() {
  console.log('=== Fetching usedCar navType page ===');
  const res = await fetch('https://m.8891.com.tw/shop?id=1726&navType=usedCar', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'text/html',
      'Accept-Language': 'zh-TW,zh;q=0.9',
    },
  });
  const html = await res.text();
  
  const match = html.match(/__NEXT_DATA__[\s\S]*?type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) { console.log('No __NEXT_DATA__'); process.exit(0); }
  
  const data = JSON.parse(match[1]);
  const pp = data.props?.pageProps;
  const sid = pp?.shopIndexData;
  
  console.log('shopIndexData keys:', Object.keys(sid || {}));
  
  // Deep scan for ALL itemId values
  const allItemIds = new Set();
  function scan(obj, depth = 0) {
    if (depth > 8) return;
    if (obj === null || obj === undefined) return;
    if (typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const item of obj) scan(item, depth + 1);
      return;
    }
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'itemId' && typeof val === 'number') {
        allItemIds.add(String(val));
      }
      if (typeof val === 'object' && val !== null) {
        scan(val, depth + 1);
      }
    }
  }
  scan(sid, 0);
  console.log('Total unique itemIds in shopIndexData:', allItemIds.size);
  console.log('IDs:', Array.from(allItemIds));
  
  const ds = pp?.dataSource;
  console.log('\ndataSource keys:', Object.keys(ds || {}));
  console.log('onSaleCount:', ds?.onSaleCount);
  
  // Check each key in shopIndexData
  for (const [key, val] of Object.entries(sid || {})) {
    if (Array.isArray(val)) {
      console.log(`  Array: ${key} (${val.length} items)`);
      if (val.length > 0 && val[0]?.itemId) {
        console.log(`    Sample: itemId=${val[0].itemId}`);
      }
    } else if (typeof val === 'object' && val !== null) {
      const subKeys = Object.keys(val);
      console.log(`  Object: ${key} -> [${subKeys.join(', ')}]`);
      for (const sk of subKeys) {
        if (Array.isArray(val[sk])) {
          console.log(`    Sub-array: ${sk} (${val[sk].length} items)`);
          if (val[sk].length > 0 && val[sk][0]?.itemId) {
            console.log(`      Sample: itemId=${val[sk][0].itemId}`);
          }
        }
      }
    } else {
      console.log(`  Value: ${key} = ${val}`);
    }
  }
  
  // Also scan the FULL __NEXT_DATA__ for itemIds
  const allItemIdsGlobal = new Set();
  scan(data, 0);
  // Add from global scan
  const jsonStr = JSON.stringify(data);
  const idMatches = jsonStr.matchAll(/"itemId":(\d+)/g);
  for (const m of idMatches) {
    allItemIdsGlobal.add(m[1]);
  }
  console.log('\nTotal unique itemIds in FULL __NEXT_DATA__:', allItemIdsGlobal.size);
  console.log('IDs:', Array.from(allItemIdsGlobal));

  // Now try fetching the usedCar navType page with different approach
  // The usedCar tab on 8891 loads vehicles via client-side JS
  // Let's check if there's a separate data endpoint
  console.log('\n=== Trying usedCar-specific endpoints ===');
  
  // Try the search endpoint that the usedCar tab might use
  const searchUrl = `https://m.8891.com.tw/api/v3/Shop/usedCar?shopId=1726&page=1&rows=30`;
  try {
    const res2 = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Accept': 'application/json',
        'Referer': 'https://m.8891.com.tw/shop?id=1726&navType=usedCar',
      },
    });
    console.log(`API ${searchUrl}: ${res2.status} ${res2.headers.get('content-type')}`);
    if (res2.ok) {
      const text = await res2.text();
      if (text.startsWith('{') || text.startsWith('[')) {
        console.log('Response:', text.substring(0, 500));
      }
    }
  } catch(e) { console.log('Error:', e.message); }

  // Try the internal API format
  const internalUrl = `https://m.8891.com.tw/api/v3/Shop/getShopUsedCar?shopId=1726&page=1&rows=30`;
  try {
    const res3 = await fetch(internalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Accept': 'application/json',
        'Referer': 'https://m.8891.com.tw/shop?id=1726&navType=usedCar',
      },
    });
    console.log(`API ${internalUrl}: ${res3.status}`);
  } catch(e) { console.log('Error:', e.message); }

  process.exit(0);
}

main();
