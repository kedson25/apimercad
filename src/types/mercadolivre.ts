export interface MLConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  pkceEnabled: boolean;
}

export interface AuthUrlResponse {
  authUrl: string;
  state: string;
  verifier: string;
  challenge: string;
  redirectUri: string;
  clientId: string;
}

export interface TokenResponse {
  success: boolean;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
  userId?: number | string;
  tokenType?: string;
  scope?: string;
  raw?: any;
}

export interface MLUser {
  id: number | string;
  nickname: string;
  email: string | null;
  contactEmail?: string;
  firstName?: string;
  lastName?: string;
  siteId: string;
  userType: string;
  points: number;
  permalink?: string;
  thumbnailUrl?: string;
  identification?: {
    type?: string;
    number?: string;
  };
  address?: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  company?: {
    brandName?: string;
    corporateName?: string;
  };
  sellerExperience?: string;
  tags?: string[];
  sellerReputation?: {
    level_id?: string;
    power_seller_status?: string | null;
    transactions?: {
      completed?: number;
      canceled?: number;
      total?: number;
      ratings?: {
        positive?: number;
        negative?: number;
        neutral?: number;
      };
    };
  };
  status?: {
    site_status?: string;
    confirmed_email?: boolean;
    mercadopago_tc_accepted?: boolean;
  };
  registrationDate?: string;
  countryId?: string;
}

export interface SelfTestCheck {
  name: string;
  status: 'ok' | 'error';
  message: string;
}

export interface SelfTestResult {
  allPassed: boolean;
  checks: SelfTestCheck[];
}

export interface AIProductAnalysis {
  productTitle: string;
  suggestedCategory: string;
  estimatedPriceRange: string;
  condition: 'Novo' | 'Usado' | 'Recondicionado';
  highlights: string[];
  seoDescription: string;
  technicalSpecs: Record<string, string>;
  listingQualityTips: string[];
}

export interface MlbItemAd {
  mlbId: string;
  title: string;
  price?: string;
  condition?: string;
  url: string;
  sellerType?: string;
}

export interface GeminiPhotoScanResult {
  productName: string;
  translatedText?: string;
  kitSuggestion?: string;
  keywords?: string[];
  brand?: string;
  model?: string;
  category?: string;
  mlbId?: string | null;
  mlbList?: MlbItemAd[];
  searchQuery: string;
  mercadoLivreSearchUrl: string;
  priceRange?: string;
  condition?: string;
  detectedTexts?: string[];
  keyFeatures?: string[];
  confidence?: string;
}

