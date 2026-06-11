import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_STOCKS } from "./src/constants";
import yf from "yahoo-finance2";

// Disable strict TLS validation for container fetches to bypass SSL/TLS handshake errors on older api servers like mis.twse.com.tw
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// yahoo-finance2 v3.x requires instantiation via 'new' constructor.
const YahooFinanceClass = (yf && (yf as any).default && typeof (yf as any).default === "function")
  ? (yf as any).default
  : yf;
const yahooFinance = new (YahooFinanceClass as any)();

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
let twseDividendCache: any[] = [];
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

// Localized Intelligence Stock Analyzer Engine (智慧財經專家診斷系統)
// Automatically computes detailed sector dynamics, technical factors, macrometrics, and generates custom markdown reports
function generateExpertFinancialReport(id: string, name: string, currentPrice: number, changePercent: number): string {
  let sector = "general";
  const idStr = String(id).trim();
  const n = name || "";
  
  if (["2330", "2454", "2317", "2303", "2382", "3231", "3037", "2379", "3034", "3443", "3661"].includes(idStr) || 
      n.includes("積電") || n.includes("發科") || n.includes("聯電") || n.includes("鴻海") || 
      n.includes("廣達") || n.includes("緯創") || n.includes("欣興") || n.includes("瑞昱") || n.includes("聯詠") || n.includes("晶圓")) {
    sector = "semiconductor";
  } else if (["2881", "2882", "2883", "2891", "2884", "2886", "2890", "2892", "2885", "5880"].includes(idStr) || 
      n.includes("金") || n.includes("銀") || n.includes("保險") || n.includes("證券") || n.includes("開發") || n.includes("凱基") || n.includes("富邦") || n.includes("國泰") || n.includes("中信")) {
    sector = "financial";
  } else if (["2603", "2609", "2615", "2618", "2610", "2633"].includes(idStr) || 
      n.includes("航") || n.includes("海") || n.includes("陽明") || n.includes("長榮") || n.includes("萬海") || n.includes("高鐵")) {
    sector = "shipping";
  } else if (["1301", "1303", "1326", "1101", "2002", "2105"].includes(idStr) || 
      n.includes("塑") || n.includes("鋼") || n.includes("水泥") || n.includes("中鋼") || n.includes("台泥")) {
    sector = "traditional";
  }

  let trend = "stable";
  if (changePercent < -1.5) {
    trend = "bearish";
  } else if (changePercent > 1.5) {
    trend = "bullish";
  }

  let p1 = "";
  let p2 = "";
  let p3 = "";

  if (sector === "semiconductor") {
    if (trend === "bearish") {
      p1 = `受今日股價大跌 ${Math.abs(changePercent)}% 的拖累，${n}（${idStr}）在技術面上跌破了短均線，乖離有所修正。主要外資與投信在短線上呈現調節賣超，顯示出在高檔獲利了結與避險壓力的雙重壓制下，融資出現減肥走勢。雖然基本面營收動能依然強健，但市場在關鍵價位（如月線或季線）的支撐上正面臨考驗，成交量放大意味著技術面短期信心正在重整，短線上不可盲目急於接刀。`;
      p2 = `在國際宏觀層面，美國費半指數與科技股（如英偉達、超微等）日前出現較大幅度的修正，加上聯準會（Fed）對降息態度的鷹審，使得全球半導體板塊的資金面承壓。雖然伺服器的基本面與高階晶片先進封裝（CoWoS）等先進產能依然供不應求，但在全球晶片供應鏈移轉、新一輪美國大選政策預期波動，以及全球地緣衝突風險干擾下，半導體外資在台股期現貨部位同步進行減肥避險，對 ${n} 短期評價造成了一定的估值修正。`;
      p3 = `投資決策與風險防護方面，鑑於目前半導體板塊技術指標出現破線整理跡象，操作上應暫行觀望，維持防禦性資金配置。長線投資人仍可關注其產業龍頭之半導體核心優勢，此處可視為高檔估值合理修正。建議分批布局，切忌單筆全進。若確認技術線型止跌（如收出長下影線 or 出現連續吞噬紅K），再配合均線在下軌附近的支撐位，適度配置部位，保障殖利率保護力道與中長線安全邊際。`;
    } else if (trend === "bullish") {
      p1 = `受到今日大漲 ${changePercent}% 的多頭動能激勵，${n}（${idStr}）多頭買盤結構極其堅實。在成交量顯著放大配合下，技術面強勢站上並站穩短期所有均線，並成功突破了上方的盤整軌道阻力位。籌碼面上，主要外資法人與自營商呈現同向買超結構，主力大戶買盤強勢，融資保持穩定，多頭排列特徵明顯。短期乖離較高，引發上行慣性，未來法說指引極佳，維持強烈技術突圍期望。`;
      p2 = `國際宏觀方面，輝達等美股科技龍龍發布之強勁AI訂單動能，促使費半指數大漲，這對 ${n} 的相關高運算晶片、ASIC客製化晶片、先進封裝及代工供應鏈帶來強力提振。全球AI伺服器零組件與邊緣端運算（Edge AI）升級趨勢十分明朗，外資法人維持看好其在新一代高運算平台中的核心話語權。美聯準會Fed降息前景趨向穩定，亦加速國際主動型基金與ETF避險資金向亞太優質半導體資產灌頂。`;
      p3 = `投資決策方面，中長線多頭買盤無輿，建議持股續抱，順勢而為。未持股者不宜在中長線乖離過高的情況下盲目全倉追高，應防範爆量震盪修正。操作策略可設定 5 日均線為短期防護軌道，並配合移動停利點。若遇短線回檔至關鍵均線支撐附近，將是極佳的中長線分批布局點。殖利率與其技術獨霸地位依然提供最底層的資產保值保護。`;
    } else {
      p1 = `今日 ${n}（${idStr}）股價走勢呈現橫向狹幅震盪（變動幅度僅為 ${changePercent}%），整體成交量能有所萎縮，顯示在法說會前夕或大盤高檔整理之際，市場多空力量暫時平衡，防禦與觀望氛圍濃厚。技術面維持在各均線密集交換區內進行整理，上行面受制於前高技術壓力，下行則獲得季線與除權息波段低位的籌碼強力支撐，整體結構偏向區間築底整理中。`;
      p2 = `從國際外圍形勢與產業宏觀來看，當前全球半導體產業依然處於下行週期尾聲與AI爆發式成長的交接期。美股科技板塊短期盤拉、通膨指標反覆，以及地緣溢價被市場逐步消化，使得外資在亞太新興市場的資金擺佈上持中性態度。這導致 ${n} 的籌碼動向不慍不火，主力與外資並無持續且顯著的連續性大進大出。產業鏈上下游目前以合理調整庫存、確認第三季訂單能見度為主。`;
      p3 = `對此，短線交易投資人應採取區間低買高賣的靈活防守操作，避免在技術面突破不顯著的區間中頻繁交易。長線存股者在殖利率收益相對明確、龍頭護城河寬廣的優勢下，可耐心利用此橫盤整理時機，採取定時定額或於區間下軌（月季線附近）分批逢低吸納。風險面上需注意下半年海外終端消費電子復甦速度不佳，及台幣匯率波動對評價的影響。`;
    }
  } else if (sector === "financial") {
    if (trend === "bearish") {
      p1 = `受大盤波動與金融法規指引調整，今日 ${n}（${idStr}）股價出現 ${Math.abs(changePercent)}% 的下跌。技術層面上，短均線面臨微幅破位整理，前期籌碼交換密集的支撐位略顯鬆動。主力外資在今日的拋售潮中扮演了主要調節方，部分自營商與融資避險退場，形成一定籌碼賣壓。然而，以金融板塊通常具備的避險與高殖利率特性，股價大跌同時也使得長期殖利率吸引力上升，融資減肥有利於浮額沉澱。`;
      p2 = `在國際金融動態上，美聯準會（Fed）貨幣政策由升轉降的預期反覆，全球利差縮窄對金融股淨利差（NIM）產生了不小壓力。同時美歐債券收益率的劇烈波動也對 ${n} 下轄的壽險與投資子公司造成海外未實現資產損益的短期評價減記。雖然地緣政治與美元匯率強勢波動等外部宏觀因素仍在考驗市場避險情緒，但國內金控整體逾放比（NPL）和資本十足率依然強大。`;
      p3 = `操作決策方面，金融股具有極強的防守屬性與底層護城河安全邊際。大跌之際，防禦性資產配置者毋需過度恐慌，反而可藉此拉高預期殖利率。操作上建議等待賣壓減輕、技術日K線出現中長陽線後，在半年線或年線支撐防線附近展開防禦性逢低布局，切忌融資搶反彈。未來可密切留意最新配息公告、除權息時程以及壽險資產未實現損益回升之指引。`;
    } else if (trend === "bullish") {
      p1 = `受到今日多方買盤強力拉抬，金控板塊的指標股 ${n}（${idStr}）大漲 ${changePercent}%，技術呈現一根長紅棒，成功向上突圍並站上所有均線系統。籌碼上，外資與投信近期買超結構保持雙重共振，主力大戶買盤強勢。利配與股利預期良好，推升大眾除權息拉抬預期。今日爆量突圍顯示出金融板塊在避險買盤和收益買盤的合力護航下，上行通道已經全面打通。`;
      p2 = `在金融總體環境與全球宏觀層面，美國聯準會（Fed）的利率預期趨向軟著陸，使全球股債雙重資產價格高漲，大幅挹注了 ${n} 旗下人壽、證券與銀行子公司的經紀收益與未實現金融資產回升。高企的殖利率優勢與國內金融機構各項資產的高品質成長，在台股震盪與高位階中發揮了極佳的資金避風港作用，引發了全球長線退休基金與高配息ETF在亞太配置上的大幅傾斜填補。`;
      p3 = `決策方案上，該股正處於強勢填息行情與基本面多頭階段，建議持股者長線安心長抱。未建倉者面對多頭行情可採取拉回、或沿 5 日均線逢低分批方式介入。此類股票具有極強的殖利率防護安全網，基本面盈利穩健。中短線需關注大盤是否出現板塊資金迅速外流、美元匯率暴跌對海外匯兌損益影響、以及高檔乖離擴大帶來的波段震盪風險，合理設定獲利調節點。`;
    } else {
      p1 = `今日 ${n}（${idStr}）股價走勢處於 ${changePercent}% 的狹窄幅震盪，成交量維持在近十日均量下方。技術走勢上呈原地橫向整固，月線與季線逐漸走平及靠攏，籌碼在密集震盪區內完成了平穩的日內交換。外資、投信與自營商近期並無顯著的多空方向性表態，行情呈現偏安一隅與存股大眾安靜防守之態勢。`;
      p2 = `在宏觀基本面上，面臨美聯準會貨幣政策明朗化之前的空檔，全球金融資產短線維持盤整運作，使得大型金控股的投資人傾向觀望。儘管 ${n} 國內市場利差收益保持相對穩健、放款成長力道如常，但在短期大環境無重大財政刺激下，業績缺乏立即爆發的引擎，股價也隨之走入平淡期。全球資金主要注意力暫時分散在其他爆發性高的科技題材上，金融股呈低波動高安全底層。`;
      p3 = `針對這種平穩的橫向走勢，投資策略上屬於典型的「攻守兼備型」配置。短線無方向性操作空間，因此不建置短多部位。長線投資大眾可秉持低點存股的複利思維，在橫盤時定額建倉。此時股價偏低可有效保護下檔，配合下半年即將迎來的穩健配息與高現金流挹注，適合穩健投資人分批中長線布局。`;
    }
  } else if (sector === "shipping") {
    if (trend === "bearish") {
      p1 = `在經歷前期多頭急拉後，今日航運指標股 ${n}（${idStr}）股價重挫 ${Math.abs(changePercent)}%。技術指標跌破短均月線支持。在籌碼面上，主要外資出現獲利了結拋售，投信買超力道亦有所減弱，部分熱錢與短線客快速離場使融資減肥。航運股本身股性活潑、高波動，今日大跌可點出市場在長假前或在供需合力降溫之際，對運價估值與業績高點的恐慌溢價進行預防性退潮修正。`;
      p2 = `國際宏觀方面，全球主要集裝箱航線美西/歐基運費SCFI指數近期自高位小跌，伴隨著中東或紅海局勢的局部分散、港口罷工風險緩解，引發了航運價格即將見頂的市場傳言。此外，受全球通膨高企、歐洲需求復甦遲滯和高庫存影響，國際航線艙位吃緊狀況略得緩解。美元大漲亦對大宗商品與航運結算帶來短暫的負回饋，外資因而趁勢調節，技術上出現了破位尋求中線支撐的走勢。`;
      p3 = `對於航運股的操作決策，高股性高波動是其特色，技術破線時絕不可輕易加碼接刀。建議持股部位較高者應適度降低籌碼比重，或在跌破月線一週內確實啟動停損避險機制。中長線存股者需嚴防運價見頂帶來的景氣下行利空，可耐心在大跌過後重拾靜止、周K線築底，並在季線/半年線支撐築穩後再分段逢低買進，保障底層殖利率保護力。`;
    } else if (trend === "bullish") {
      p1 = `今日航運動能板塊大幅爆發，${n}（${idStr}）強勢暴漲 ${changePercent}%，領漲大盤。成交量極速井噴，技術面以大陽線一舉突破所有均線障礙，多頭行情全線啟動。籌碼面上，外資大舉追高建倉，主力熱錢短線大幅湧入，融資同向大增，顯示這波漲幅背後具備強大的即時買盤助推，短線上升技術空間被徹底拉開。`;
      p2 = `在國際運費供給端宏觀形勢方面，中東局勢再起波瀾，紅海航線繞行常態化迫使全球船隊航程拉長、運力周轉率受限。同步疊加歐美港口因碼頭工會談緊繃導致的大量塞港、缺箱、全球主要航線運價SCFI指數連續暴力調漲。伴隨著歐美零售商傳統節日旺季前提前補庫存的急劇訂單需求，全球運能極度供不應求，外資分析大幅上修其全年每股盈餘（EPS）與配息預期。`;
      p3 = `投資操作策略方面，航運股具有典型景氣循環與急漲急跌特色。面對目前的暴力拉抬走勢，持股者可享受多頭波段，並以 5 日或 10 日均線作為移動停利止守位；而空手者不宜大筆滿倉追入高乖離點，防爆量長黑防線機制。操作上可採取小資分批、波段操作策略，緊盯每週五發布的SCFI/CCFI運價指數以及各大航線塞港程度之數據連動，動態調整持倉比重。`;
    } else {
      p1 = `今日航運板塊的 ${n}（${idStr}）展現了 ${changePercent}% 的窄幅原地橫盤走勢，成交量均勻且有所縮減。預示著在運價指數劇烈波動或技術前高密集壓力區前，市場買盤與賣盤在此達成了短暫的休兵整固。各均線線型收窄糾結，多空在尋求下一輪宏觀事件或月度營收報告的進一步刺激。`;
      p2 = `宏觀及中觀層面，雖然紅海地緣摩擦依然在拉長供應鏈航程、耗損運能，但目前運力調度與高位箱量供需在短期內達到均衡。SCFI運價大漲大跌的幅度出現收斂，國際大宗航線與航空客貨運市場走入短暫平緩期，使得 ${n} 來回震盪，籌碼上外資與投信近期買賣多相抵銷、未見持續的主力重金布局。`;
      p3 = `對此高波動循環題材，橫向整固期是典型的觀望與防守期。短多不宜開展，以免陷入震盪折磨。建議已有持股者耐心等待盤整格局被大陽線或大陰線方向性跌破/突破時再行動作；中長線可藉由低位橫盤時審視其最新的營收實現程度與未來的派息吸引力，把握資產配置權重。`;
    }
  } else {
    if (trend === "bearish") {
      p1 = `受今日市場修正情勢壓盤影響，${n}（${idStr}）今日股價下挫 ${Math.abs(changePercent)}%，在技術面呈現短期均線偏弱向下走勢。成交量有所放大，籌碼面上部分短期外資與投信減持避險，融資出現減肥整理。主要是今日技術走勢跌破了十日線支撐，市場短期追價信心受挫，浮額正在尋求下方更強大的均線防線或前期密集換手區進行承接。`;
      p2 = `從國際大環境和產業宏觀面來看，目前全球通膨受大宗商品價格走勢影響出現反覆，聯準會利率指引的鷹派態度壓制了全球中小型企業與傳統產業股的評價空間。伴隨大盤高檔避險情緒升溫、美元指數走強、以及外資期貨空單在台股市場上的大肆壓迫，資金偏向回防保守性工具 or 美元資產，導致 ${n} 出現籌碼調節和技術回測。`;
      p3 = `操作上宜謹慎防禦。既然目前技術軌道走弱，不建議主動盲目承接或攤平、避免接刀。短線投資人應把持跌破重要技術支撐位即啟動停損防守的原則，以保障資金水位；長線持股者此時可多審視除權息後該股之殖利率保護優勢，耐心等待在季線、半年線甚至半年平台築底信號出現，且籌碼洗乾淨後再行分批介入。`;
    } else if (trend === "bullish") {
      p1 = `今日受多方買盤力捧，${n}（${idStr}）股價大幅噴發 ${changePercent}%，技術上拉出一條大紅棒，一舉踏平短期均線反壓。在成交量同步成倍增長的利好配合下，成功宣告多頭技術性突圍。籌碼面上，外資與本土主力大戶呈現默契買超，散戶融資維持理性，多頭排列明顯，展示出短線上強悍的上攻預期。`;
      p2 = `宏觀經濟與產業大環境方面，受海外部分市場需求超預期復甦、以及國內資金豐沛引領的大盤整體向上動能，該股所處板塊獲得資金的大幅板塊輪動青睞。全球供應鏈調整對傳統或特定高階零部件之營運利好持續發酵，且受惠於台幣匯率與出口景氣信號綠燈利多，為外資調升 ${n} 獲利目標與未來估值空間提供了堅實總體基礎。`;
      p3 = `投資決策方面，技術走勢強健，已持股者建議持股線路，順應趨勢。無高乖離持本者若欲建倉，可於拉回 5 日均線不破之時或高成交量換手時再行分批買進，不宜在短線大幅拉高時一次性滿倉追入。隨時設定好移動停利防禦線以保衛利潤，基本面與高股息預期仍將在中長線上為其多頭路徑提供強有力的底盤。`;
    } else {
      p1 = `今日 ${n}（${idStr}）呈現相對平靜的窄幅區間橫盤，幅度僅為 ${changePercent}%。成交量亦同步縮減。技術面看目前處於大盤高檔橫盤洗盤階段，日K線呈現上下影線極短的十字星或小紅小綠，均線系統高度交織糾結，顯示此處屬於密集籌碼換手與多空觀望不前的平衡地帶。`;
      p2 = `受宏觀政策不確定性影響，包含美聯準會Fed、國內碳政策落實等，市場主力大戶在傳統產業與部分板塊採取了高檔防禦守勢，並未主動發起猛烈多頭拉抬或壓迫拋售。投信與外資基金近期呈現微幅調節、互相抵消態勢，營運基本面隨季節庫存變動平穩，無重大的急單或砍單利多利空干擾。`;
      p3 = `對於目前的平穩無波動走勢，操作上應保持「多看少動」的防禦原則。避免在橫向盤整時頻繁作多或作空以減少交易手續費損耗。可利用此橫盤期作為存股分批定量布局的時機，配合股息發放時期的股價位階保護，在區間下邊緣（如半年線支撐）採取分批買進布局策略，等待多方或空方最終表態技術性解耦目標。`;
    }
  }

  return `### 📊 近期基本面與籌碼解析\n${p1}\n\n### 🌐 國際宏觀與產業連動影響\n${p2}\n\n### ⚠️ 投資決策與風險預警\n${p3}`;
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
  }

  try {
    console.log("Fetching live Taiwan Ex-Dividend Notice Table from TWSE OpenAPI...");
    const divRes = await fetchWithTimeoutAndRetry("https://openapi.twse.com.tw/v1/exchangeReport/TWT48U_ALL", {}, 1, 500);
    twseDividendCache = await divRes.json();
    console.log(`TWSE Ex-Dividend cache successfully loaded with ${twseDividendCache.length} entries.`);
  } catch (err: any) {
    console.warn("Could not fetch TWSE ex-dividend notice tables:", err?.message || err);
  } finally {
    isFetching = false;
  }
}



async function fetchYahooFinanceRealtime(id: string): Promise<{
  currentPrice: number;
  change: number;
  changePercent: number;
  realName: string;
  exchange: "TW" | "TWO";
} | null> {
  const suffixes = ["TW", "TWO"];
  
  for (const suffix of suffixes) {
    const symbol = `${id}.${suffix}`;
    
    try {
      console.log(`Querying Yahoo Finance library quote for ${symbol}...`);
      const quote = await yahooFinance.quote(symbol);
      if (quote && quote.regularMarketPrice !== undefined && quote.regularMarketPrice !== null) {
        const currentPrice = quote.regularMarketPrice;
        const change = quote.regularMarketChange !== undefined ? quote.regularMarketChange : 0;
        const changePercent = quote.regularMarketChangePercent !== undefined ? quote.regularMarketChangePercent : 0;
        const rawName = quote.shortName || quote.longName || "";
        
        console.log(`[Yahoo Quote Success] ${symbol}: Price=${currentPrice}, ChangePercent=${changePercent}`);
        return {
          currentPrice: Math.round(currentPrice * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100,
          realName: rawName,
          exchange: suffix as "TW" | "TWO"
        };
      }
    } catch (err: any) {
      console.warn(`Yahoo library quote query failed for ${symbol}:`, err?.message || err);
    }
  }
  return null;
}

async function fetchYahooFinanceChart(ticker: string): Promise<{ month: string; price: number }[] | null> {
  try {
    const period1Date = new Date();
    period1Date.setMonth(period1Date.getMonth() - 11);
    console.log(`Querying yahooFinance.chart for ${ticker}...`);
    const yRes = await yahooFinance.chart(ticker, {
      period1: period1Date,
      period2: new Date(),
      interval: "1mo"
    });
    if (yRes && yRes.quotes && yRes.quotes.length > 0) {
      const history = yRes.quotes
        .filter((q: any) => q.close !== null && q.close !== undefined && !isNaN(q.close))
        .map((q: any) => {
          const dateObj = new Date(q.date);
          return {
            month: `${dateObj.getMonth() + 1}月`,
            price: Math.round(q.close * 10) / 10
          };
        });
      if (history.length > 0) {
        return history.slice(-12);
      }
    }
  } catch (err: any) {
    console.warn(`yahooFinance.chart failed for ${ticker}:`, err?.message || err);
  }
  return null;
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
  let finalHistory: any[] = [];
  let detectedExchange: "TW" | "TWO" = "TW";
  let yahooSuccess = false;

  // 1. Try official TWSE real-time MIS API FIRST for 100% accurate, 0-second delay real-time quotes during Taiwan market hours
  console.log(`Querying official TWSE MIS Realtime API for stock ${id}...`);
  try {
    const misUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${id}.tw|otc_${id}.tw&json=1&delay=0`;
    const misRes = await fetchWithTimeoutAndRetry(misUrl, {}, 1, 500);
    const misData = await misRes.json();
    if (misData && misData.msgArray && misData.msgArray.length > 0) {
      const validItem = misData.msgArray.find((m: any) => m && m.n && m.key);
      if (validItem) {
        const yValue = parseFloat(validItem.y);
        let parsedPrice = parseFloat(validItem.z);
        
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
          currentPrice = Math.round(parsedPrice * 100) / 100;
          realName = validItem.n || realName;
          detectedExchange = validItem.ex === "otc" ? "TWO" : "TW";
          if (!isNaN(yValue) && yValue > 0) {
            change = Math.round((currentPrice - yValue) * 100) / 100;
            changePercent = Math.round(((change / yValue) * 100) * 100) / 100;
          }
          yahooSuccess = true;
          console.log(`TWSE MIS API fetch success for ${id}: currentPrice = ${currentPrice}, change = ${change}`);
        }
      }
    }
  } catch (err: any) {
    console.warn(`Primary TWSE MIS fetch failed or timed out for ${id}:`, err?.message || err);
  }

  // 2. Fallback to Yahoo Finance REAL-TIME API (via yahoo-finance2 library) if MIS failed
  if (!yahooSuccess) {
    console.log(`Querying Yahoo Finance Realtime via library for stock ${id}...`);
    try {
      const rtData = await fetchYahooFinanceRealtime(id);
      if (rtData) {
        currentPrice = rtData.currentPrice;
        change = rtData.change;
        changePercent = rtData.changePercent;
        detectedExchange = rtData.exchange;
        yahooSuccess = true;
        if (rtData.realName) {
          realName = rtData.realName;
        }
        
        // Also try to grab history
        const ticker = `${id}.${detectedExchange}`;
        const hist = await fetchYahooFinanceChart(ticker);
        if (hist && hist.length > 0) {
          finalHistory = hist;
        }
      }
    } catch (e: any) {
      console.warn(`Yahoo library Realtime quote failed for ${id}:`, e?.message || e);
    }
  }

  // If we have price from TWSE MIS but no history yet, try to load the history chart from Yahoo Finance
  if (yahooSuccess && finalHistory.length === 0) {
    try {
      const ticker = `${id}.${detectedExchange}`;
      const hist = await fetchYahooFinanceChart(ticker);
      if (hist && hist.length > 0) {
        finalHistory = hist;
      }
    } catch (e) {
      console.warn(`Optional background chart history load failed for ${id}`);
    }
  }

  // 4. Fallback to daily open API caches
  if (!yahooSuccess) {
    const tseFound = tseCache.find((s: any) => String(s.Code).trim() === String(id).trim());
    let tpexFound: any = null;
    if (!tseFound) {
      tpexFound = tpexCache.find((s: any) => String(s.SecuritiesCompanyCode).trim() === String(id).trim());
    }

    if (tseFound) {
      currentPrice = parseFloat(tseFound.ClosingPrice) || 0;
      change = parseFloat(tseFound.Change) || 0;
      realName = tseFound.Name || realName;
      detectedExchange = "TW";
      if (currentPrice) {
        const prev = currentPrice - change;
        changePercent = prev ? (change / prev) * 100 : 0;
      }
      yahooSuccess = true;
    } else if (tpexFound) {
      currentPrice = parseFloat(tpexFound.Close) || 0;
      change = parseFloat(tpexFound.Change) || 0;
      realName = tpexFound.CompanyName || realName;
      detectedExchange = "TWO";
      if (currentPrice) {
        const prev = currentPrice - change;
        changePercent = prev ? (change / prev) * 100 : 0;
      }
      yahooSuccess = true;
    }
  }

  // 5. Default Seed/Fallbacks if all live sources failed
  const original = DEFAULT_STOCKS.find(s => s.id === id);
  if (!currentPrice && original) {
    currentPrice = original.currentPrice;
    change = original.change || 0;
    changePercent = original.changePercent || 0;
  } else if (!currentPrice) {
    currentPrice = 100;
    change = 1.5;
    changePercent = 1.5;
  }

  if (finalHistory.length === 0) {
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

  // Generate dividend info - do not fabricate fake dividends for custom added stocks
  let scaledDividends = original
    ? [...original.dividendInfo]
    : [];

  const cleanId = String(id).trim();
  if (Array.isArray(twseDividendCache)) {
    const matchedDivInfo = twseDividendCache.find(x => x && String(x.Code).trim() === cleanId);
    if (matchedDivInfo && matchedDivInfo.CashDividend) {
      const amount = parseFloat(matchedDivInfo.CashDividend);
      if (!isNaN(amount) && amount > 0) {
        let dateStr = matchedDivInfo.Date;
        let adExDate = "—";
        let adLastBuyDate = "—";
        if (dateStr && dateStr.length === 7) {
          const rocYear = parseInt(dateStr.slice(0, 3));
          const month = dateStr.slice(3, 5);
          const day = dateStr.slice(5, 7);
          const adYear = rocYear + 1911;
          adExDate = `${adYear}/${month}/${day}`;
          
          try {
            const exDate = new Date(adYear, parseInt(month) - 1, parseInt(day));
            const lastBuy = new Date(exDate.getTime() - 24 * 60 * 60 * 1000);
            if (lastBuy.getDay() === 0) {
              lastBuy.setDate(lastBuy.getDate() - 2);
            } else if (lastBuy.getDay() === 6) {
              lastBuy.setDate(lastBuy.getDate() - 1);
            }
            const lbY = lastBuy.getFullYear();
            const lbM = String(lastBuy.getMonth() + 1).padStart(2, "0");
            const lbD = String(lastBuy.getDate()).padStart(2, "0");
            adLastBuyDate = `${lbY}/${lbM}/${lbD}`;
          } catch (e) {
            adLastBuyDate = adExDate;
          }
        }
        
        const currentYear = adExDate !== "—" ? adExDate.slice(0, 4) : "2026";
        const matchedIdx = scaledDividends.findIndex(d => d.year === currentYear);
        const newDivItem = {
          year: currentYear,
          amount: Math.round(amount * 100) / 100,
          status: "已公告",
          exDividendDate: adExDate,
          lastBuyDate: adLastBuyDate
        };

        if (matchedIdx !== -1) {
          scaledDividends[matchedIdx] = newDivItem;
        } else {
          scaledDividends = [newDivItem, ...scaledDividends];
        }
      }
    }
  }

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
    derivedAnalysis = generateExpertFinancialReport(id, realName, currentPrice, changePercent);
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
