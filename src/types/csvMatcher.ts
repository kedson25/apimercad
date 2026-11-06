export interface CsvItem {
  id: string;
  itens: string;
  valorUsd?: string;
  valorReal?: string;
  qtdItens?: string;
  cepBuyer?: string;
  /** Coluna G: MLB (um ou mais códigos MLB do produto/kit no CSV de destinação) */
  mlb?: string;
  mlbId?: string;
  matchScore?: number;
  matchReason?: string;
  matchedKeywords?: string[];
  matchCount?: number;
}

export interface MercadoLivreAd {
  mlbId?: string;
  title: string;
  price?: string;
  url: string;
  matchedKeywords: string[];
  matchCount?: number;
  relevance?: string;
  condition?: string;
  sellerType?: string;
}

export interface CsvMatchResult {
  matchedId: string;
  matchedItem: string;
  confidenceScore: number; // 0 - 100
  reasoning: string;
  visualOcrText?: string;
  productDescription?: string;
  mercadoLivreTitle: string;
  keywords: string[];
  matchedKeywords: string[];
  mlbId?: string;
  mlbList?: MercadoLivreAd[];
  mercadoLivreSearchUrl?: string;
  relatedMercadoLivreAds?: MercadoLivreAd[];
  allRankedMatches?: Array<{
    id: string;
    itens: string;
    mlb?: string;
    confidenceScore: number;
    matchedKeywords: string[];
    matchCount: number;
    reasoning?: string;
  }>;
}

export interface KitSearchResult {
  kitTitle: string;
  kitDescription: string;
  components: string[];
  estimatedPrice: string;
  keywords: string[];
  mercadoLivreSearchUrl: string;
  ads: MercadoLivreAd[];
  matchingCsvItems: Array<{
    id: string;
    itens: string;
    mlb?: string;
    valorReal?: string;
    matchedKeywords: string[];
    matchCount: number;
  }>;
}
