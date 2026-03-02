export interface KeywordItem {
  keyword: string;
  pcVolume: number;
  mobileVolume: number;
  totalVolume: number;
  cpc: number;
  totalDocCount: number;
  saturation: number;
  competition: number;
  commercialIntent: number;
  blogRatio: number;
  profitScore: number;
  grade: "S" | "A" | "B" | "C" | "D";
  reason: string;
}

export interface AnalyzeRequest {
  keyword: string;
}

export interface AnalyzeResponse {
  items: KeywordItem[];
  seed: string;
  analyzedAt: string;
}

export interface TitleSuggestion {
  title: string;
  clickScore: number;
  reason: string;
}

export interface TransformRequest {
  originalText: string;
  keywords: string[];
}

export interface TransformResponse {
  transformedText: string;
  titles: TitleSuggestion[];
  changes: string[];
  seoTips: string[];
}

export interface VolumeData {
  keyword: string;
  pcVolume: number;
  mobileVolume: number;
  totalVolume: number;
  cpc: number;
}

export interface SerpData {
  keyword: string;
  totalDocCount: number;
  blogPostCount: number;
  blogRatio: number;
  commercialIntent: number;
  competition: number;
}

export interface VolumeProvider {
  getVolume(keywords: string[]): Promise<VolumeData[]>;
}

export interface SerpProvider {
  analyze(keywords: string[]): Promise<SerpData[]>;
}

export interface UsageRecord {
  date: string;
  count: number;
}
