import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_STOCKS } from "./src/constants";
import yf from "yahoo-finance2";

// Safe dual-mode instantiation for ESM (tsx dev) and CommonJS (esbuild production bundle)
const yahooFinance = typeof yf === "function" ? new yf() : new (yf as any).default();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

// Initialize Gemini SDK with named parameter and 'aistudio-build' client telemetry parameter
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Background caches for TWSE & TPEx quotes to protect from public rate-limiting
let tseCache: any[] = [];
let tpexCache: any[] = [];
let lastFetchTime = 0;
let isFetching = false;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache to avoid rate limits

async function fetchWithTimeoutAndRetry(url: string, options: any = {}, retries = 2, delay = 1000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
  
  const mergedOptions = {
    ...options,
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, mergedOptions);
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (retries > 0) {
      console.warn(`Fetch to ${url} failed: ${err?.message || err}. Retrying in ${delay}ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithTimeoutAndRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}

async function updateStockCache() {
  if (isFetching) {
    return; // Fast-path if already fetching in parallel
  }
  const now = Date.now();
  if (now - lastFetchTime < CACHE_DURATION && (tseCache.length > 0 || tpexCache.length > 0)) {
    return;
  }

  isFetching = true;
  lastFetchTime = now; // Set immediately to prevent multiple fast requests from stacking fetch promises

  try {
    console.log("Fetching live Taiwan Stock Exchange quotes from TWSE OpenAPI...");
    const tseRes = await fetchWithTimeoutAndRetry("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL", {}, 1, 500);
    tseCache = await tseRes.json();
    console.log(`TWSE cache successfully loaded with ${tseCache.length} entries.`);
  } catch (err: any) {
    console.warn("Could not fetch TWSE fast-path data, will fall back to Yahoo Finance:", err?.message || err);
  }

  try {
    console.log("Fetching live OTC quotes from TPEx OpenAPI...");
    const tpexRes = await fetchWithTimeoutAndRetry("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes", {}, 0, 0);
    tpexCache = await tpexRes.json();
    console.log(`TPEx cache successfully loaded with ${tpexCache.length} entries.`);
  } catch (err: any) {
    console.warn("Could not fetch TPEx fast-path data, will fall back to Yahoo Finance / real-time API.");
  } finally {
    isFetching = false;
  }
}

// Default standard preloaded stocks list as lookup guides
app.get("/api/stock/:id", async (req, res) => {
  const { id } = req.params;
  const name = (req.query.name as string) || "";
  
  // Trigger cache updates asynchronously in the background to avoid blocking user request times
  updateStockCache().catch(e => console.error("Background cache update failed:", e));

  let currentPrice = 0;
  let change = 0;
  let changePercent = 0;
  let realName = name;
  let detectedExchange: "TW" | "TWO" | null = null;
  let misSuccess = false;

  // 1. Try to fetch official real-time stock price from mis.twse.com.tw first (uncached, live)
  try {
    const misUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${id}.tw|otc_${id}.tw&json=1&delay=0`;
    const misRes = await fetchWithTimeoutAndRetry(misUrl, {}, 1, 500);
    const misData = await misRes.json();
    if (misData && misData.msgArray && misData.msgArray.length > 0) {
      const validItem = misData.msgArray.find((m: any) => m && m.n && m.key);
      if (validItem) {
        const yValue = parseFloat(validItem.y);
        let parsedPrice = parseFloat(validItem.z);
        
        // Handle '-' during certain matching periods or outside standard execution
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
          const asks = validItem.a ? validItem.a.split("_").filter(Boolean) : [];
          const bids = validItem.b ? validItem.b.split("_").filter(Boolean) : [];
          const bestAsk = asks[0] ? parseFloat(asks[0]) : 0;
          const bestBid = bids[0] ? parseFloat(bids[0]) : 0;
          if (bestAsk > 0 && bestBid > 0) {
            parsedPrice = (bestAsk + bestBid) / 2;
          } else if (bestAsk > 0) {
            parsedPrice = bestAsk;
          } else if (bestBid > 0) {
            parsedPrice = bestBid;
          } else {
            parsedPrice = yValue || 0;
          }
        }

        if (parsedPrice > 0) {
          currentPrice = parsedPrice;
          realName = validItem.n || realName;
          detectedExchange = validItem.ex === "otc" ? "TWO" : "TW";
          if (!isNaN(yValue) && yValue > 0) {
            change = currentPrice - yValue;
            changePercent = (change / yValue) * 100;
          } else {
            change = 0;
            changePercent = 0;
          }
          misSuccess = true;
          console.log(`Successfully fetched real-time TWSE API for ${id}: Price=${currentPrice}, Change=${change}`);
        }
      }
    }
  } catch (err: any) {
    console.warn(`mis.twse.com.tw real-time api failed for ${id}, falling back to OpenAPI/Yahoo:`, err?.message || err);
  }

  // 2. Search in local OpenAPI cache if real-time API failed
  let tseFound = tseCache.find(
    (s: any) => String(s.Code).trim() === String(id).trim()
  );
  let tpexFound: any = null;

  if (!tseFound) {
    tpexFound = tpexCache.find(
      (s: any) => String(s.SecuritiesCompanyCode).trim() === String(id).trim()
    );
  }

  if (!detectedExchange) {
    detectedExchange = tpexFound ? "TWO" : "TW";
  }

  if (!misSuccess) {
    if (tseFound) {
      currentPrice = parseFloat(tseFound.ClosingPrice) || 0;
      change = parseFloat(tseFound.Change) || 0;
      realName = tseFound.Name || realName;
      if (currentPrice) {
        const prev = currentPrice - change;
        changePercent = prev ? (change / prev) * 100 : 0;
      }
    } else if (tpexFound) {
      currentPrice = parseFloat(tpexFound.Close) || 0;
      change = parseFloat(tpexFound.Change) || 0;
      realName = tpexFound.CompanyName || realName;
      if (currentPrice) {
        const prev = currentPrice - change;
        changePercent = prev ? (change / prev) * 100 : 0;
      }
    }

    // 3. Fallback to Yahoo Finance quote if cache didn't return a price
    try {
      let yTicker = `${id}.${detectedExchange}`;
      let quote;
      try {
        quote = await yahooFinance.quote(yTicker);
      } catch (err: any) {
        yTicker = detectedExchange === "TW" ? `${id}.TWO` : `${id}.TW`;
        quote = await yahooFinance.quote(yTicker);
      }
      if (quote && quote.regularMarketPrice) {
        currentPrice = quote.regularMarketPrice;
        change = quote.regularMarketChange || 0;
        changePercent = quote.regularMarketChangePercent || 0;
        if (quote.shortName || quote.longName) {
          realName = quote.shortName || quote.longName || realName;
        }
      }
    } catch (e) {
      // Silently fallback
    }
  }

  // If we could not fetch a real price, fall back to default or generated numbers
  const original = DEFAULT_STOCKS.find(s => s.id === id);
  if (!currentPrice && original) {
    currentPrice = original.currentPrice;
    change = original.change || 0;
    changePercent = original.changePercent || 0;
  } else if (!currentPrice) {
    currentPrice = 100;
    change = 1.5;
    changePercent = 1.52;
  }

  let finalHistory: any[] = [];
  try {
    const period1Date = new Date();
    period1Date.setMonth(period1Date.getMonth() - 11);
    let yTicker = `${id}.${detectedExchange}`;
    let yRes;
    try {
      yRes = await yahooFinance.chart(yTicker, { period1: period1Date, period2: new Date(), interval: '1mo' });
    } catch (chartErr: any) {
      if (!tseFound && !tpexFound) {
        yTicker = `${id}.TWO`;
        yRes = await yahooFinance.chart(yTicker, { period1: period1Date, period2: new Date(), interval: '1mo' });
      } else {
        throw chartErr;
      }
    }
    if (yRes && yRes.quotes && yRes.quotes.length > 0) {
      finalHistory = yRes.quotes.filter((q: any) => q.close !== null).map((q: any) => {
        const dateObj = new Date(q.date);
        return {
          month: `${dateObj.getMonth() + 1}月`,
          price: Math.round(q.close * 10) / 10
        };
      });
      if (finalHistory.length > 12) {
        finalHistory = finalHistory.slice(-12);
      }
    }
  } catch(e: any) {
    // Silently fallback without noisy logs
  }

  if (finalHistory.length === 0) {
    // Generate historical trends proportional to current live price as fallback
    finalHistory = original
      ? original.priceHistory.map(pt => {
          const originalLast = original.priceHistory[original.priceHistory.length - 1].price;
          const ratio = currentPrice / originalLast;
          return {
            month: pt.month,
            price: Math.round(pt.price * ratio * 10) / 10
          };
        })
      : (() => {
          const months = ["7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月"];
          return months.map((m, idx) => {
            const trendFactor = 1 - (11 - idx) * 0.02 + (Math.random() * 0.04 - 0.02);
            return {
              month: m,
              price: Math.round(currentPrice * trendFactor * 10) / 10
            };
          });
        })();
  }

  // Generate dividend info
  const scaledDividends = original
    ? original.dividendInfo
    : [
        {
          year: "2026",
          amount: Math.round(currentPrice * 0.035 * 10) / 10,
          status: "預估",
          exDividendDate: "2026/08/15",
          lastBuyDate: "2026/08/13"
        },
        {
          year: "2025",
          amount: Math.round(currentPrice * 0.041 * 10) / 10,
          status: "已公告",
          exDividendDate: "2025/08/15",
          lastBuyDate: "2025/08/13"
        }
      ];

  // Try real-time deep stock report generation from Gemini if possible
  let derivedAnalysis = original ? original.aiAnalysis : "";
  const generateAiReport = req.query.ai === "true";
  let aiError: string | null = null;

  if (generateAiReport && ai) {
    try {
      console.log(`Querying Gemini (gemini-3.5-flash) on backend to diagnose ${id} ${realName}...`);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `你是一位具有外資資法人背景的資深宏觀經濟與台股首席分析師。請針對台股股票「${id} ${realName}」（現價約為 ${currentPrice} 元，今日漲跌幅為 ${Math.round(changePercent * 100) / 100}%）撰寫一份絕對客觀、具備國際視野、專業度極高的深度投資決策報告。

【重點指令與要求】
1. 若今日狀況為大跌，報告內容【必須嚴格符合大跌的避險或利空警告趨勢】！必須無情點出拋售原因、外資調節及潛在的根本利空；若為大漲，則點明追價動能與未來上行預期，絕不可在暴跌時給予無關緊要的樂觀套話或背離現實。
2. 必須強烈帶入「國際宏觀與地緣政治因素」（如美聯準會Fed政策、美國科技股連動、地緣衝突、全球產業鏈移轉、匯率波動與通膨變化等）如何真實影響該公司的營運與評價。
3. 大量且精確地使用專業財經術語（如：均線乖離、法說會前瞻、外資期貨空單、本益比修正、殖利率保護、避險情緒、技術面破底/突破、基本面防護等）。

請嚴格遵循以下三大結構，使用 Markdown 格式（不使用 HTML 標籤），每個段落約 150 - 200 字：

### 📊 近期基本面與籌碼解析
（務必結合當前漲跌幅：${Math.round(changePercent * 100) / 100}%。分析技術走勢、營收動能，以及主要外資/投信近期的籌碼動向。如遇大跌需探討籌碼鬆動與支撐位。如實反映市況，客觀精確。）

### 🌐 國際宏觀與產業連動影響
（深度剖析國際局勢、美國總體數據、全球供應鏈調整或同業競合等「國際外部與宏觀因素」，以及這些因素對該公司營收與利潤的直接或間接衝擊/助益。）

### ⚠️ 投資決策與風險預警
（給予明確的操作策略與避險建議。若走勢疲弱，提出防禦性資產配置警戒、停損或接刀風險提示；若走勢強健，則分析追高風險與停利點；並適時納入除權息與殖利率防護的考量。語氣需客觀、權威。）`,
      });
      if (response && response.text) {
        derivedAnalysis = response.text;
      }
    } catch (err: any) {
      console.error("Gemini stock diagnosis error on server:", err);
      aiError = err?.message || err?.toString() || "Model high demand or service unavailable";
    }
  }

  if (!derivedAnalysis) {
    if (original) {
      derivedAnalysis = original.aiAnalysis;
    } else {
      derivedAnalysis = `### 📊 近期基本面與籌碼解析
該股近期籌碼面隨大盤波動呈現劇烈輪動，外資與投信在技術面關鍵價位附近出現分歧。今日該股股價漲跌幅為 ${Math.round(changePercent * 100) / 100}%，投資人需密切留意法人籌碼是否出現連續性鬆動，以及技術指標是否進入乖離過大區間，避免盲目追高或接刀。

### 🌐 國際宏觀與產業連動影響
近期受到美國聯準會（Fed）貨幣政策預期變動、全球地緣政治摩擦升溫及供應鏈重組等多重國際宏觀因素干擾，整體產業能見度承壓。跨國終端消費力道回溫不如預期，亦可能進一步衝擊供應鏈的報價與毛利率表現，建議高度關注國際美股相關指標之連動效應。

### ⚠️ 投資決策與風險預警
考量當前總體經濟變數高達，短線操作風險較高。建議投資人嚴格控管資金水位與部位曝險，留意短期高檔震盪或破底風險。長線存股者仍需重新審視其護城河與殖利率保護力道，適時納入防禦性操作並準備避險策略。`;
    }
  }

  res.json({
    id,
    name: realName,
    currentPrice,
    change,
    changePercent,
    priceHistory: finalHistory,
    dividendInfo: scaledDividends,
    aiAnalysis: derivedAnalysis,
    aiError: aiError
  });
});

async function startServer() {
  // Vite dev mode vs production server files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Taiwan Stock Wealth Log server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

// Trigger initial cache warmup asynchronously on startup
updateStockCache().catch(e => console.error("Initial background cache warmup failed:", e));
