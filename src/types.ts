export interface PricePoint {
  month: string;
  price: number;
}

export interface DividendPoint {
  year: string;
  amount: number;
  status: string; // "已公告" | "預估"
  exDividendDate: string;
  lastBuyDate: string;
}

export interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  date: string;
  shares: number;
  price: number;
  fee?: number;
  tax?: number;
  netAmount?: number;
}

export interface Stock {
  id: string;
  name: string;
  shares: number;
  buyPrice: number;
  transactions?: Transaction[];
  currentPrice: number;
  change?: number;
  changePercent?: number;
  priceHistory: PricePoint[];
  dividendInfo: DividendPoint[];
  aiAnalysis: string;
}

export interface MarketState {
  isOpen: boolean;
  desc: string;
  color: string;
}

export interface BroadcastState {
  msg: string;
  type: "normal" | "warning";
  visible: boolean;
}
