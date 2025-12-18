const puppeteer = require('puppeteer');
const fs = require('fs');

// --- CONFIGURATION ---
const TARGETS = [
  {
    id: "regaine_boots",
    type: "retailer",
    name: "Regaine Foam (Boots)",
    url: "https://www.boots.com/regaine-for-men-extra-strength-scalp-foam-5-w-w-cutaneous-foam-3-x-73ml-10082725",
    selector: ".price_container .price", 
    parseMethod: "text" 
  },
  {
    id: "sons_minox",
    type: "retailer",
    name: "Sons Minoxidil",
    url: "https://sons.co.uk/products/minoxidil-5-solution",
    selector: ".product-price", 
    parseMethod: "text"
  },
  // --- NEW EBAY STRATEGY ---
  // We don't link to an item. We link to a "Search Query" sorted by lowest price.
  // This ensures we always find a live listing.
  {
    id: "kirkland_ebay_6_month",
    type: "ebay_search",
    name: "Kirkland Minoxidil (6 Months) - eBay Market Price",
    // URL Breakdown: 
    // _nkw=kirkland+minoxidil+5 (Keyword)
    // _sop=15 (Sort by Price + Shipping: Lowest First)
    // _udlo=15 (Min Price £15 to filter out fake accessories/droppers)
    // LH_BIN=1 (Buy It Now only)
    url: "https://www.ebay.co.uk/sch/i.html?_nkw=kirkland+minoxidil+5+6+months&_sop=15&_udlo=20&LH_BIN=1",
    selector: ".s-item__price", 
    parseMethod: "ebay_search"
  }
];

async function scrapePrices() {
  console.log("🤖 MinoxSaver Bot Starting...");
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const results = [];

  for (const target of TARGETS) {
    try {
      console.log(`Checking price for: ${target.name}...`);
      await page.goto(target.url, { waitUntil: 'domcontentloaded' });

      let cleanPrice = 0;

      // STRATEGY A: Standard Retailer Page
      if (target.type === "retailer") {
        await page.waitForSelector(target.selector, { timeout: 5000 });
        let priceText = await page.$eval(target.selector, el => el.innerText);
        cleanPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
      }
      
      // STRATEGY B: eBay Search Results (The Arbitrage Finder)
      else if (target.type === "ebay_search") {
        // Wait for list of items
        await page.waitForSelector('.s-item', { timeout: 5000 });
        
        // Get the first 3 prices (to ignore sponsored ads if needed, though eBay usually marks them)
        // We select the second item (.s-item:nth-of-type(2)) because the first is often a hidden "Shop on eBay" header or Sponsored
        const priceText = await page.$eval('.s-item:nth-of-type(2) .s-item__price', el => el.innerText);
        
        // Handle ranges like "£20.00 to £30.00" -> Take the lower number
        let rawString = priceText.split('to')[0]; 
        cleanPrice = parseFloat(rawString.replace(/[^0-9.]/g, ''));
      }

      results.push({
        id: target.id,
        price: cleanPrice,
        last_updated: new Date().toISOString(),
        status: "success"
      });
      
      console.log(`   ✅ Found: £${cleanPrice}`);

    } catch (error) {
      console.error(`   ❌ Failed to scrape ${target.name}: ${error.message}`);
      results.push({ id: target.id, price: null, status: "error" });
    }
  }

  await browser.close();
  fs.writeFileSync('minoxidil_data.json', JSON.stringify(results, null, 2));
  console.log("🎉 Prices updated.");
}

scrapePrices();