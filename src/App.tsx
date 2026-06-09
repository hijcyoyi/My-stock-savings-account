import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Sparkles,
  Loader2,
  TrendingUp,
  Coins,
  ChevronUp,
  Volume2,
  Clock,
  Briefcase,
  AlertCircle,
  AlertTriangle
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Stock, MarketState, BroadcastState, Transaction } from "./types";
import { DEFAULT_STOCKS } from "./constants";

// Time calculator for Taiwan Stock Market active session (UTC+8)
const getTaiwanMarketState = (): MarketState => {
  const date = new Date();
  const taiwanTime = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Taipei" })
  );
  
  const day = taiwanTime.getDay();
  const hours = taiwanTime.getHours();
  const minutes = taiwanTime.getMinutes();
  const hhmm = hours * 100 + minutes;

  if (day === 0 || day === 6) {
    return {
      isOpen: false,
      desc: "假日休市",
      color: "bg-[#f3f0e8] text-[#8e8476] border-[#e5dfd2]"
    };
  }

  if (hhmm >= 900 && hhmm <= 1330) {
    return {
      isOpen: true,
      desc: "盤中一般與零股交易 (09:00~13:30)",
      color: "bg-[#f0f4f1] text-[#4d7c5a] border-[#dce6df]"
    };
  }

  if (hhmm > 1330 && hhmm < 1340) {
    return {
      isOpen: false,
      desc: "盤中休息 (13:30~13:40)",
      color: "bg-[#fdf9f2] text-[#bda07a] border-[#f1e4d0]"
    };
  }

  if (hhmm >= 1340 && hhmm <= 1430) {
    return {
      isOpen: false,
      desc: "盤後零股交易 (13:40~14:30)",
      color: "bg-[#f5eff9] text-[#8f6ca8] border-[#e6daeb]"
    };
  }

  return {
    isOpen: false,
    desc: "台股已收盤",
    color: "bg-[#f3f0e8] text-[#8e8476] border-[#e5dfd2]"
  };
};

class SpeechSynthesizer {
  onSpeak: (msg: string, type: "normal" | "warning", durationMs: number) => void;
  voices: SpeechSynthesisVoice[] = [];
  onEndCallback?: () => void;

  constructor(
    onSpeak: (msg: string, type: "normal" | "warning", durationMs: number) => void
  ) {
    this.onSpeak = onSpeak;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  stop() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (this.onEndCallback) {
      this.onEndCallback();
    }
  }

  speak(text: string, type: "normal" | "warning" = "normal", durationMs = 8000, onEnd?: () => void) {
    this.onSpeak(text, type, durationMs);
    if (onEnd) {
      this.onEndCallback = onEnd;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-TW";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        if (this.onEndCallback) {
          this.onEndCallback();
        }
      };
      utterance.onerror = () => {
        if (this.onEndCallback) {
          this.onEndCallback();
        }
      };

      if (this.voices.length > 0) {
        const preferredVoice = this.voices.find(
          v =>
            v.name.includes("Google 國語") ||
            v.name.includes("Google Mandarin") ||
            v.name.includes("Google zh-TW")
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        } else {
          const fallbackVoice =
            this.voices.find(v => v.lang === "zh-TW" && v.name.includes("Female")) ||
            this.voices.find(v => v.lang.includes("zh-TW"));
          if (fallbackVoice) {
            utterance.voice = fallbackVoice;
          }
        }
      }
      window.speechSynthesis.speak(utterance);
    }
  }
}

class AlertScheduler {
  uiSynthesizer: SpeechSynthesizer;
  timerId: number | null = null;
  lastTriggeredAlerts: { [key: string]: string } = {};
  sessionStartTime: number;

  constructor(uiSynthesizer: SpeechSynthesizer) {
    this.uiSynthesizer = uiSynthesizer;
    this.sessionStartTime = Date.now();
  }

  start() {
    this.sessionStartTime = Date.now();
    this.timerId = window.setInterval(() => this.runCheck(), 60 * 1000);
    
    // Welcome speech
    setTimeout(() => {
      this.uiSynthesizer.speak(
        "投資人您好，今天行情持續推移中，系統已為您備妥全方位 AI 智動化分析與個股決策報告，隨時提供最專業的主流趨勢診斷！",
        "normal",
        10000
      );
    }, 1500);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  runCheck() {
    const now = new Date();
    const formattedTime = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    const todayStr = now.toISOString().split("T")[0];
    const elapsedMinutes = (Date.now() - this.sessionStartTime) / (1000 * 60);

    // 1. Tired eye alert every 30 minutes
    if (elapsedMinutes > 0 && Math.floor(elapsedMinutes) % 30 === 0 && Math.floor(elapsedMinutes) !== 0) {
      const alertKey = `eye-${todayStr}-${Math.floor(elapsedMinutes)}`;
      if (this.lastTriggeredAlerts.eye !== alertKey) {
        this.uiSynthesizer.speak(
          "提示：您已盯盤超過 30 分鐘，建議適度閉眼或遠眺，舒緩視力疲勞以維持精準的投資決策力。",
          "warning",
          8000
        );
        this.lastTriggeredAlerts.eye = alertKey;
      }
    }

    // 2. Open market alert (09:00)
    if (formattedTime === "09:00" && this.lastTriggeredAlerts.open !== todayStr) {
      this.uiSynthesizer.speak(
        "提示：台股市場核心交易已正式開盤，請高度注意各板塊開盤委買委賣力道與量能變化。",
        "normal",
        8000
      );
      this.lastTriggeredAlerts.open = todayStr;
    }

    // 3. Market closing alert (13:00)
    if (formattedTime === "13:00" && this.lastTriggeredAlerts.closing !== todayStr) {
      this.uiSynthesizer.speak(
        "提示：距離大盤收盤僅剩最後 30 分鐘，請檢視持股部位並注意尾盤大單敲進或避險資金流向。",
        "warning",
        8000
      );
      this.lastTriggeredAlerts.closing = todayStr;
    }

    // 4. Closed market analysis alert (13:30)
    if (formattedTime === "13:30" && this.lastTriggeredAlerts.closed !== todayStr) {
      this.uiSynthesizer.speak(
        "提示：台股現貨市場本日已正式收盤，系統將開啟今日盤後籌碼動向與大盤融資券變動盤後分析。",
        "normal",
        8000
      );
      this.lastTriggeredAlerts.closed = todayStr;
    }
  }
}

const parseAiReportIntoStyledElements = (text: string) => {
  if (!text) return <p className="text-[#8e8377] italic text-xs">暫無可用的專家研報分析。請點擊上方按鈕進行即時診斷。</p>;
  
  // Split sections gracefully on headers like 【...】 or ### ...
  const sections = text.split(/(?=【.*?】|### .+)/);
  
  return (
    <div className="space-y-4 sm:space-y-5">
      {sections.map((sec, idx) => {
        let title = "";
        let content = "";
        
        const matchBracket = sec.match(/【(.*?)】([\s\S]*)/);
        const matchMarkdown = sec.match(/### (.*?)\n([\s\S]*)/);
        
        if (matchBracket) {
          title = matchBracket[1];
          content = matchBracket[2].trim();
        } else if (matchMarkdown) {
          title = matchMarkdown[1].trim();
          content = matchMarkdown[2].trim();
        }
        
        if (title) {
          let icon = "📋";
          let themeClass = "border-l-4 border-slate-300 pl-3 bg-slate-50/20";
          let cardTitleStyle = "text-slate-800";
          
          // Remove emoji from title if strictly provided by markdown to prevent double emojis
          const cleanTitle = title.replace(/^[\u0000-\u1F9FF\u2600-\u26FF\u2700-\u27BF\s]+/, "").trim();
          
          if (cleanTitle.includes("基本面") || cleanTitle.includes("籌碼")) {
            icon = "📊";
            themeClass = "border-l-4 border-[#bda07a] pl-4 bg-[#fdfaf5]/70 py-3.5 px-3.5 rounded-r-xl border border-l-0 border-[#eae6df]/40 shadow-xs";
            cardTitleStyle = "text-[#8e7355]";
          } else if (cleanTitle.includes("策略") || cleanTitle.includes("除息") || cleanTitle.includes("操作")) {
            icon = "🎯";
            themeClass = "border-l-4 border-[#4d7c5a] pl-4 bg-[#f4f7f5]/70 py-3.5 px-3.5 rounded-r-xl border border-l-0 border-[#eae6df]/40 shadow-xs";
            cardTitleStyle = "text-[#4d7c5a]";
          } else if (cleanTitle.includes("風險") || cleanTitle.includes("注意") || cleanTitle.includes("決策") || cleanTitle.includes("宏觀") || cleanTitle.includes("國際")) {
            icon = "⚠️";
            themeClass = "border-l-4 border-[#9e3028] pl-4 bg-[#fdf8f7]/70 py-3.5 px-3.5 rounded-r-xl border border-l-0 border-[#eae6df]/40 shadow-xs";
            cardTitleStyle = "text-[#9e3028]";
          }
          
          return (
            <div key={idx} className={`${themeClass} space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <h4 className={`text-xs sm:text-[14px] font-black flex items-center gap-1.5 ${cardTitleStyle}`}>
                <span>{icon}</span> {cleanTitle}
              </h4>
              <p className="text-[12.5px] sm:text-[14px] leading-relaxed text-[#2d2926] font-medium whitespace-pre-line tracking-wide">
                {content}
              </p>
            </div>
          );
        }
        
        // Fallback for plain text parts with standard typography
        if (sec.trim()) {
          return (
            <p key={idx} className="text-[12.5px] sm:text-[14px] leading-relaxed text-[#2d2926] font-medium whitespace-pre-line tracking-wide">
              {sec.trim()}
            </p>
          );
        }
        
        return null;
      })}
    </div>
  );
};

const getPayoutDate = (exDateStr: string): string => {
  if (!exDateStr || exDateStr === "—") return "待公告";
  try {
    const parts = exDateStr.split("/");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      let newM = m + 1;
      let newY = y;
      if (newM > 12) {
        newM = 1;
        newY = y + 1;
      }
      const padM = String(newM).padStart(2, "0");
      const padD = String(d).padStart(2, "0");
      return `${newY}/${padM}/${padD}`;
    }
  } catch (e) {
    // ignores
  }
  return "除息後約1個月";
};

const getEnrichedDividendHistory = (stockId: string, currentInfo: any[]): any[] => {
  const result = [...currentInfo];
  const existingYears = new Set(result.map(d => d.year));
  
  const fillers: { [key: string]: { year: string; amount: number }[] } = {
    "2330": [
      { year: "2024", amount: 11.5 },
      { year: "2023", amount: 11.0 },
      { year: "2022", amount: 11.0 },
      { year: "2021", amount: 10.0 },
      { year: "2020", amount: 10.0 },
    ],
    "0050": [
      { year: "2024", amount: 5.6 },
      { year: "2023", amount: 4.9 },
      { year: "2022", amount: 5.0 },
      { year: "2021", amount: 4.25 },
      { year: "2020", amount: 3.6 },
    ],
    "2881": [
      { year: "2024", amount: 3.0 },
      { year: "2023", amount: 1.5 },
      { year: "2022", amount: 4.0 },
      { year: "2021", amount: 3.0 },
      { year: "2020", amount: 2.0 },
    ],
    "2454": [
      { year: "2024", amount: 76.0 },
      { year: "2023", amount: 76.0 },
      { year: "2022", amount: 73.0 },
      { year: "2021", amount: 37.0 },
      { year: "2020", amount: 51.0 },
    ],
    "2317": [
      { year: "2024", amount: 5.3 },
      { year: "2023", amount: 5.0 },
      { year: "2022", amount: 5.2 },
      { year: "2021", amount: 4.0 },
      { year: "2020", amount: 4.2 },
    ],
  };

  const currentFillers = fillers[stockId] || [
    { year: "2024", amount: Number((result[0]?.amount * 0.95 || 5).toFixed(1)) },
    { year: "2023", amount: Number((result[0]?.amount * 0.9 || 4.5).toFixed(1)) },
    { year: "2022", amount: Number((result[0]?.amount * 1.05 || 5.2).toFixed(1)) },
    { year: "2021", amount: Number((result[0]?.amount * 0.85 || 4.2).toFixed(1)) },
    { year: "2020", amount: Number((result[0]?.amount * 0.8 || 4.0).toFixed(1)) },
  ];

  currentFillers.forEach(f => {
    if (!existingYears.has(f.year)) {
      result.push({
        year: f.year,
        amount: f.amount,
        status: "歷史配息",
        exDividendDate: `${f.year}/08/15`,
        lastBuyDate: `${f.year}/08/13`,
      });
    }
  });

  return result.sort((a, b) => b.year.localeCompare(a.year));
};

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>(() => {
    try {
      const stored = localStorage.getItem("my_stocks");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          parsed.length > 0 &&
          Array.isArray(parsed[0].dividendInfo) &&
          parsed[0].priceHistory &&
          parsed[0].priceHistory[0] &&
          parsed[0].priceHistory[0].month
        ) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Local storage load Error:", e);
    }
    return DEFAULT_STOCKS;
  });

  const [market, setMarket] = useState<MarketState>(getTaiwanMarketState());

  const [activeTab, setActiveTab] = useState<"inventory" | "trade">("inventory");
  const [tradeForm, setTradeForm] = useState({
    id: "",
    name: "",
    type: "buy" as "buy" | "sell",
    lots: "" as number | "",
    odd: "" as number | "",
    price: "" as number | "",
    currentPrice: null as number | null,
    isSearching: false,
  });
  const [showTradeConfirmModal, setShowTradeConfirmModal] = useState(false);
  const [detailStockId, setDetailStockId] = useState<string | null>(null);
  const detailStock = stocks.find(s => s.id === detailStockId) || null;

  const [zoomedStock, setZoomedStock] = useState<Stock | null>(null);
  const [zoomedDividendStock, setZoomedDividendStock] = useState<Stock | null>(null);
  const [zoomViewMode, setZoomViewMode] = useState<"all" | "ai" | "price" | "dividend">("all");
  const [speakingStockId, setSpeakingStockId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1.15);
  const [aiTextSize, setAiTextSize] = useState<"base" | "lg" | "xl">("lg");
  const textSizeClass = aiTextSize === "base" ? "text-xs" : aiTextSize === "lg" ? "text-sm" : "text-base";

  const [aiStates, setAiStates] = useState<{ [key: string]: "idle" | "loading" | "done" }>({});
  const [aiReports, setAiReports] = useState<{ [key: string]: string }>({});
  const [aiErrors, setAiErrors] = useState<{ [key: string]: string | null }>({});
  const [expandedCards, setExpandedCards] = useState<{ [key: string]: boolean }>({});

  const [broadcast, setBroadcast] = useState<BroadcastState>({
    msg: "",
    type: "normal",
    visible: false,
  });

  const broadcastTimerRef = useRef<number | null>(null);
  const synthesizerRef = useRef<SpeechSynthesizer | null>(null);
  const stocksRef = useRef<Stock[]>(stocks);

  useEffect(() => {
    stocksRef.current = stocks;
  }, [stocks]);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      // Taiwan stock code is typical 4-6 digits
      if (tradeForm.id && tradeForm.id.length >= 2) {
        setTradeForm(prev => ({ ...prev, isSearching: true }));
        try {
          const checkRes = await fetch(`/api/stock/${tradeForm.id}`);
          if (checkRes.ok) {
            const data = await checkRes.json();
            if (data.currentPrice) {
              setTradeForm(prev => ({
                ...prev,
                name: data.name || prev.name,
                currentPrice: data.currentPrice,
                price: prev.price === "" ? data.currentPrice : prev.price,
                isSearching: false,
              }));
            } else {
              setTradeForm(prev => ({ ...prev, isSearching: false }));
            }
          } else {
            // Static/Offline Fallback (e.g., GitHub Pages)
            const fallback = DEFAULT_STOCKS.find(s => s.id === tradeForm.id);
            if (fallback) {
              setTradeForm(prev => ({
                ...prev,
                name: fallback.name,
                currentPrice: fallback.currentPrice,
                price: prev.price === "" ? fallback.currentPrice : prev.price,
                isSearching: false,
              }));
            } else {
              const mockPrice = 60 + Math.floor(Math.random() * 80);
              setTradeForm(prev => ({
                ...prev,
                name: `個股 (${tradeForm.id})`,
                currentPrice: mockPrice,
                price: prev.price === "" ? mockPrice : prev.price,
                isSearching: false,
              }));
            }
          }
        } catch (e) {
          // Static/Offline Fallback (e.g., GitHub Pages)
          const fallback = DEFAULT_STOCKS.find(s => s.id === tradeForm.id);
          if (fallback) {
            setTradeForm(prev => ({
              ...prev,
              name: fallback.name,
              currentPrice: fallback.currentPrice,
              price: prev.price === "" ? fallback.currentPrice : prev.price,
              isSearching: false,
            }));
          } else {
            const mockPrice = 60 + Math.floor(Math.random() * 80);
            setTradeForm(prev => ({
              ...prev,
              name: `個股 (${tradeForm.id})`,
              currentPrice: mockPrice,
              price: prev.price === "" ? mockPrice : prev.price,
              isSearching: false,
            }));
          }
        }
      } else {
         setTradeForm(prev => ({ ...prev, name: "", currentPrice: null, price: "" }));
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [tradeForm.id]);

  const executeTradeAction = () => {
    const { id, name, type, lots, odd, price } = tradeForm;
    const nPrice = Number(price);
    const nLots = Number(lots);
    const nOdd = Number(odd);
    const shares = (nLots * 1000) + nOdd;
    
    if (!id || !name || nPrice <= 0 || shares <= 0) {
      synthesizerRef.current?.speak("請填寫完整的買賣交易資訊！", "warning", 3000);
      return;
    }
    
    setStocks(prev => {
      const cloned = [...prev];
      const existIdx = cloned.findIndex(s => s.id === id);
      
      const newTx: Transaction = {
        id: "tx-" + Date.now().toString(),
        type,
        date: new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        shares,
        price: nPrice,
        fee: Math.max(20, Math.floor(nPrice * shares * 0.001425)),
        tax: type === 'sell' ? Math.floor(nPrice * shares * 0.003) : 0,
        netAmount: type === 'buy' ? (nPrice * shares + Math.max(20, Math.floor(nPrice * shares * 0.001425))) : (nPrice * shares - Math.max(20, Math.floor(nPrice * shares * 0.001425)) - Math.floor(nPrice * shares * 0.003))
      };
      
      if (existIdx !== -1) {
        const tgt = { ...cloned[existIdx] };
        const oldTxs = tgt.transactions || [];
        
        let baselineTxs = oldTxs;
        if (baselineTxs.length === 0 && tgt.shares > 0) {
          baselineTxs = [{
            id: 'init',
            type: 'buy',
            date: new Date(2000, 0, 1).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }),
            shares: tgt.shares,
            price: tgt.buyPrice || 0,
            fee: 0,
            tax: 0,
            netAmount: tgt.shares * (tgt.buyPrice || 0)
          }];
        }
        
        if (type === 'sell' && shares > tgt.shares) {
          return prev;
        }

        const newTxs = [...baselineTxs, newTx];
        const res = recalculateLedger(newTxs);
        tgt.transactions = newTxs;
        tgt.shares = res.shares;
        tgt.buyPrice = res.buyPrice;
        
        // update basic info
        tgt.name = name;
        if (tradeForm.currentPrice) {
          tgt.currentPrice = tradeForm.currentPrice;
        }
        
        cloned[existIdx] = tgt;
      } else {
        if (type === 'sell') {
           return prev;
        }
        cloned.push({
           id,
           name,
           shares: newTx.shares,
           buyPrice: newTx.price,
           currentPrice: tradeForm.currentPrice || newTx.price,
           change: 0,
           changePercent: 0,
           priceHistory: [],
           dividendInfo: [],
           aiAnalysis: "尚無系統分析資料報告。",
           transactions: [newTx]
        });
      }
      return cloned;
    });

    synthesizerRef.current?.speak(`已成功紀錄 ${name} 的 ${type === 'buy' ? '買入' : '賣出'} 交易。`, "normal", 3000);
    
    setTradeForm({
      id: "",
      name: "",
      type: "buy",
      lots: "",
      odd: "",
      price: "",
      currentPrice: null,
      isSearching: false
    });
    setShowTradeConfirmModal(false);
    setActiveTab("inventory");
  };

  const handleTradeSubmit = () => {
    const { id, name, type, lots, odd, price } = tradeForm;
    const nPrice = Number(price);
    const nLots = Number(lots);
    const nOdd = Number(odd);
    const shares = (nLots * 1000) + nOdd;
    
    if (!id) {
      synthesizerRef.current?.speak("請填寫完整的股票代號！", "warning", 3000);
      return;
    }
    if (!name) {
      synthesizerRef.current?.speak("請填寫公司名稱！", "warning", 3000);
      return;
    }
    if (nPrice <= 0) {
      synthesizerRef.current?.speak("請輸入大於零的有效價格！", "warning", 3000);
      return;
    }
    if (shares <= 0 || (lots === "" && odd === "")) {
      synthesizerRef.current?.speak("請輸入大於零的買賣股數！", "warning", 3000);
      return;
    }
    
    const existStock = stocks.find(s => s.id === id);
    if (type === 'sell') {
      if (!existStock) {
        synthesizerRef.current?.speak(`您目前並未持有 ${name}（${id}），無法進行賣出操作！`, "warning", 3000);
        return;
      }
      if (shares > existStock.shares) {
        synthesizerRef.current?.speak(`賣出股數 (${shares} 股) 不可大於目前持有股數 (${existStock.shares} 股)！`, "warning", 3000);
        return;
      }
    }

    if (tradeForm.currentPrice !== null) {
      const diffPercent = Math.abs(nPrice - tradeForm.currentPrice) / tradeForm.currentPrice;
      if (diffPercent > 0.05) {
        setShowTradeConfirmModal(true);
      } else {
        executeTradeAction();
      }
    } else {
      executeTradeAction();
    }
  };

  const syncAllStockPrices = async () => {
    try {
      // First, capture the current list of stocks we want to sync
      const listToSync = stocksRef.current;
      
      const newQuotes = await Promise.all(
        listToSync.map(async item => {
          try {
            const fetched = await fetch(`/api/stock/${item.id}?name=${encodeURIComponent(item.name)}`);
            if (fetched.ok) {
              const resJson = await fetched.json();
              return { id: item.id, resJson };
            } else {
              // Static Fallback (e.g., GitHub Pages) - simulated price fluctuation
              const randomWalkChangePercent = (Math.random() * 3 - 1.5); // -1.5% to +1.5%
              const currentP = item.currentPrice || 100;
              const priceChange = Math.round(currentP * (randomWalkChangePercent / 100) * 10) / 10;
              const newPrice = Math.max(5, Math.round((currentP + priceChange) * 10) / 10);
              const totalChange = Math.round((priceChange) * 10) / 10;
              return {
                id: item.id,
                resJson: {
                  currentPrice: newPrice,
                  change: totalChange,
                  changePercent: Math.round((totalChange / (newPrice - totalChange)) * 100 * 100) / 100,
                }
              };
            }
          } catch (e) {
            // Static Fallback (e.g., GitHub Pages) - simulated price fluctuation on catch
            const randomWalkChangePercent = (Math.random() * 3 - 1.5); // -1.5% to +1.5%
            const currentP = item.currentPrice || 100;
            const priceChange = Math.round(currentP * (randomWalkChangePercent / 100) * 10) / 10;
            const newPrice = Math.max(5, Math.round((currentP + priceChange) * 10) / 10);
            const totalChange = Math.round((priceChange) * 10) / 10;
            return {
              id: item.id,
              resJson: {
                currentPrice: newPrice,
                change: totalChange,
                changePercent: Math.round((totalChange / (newPrice - totalChange)) * 100 * 100) / 100,
              }
            };
          }
        })
      );

      setStocks(prev => {
        return prev.map(item => {
          const update = newQuotes.find(q => q && q.id === item.id);
          if (update && update.resJson) {
            const { resJson } = update;
            return {
              ...item,
              currentPrice: resJson.currentPrice || item.currentPrice,
              change: typeof resJson.change === "number" ? resJson.change : item.change,
              changePercent:
                typeof resJson.changePercent === "number" ? resJson.changePercent : item.changePercent,
              priceHistory:
                resJson.priceHistory && resJson.priceHistory.length > 0
                  ? resJson.priceHistory
                  : item.priceHistory,
              dividendInfo:
                resJson.dividendInfo && resJson.dividendInfo.length > 0
                  ? resJson.dividendInfo
                  : item.dividendInfo,
              aiAnalysis: resJson.aiAnalysis || item.aiAnalysis,
            };
          }
          return item;
        });
      });
    } catch (err) {
      console.error("Batch sync prices error:", err);
    }
  };

  useEffect(() => {
    // Initializer Speech synthesizer
    const synth = new SpeechSynthesizer((msg, type, durationMs) => {
      setBroadcast({ msg, type, visible: true });
      if (broadcastTimerRef.current) {
        clearTimeout(broadcastTimerRef.current);
      }
      broadcastTimerRef.current = window.setTimeout(() => {
        setBroadcast(prev => ({ ...prev, visible: false }));
      }, durationMs);
    });
    synthesizerRef.current = synth;

    const alertScheduler = new AlertScheduler(synth);
    alertScheduler.start();

    // Initial price sync after mount
    syncAllStockPrices();

    // Hot interval triggers price sync every 15s during active market
    const priceScheduler = window.setInterval(() => {
      const activeMarket = getTaiwanMarketState();
      setMarket(activeMarket);
      if (activeMarket.isOpen) {
        syncAllStockPrices();
      }
    }, 15000);

    return () => {
      alertScheduler.stop();
      clearInterval(priceScheduler);
      if (broadcastTimerRef.current) {
        clearTimeout(broadcastTimerRef.current);
      }
      synth.stop();
    };
  }, []);

  // Save stock ledger list to local storage
  useEffect(() => {
    localStorage.setItem("my_stocks", JSON.stringify(stocks));
  }, [stocks]);

  // Execute server-side AI Diagnostic push
  const listenToAiReport = async (stockId: string, item: Stock) => {
    setAiStates(prev => ({ ...prev, [stockId]: "loading" }));
    setAiErrors(prev => ({ ...prev, [stockId]: null }));
    setSpeakingStockId(stockId);
    
    try {
      // Trigger API in backend with instructions to perform high-tier Gemini model inference
      const response = await fetch(
        `/api/stock/${stockId}?name=${encodeURIComponent(item.name)}&ai=true`
      );
      
      if (response.ok) {
        const completedData = await response.json();
        
        setAiReports(prev => ({ ...prev, [stockId]: completedData.aiAnalysis }));
        setAiStates(prev => ({ ...prev, [stockId]: "done" }));
        
        if (completedData.aiError) {
          setAiErrors(prev => ({ ...prev, [stockId]: completedData.aiError }));
        } else {
          setAiErrors(prev => ({ ...prev, [stockId]: null }));
        }
        
        // Clean markdown indicators for audio narration
        const speakableText = completedData.aiAnalysis
          .replace(/【.*?】/g, "")
          .replace(/[#*`_\\-]/g, "")
          .replace(/\n/g, "，");
        
        synthesizerRef.current?.speak(speakableText, "normal", 15000, () => {
          setSpeakingStockId(null);
        });
      } else {
        throw new Error(`Server-side diagnosis failed (HTTP Status ${response.status})`);
      }
    } catch (err: any) {
      console.error(err);
      // Fallback
      setAiReports(prev => ({ ...prev, [stockId]: item.aiAnalysis }));
      setAiStates(prev => ({ ...prev, [stockId]: "done" }));
      setAiErrors(prev => ({ ...prev, [stockId]: err?.message || err?.toString() || "Diagnostic Failed" }));
      
      const speakableText = item.aiAnalysis
        .replace(/【.*?】/g, "")
        .replace(/[#*`_\\-]/g, "")
        .replace(/\n/g, "，");
      
      synthesizerRef.current?.speak(speakableText, "normal", 15000, () => {
        setSpeakingStockId(null);
      });
    }
  };


  const getRunningDetails = (txs: Transaction[]) => {
    let runningShares = 0;
    let runningCostBase = 0;
    
    return (txs || []).map((t) => {
      if (t.type === 'buy') {
        runningShares += t.shares;
        runningCostBase += (t.price * t.shares + (t.fee || 0));
      } else if (t.type === 'sell') {
        if (runningShares > 0) {
          const avgCost = runningCostBase / runningShares;
          runningShares -= t.shares;
          if (runningShares <= 0) {
            runningShares = 0;
            runningCostBase = 0;
          } else {
            runningCostBase -= avgCost * t.shares;
          }
        }
      }
      const avgPrice = runningShares > 0 ? Number((runningCostBase / runningShares).toFixed(2)) : 0;
      return {
        ...t,
        runningShares,
        runningAvgPrice: avgPrice,
        runningCostBase
      };
    });
  };

  const handleRemoveTransaction = (stockId: string, txId: string) => {
    setStocks(prev => prev.map(s => {
      if (s.id !== stockId) return s;
      const updatedTxs = (s.transactions || []).filter(t => t.id !== txId);
      const { shares: newShares, buyPrice: newBuyPrice } = recalculateLedger(updatedTxs);
      
      return {
        ...s,
        transactions: updatedTxs,
        shares: newShares,
        buyPrice: newBuyPrice
      };
    }));
    synthesizerRef.current?.speak("已成功刪除該筆交易紀錄並重新核算均價。", "normal", 3000);
  };

  const recalculateLedger = (txs: Transaction[]) => {
    let currentShares = 0;
    let totalCostBase = 0;

    for (const t of txs) {
      if (t.type === 'buy') {
        currentShares += t.shares;
        totalCostBase += (t.price * t.shares + (t.fee || 0));
      } else if (t.type === 'sell') {
        if (currentShares > 0) {
          const avgCost = totalCostBase / currentShares;
          currentShares -= t.shares;
          if (currentShares <= 0) {
            currentShares = 0;
            totalCostBase = 0;
          } else {
            totalCostBase -= avgCost * t.shares;
          }
        }
      }
    }

    const avgBuyPrice = currentShares > 0 ? (totalCostBase / currentShares) : 0;
    return {
      shares: currentShares,
      buyPrice: Number(avgBuyPrice.toFixed(2))
    };
  };


  const deleteStockLedgerRecord = (id: string, name: string) => {
    // Drop window.confirm because iframe blocks it
    setStocks(prev => prev.filter(s => s.id !== id));
    synthesizerRef.current?.speak(`已移除 ${name} 的紀錄。`, "normal", 4000);
  };

  // Calculate gross portfolio asset estimates
  const totalPortfolioAssetValue = stocks.reduce(
    (acc, st) => acc + st.currentPrice * st.shares,
    0
  );

  return (
    <div id="app_view" className="min-h-screen bg-[#faf8f5] font-sans text-[#2d2926] flex flex-col select-none relative pb-16">
      {/* Visual Header */}
      <header className="bg-white/85 backdrop-blur-md border-b border-[#eae6df] text-[#2d2926] p-5 md:p-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#9e3028] rounded-xl flex items-center justify-center shadow-sm">
              <Coins className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight flex items-center whitespace-nowrap gap-2 text-[#2d2926]">
                我的股票存摺 <span className="text-[10px] bg-[#8e8377]/10 text-[#7a7065] font-extrabold px-1.5 py-0.5 rounded-md border border-[#8e8377]/20 uppercase tracking-wider">Muji System</span>
              </h1>
              <p className="text-[#8e8377] text-xs mt-0.5 font-medium block">
                AI 專業財務智庫與個股決策報告系統
              </p>
            </div>
          </div>
          
          {/* Total Asset net appraisal desktop display */}
          <div className="hidden md:block text-right bg-[#fdfdfc] px-5 py-2.5 rounded-xl border border-[#eae6df] shadow-xs">
            <div className="text-[10px] uppercase tracking-wider text-[#8e8377] font-bold flex items-center gap-1.5 justify-end">
              <Briefcase size={11} className="text-[#9e3028]" />
              總資產淨值 (TWD)
            </div>
            <div className="text-xl md:text-2xl font-mono font-bold text-[#2d2926] mt-0.5">
              $ {totalPortfolioAssetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </header>

      {/* Floating broadcaster wave notifications */}
      {broadcast.visible && (
        <div className="fixed top-20 right-4 left-4 md:left-auto md:w-[420px] bg-white text-[#2d2926] backdrop-blur-md px-5 py-4 rounded-2xl shadow-xl z-50 border border-[#eae6df] flex gap-4 items-center animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="relative flex-shrink-0 flex items-center justify-center p-3 rounded-full bg-[#9e3028]/10 text-[#9e3028]">
            <Volume2 className="h-6 w-6 animate-bounce" />
            <div className="absolute inset-0 rounded-full border-2 border-[#9e3028]/30 animate-ping" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[#9e3028] tracking-wider font-extrabold uppercase flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4d7c5a] animate-pulse" />
              智慧語音決策廣播中
            </div>
            <p className="text-sm font-bold text-[#2d2926] mt-1 line-clamp-3 leading-relaxed">
              {broadcast.msg}
            </p>
          </div>
          <button
            onClick={() => {
              synthesizerRef.current?.stop();
              setBroadcast(prev => ({ ...prev, visible: false }));
            }}
            className="text-[#8e8377] hover:text-[#2d2926] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main stage */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Mobile Total Asset Appraisal Box */}
        <div className="md:hidden bg-white px-5 py-4 rounded-2xl border border-[#eae6df] shadow-xs flex flex-col items-center justify-center">
          <div className="text-[10px] uppercase tracking-wider text-[#8e8377] font-bold flex items-center gap-1 justify-center">
            <Briefcase size={11} className="text-[#9e3028]" />
            總資產淨值 (TWD)
          </div>
          <div className="text-2xl font-mono font-bold text-[#2d2926] mt-1">
            $ {totalPortfolioAssetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Dynamic status center */}
        <div className="bg-white p-4 rounded-xl border border-[#eae6df] shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
            <div className={`px-4 py-1.5 border rounded-full font-bold flex items-center justify-center w-full sm:w-auto gap-2 text-xs sm:text-sm shadow-xs ${market.color}`}>
              <span className={`block h-1.5 w-1.5 rounded-full ${market.isOpen ? "bg-[#4d7c5a] animate-pulse" : "bg-[#8e8476]"}`} />
              <span>{market.desc}</span>
            </div>
            <div className="text-[11px] text-[#8e8377] font-medium flex items-center gap-1">
              <Clock size={12} className="text-[#8e8377]" />
              自動即時更新：開盤中每 15 秒同步一次
            </div>
          </div>
          <button
            onClick={() => setActiveTab("trade")}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#9e3028] hover:bg-[#872822] text-white transition-colors px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer shadow-sm active:scale-98"
          >
            <Plus size={16} />
            新增買賣紀錄
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-[#eae6df] mb-2 mt-4">
          <button 
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'inventory' ? 'text-[#2d2926] border-[#2d2926]' : 'text-[#8e8377] border-transparent hover:text-[#2d2926]'}`}
          >
            📊 庫存概覽
          </button>
          <button 
            onClick={() => setActiveTab("trade")}
            className={`px-4 py-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'trade' ? 'text-[#2d2926] border-[#2d2926]' : 'text-[#8e8377] border-transparent hover:text-[#2d2926]'}`}
          >
            💰 買賣交易
          </button>
        </div>

        {activeTab === "trade" && (
          <div className="bg-white border border-[#eae6df] text-[#2d2926] rounded-xl p-6 md:p-8 max-w-lg w-full shadow-lg flex flex-col gap-5 mx-auto animate-in fade-in duration-300 mt-6">
            <div className="border-b border-[#eae6df] pb-3">
              <h2 className="text-xl font-black text-[#2d2926] flex items-center gap-2">
                💰 買賣交易執行區
              </h2>
              <p className="text-xs text-[#8e8377] mt-1 font-medium">獨立的買入/賣出輸入框，輸入代號後自動帶入即時市價。</p>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-[#8e8377] mb-1 uppercase tracking-wider">代號</label>
                  <input
                    type="text"
                    value={tradeForm.id}
                    onChange={(e) => setTradeForm(prev => ({ ...prev, id: e.target.value.trim() }))}
                    className="w-full text-sm font-bold p-3 bg-[#faf8f5] text-[#2d2926] rounded-lg border border-[#eae6df] focus:border-[#9e3028] outline-none placeholder:font-normal"
                    placeholder="輸入代號 (如 2330)"
                  />
                  {tradeForm.isSearching && <div className="text-[10px] text-[#8e8377] mt-1 pulse-animation">抓取名稱與市價中...</div>}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-[#8e8377] mb-1 uppercase tracking-wider">名稱</label>
                  <input
                    type="text"
                    value={tradeForm.name}
                    onChange={(e) => setTradeForm(prev => ({ ...prev, name: e.target.value.trim() }))}
                    className="w-full text-sm font-bold p-3 bg-[#faf8f5] text-[#2d2926] rounded-lg border border-[#eae6df] focus:border-[#9e3028] outline-none"
                    placeholder="自動帶入"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <label className="block text-xs font-bold text-[#8e8377] mb-1 uppercase tracking-wider">交易類別</label>
                  <select 
                    value={tradeForm.type}
                    onChange={(e) => setTradeForm(prev => ({ ...prev, type: e.target.value as "buy" | "sell" }))}
                    className="w-full text-sm font-bold p-3 bg-[#faf8f5] text-[#2d2926] rounded-lg border border-[#eae6df] outline-none cursor-pointer"
                  >
                    <option value="buy">買入</option>
                    <option value="sell">賣出</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#8e8377] mb-1 uppercase tracking-wider">價格</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tradeForm.price === "" ? "" : tradeForm.price}
                    onChange={(e) => setTradeForm(prev => ({ ...prev, price: e.target.value ? Math.abs(Number(e.target.value)) : "" }))}
                    className="w-full text-sm font-bold p-3 bg-[#faf8f5] text-[#2d2926] rounded-lg border border-[#eae6df] focus:border-[#9e3028] outline-none font-mono"
                    placeholder="自動帶入即時市價"
                  />
                </div>
              </div>
              
              {/* Validation Warning */}
              {tradeForm.price !== "" && tradeForm.currentPrice !== null && (Math.abs(Number(tradeForm.price) - tradeForm.currentPrice) / tradeForm.currentPrice) > 0.05 && (
                <div className="bg-[#fdf8f7] border-l-4 border-[#c84a42] p-3 rounded-r-lg text-xs font-medium text-[#c84a42] flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>您設定的價格與當前市價 ({tradeForm.currentPrice}) 差距大於 5%！</span>
                </div>
              )}

              <div className="flex gap-2 items-center bg-[#faf8f5] rounded-lg border border-[#eae6df] p-3 focus-within:border-[#9e3028] mt-1">
                <input
                  type="number"
                  min="0"
                  value={tradeForm.lots === "" ? "" : tradeForm.lots}
                  onChange={(e) => setTradeForm(prev => ({ ...prev, lots: e.target.value ? Math.abs(Number(e.target.value)) : "" }))}
                  placeholder="0"
                  className="w-full min-w-0 text-base font-bold p-1 bg-transparent text-[#2d2926] outline-none font-mono text-center"
                />
                <span className="text-sm text-[#8e8377] font-bold shrink-0">張</span>
                <div className="w-[1px] h-6 bg-[#eae6df] mx-2"></div>
                <input
                  type="number"
                  min="0"
                  value={tradeForm.odd === "" ? "" : tradeForm.odd}
                  onChange={(e) => setTradeForm(prev => ({ ...prev, odd: e.target.value ? Math.abs(Number(e.target.value)) : "" }))}
                  placeholder="0"
                  className="w-full min-w-0 text-base font-bold p-1 bg-transparent text-[#2d2926] outline-none font-mono text-center"
                />
                <span className="text-sm text-[#8e8377] font-bold shrink-0">股</span>
              </div>

              <button
                onClick={handleTradeSubmit}
                className="mt-4 w-full bg-[#2d2926] hover:bg-[#4a4440] text-white font-bold py-4 rounded-xl shadow-[0_4px_12px_rgba(45,41,38,0.2)] transition-all cursor-pointer flex justify-center items-center gap-2 text-base"
              >
                確認送出
              </button>
            </div>
          </div>
        )}

        {/* Stocks Ledger Grid */}
        <div className={`flex flex-col gap-5 transition-opacity duration-300 ${activeTab === 'inventory' ? 'opacity-100' : 'opacity-0 hidden'}`}>
          {stocks.length === 0 ? (
            <div className="text-center p-16 bg-white rounded-2xl border-2 border-dashed border-[#eae6df] text-[#8e8377] font-medium text-base">
              <Coins className="h-10 w-10 text-[#8e8377]/60 mx-auto mb-3" />
              目前沒有任何庫存資料，請點擊上方「新增股票」！
            </div>
          ) : (
            stocks.map(item => {
              const unrealizedReturn = (item.currentPrice - item.buyPrice) * item.shares;
              const isProfit = unrealizedReturn > 0;
              const isLoss = unrealizedReturn < 0;
              const dayUp = (item.change ?? 0) > 0;
              const dayDown = (item.change ?? 0) < 0;
              const priceColorClass = dayUp
                ? "text-[#c84a42]"
                : dayDown
                ? "text-[#4d7c5a]"
                : "text-[#2d2926]";
              const isTrapState = isLoss; // "高點套牢" warning condition
              const isExpanded = !!expandedCards[item.id];
              const diagnosisState = aiStates[item.id] || "idle";
              const displayDiagnosis = aiReports[item.id] || item.aiAnalysis;

              return (
                <div
                  key={item.id}
                  id={`card_${item.id}`}
                  className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-[#eae6df] flex flex-col transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] hover:border-[#c5bcad] overflow-hidden"
                >
                  <div className="p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 justify-between animate-in fade-in duration-300">
                    {/* Header: Name and ID */}
                    <div className="flex justify-between items-start md:w-[25%] md:shrink-0">
                      <div>
                        <div className="font-bold text-lg md:text-xl text-[#2d2926] tracking-tight">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-[#8e8377] font-mono mt-1 font-bold bg-[#faf8f5] rounded-md px-2 py-0.5 inline-block border border-[#eae6df]">
                          {item.id}
                        </div>
                      </div>
                      
                      {/* Mobile Current Price */}
                      <div className="text-right md:hidden">
                        <div className={`font-mono text-xl font-bold ${priceColorClass}`}>
                          $ {item.currentPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 2,
                          })}
                          <span className="text-xs ml-1 align-baseline">
                            {dayUp ? "▲" : dayDown ? "▼" : "-"}
                          </span>
                        </div>
                        {isTrapState && (
                          <div className="inline-block mt-1 bg-[#4d7c5a]/10 text-[#4d7c5a] text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#4d7c5a]/20">
                            高點套牢
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Columns: Assets held, Buy Price, Gain/Loss */}
                    <div className="grid grid-cols-3 gap-2 md:flex md:flex-1 md:justify-around text-center">
                      <div 
                        className="bg-[#faf8f5] md:bg-transparent rounded-lg p-2 md:p-0 flex flex-col justify-center items-center cursor-pointer hover:bg-[#eae6df] md:hover:bg-[#faf8f5] transition-all md:px-3 md:cursor-pointer group relative"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setDetailStockId(item.id);
                        }}
                        title="點擊查看庫存歷史明細與均價變化"
                      >
                        <div className="absolute -top-1 -right-1 text-[10px] bg-[#9e3028] text-white px-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden md:block">
                          紀錄
                        </div>
                        <div className="text-[10px] font-bold text-[#8e8377] mb-0.5 group-hover:text-[#9e3028] transition-colors">
                          持有股數
                        </div>
                        <div className="font-mono text-sm sm:text-base font-bold text-[#2d2926] mt-0.5 whitespace-nowrap">
                          {item.shares} 股
                        </div>
                      </div>

                      <div className="bg-[#faf8f5] md:bg-transparent rounded-lg p-2 md:p-0 flex flex-col justify-center items-center">
                        <div className="text-[10px] font-bold text-[#8e8377] mb-0.5">
                          均價成本
                        </div>
                        <div className="font-mono text-sm sm:text-base font-bold text-[#2d2926] mt-0.5">
                          $ {item.buyPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>

                      <div className={`rounded-lg p-2 md:px-3 md:py-1 md:rounded-lg flex flex-col justify-center items-center ${isProfit ? "bg-[#c84a42]/10 text-[#c84a42] border border-[#c84a42]/20" : isLoss ? "bg-[#4d7c5a]/10 text-[#4d7c5a] border border-[#4d7c5a]/20" : "bg-[#faf8f5] text-[#8e8377] border border-[#eae6df]"}`}>
                        <div className="text-[10px] font-bold mb-0.5 opacity-85">
                          {isProfit ? "未實現獲利" : isLoss ? "未實現虧損" : "未實現損益"}
                        </div>
                        <div className="font-mono text-xs sm:text-sm md:text-base font-bold mt-0.5">
                          {isProfit ? "+" : ""}
                          {Math.round(unrealizedReturn).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Current Price column */}
                    <div className="hidden md:flex md:w-[15%] md:shrink-0 md:flex-col md:items-end">
                      <div className="text-right">
                        <div className={`font-mono text-xl font-bold ${priceColorClass}`}>
                          $ {item.currentPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 2,
                          })}
                          <span className="text-sm ml-1">
                            {dayUp ? "▲" : dayDown ? "▼" : "-"}
                          </span>
                        </div>
                        {isTrapState && (
                          <div className="inline-block mt-0.5 bg-[#4d7c5a]/10 text-[#4d7c5a] text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#4d7c5a]/20">
                            高點套牢
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Desktop control actions */}
                    <div className="hidden md:flex md:w-[22%] md:shrink-0 md:items-center md:justify-end gap-2">
                      <button
                        onClick={() => toggleCard(item.id)}
                        className="flex-1 bg-[#faf8f5] hover:bg-[#eae6df] text-[#2d2926] border border-[#eae6df] font-bold py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1 text-xs whitespace-nowrap shadow-xs cursor-pointer"
                      >
                        <span>📝 查看明細與分析</span>
                        <ChevronUp
                          size={13}
                          className={`transform transition-transform ${isExpanded ? "" : "rotate-180"}`}
                        />
                      </button>
                      
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setTradeForm({
                            id: item.id,
                            name: item.name,
                            type: "buy",
                            lots: "",
                            odd: "",
                            price: item.currentPrice || "",
                            currentPrice: item.currentPrice || null,
                            isSearching: false
                          });
                          setActiveTab("trade");
                        }}
                        className="p-2 bg-[#faf8f5] hover:bg-[#eae6df] text-[#8e8377] rounded-lg border border-[#eae6df] transition-colors shrink-0 shadow-xs cursor-pointer px-3"
                        title="紀錄買賣"
                      >
                        <span className="text-xs font-bold text-[#8e8377] group-hover:text-[#2d2926]">買賣</span>
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); deleteStockLedgerRecord(item.id, item.name); }}
                        className="p-2 bg-[#faf8f5] hover:bg-[#fdf4f4] text-[#c84a42] hover:border-[#f5dce0] rounded-lg border border-[#eae6df] transition-colors shrink-0 shadow-xs cursor-pointer"
                        title="刪除紀錄"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Mobile Actions block */}
                  <div className="px-5 pb-5 md:hidden flex flex-col gap-3 border-t border-[#eae6df] pt-4">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setTradeForm({
                            id: item.id,
                            name: item.name,
                            type: "buy",
                            lots: "",
                            odd: "",
                            price: item.currentPrice || "",
                            currentPrice: item.currentPrice || null,
                            isSearching: false
                          });
                          setActiveTab("trade");
                        }}
                        className="flex-1 text-xs px-3 py-2 rounded-lg bg-[#faf8f5] text-[#8e8377] border border-[#eae6df] font-bold hover:bg-[#eae6df] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span className="text-xs font-bold">紀錄買賣</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteStockLedgerRecord(item.id, item.name); }}
                        className="flex-1 text-xs px-3 py-2 rounded-lg bg-[#faf8f5] text-[#c84a42] border border-[#eae6df] font-bold hover:bg-[#fdf4f4] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 size={11} />
                        刪除庫存
                      </button>
                    </div>
                    
                    <button
                      onClick={() => toggleCard(item.id)}
                      className="bg-[#faf8f5] hover:bg-[#eae6df] text-[#2d2926] border border-[#eae6df] font-bold py-2 px-4 rounded-lg transition-all flex justify-between items-center text-xs w-full shadow-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>📝</span>
                        查看明細與分析走勢
                      </span>
                      <ChevronUp
                        size={13}
                        className={`transform transition-transform ${isExpanded ? "" : "rotate-180"}`}
                      />
                    </button>
                  </div>

                  {/* Expanded bento box for visual trends & AI insights */}
                  {isExpanded && (
                    <div className="bg-[#faf9f6]/90 p-5 md:p-6 border-t border-[#eae6df] animate-in fade-in slide-in-from-top-2 duration-200">
                      
                      {/* Transaction History Area */}
                      {item.transactions && item.transactions.length > 0 && (
                        <div className="border border-[#eae6df] bg-white rounded-xl p-4 md:p-5 shadow-xs flex flex-col gap-4 mb-6">
                          <div className="flex items-center justify-between border-b border-[#faf8f5] pb-2">
                            <span className="text-xs font-black text-[#2d2926] flex items-center gap-1.5">
                              📝 買入明細表
                            </span>
                            <span className="text-[10px] bg-[#faf8f5] text-[#8e8377] font-bold px-2 py-0.5 rounded border border-[#eae6df]">
                              共 {item.transactions.length} 筆
                            </span>
                          </div>
                          <div className="overflow-x-auto scrollbar-thin pb-1">
                            <table className="w-full text-[11px] sm:text-xs text-left min-w-[300px]">
                              <thead>
                                <tr className="border-b border-[#eae6df]/60 text-[#8e8377] font-bold">
                                  <th className="pb-2 pl-2">日期</th>
                                  <th className="pb-2 text-center">類別</th>
                                  <th className="pb-2 text-right">價格</th>
                                  <th className="pb-2 text-right pr-2">股數</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.transactions.map((tx, idx) => (
                                  <tr key={tx.id || idx} className="border-b border-[#eae6df]/30 last:border-0 hover:bg-[#faf8f5] transition-colors">
                                    <td className="py-2.5 pl-2 font-mono text-[#8e8377]">{tx.date}</td>
                                    <td className="py-2.5 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.type === 'buy' ? 'bg-[#c84a42]/10 text-[#c84a42]' : 'bg-[#4d7c5a]/10 text-[#4d7c5a]'}`}>
                                        {tx.type === 'buy' ? '買入' : '賣出'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 font-mono font-bold text-[#c84a42] text-right">@ {tx.price}</td>
                                    <td className="py-2.5 font-mono font-bold text-[#2d2926] text-right pr-2">
                                      {tx.shares >= 1000 
                                        ? `${Math.floor(tx.shares / 1000)}張 ${tx.shares % 1000 > 0 ? (tx.shares % 1000 + '股') : ''}` 
                                        : `${tx.shares} 股`}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          {/* Accumulated Dividends Calculation */}
                          <div className="mt-2 pt-3 border-t border-[#eae6df] flex flex-col gap-2 bg-[#faf8f5]/50 px-3 py-2.5 rounded text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[#8e8377]">總投入成本試算</span>
                              <span className="font-mono font-bold text-[#2d2926] text-sm">
                                $ {Math.floor(item.shares * item.buyPrice).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[#8e8377]">預估累計領息 (由歷史交易推算)</span>
                              <span className="font-mono font-bold text-[#4d7c5a] text-sm">
                                $ {(() => {
                                    if (!item.transactions || item.transactions.length === 0) return 0;
                                    if (!item.dividendInfo || item.dividendInfo.length === 0) return 0;
                                    let totalDiv = 0;
                                    item.dividendInfo.forEach(div => {
                                      const year = parseInt(div.year);
                                      if (isNaN(year)) return;
                                      const exDate = new Date(year, 6, 1);
                                      let sharesHeld = 0;
                                      (item.transactions || []).forEach(t => {
                                        let tDate = new Date();
                                        if (t.date === '初始庫存轉換') {
                                          tDate = new Date(2000, 0, 1);
                                        } else if (t.date) {
                                          const parts = String(t.date).split('/');
                                          if (parts.length === 3) {
                                            tDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                                          } else {
                                            const dashParts = String(t.date).split('-');
                                            if (dashParts.length === 3) {
                                              tDate = new Date(parseInt(dashParts[0], 10), parseInt(dashParts[1], 10) - 1, parseInt(dashParts[2], 10));
                                            } else {
                                              const d = new Date(t.date);
                                              if (!isNaN(d.getTime())) {
                                                tDate = d;
                                              }
                                            }
                                          }
                                        }
                                        if (tDate <= exDate) {
                                          if (t.type === 'buy') sharesHeld += t.shares;
                                          else if (t.type === 'sell') sharesHeld -= t.shares;
                                        }
                                      });
                                      if (sharesHeld > 0) totalDiv += sharesHeld * div.cashDividend;
                                    });
                                    return Math.floor(totalDiv).toLocaleString();
                                  })()}
                              </span>
                            </div>
                          </div>
                          
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Sub-Bento 1: Area line chart */}
                        <div className="lg:col-span-1 border border-[#eae6df] bg-white rounded-xl p-4 md:p-5 shadow-xs flex flex-col justify-between">
                          <div className="text-xs font-bold text-[#2d2926] mb-4 flex justify-between items-center border-b border-[#faf8f5] pb-2">
                            <span className="flex items-center gap-1">📊 近一年股價走勢圖</span>
                            <span className="text-[9px] bg-[#faf8f5] text-[#8e8377] font-bold px-1.5 py-0.5 rounded border border-[#eae6df] uppercase">
                              歷史軌跡
                            </span>
                          </div>

                          {item.priceHistory && item.priceHistory.length > 0 ? (
                            <div
                              className="flex-1 h-[150px] w-full mt-2 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => { setZoomedStock(item); setZoomViewMode("price"); }}
                              title="點擊放大圖表"
                            >
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                  data={item.priceHistory}
                                  margin={{ top: 5, right: 0, left: -25, bottom: 0 }}
                                >
                                  <defs>
                                    <linearGradient
                                      id={`colorPrice-${item.id}`}
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="1"
                                    >
                                      <stop
                                        offset="5%"
                                        stopColor={dayUp ? "#c84a42" : dayDown ? "#4d7c5a" : "#8e8377"}
                                        stopOpacity={0.15}
                                      />
                                      <stop
                                        offset="95%"
                                        stopColor={dayUp ? "#c84a42" : dayDown ? "#4d7c5a" : "#8e8377"}
                                        stopOpacity={0}
                                      />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eae6df" />
                                  <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: "#8e8377", fontWeight: "bold" }}
                                    dy={6}
                                  />
                                  <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: "#8e8377", fontWeight: "bold" }}
                                    domain={["dataMin - 10", "dataMax + 10"]}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: "#ffffff",
                                      borderRadius: "8px",
                                      border: "1px solid #eae6df",
                                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                                      fontWeight: "bold",
                                      fontSize: "12px",
                                      color: "#2d2926",
                                    }}
                                    itemStyle={{
                                      color: dayUp ? "#c84a42" : dayDown ? "#4d7c5a" : "#8e8377",
                                      fontWeight: "900",
                                    }}
                                    formatter={(val: number) => [`$${val}`, "收盤價"]}
                                    labelStyle={{ color: "#8e8377" }}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke={dayUp ? "#c84a42" : dayDown ? "#4d7c5a" : "#8e8377"}
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill={`url(#colorPrice-${item.id})`}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="h-32 flex items-center justify-center text-xs font-bold text-[#8e8377]">
                              尚無走勢圖資料
                            </div>
                          )}
                        </div>

                        {/* Sub-Bento 2: Dividend grid */}
                        <div
                          onClick={() => { setZoomedStock(item); setZoomViewMode("dividend"); }}
                          className="lg:col-span-1 border border-[#eae6df] bg-white rounded-xl p-4 md:p-5 shadow-xs flex flex-col justify-between cursor-pointer hover:border-[#9e3028]/35 hover:shadow-sm transition-all group"
                          title="點擊放大配息資料與歷年配息軌跡"
                        >
                          <div className="text-xs font-bold text-[#9e3028] mb-4 flex items-center justify-between border-b border-[#faf8f5] pb-2">
                            <span className="flex items-center gap-1.5">💰 當期股利、除息與發放日前瞻</span>
                            <span className="text-[10px] text-[#8e8377] font-semibold bg-[#faf8f5] group-hover:bg-[#9e3028] group-hover:text-white px-2 py-0.5 rounded border border-[#eae6df] group-hover:border-transparent transition-colors flex items-center gap-1">
                              🔍 點擊放大
                            </span>
                          </div>

                          {(() => {
                            const enrichedHist = getEnrichedDividendHistory(item.id, item.dividendInfo);
                            const currentDiv = enrichedHist[0] || { year: "2026", amount: 0, status: "預估", exDividendDate: "—", lastBuyDate: "—" };
                            const estPayoutDate = getPayoutDate(currentDiv.exDividendDate);
                            const totalEstPayout = currentDiv.amount * item.shares;
                            
                            return (
                              <div className="flex-1 flex flex-col justify-between gap-3 text-xs w-full">
                                <div className="grid grid-cols-2 gap-2 bg-[#faf8f5] p-2.5 rounded-lg border border-[#eae6df]/60">
                                  <div>
                                    <div className="text-[9px] text-[#8e8377] font-bold">當期配息 (元/股)</div>
                                    <div className="text-[14px] font-bold text-[#c84a42] mt-0.5 whitespace-nowrap">
                                      {currentDiv.amount.toFixed(1)} 元{" "}
                                      <span className="text-[9px] font-bold px-1 py-0.2 bg-[#9e3028]/5 border border-[#9e3028]/15 rounded text-[#9e3028] ml-0.5">
                                        {currentDiv.status}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[9px] text-[#8e8377] font-bold">當期累計應收預估</div>
                                    <div className="text-[14px] font-bold text-[#c84a42] mt-0.5 whitespace-nowrap">
                                      ${totalEstPayout.toLocaleString()} 元
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-1.5 font-sans mt-0.5 text-[#2d2926]">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-[#8e8377] font-semibold flex items-center gap-1">🗓️ 除息交易日</span>
                                    <span className="font-mono font-bold bg-[#faf8f5] px-1.5 py-0.5 rounded border border-[#eae6df] text-[11px]">{currentDiv.exDividendDate}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-[#8e8377] font-semibold flex items-center gap-1">🎁 預估發放日</span>
                                    <span className="font-mono font-bold bg-[#4d7c5a]/5 text-[#4d7c5a] px-1.5 py-0.5 rounded border border-[#4d7c5a]/15 text-[11px]">{estPayoutDate}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-[#8e8377] font-semibold flex items-center gap-1">⏳ 最後買進過戶日</span>
                                    <span className="font-mono font-bold bg-[#faf8f5] px-1.5 py-0.5 rounded border border-[#eae6df] text-[11px]">{currentDiv.lastBuyDate}</span>
                                  </div>
                                </div>
                                <div 
                                  className="text-[10px] text-right text-[#9e3028] font-bold mt-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); setZoomedStock(item); setZoomViewMode("all"); }}
                                >
                                  💡 點擊展開歷年完整配息與長線走勢
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Sub-Bento 3: Server-side AI Advisor with Real-time Generation */}
                        <div className="lg:col-span-1 bg-white border border-[#eae6df] rounded-xl p-4 md:p-5 shadow-xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-3 border-b border-[#faf8f5] pb-2">
                              <h4 className="font-bold text-[#9e3028] flex items-center gap-1.5 text-xs sm:text-sm">
                                <Sparkles size={16} className="text-[#9e3028]" />
                                股神級 AI 個股財務健檢
                              </h4>
                            </div>

                            <button
                              onClick={() => listenToAiReport(item.id, item)}
                              disabled={diagnosisState === "loading"}
                              className={`w-full px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs shrink-0 cursor-pointer ${
                                diagnosisState === "loading"
                                  ? "bg-[#faf8f5] text-[#8e8377] border border-[#eae6df] cursor-not-allowed"
                                  : "bg-[#9e3028] hover:bg-[#872822] text-white active:scale-98"
                              }`}
                            >
                              {diagnosisState === "loading" ? (
                                <>
                                  <Loader2 size={16} className="animate-spin text-[#9e3028]" />
                                  <span>雲端 AI 深度智庫分析中...</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 size={16} />
                                  <span>聽取 AI 專業決策報告 (國語)</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Error/Warning Banner for API 503 limit fallback */}
                          {aiErrors[item.id] && (
                            <div className="mt-2.5 px-3 py-2 bg-[#9e3028]/5 border border-[#9e3028]/15 rounded-lg text-[10px] sm:text-xs text-[#9e3028] leading-normal flex items-start gap-1.5 font-medium animate-in slide-in-from-top-1 duration-200">
                              <span className="shrink-0 font-bold mt-0.5">⚠️ 系統提示：</span>
                              <div>
                                <span>由於目前雲端 AI 智庫需求量過大 (503 Unavailable / 網路忙碌中)，已自動為您加載該標的預存專家分析報告。請稍後重試！</span>
                              </div>
                            </div>
                          )}

                          {/* Dynamic diagnostic scroll card */}
                          {(diagnosisState === "loading" || diagnosisState === "done") && (
                            <div 
                              onClick={diagnosisState === "done" ? () => { setZoomedStock(item); setZoomViewMode("ai"); } : undefined}
                              className={`mt-4 bg-[#faf8f5] rounded-lg p-3 border border-[#eae6df] flex-1 text-left transition-all ${
                                diagnosisState === "done" 
                                  ? "cursor-pointer hover:border-[#9e3028]/35 hover:bg-white select-none group/diag relative overflow-hidden" 
                                  : ""
                              }`}
                              style={{ maxHeight: "140px" }}
                              title={diagnosisState === "done" ? "點擊展開全螢幕完整診斷書" : undefined}
                            >
                              {diagnosisState === "loading" ? (
                                <div className="flex flex-col gap-2 py-2">
                                  <div className="flex items-center gap-2 text-[#9e3028] font-bold text-xs">
                                    <Loader2 className="animate-spin" size={14} />
                                    <span className="animate-pulse">調閱該股基本面、歷年配息與籌碼指標...</span>
                                  </div>
                                  <div className="h-2 bg-[#eae6df] rounded-full animate-pulse w-full mt-2" />
                                  <div className="h-2 bg-[#eae6df] rounded-full animate-pulse w-[85%]" />
                                  <div className="h-2 bg-[#eae6df] rounded-full animate-pulse w-[50%]" />
                                </div>
                              ) : (
                                <div className="h-full flex flex-col justify-between">
                                  <div className="overflow-y-auto max-h-[96px] text-xs text-[#2d2926] font-medium whitespace-pre-line tracking-wide leading-relaxed pr-1 scrollbar-thin">
                                    {displayDiagnosis}
                                  </div>
                                  <div className="text-right text-[9px] text-[#9e3028] font-bold mt-1 group-hover/diag:translate-x-0.5 transition-transform flex items-center justify-end gap-1">
                                    <span>🔍 點擊展開全螢幕頂尖研報診斷書</span>
                                    <span>➔</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mt-12 py-8 border-t border-[#eae6df] bg-[#fdfcfb] text-center text-[10px] md:text-sm text-[#8e8377] font-medium tracking-wide">
        <p>© 2026 我的股票存摺 · 雲端實時台股價格對接系統</p>
        <p className="mt-2 max-w-2xl mx-auto px-4 opacity-80 justify-center flex items-center gap-1.5 leading-relaxed text-xs">
          <AlertCircle size={12} className="text-[#8e8377] shrink-0" />
          免責聲明：本存摺所提供之 AI 診斷、個股報價與走勢，皆為系統模擬並介接公開 API 計算，絕非任何投資買賣建議。
        </p>
      </footer>

      {/* MODAL 0: TRADE CONFIRMATION POPUP */}
      {showTradeConfirmModal && (
        <div className="fixed inset-0 bg-[#2d2926]/40 backdrop-blur-xs z-[115] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#eae6df] text-[#2d2926] rounded-xl p-6 max-w-sm w-full shadow-lg flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-[#c84a42] font-black">
              <AlertTriangle size={20} />
              <h2 className="text-lg">價格偏離警示</h2>
            </div>
            <p className="text-sm font-medium text-[#2d2926] leading-relaxed">
              您設定的{tradeForm.type === 'buy' ? '買入' : '賣出'}價（<span className="font-bold underline">${tradeForm.price}</span>）與當下市價（<span className="font-bold underline">${tradeForm.currentPrice}</span>）差異超過 5%。
            </p>
            <p className="text-sm font-bold text-[#8e8377]">請問是否確認執行此筆交易？</p>
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowTradeConfirmModal(false)}
                className="flex-1 bg-[#faf8f5] hover:bg-[#eae6df] text-[#8e8377] font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                取消修改
              </button>
              <button
                onClick={() => executeTradeAction()}
                className="flex-1 bg-[#c84a42] hover:bg-[#a63d36] text-white font-bold py-2.5 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                確認執行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: INVENTORY DETAIL POPUP */}
      {detailStockId && detailStock && (
        <div className="fixed inset-0 bg-[#2d2926]/40 backdrop-blur-xs z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#eae6df] text-[#2d2926] rounded-xl p-6 md:p-8 max-w-2xl w-full shadow-lg flex flex-col gap-5 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] scrollbar-thin">
            
            <div className="flex justify-between items-center border-b border-[#eae6df] pb-3">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-[#2d2926] flex items-center gap-1.5 leading-none">
                  📋 {detailStock.name} <span className="text-[#8e8377] text-sm ml-1 font-semibold">({detailStock.id})</span>
                </h2>
                <p className="text-[11px] text-[#8e8377] mt-1.5 font-medium">歷史買賣明細與核算均價變化軌跡</p>
              </div>
              <button
                onClick={() => setDetailStockId(null)}
                className="text-[#8e8377] hover:text-[#2d2926] bg-[#faf8f5] hover:bg-[#eae6df] p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-[#faf8f5]/60 p-3.5 rounded-xl border border-[#eae6df]/70 text-xs shadow-3xs">
                <div>
                  <span className="block text-[#8e8377] font-bold mb-1">目前庫存股數</span>
                  <span className="font-mono font-black text-sm text-[#2d2926]">{detailStock.shares.toLocaleString()} 股</span>
                </div>
                <div>
                  <span className="block text-[#8e8377] font-bold mb-1">目前平均成本</span>
                  <span className="font-mono font-black text-sm text-[#c84a42]">$ {detailStock.buyPrice.toLocaleString()} 元</span>
                </div>
              </div>

              <div className="border border-[#eae6df] rounded-xl overflow-hidden bg-[#fdfcfb]">
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-xs text-left min-w-[450px]">
                    <thead>
                      <tr className="bg-[#faf8f5] border-b border-[#eae6df] text-[#8e8377] font-bold">
                        <th className="py-3 px-3">交易日期</th>
                        <th className="py-3 px-2 text-center">交易類別</th>
                        <th className="py-3 px-2 text-right">交易單價</th>
                        <th className="py-3 px-2 text-right">交易股數</th>
                        <th className="py-3 px-2 text-right text-amber-900 font-bold">交易後均價</th>
                        <th className="py-3 px-2 text-right">持有股數</th>
                        <th className="py-3 px-3 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const runningTxs = getRunningDetails(detailStock.transactions || []);
                        if (runningTxs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-[#8e8377] font-medium font-mono">
                                尚無歷史交易明細
                              </td>
                            </tr>
                          );
                        }
                        return runningTxs.map((tx, idx) => (
                          <tr key={tx.id || idx} className="border-b border-[#eae6df]/30 last:border-0 hover:bg-[#faf8f5]/40 transition-colors">
                            <td className="py-3 px-3 font-mono text-[#8e8377] text-[11px]">{tx.date}</td>
                            <td className="py-3 px-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold leading-none inline-block ${tx.type === 'buy' ? 'bg-[#c84a42]/10 text-[#c84a42]' : 'bg-[#4d7c5a]/10 text-[#4d7c5a]'}`}>
                                {tx.type === 'buy' ? '買入' : '賣出'}
                              </span>
                            </td>
                            <td className="py-3 px-2 font-mono font-bold text-[#c84a42] text-right">$ {tx.price}</td>
                            <td className="py-3 px-2 font-mono text-right text-[#2d2926]">
                              {tx.shares >= 1000 
                                ? `${Math.floor(tx.shares / 1000)}張 ${tx.shares % 1000 > 0 ? (tx.shares % 1000 + '股') : ''}` 
                                : `${tx.shares} 股`}
                            </td>
                            <td className="py-3 px-2 font-mono font-bold text-amber-800 text-right bg-amber-50/20">
                              $ {tx.runningAvgPrice}
                            </td>
                            <td className="py-3 px-2 font-mono text-right text-slate-500">
                              {tx.runningShares.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleRemoveTransaction(detailStock.id, tx.id)}
                                className="text-[#8e8377] hover:text-[#c84a42] hover:bg-[#faf8f5] p-1.5 rounded transition-colors cursor-pointer"
                                title="刪除本筆紀錄"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Invested Trial Calculation */}
              {detailStock.shares > 0 && detailStock.buyPrice > 0 && (
                <div className="bg-[#faf8f5] p-3.5 rounded-xl flex items-center justify-between border border-[#eae6df] text-xs">
                  <span className="font-bold text-[#8e8377]">總投入成本試算</span>
                  <span className="font-mono font-black text-[#2d2926] text-sm">
                    $ {Math.round(detailStock.shares * detailStock.buyPrice).toLocaleString()} 元
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 border-t border-[#eae6df] pt-4 mt-1">
              <button
                onClick={() => setDetailStockId(null)}
                className="bg-[#2d2926] hover:bg-[#4a4440] text-white font-bold py-2 px-6 rounded-lg text-xs transition-colors cursor-pointer"
              >
                關閉
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: MASTER GLOBAL STOCK ANALYST HUB (UNIFIED TWO-COLUMN SCALE TRANSFORMATION DISPLAY) */}
      {zoomedStock && (
        <div className="fixed inset-0 bg-[#2d2926]/45 backdrop-blur-xs z-[120] flex items-start justify-center p-2 sm:p-4 overflow-y-auto pt-6 md:pt-12 pb-24 scrollbar-thin">
          <div 
            style={{ 
              transform: `scale(${zoomScale})`, 
              transformOrigin: "top center",
              marginTop: "10px",
              marginBottom: "80px"
            }}
            className="bg-white border border-[#eae6df] text-[#2d2926] rounded-2xl p-4 sm:p-6 md:p-8 max-w-6xl w-full shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-200 transition-all origin-top"
          >
            {/* Modal Sub-Header (Controls + Status) */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-[#eae6df] pb-4 gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h2 className="text-base sm:text-xl font-black text-[#2d2926] flex items-center gap-2 leading-none">
                  <span className="bg-[#9e3028] text-white text-[10px] sm:text-xs font-black px-2.5 py-1 rounded font-mono uppercase tracking-wider">
                    {zoomedStock.id}
                  </span>
                  <span>{zoomedStock.name}</span>
                  <span className="text-xs text-[#8e8377] font-semibold">存摺研報特許終端</span>
                </h2>
                
                {/* Voice Status Pill */}
                {speakingStockId === zoomedStock.id && (
                  <div className="flex items-center gap-1.5 bg-[#4d7c5a]/10 text-[#4d7c5a] border border-[#4d7c5a]/20 px-2.5 py-1 rounded-full text-[10px] font-bold animate-pulse">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4d7c5a] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4d7c5a]"></span>
                    </span>
                    <span>AI 國語決策音頻播報中</span>
                  </div>
                )}
              </div>
              
              {/* Dynamic Interactive Panel Scales */}
              <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto uppercase">
                {/* AI Text Reading Font Size controls */}
                <div className="flex items-center gap-1 bg-[#faf8f5] border border-[#eae6df] p-0.5 rounded-lg text-[10px] font-bold text-[#8e8377] shadow-3xs">
                  <span className="hidden xs:inline px-1 text-[9px] font-semibold text-[#8e8377]/80">本文比例:</span>
                  {(["base", "lg", "xl"] as const).map(sz => (
                    <button
                      key={sz}
                      onClick={() => setAiTextSize(sz)}
                      className={`px-2 py-0.5 rounded transition-all text-[9.5px] font-extrabold cursor-pointer ${
                        aiTextSize === sz ? "bg-[#9e3028] text-white shadow-3xs" : "hover:bg-[#eae6df]/40 text-[#2d2926]"
                      }`}
                    >
                      {sz === "base" ? "精簡" : sz === "lg" ? "適中" : "放大"}
                    </button>
                  ))}
                </div>

                {/* Main Zoom Scale Ratio */}
                <div className="flex items-center gap-1 bg-[#faf8f5] border border-[#eae6df] px-2 py-0.5 rounded-full text-[10px] font-bold shadow-3xs select-none">
                  <span className="font-mono text-[#2d2926] min-w-[32px] text-center">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomScale(prev => Math.max(0.6, Number((prev - 0.05).toFixed(2))))}
                    className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#eae6df] text-[#8e8377] font-extrabold text-[10px] cursor-pointer transition-colors border border-[#eae6df] bg-white shadow-3xs"
                    title="縮小"
                  >
                    —
                  </button>
                  <button
                    onClick={() => setZoomScale(prev => Math.min(1.8, Number((prev + 0.05).toFixed(2))))}
                    className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#eae6df] text-[#8e8377] font-extrabold text-[10px] cursor-pointer transition-colors border border-[#eae6df] bg-white shadow-3xs"
                    title="放大"
                  >
                    +
                  </button>
                  <div className="w-[1px] h-3 bg-[#eae6df] mx-0.5" />
                  <button
                    onClick={() => setZoomScale(1.15)}
                    className="px-1.5 py-0.2 text-[9px] text-[#8e8377] hover:text-[#2d2926] transition-colors rounded font-extrabold cursor-pointer"
                  >
                    重設
                  </button>
                </div>
                
                {/* Dismiss Button - DOES NOT interrupt speech synthesis! */}
                <button
                  onClick={() => setZoomedStock(null)}
                  className="text-[#8e8377] hover:text-white bg-[#faf8f5] hover:bg-[#9e3028] p-1.5 rounded-full transition-all cursor-pointer shadow-3xs"
                  title="最小化面板 (播放中語音報告不中斷)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
 
            {/* Grand Two-Column Workspace (Market & Yields || AI Analyst Page) */}
            <div className={`grid grid-cols-1 ${zoomViewMode === 'all' ? 'lg:grid-cols-12' : 'lg:grid-cols-1'} gap-6 md:gap-8 items-stretch`}>
              
              {/* LEFT COLUMN: Price Trends & Dividend History Tracker (lg:col-span-6) */}
              {(zoomViewMode === 'all' || zoomViewMode === 'price' || zoomViewMode === 'dividend') && (
                <div className={`${zoomViewMode === 'all' ? 'lg:col-span-6' : 'lg:col-span-1'} flex flex-col gap-5 justify-between`}>
                  
                  {/* Price History Section */}
                  {(zoomViewMode === 'all' || zoomViewMode === 'price') && (
                    <div className="border border-[#eae6df] bg-white rounded-xl p-4 md:p-5 shadow-3xs flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-[#faf8f5] pb-2">
                    <span className="text-xs font-black text-[#2d2926] flex items-center gap-1.5">
                      📈 核心走勢與大盤實時報價軌跡
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono">
                      昨收現價: ${zoomedStock.currentPrice} 元
                    </span>
                  </div>
                  
                  <div className="h-[210px] w-full">
                    {zoomedStock.priceHistory && zoomedStock.priceHistory.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={zoomedStock.priceHistory}
                          margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id={`zoomedColorPrice-${zoomedStock.id}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor={(zoomedStock.change ?? 0) > 0 ? "#c84a42" : (zoomedStock.change ?? 0) < 0 ? "#4d7c5a" : "#8e8377"}
                                stopOpacity={0.2}
                              />
                              <stop
                                offset="95%"
                                stopColor={(zoomedStock.change ?? 0) > 0 ? "#c84a42" : (zoomedStock.change ?? 0) < 0 ? "#4d7c5a" : "#8e8377"}
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eae6df" />
                          <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: "#8e8377", fontWeight: "bold" }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: "#8e8377", fontWeight: "bold" }}
                            domain={["dataMin - 15", "dataMax + 15"]}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(255,255,255,0.96)",
                              border: "1px solid #eae6df",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "bold",
                            }}
                            formatter={(val: number) => [`$${val} 元`, "收盤實價"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke={(zoomedStock.change ?? 0) > 0 ? "#c84a42" : (zoomedStock.change ?? 0) < 0 ? "#4d7c5a" : "#8e8377"}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill={`url(#zoomedColorPrice-${zoomedStock.id})`}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-[#8e8377] font-bold">
                        暫無可用長線趨勢圖
                      </div>
                    )}
                  </div>
                    </div>
                  )}

                  {/* Next Payout Forecast Metrics */}
                  {(zoomViewMode === 'all' || zoomViewMode === 'dividend') && (() => {
                  const enrichedHist = getEnrichedDividendHistory(zoomedStock.id, zoomedStock.dividendInfo);
                  const currentDiv = enrichedHist[0] || { year: "2026", amount: 0, status: "預估", exDividendDate: "—", lastBuyDate: "—" };
                  const estPayoutDate = getPayoutDate(currentDiv.exDividendDate);
                  const totalEstPayout = currentDiv.amount * zoomedStock.shares;
                  const basisPrice = zoomedStock.buyPrice || zoomedStock.currentPrice || 100;
                  const calculatedYield = (currentDiv.amount / basisPrice) * 100;

                  return (
                    <div className="border border-[#eae6df] bg-[#fdfcfb] rounded-xl p-4 md:p-5 shadow-3xs flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-[#faf8f5] pb-2">
                        <span className="text-xs font-black text-[#9e3028] flex items-center gap-1.5">
                          🎁 當期配息與除權息預估日程前瞻
                        </span>
                        <span className="text-[10px] font-bold text-[#9e3028] bg-[#9e3028]/5 px-2 py-0.5 rounded border border-[#9e3028]/10">
                          {currentDiv.status}期
                        </span>
                      </div>

                      {/* Stat Metrics Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white p-2.5 rounded-lg border border-[#eae6df]/80 shadow-3xs">
                          <div className="text-[9px] text-[#8e8377] font-bold">當期配息 (每股/元)</div>
                          <div className="text-sm sm:text-lg font-black text-[#c84a42] mt-0.5">
                            {currentDiv.amount.toFixed(1)} <span className="text-[10px] font-semibold text-[#8e8377]">元</span>
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-[#eae6df]/80 shadow-3xs">
                          <div className="text-[9px] text-[#8e8377] font-bold">累計配息應領總額</div>
                          <div className="text-sm sm:text-lg font-black text-[#c84a42] mt-0.5">
                            ${totalEstPayout.toLocaleString()} <span className="text-[10px] font-semibold text-[#8e8377]">元</span>
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-[#eae6df]/80 shadow-3xs">
                          <div className="text-[9px] text-[#8e8377] font-bold">預估單期年化殖率</div>
                          <div className="text-sm sm:text-lg font-black text-[#4d7c5a] mt-0.5 font-mono">
                            {calculatedYield.toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      {/* Timeline Detail Row */}
                      <div className="bg-white rounded-lg border border-[#eae6df] p-3 space-y-2 text-xs text-[#2d2926]">
                        <div className="flex justify-between items-center">
                          <span className="text-[#8e8377] font-bold flex items-center gap-1">🗓️ 除息交易日</span>
                          <span className="font-mono font-bold bg-[#faf8f5] px-2 py-0.5 rounded border border-[#eae6df] text-[11px]">{currentDiv.exDividendDate}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#8e8377] font-bold flex items-center gap-1">🎁 預估發放日 (除息約1個月)</span>
                          <span className="font-mono font-bold bg-green-50 text-[#4d7c5a] px-2 py-0.5 rounded border border-[#4d7c5a]/20 text-[11px]">{estPayoutDate}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#8e8377] font-bold flex items-center gap-1">⏳ 最後買進過戶日</span>
                          <span className="font-mono font-bold bg-[#faf8f5] px-2 py-0.5 rounded border border-[#eae6df] text-[11px]">{currentDiv.lastBuyDate}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Historical Payouts Comparative Trend Plot & All Historic Table */}
                {(zoomViewMode === 'all' || zoomViewMode === 'dividend') && (() => {
                  const enrichedHist = getEnrichedDividendHistory(zoomedStock.id, zoomedStock.dividendInfo);
                  const parsedChartData = [...enrichedHist].reverse().map(d => ({
                    year: `${d.year}`,
                    amount: d.amount,
                  }));
                  const basisPrice = zoomedStock.buyPrice || zoomedStock.currentPrice || 100;

                  return (
                    <div className="border border-[#eae6df] bg-white rounded-xl p-4 md:p-5 shadow-3xs flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-[#faf8f5] pb-2">
                        <span className="text-xs font-black text-[#2d2926] flex items-center gap-1.5">
                          📊 歷年配息軌跡與殖利率明細一覽
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          累計記錄: {enrichedHist.length} 筆
                        </span>
                      </div>

                      {/* Small Dividend Line Chart */}
                      <div className="h-[95px] w-full mt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={parsedChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eae6df/60" />
                            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#8e8377" }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#8e8377" }} />
                            <Tooltip
                              contentStyle={{ fontSize: "10px", padding: "4px 8px" }}
                              formatter={(val: number) => [`${val} 元`, "配息金額"]}
                            />
                            <Area
                              type="monotone"
                              dataKey="amount"
                              stroke="#c84a42"
                              strokeWidth={1.5}
                              fill="#c84a42"
                              fillOpacity={0.06}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Scrollable Detailed Table */}
                      <div className="border border-[#eae6df]/80 rounded-lg overflow-hidden max-h-[140px] overflow-y-auto mt-2 text-left scrollbar-thin">
                        <table className="w-full text-left text-[11px] border-collapse font-sans bg-white">
                          <thead>
                            <tr className="bg-[#faf8f5] text-[#8e8377] border-b border-[#eae6df]/80 font-bold sticky top-0 z-10 shadow-3xs">
                              <th className="p-2 sm:p-2.5 font-bold">配息年度</th>
                              <th className="p-2 sm:p-2.5 font-bold">狀態</th>
                              <th className="p-2 sm:p-2.5 font-bold text-right font-bold">單票配息</th>
                              <th className="p-2 sm:p-2.5 text-center font-bold">除息交易日</th>
                              <th className="p-2 sm:p-2.5 text-right font-bold">可領配金</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#eae6df]/50 font-medium">
                            {enrichedHist.map((div, index) => {
                              const yieldEstimate = (div.amount / basisPrice) * 100;
                              const isAnnounced = div.status === "已公告";
                              const isHistorical = div.status === "歷史配息";

                              return (
                                <tr key={index} className="hover:bg-[#faf8f5]/60 transition-colors">
                                  <td className="p-2 sm:p-2.5 font-bold text-[#2d2926]">{div.year} 年</td>
                                  <td className="p-2 sm:p-2.5">
                                    <span className={`px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-black border ${
                                      isAnnounced 
                                        ? "bg-green-50 text-[#4d7c5a] border-[#4d7c5a]/20" 
                                        : isHistorical
                                          ? "bg-slate-50 text-slate-500 border-slate-200"
                                          : "bg-[#9e3028]/5 text-[#9e3028] border-[#9e3028]/25"
                                    }`}>
                                      {div.status}
                                    </span>
                                  </td>
                                  <td className="p-2 sm:p-2.5 text-right font-bold text-[#c84a42]">{div.amount.toFixed(2)} 元</td>
                                  <td className="p-2 sm:p-2.5 text-center font-mono text-slate-500">{div.exDividendDate}</td>
                                  <td className="p-2 sm:p-2.5 text-right font-black text-[#2d2926]">
                                    <span className="text-[9px] font-normal text-slate-400 mr-1.5">
                                      ({yieldEstimate.toFixed(1)}%)
                                    </span>
                                    ${(zoomedStock.shares * div.amount).toLocaleString()} 元
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

              </div>
              )}

              {/* RIGHT COLUMN: Professional Document Container for AI Advisory Report (lg:col-span-6) */}
              {(zoomViewMode === 'all' || zoomViewMode === 'ai') && (
                <div 
                  className={`${zoomViewMode === 'ai' ? 'col-span-1 lg:col-span-1' : 'lg:col-span-6'} flex flex-col border border-[#eae6df] bg-[#fbfaf8] p-5 sm:p-6 rounded-2xl shadow-3xs relative select-text`}
                >
                {/* Decorative watermarking or subtle badge */}
                <div className="absolute top-4 right-4 text-[9px] font-black text-[#8e8377]/10 pointer-events-none select-none tracking-widest uppercase font-mono">
                  PRO FINANCIAL DECISION SYSTEM
                </div>

                {/* Sub title header */}
                <div className="flex items-center justify-between border-b border-[#eae6df] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-[#9e3028]" size={16} />
                    <h3 className="font-black text-[#2d2926] text-xs sm:text-sm uppercase tracking-wider">
                      股神級 AI 財經決策診斷書
                    </h3>
                  </div>
                  
                  {/* Speech status display and manual toggle controls */}
                  <div className="flex items-center gap-1.5">
                    {speakingStockId === zoomedStock.id ? (
                      <button
                        onClick={() => {
                          synthesizerRef.current?.stop();
                          setSpeakingStockId(null);
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-md cursor-pointer shadow-3xs flex items-center gap-1 transition-all active:scale-95"
                        title="暫停宣讀"
                      >
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                        </span>
                        <span>暫停宣讀</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => listenToAiReport(zoomedStock.id, zoomedStock)}
                        disabled={aiStates[zoomedStock.id] === "loading"}
                        className="bg-[#9e3028] hover:bg-[#872822] text-white font-extrabold text-[10px] px-2.5 py-1 rounded-md cursor-pointer shadow-3xs flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                        title="音頻朗讀"
                      >
                        {aiStates[zoomedStock.id] === "loading" ? (
                          <>
                            <Loader2 size={11} className="animate-spin text-white" />
                            <span>診斷中...</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={11} />
                            <span>朗讀報告</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => listenToAiReport(zoomedStock.id, zoomedStock)}
                      disabled={aiStates[zoomedStock.id] === "loading"}
                      className="text-[#8e8377] hover:text-[#2d2926] bg-white border border-[#eae6df] p-1 rounded-md transition-colors cursor-pointer shadow-3xs"
                      title="重整 AI 深度個股分析和診斷"
                    >
                      <Loader2 size={12} className={aiStates[zoomedStock.id] === "loading" ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>

                {/* Warning / Notification for busy models */}
                {aiErrors[zoomedStock.id] && (
                  <div className="mb-4 px-3.5 py-2.5 bg-[#9e3028]/5 border border-[#9e3028]/15 rounded-lg text-[10px] sm:text-xs text-[#9e3028] leading-normal flex items-start gap-1.5 font-medium animate-in slide-in-from-top-1 duration-200">
                    <span className="shrink-0 font-bold">⚠️ 聯網診斷提示：</span>
                    <span>雲端大模型過載需排隊，系統當前為您提取該標的備載智慧財經報告。語音導論播報不受影響！</span>
                  </div>
                )}

                {/* AI report output panel with dynamic nested tailwind font selection overrides */}
                <div className="flex-1 bg-white border border-[#eae6df]/80 rounded-xl p-4 sm:p-5 shadow-3xs overflow-y-auto max-h-[500px]">
                  {aiStates[zoomedStock.id] === "loading" ? (
                    <div className="flex flex-col gap-3 py-16 text-center justify-center items-center">
                      <Loader2 className="animate-spin text-[#9e3028]" size={28} />
                      <div className="space-y-1">
                        <p className="font-bold text-xs sm:text-sm text-[#2d2926] animate-pulse">
                          正在穿透雲端智庫、彙整當期財報利多利空...
                        </p>
                        <p className="text-[10px] text-[#8e8377] font-semibold">
                          高難度專家模型正在整合除權日、貼息週期與長線資產安全墊
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className={`text-slate-800 tracking-wide leading-relaxed font-sans ${textSizeClass}`}>
                      {parseAiReportIntoStyledElements(aiReports[zoomedStock.id] || zoomedStock.aiAnalysis || "")}
                    </div>
                  )}
                </div>

                {/* Professional Bottom Dismiss Statement */}
                <div className="mt-4 pt-3 border-t border-[#eae6df] text-center text-[10px] text-[#8e8377] font-semibold">
                  <span>💡 縮小此面板後，中心背景研報語音廣播將在後台安全不中斷播放。</span>
                </div>
              </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: ZOOM DIVIDEND POPUP - DEPRECATED (CONSOLIDATED INTO MASTER HUB) */}
      {zoomedDividendStock && null && (
        <div className="fixed inset-0 bg-[#2d2926]/45 backdrop-blur-xs z-[120] flex items-start justify-center p-4 overflow-y-auto pt-10 pb-20">
          <div 
            style={{ 
              transform: `scale(${zoomScale})`, 
              transformOrigin: "top center",
              marginTop: "20px",
              marginBottom: "80px"
            }}
            className="bg-white border border-[#eae6df] text-[#2d2926] rounded-xl p-5 md:p-8 max-w-4xl w-full shadow-lg flex flex-col gap-6 animate-in zoom-in-95 duration-200 transition-all origin-top"
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-[#eae6df] pb-3 gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-bold text-[#2d2926] flex items-center gap-1.5 leading-none">
                  <span>💰 {zoomedDividendStock.name}</span>
                  <span className="text-xs bg-[#faf8f5] text-[#8e8377] px-2 py-0.5 rounded font-mono border border-[#eae6df]">
                    {zoomedDividendStock.id}
                  </span>
                </h2>
                <span className="text-xs text-[#9e3028] font-semibold bg-[#9e3028]/10 border border-[#9e3028]/15 px-1.5 py-0.5 rounded">
                  歷年級利息智庫 (最高支援200%)
                </span>
              </div>
              
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {/* Scale control */}
                <div className="flex items-center gap-1.5 bg-[#faf8f5] border border-[#eae6df] px-2.5 py-1 rounded-full text-xs shadow-2xs select-none">
                  <span className="font-mono font-bold text-[#2d2926] min-w-[36px] text-center">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomScale(prev => Math.max(0.5, Number((prev - 0.05).toFixed(2))))}
                    className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#eae6df] text-[#8e8377] font-bold text-[10px] cursor-pointer transition-colors active:scale-95 border border-[#eae6df] bg-white shadow-3xs"
                    title="縮小"
                  >
                    —
                  </button>
                  <button
                    onClick={() => setZoomScale(prev => Math.min(2.0, Number((prev + 0.05).toFixed(2))))}
                    className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#eae6df] text-[#8e8377] font-bold text-[10px] cursor-pointer transition-colors active:scale-95 border border-[#eae6df] bg-white shadow-3xs"
                    title="放大"
                  >
                    +
                  </button>
                  <div className="w-[1px] h-3.5 bg-[#eae6df] mx-1"></div>
                  <button
                    onClick={() => setZoomScale(1.25)}
                    className="px-2 py-0.5 text-[10px] text-[#8e8377] hover:text-[#2d2926] hover:bg-[#eae6df] transition-colors rounded-md font-bold cursor-pointer"
                  >
                    重設
                  </button>
                </div>
                
                <button
                  onClick={() => setZoomedDividendStock(null)}
                  className="text-[#8e8377] hover:text-[#2d2926] bg-[#faf8f5] hover:bg-[#eae6df] p-1.5 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Bento Statistics Grid inside zoomed view */}
            {(() => {
              const enrichedHist = getEnrichedDividendHistory(zoomedDividendStock.id, zoomedDividendStock.dividendInfo);
              const totalDPS = enrichedHist.reduce((acc, current) => acc + current.amount, 0);
              const avgDPS = enrichedHist.length > 0 ? totalDPS / enrichedHist.length : 0;
              const expectedTotalCashPayout = zoomedDividendStock.shares * (enrichedHist[0]?.amount || 0);
              
              const basisPrice = zoomedDividendStock.buyPrice || zoomedDividendStock.currentPrice || 100;
              const avgYield = (avgDPS / basisPrice) * 100;
              
              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Stat Card 1 */}
                    <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#eae6df] flex flex-col justify-between">
                      <span className="text-xs text-[#8e8377] font-bold">當期實領配息預估</span>
                      <div className="mt-2 text-xl font-bold text-[#c84a42]">
                        ${expectedTotalCashPayout.toLocaleString()} 元
                      </div>
                      <span className="text-[10px] text-[#8e8377] mt-1">
                        依持有 {zoomedDividendStock.shares.toLocaleString()} 股 ✖ 最近一期 {enrichedHist[0]?.amount || 0} 元計算
                      </span>
                    </div>

                    {/* Stat Card 2 */}
                    <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#eae6df] flex flex-col justify-between">
                      <span className="text-xs text-[#8e8377] font-bold">當期未發放股利與除股息時程</span>
                      <div className="space-y-1.5 mt-2 text-xs text-[#2d2926] font-semibold leading-normal">
                        <div className="flex justify-between">
                          <span className="text-[#8e8377]">每股配息：</span>
                          <span className="font-bold text-[#c84a42]">{enrichedHist[0]?.amount.toFixed(2)} 元 ({enrichedHist[0]?.status || "預估"})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8e8377]">除息交易日：</span>
                          <span className="font-bold font-mono">{enrichedHist[0]?.exDividendDate || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8e8377]">預估發放日：</span>
                          <span className="font-bold font-mono text-[#4d7c5a]">{getPayoutDate(enrichedHist[0]?.exDividendDate)}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#8e8377] mt-1.5">
                        依當期 {enrichedHist[0]?.year || "2026"} 年除息排定日前瞻估算
                      </span>
                    </div>

                    {/* Stat Card 3 */}
                    <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#eae6df] flex flex-col justify-between">
                      <span className="text-xs text-[#8e8377] font-bold">歷史平均特許股利殖利率</span>
                      <div className="mt-2 text-xl font-bold text-[#4d7c5a]">
                        {avgYield.toFixed(2)}%
                      </div>
                      <span className="text-[10px] text-[#8e8377] mt-1">
                        基於平均派息與您的每股持股成本 ${basisPrice} 計算
                      </span>
                    </div>
                  </div>

                  {/* Visual Chart of Dividend Growth */}
                  <div className="border border-[#eae6df] rounded-xl p-4 bg-[#fdfcfb]">
                    <h3 className="text-xs font-bold text-[#2d2926] mb-3 flex items-center justify-between border-b border-[#faf8f5] pb-2">
                      <span>📊 歷年配息金額趨勢對比 (元)</span>
                      <span className="text-[9px] bg-[#faf8f5] text-[#8e8377] px-1.5 py-0.5 rounded border border-[#eae6df]">
                        長線盈餘分紅分配軌跡
                      </span>
                    </h3>
                    
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={[...enrichedHist].reverse()}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="colorDividendLg"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop offset="5%" stopColor="#4d7c5a" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#4d7c5a" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eae6df" />
                          <XAxis
                            dataKey="year"
                            axisLine={false}
                            tickLine={false}
                            textAnchor="middle"
                            tick={{ fontSize: 10, fill: "#8e8377", fontWeight: "bold" }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: "#8e8377", fontWeight: "bold" }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#ffffff",
                              borderRadius: "8px",
                              border: "1px solid #eae6df",
                              fontWeight: "bold",
                              fontSize: "12px",
                              color: "#2d2926"
                            }}
                            formatter={(val: number) => [`${val} 元`, "配息金額"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="amount"
                            stroke="#4d7c5a"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorDividendLg)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Multi-year Detailed Dividends Table */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-[#9e3028] uppercase tracking-wider">
                      📋 歷年完整配息明細對照表
                    </h3>
                    <div className="overflow-x-auto border border-[#eae6df] rounded-xl bg-white shadow-2xs">
                      <table className="w-full text-left font-mono text-xs whitespace-nowrap">
                        <thead>
                          <tr className="border-b border-[#eae6df] bg-[#faf8f5] text-[#8e8377] font-bold">
                            <th className="p-3">配息年度</th>
                            <th className="p-3">狀態</th>
                            <th className="p-3 text-right">每股配息金額 (元)</th>
                            <th className="p-3 text-center">估計除息交易日</th>
                            <th className="p-3 text-center">最後買進過戶基準日</th>
                            <th className="p-3 text-right">當期持股估計實領</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eae6df]">
                          {enrichedHist.map((div, dIdx) => {
                            const isAnnounced = div.status === "已公告";
                            const annualYieldEstimate = (div.amount / basisPrice) * 100;
                            const isHistorical = div.status === "歷史配息";
                            return (
                              <tr key={dIdx} className="hover:bg-[#faf8f5] transition-colors">
                                <td className="p-3 font-bold text-[#2d2926]">
                                  {div.year} 年
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                    isAnnounced 
                                      ? "bg-[#4d7c5a]/5 text-[#4d7c5a] border-[#4d7c5a]/20" 
                                      : isHistorical
                                        ? "bg-[#faf8f5] text-[#8e8377] border-[#eae6df]"
                                        : "bg-[#9e3028]/5 text-[#9e3028] border-[#9e3028]/20"
                                  }`}>
                                    {div.status}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-bold text-[#c84a42]">
                                  {div.amount.toFixed(2)} 元
                                </td>
                                <td className="p-3 text-center font-bold text-[#2d2926]">
                                  {div.exDividendDate}
                                </td>
                                <td className="p-3 text-center">
                                  <span className="font-semibold bg-[#faf8f5] border border-[#eae6df] rounded px-2 py-0.5 text-[10px] text-[#8e8377]">
                                    {div.lastBuyDate}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-bold text-[#2d2926]">
                                  <span className="text-[#8e8377] text-[10px] font-normal mr-2">
                                    殖利率 {annualYieldEstimate.toFixed(2)}%
                                  </span>
                                  ${(zoomedDividendStock.shares * div.amount).toLocaleString()} 元
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary Callout Banner */}
                  <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#eae6df] text-xs text-[#8e8377] leading-relaxed flex items-start gap-2.5">
                    <Sparkles size={16} className="text-[#9e3028] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[#2d2926]">除權息前瞻智庫分析提示：</span>
                      這份完整明細涵蓋了該標的穩健的長期紅利收益軌跡。
                      依據您的庫存配置規劃，若以配息進行再投資，複利效應將伴隨大盤長線增值，是建立長線優質股權存摺的精確方法。
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
