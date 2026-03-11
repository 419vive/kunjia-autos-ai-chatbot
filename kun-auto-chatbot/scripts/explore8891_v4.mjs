// Try multiple strategies to get ALL 12 vehicles from 8891

async function main() {
  // Strategy A: Mobile search list page with shopId filter
  console.log('=== Strategy A: Mobile search list ===');
  const listUrls = [
    'https://m.8891.com.tw/usedauto-list.html?shopId=1726',
    'https://m.8891.com.tw/usedauto-list.html?shopId=1726&firstRow=0&totalRows=30',
  ];
  
  for (const url of listUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'text/html',
          'Accept-Language': 'zh-TW,zh;q=0.9',
        },
      });
      const html = await res.text();
      const match = html.match(/__NEXT_DATA__[\s\S]*?type="application\/json">([\s\S]*?)<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        const pp = data.props?.pageProps;
        console.log(`${url}`);
        console.log('  pageProps keys:', Object.keys(pp || {}));
        
        if (pp?.listData) {
          console.log('  listData.totalCount:', pp.listData.totalCount);
          console.log('  listData.items count:', pp.listData.items?.length);
          if (pp.listData.items) {
            for (const v of pp.listData.items) {
              console.log(`    ID: ${v.itemId} | ${v.brandEnName || ''} ${v.kindEnName || ''} | Price: ${v.price} | Shop: ${v.shopId}`);
            }
          }
        }
        
        // Also scan for all itemIds
        const jsonStr = JSON.stringify(pp);
        const idMatches = [...jsonStr.matchAll(/"itemId":(\d+)/g)];
        const ids = new Set(idMatches.map(m => m[1]));
        console.log('  All itemIds:', ids.size, Array.from(ids));
      }
    } catch(e) { console.log('Error:', e.message); }
  }

  // Strategy B: Try with sellerNo parameter
  console.log('\n=== Strategy B: sellerNo parameter ===');
  try {
    const res = await fetch('https://m.8891.com.tw/usedauto-list.html?sellerNo=1726', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Accept': 'text/html',
      },
    });
    const html = await res.text();
    const match = html.match(/__NEXT_DATA__[\s\S]*?type="application\/json">([\s\S]*?)<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      const pp = data.props?.pageProps;
      if (pp?.listData) {
        console.log('totalCount:', pp.listData.totalCount);
        console.log('items:', pp.listData.items?.length);
      }
    }
  } catch(e) { console.log('Error:', e.message); }

  // Strategy C: Try with memberId from dataSource
  console.log('\n=== Strategy C: Get memberId from shop page ===');
  try {
    const res = await fetch('https://m.8891.com.tw/shop?id=1726&navType=index', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Accept': 'text/html',
      },
    });
    const html = await res.text();
    const match = html.match(/__NEXT_DATA__[\s\S]*?type="application\/json">([\s\S]*?)<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      const ds = data.props?.pageProps?.dataSource;
      console.log('memberId:', ds?.memberId);
      console.log('shopMobile:', ds?.shopMobile);
      console.log('contactName:', ds?.contactName);
      
      if (ds?.memberId) {
        // Try search with memberId
        const res2 = await fetch(`https://m.8891.com.tw/usedauto-list.html?memberId=${ds.memberId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
            'Accept': 'text/html',
          },
        });
        const html2 = await res2.text();
        const match2 = html2.match(/__NEXT_DATA__[\s\S]*?type="application\/json">([\s\S]*?)<\/script>/);
        if (match2) {
          const data2 = JSON.parse(match2[1]);
          const pp2 = data2.props?.pageProps;
          if (pp2?.listData) {
            console.log('memberId search totalCount:', pp2.listData.totalCount);
            console.log('memberId search items:', pp2.listData.items?.length);
            if (pp2.listData.items) {
              for (const v of pp2.listData.items) {
                console.log(`  ID: ${v.itemId} | ${v.brandEnName || ''} ${v.kindEnName || ''} | Price: ${v.price}`);
              }
            }
          }
        }
      }
    }
  } catch(e) { console.log('Error:', e.message); }

  // Strategy D: Try the desktop search with different parameters
  console.log('\n=== Strategy D: Desktop search ===');
  const desktopUrls = [
    'https://auto.8891.com.tw/usedauto-list.html?shopId=1726',
    'https://auto.8891.com.tw/usedauto-list.html?sellerNo=1726',
  ];
  for (const url of desktopUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'zh-TW,zh;q=0.9',
        },
      });
      console.log(`${url}: ${res.status}`);
      if (res.ok) {
        const html = await res.text();
        // Look for vehicle IDs
        const allIds = new Set();
        const patterns = [
          /usedauto-infos-(\d+)/g,
          /"itemId":(\d+)/g,
          /auto\?id=(\d+)/g,
        ];
        for (const p of patterns) {
          let m;
          while ((m = p.exec(html)) !== null) {
            allIds.add(m[1]);
          }
        }
        if (allIds.size > 0) {
          console.log('  IDs found:', allIds.size, Array.from(allIds));
        } else {
          // Check if it's a redirect or error
          console.log('  No IDs. HTML length:', html.length);
          console.log('  First 200 chars:', html.substring(0, 200));
        }
      }
    } catch(e) { console.log('Error:', e.message); }
  }

  process.exit(0);
}

main();
