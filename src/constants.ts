import { Stock } from "./types";

export const DEFAULT_STOCKS: Stock[] = [
  {
    id: "2330",
    name: "台積電",
    shares: 1000,
    buyPrice: 650,
    currentPrice: 2265,
    change: -40,
    changePercent: -1.74,
    priceHistory: [
      { month: "7月", price: 1800 },
      { month: "8月", price: 1850 },
      { month: "9月", price: 1900 },
      { month: "10月", price: 1950 },
      { month: "11月", price: 2000 },
      { month: "12月", price: 2050 },
      { month: "1月", price: 2100 },
      { month: "2月", price: 2150 },
      { month: "3月", price: 2200 },
      { month: "4月", price: 2230 },
      { month: "5月", price: 2250 },
      { month: "6月", price: 2265 }
    ],
    dividendInfo: [
      { year: "2026", amount: 4.5, status: "已公告", exDividendDate: "2026/06/15", lastBuyDate: "2026/06/13" },
      { year: "2025", amount: 13, status: "預估", exDividendDate: "2025/12/15", lastBuyDate: "2025/12/13" }
    ],
    aiAnalysis: `【近期基本面與籌碼面】
近期受惠於 AI 伺服器與高速運算（HPC）需求極其強勁，先進製程產能接近滿載。法人籌碼方面，外資呈現階段性連續買超，帶動毛利率與營業利益率維持高檔區間。

【除權息操作策略】
公司已正式公告本季度配息 4.5 元，最後過戶買進日為 6 月 13 日。就基本面強勢格局而言，填息動能健康，長線投資填息機率極高。

【宏觀風險與決策注意】
需高度警惕地緣政治衝突演變、美中科技制裁範圍擴大以及全球半導體產線去中心化建置成本（如日美歐設廠）拉高對長期利潤率的侵蝕。另外，美Fed高利率維持時程與美元匯率強弱，亦是牵動外資資金調節高估值權值股的關鍵因子。`
  },
  {
    id: "0050",
    name: "元大台灣50",
    shares: 5000,
    buyPrice: 120,
    currentPrice: 100.5,
    change: -2.9,
    changePercent: -2.85,
    priceHistory: [
      { month: "7月", price: 110 },
      { month: "8月", price: 108 },
      { month: "9月", price: 112 },
      { month: "10月", price: 109 },
      { month: "11月", price: 105 },
      { month: "12月", price: 103 },
      { month: "1月", price: 102 },
      { month: "2月", price: 100 },
      { month: "3月", price: 98 },
      { month: "4月", price: 99 },
      { month: "5月", price: 101 },
      { month: "6月", price: 100.5 }
    ],
    dividendInfo: [
      { year: "2026", amount: 3.5, status: "已公告", exDividendDate: "2026/07/20", lastBuyDate: "2026/07/18" },
      { year: "2025", amount: 2.8, status: "預估", exDividendDate: "2025/01/20", lastBuyDate: "2025/01/18" }
    ],
    aiAnalysis: `【近期基本面與籌碼面】
隨著台股加權指數處於高位，大市值權值股受到國內外長線資金持續追捧，帶動 ETF 規模與流動性擴張。權重分布集中於主流科技能見度高的頂尖企業。

【除權息操作策略】
已公告本次現金股息 3.5 元，最後交易買進基準日為 7 月 18 日。得益於自動淘汰弱勢、納入新興權值股的機制，具有極佳的防守與跟漲能力。

【宏觀風險與決策注意】
高比例持股集中於單一晶圓代工巨頭，承受特定產業單一事件的集中風險；此外，全球通膨黏性與海外主權基金持股比重的快速變化，常使得大盤型商品面完備系統性修正。在進行資產分配時，須注意全球製造業PMI走勢與出口貨運景氣，適當調整防禦部位。`
  },
  {
    id: "2881",
    name: "富邦金",
    shares: 10000,
    buyPrice: 60,
    currentPrice: 123.5,
    change: -1.5,
    changePercent: -1.2,
    priceHistory: [
      { month: "7月", price: 82 },
      { month: "8月", price: 80 },
      { month: "9月", price: 85 },
      { month: "10月", price: 90 },
      { month: "11月", price: 95 },
      { month: "12月", price: 100 },
      { month: "1月", price: 105 },
      { month: "2月", price: 110 },
      { month: "3月", price: 115 },
      { month: "4月", price: 120 },
      { month: "5月", price: 122 },
      { month: "6月", price: 123.5 }
    ],
    dividendInfo: [
      { year: "2026", amount: 2.5, status: "預估", exDividendDate: "2026/08/10", lastBuyDate: "2026/08/08" },
      { year: "2025", amount: 2, status: "已公告", exDividendDate: "2025/08/10", lastBuyDate: "2025/08/08" }
    ],
    aiAnalysis: `【近期基本面與籌碼面】
受惠於人壽子公司投資利得強勁增長、證券與銀行海外放款利差擴大，整體金控獲利動能爆發。且避險成本在台幣適度波動下控制得宜，法人買盤平穩。

【除權息操作策略】
市場預估今年將配發放 2.5 元現金，並輔以部分股票股利分配。以目前評價面來看，資產負債表重估價值提升，穩健型存股策略能見度極高。

【宏觀風險與決策注意】
必須持續監控美聯儲貨幣政策的利率頂點動向、因為這將直接影響海外債券部位未實現損益（淨值波動）及人壽避險利差。另外，若全球股債市大幅拉回可能重創金控淨值與投資收益.操作上需配合債市收益率變化分批承接。`
  },
  {
    id: "2454",
    name: "聯發科",
    shares: 2000,
    buyPrice: 950,
    currentPrice: 4190,
    change: -285,
    changePercent: -6.37,
    priceHistory: [
      { month: "7月", price: 3200 },
      { month: "8月", price: 3300 },
      { month: "9月", price: 3400 },
      { month: "10月", price: 3500 },
      { month: "11月", price: 3600 },
      { month: "12月", price: 3700 },
      { month: "1月", price: 3800 },
      { month: "2月", price: 3900 },
      { month: "3月", price: 4000 },
      { month: "4月", price: 4100 },
      { month: "5月", price: 4150 },
      { month: "6月", price: 4190 }
    ],
    dividendInfo: [
      { year: "2026", amount: 45, status: "預估", exDividendDate: "2026/07/04", lastBuyDate: "2026/07/02" },
      { year: "2025", amount: 55, status: "已公告", exDividendDate: "2025/07/04", lastBuyDate: "2025/07/02" }
    ],
    aiAnalysis: `【近期基本面與籌碼面】
新世代旗艦晶片（天璣系列）在亞太及歐洲市佔率攀升，外加邊緣智慧（Edge AI）運算晶片及 ASIC 進程加速，營收呈現優異的高成長。融資陸續退場，籌碼向法人集中。

【除權息操作策略】
預估今年度配發現金股息達 45 元，優異的盈餘分配率使高殖利率優勢常固，且憑藉在 IC 設計產業的高競爭護城河，長線具有優質本底防禦空間。

【宏觀風險與決策注意】
需高度關注美中科技政策對成熟與先進製程產品出口政策的邊界收緊、全球消費性電子（智慧手機）換機週期的回溫力道是否符合預期。此外，高階代工投片成本（CoWoS等先進封裝、台積電晶圓漲價）調升對毛利率的壓抑，也是主要必須釐清的重要監控指標。`
  },
  {
    id: "2317",
    name: "鴻海",
    shares: 6000,
    buyPrice: 105,
    currentPrice: 265,
    change: -12.5,
    changePercent: -4.5,
    priceHistory: [
      { month: "7月", price: 180 },
      { month: "8月", price: 190 },
      { month: "9月", price: 200 },
      { month: "10月", price: 210 },
      { month: "11月", price: 220 },
      { month: "12月", price: 230 },
      { month: "1月", price: 240 },
      { month: "2月", price: 245 },
      { month: "3月", price: 250 },
      { month: "4月", price: 255 },
      { month: "5月", price: 260 },
      { month: "6月", price: 265 }
    ],
    dividendInfo: [
      { year: "2026", amount: 5.5, status: "已公告", exDividendDate: "2026/08/25", lastBuyDate: "2026/08/23" },
      { year: "2025", amount: 5.4, status: "預估", exDividendDate: "2025/08/25", lastBuyDate: "2025/08/23" }
    ],
    aiAnalysis: `【近期基本面與籌碼面】
高度受益於全球大型雲端業者（CSP）AI 伺服器機櫃（如 GB200 等系統級出貨）強勁建置潮，垂直整合能力顯現。外資機構紛紛調升本益比區間，大戶持股結構穩固。

【除權息操作策略】
已公告配發 5.5 元現金股利，並連年調增配息比例，以目前本益比及淨值比結構審視，估值尚處於合理發展區間，配息行情值得參與。

【宏觀風險與決策注意】
作為跨國供應鏈巨人，地緣衝突推動「中國+1」轉移（如擴大投資印度、北美、越南）帶來的資本開支增加與跨國人才管理難度是核心風險；其次，全球航運供應鏈或中東地緣不穩拉高物流運價，將直接干擾高單價機櫃出貨效率，需密切留意每季毛利率是否受到出貨與運價侵蝕。`
  }
];
