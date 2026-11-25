/**
 * Yahoo Finance & US Market News Org Connector: fetches ticker quotes and market headlines.
 */

export interface MarketNewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
  tickers: string[];
}

interface RawYahooSearch {
  news?: {
    uuid?: string;
    title?: string;
    publisher?: string;
    link?: string;
    providerPublishTime?: number;
    relatedTickers?: string[];
  }[];
}

export function normalizeYahooMarketNews(raw: RawYahooSearch): MarketNewsItem[] {
  return (raw.news ?? [])
    .filter((n) => Boolean(n.title && n.link))
    .map((n, i) => ({
      uuid: n.uuid ?? `yf-${i}`,
      title: n.title!,
      publisher: n.publisher ?? 'Yahoo Finance',
      link: n.link!,
      publishedAt: Number(n.providerPublishTime ?? 0),
      tickers: n.relatedTickers ?? [],
    }));
}

export async function fetchYahooMarketNews(query = 'US stock market', newsCount = 10): Promise<MarketNewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=${Math.min(20, newsCount)}&quotesCount=0`;
  const res = await fetch(url, { headers: { 'user-agent': 'EveryAI-CreatorStudio/1.0' } });
  if (!res.ok) throw new Error(`Yahoo Finance API error ${res.status}: ${await res.text()}`);
  return normalizeYahooMarketNews((await res.json()) as RawYahooSearch);
}
