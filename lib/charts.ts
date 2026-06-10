export type ThemeMode = "light" | "dark";

export interface MacroIndicator {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  sourceLabel: string;
  symbol: string;
  interval: string;
  studies?: string[];
  pineScript?: string;
}

export const MACRO_INDICATORS: MacroIndicator[] = [
  {
    id: "pmi",
    title: "US Manufacturing PMI",
    description:
      "Purchasing Managers' Index. Опережающий индикатор деловой активности. Уровень выше 50 означает расширение экономики.",
    sourceUrl:
      "https://tradingeconomics.com/united-states/business-confidence",
    sourceLabel: "Trading Economics",
    symbol: "ECONOMICS:USBCOI",
    interval: "M",
  },
  {
    id: "copper",
    title: "Copper Futures",
    description:
      "Медь является одним из лучших индикаторов промышленного спроса и глобального экономического цикла.",
    sourceUrl: "https://tradingeconomics.com/commodity/copper",
    sourceLabel: "Trading Economics",
    symbol: "COMEX:HG1!",
    interval: "D",
  },
  {
    id: "vix",
    title: "Volatility Index",
    description:
      "Индекс страха рынка. Низкие значения — спокойствие. Высокие значения — стресс и риск-офф.",
    sourceUrl: "https://tradingeconomics.com/vix:ind",
    sourceLabel: "Trading Economics",
    symbol: "CBOE:VIX",
    interval: "D",
  },
  {
    id: "yield-curve",
    title: "US 10Y-2Y Spread",
    description:
      "Спред доходностей 10-летних и 2-летних казначейских облигаций США. Отрицательные значения сигнализируют об инверсии кривой.",
    sourceUrl: "https://fred.stlouisfed.org",
    sourceLabel: "FRED",
    symbol: "TVC:US10Y-TVC:US02Y",
    interval: "D",
    pineScript: "pine/yield-spread.pine",
  },
  {
    id: "copper-gold",
    title: "Copper-Gold Ratio",
    description:
      "Отношение цен меди к золоту. Рост ratio указывает на ожидания экономического роста, падение — на защитный режим.",
    sourceUrl: "",
    sourceLabel: "Расчётный индикатор",
    symbol: "COMEX:HG1!/COMEX:GC1!",
    interval: "D",
    studies: ["MASimple@tv-basicstudies"],
    pineScript: "pine/copper-gold-ratio.pine",
  },
];

export const INFO_PANEL_ITEMS = [
  {
    label: "PMI > 50",
    text: "Расширение производственной активности в США.",
  },
  {
    label: "Copper",
    text: "Рост цен на медь часто опережает цикл промышленного спроса.",
  },
  {
    label: "VIX",
    text: "Резкий рост волатильности — сигнал стресса на рынке риска.",
  },
  {
    label: "Yield Curve",
    text: "Инверсия (спред < 0) исторически предшествует замедлению.",
  },
  {
    label: "Cu/Au",
    text: "Высокий ratio — «risk-on», низкий — защитные активы в фаворе.",
  },
];
