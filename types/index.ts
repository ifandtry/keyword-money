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
  seedItem: KeywordItem | null;
  items: KeywordItem[];
  autoCompleteKeywords: KeywordItem[];
  seed: string;
  analyzedAt: string;
}

export interface TitleSuggestion {
  title: string;
  clickScore: number;
  reason: string;
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

export interface ExtractRequest {
  description: string;
}

export interface BlogTitleAnalysis {
  title: string;
  link: string;
  clickScore: number;
  analysis: string;
  bloggerName: string;
  postDate: string;
  description: string;
  commentCount: number | null;
  dailyVisitors: number | null;
  totalPosts: number | null;
}

export interface ExtractResponse {
  mainKeywordCandidates: KeywordItem[];
  subKeywords: KeywordItem[];
  autoCompleteKeywords: KeywordItem[];
  titles: TitleSuggestion[];
  topBlogTitles: BlogTitleAnalysis[];
  description: string;
  analyzedAt: string;
}

// ── 3-Step Flow Types ──

export interface MoneyKeywordItem {
  keyword: string;
  pcVolume: number;
  mobileVolume: number;
  totalVolume: number;
  totalDocCount: number;
  moneyScore: number;
  commercialWeight: number;
  volumeWeight: number;
  finalScore: number;
  commercialTokens: string[];
}

export interface DiscoveryResponse {
  keywords: MoneyKeywordItem[];
  seed: string;
  analyzedAt: string;
}

export interface ExpansionResponse {
  mainKeyword: MoneyKeywordItem;
  subKeywords: MoneyKeywordItem[];
  allCandidates: MoneyKeywordItem[];
  topBlogs: BlogReference[];
  analyzedAt: string;
}

export interface BlogReference {
  title: string;
  link: string;
  description: string;
  bloggerName: string;
  postDate: string;
}

export interface ProductionRequest {
  mainKeyword: string;
  subKeywords: string[];
}

export interface ProductionResponse {
  titles: string[];
  outline: ContentOutline;
  generatedAt: string;
}

export interface ContentOutline {
  title: string;
  sections: ContentSection[];
}

export interface ContentSection {
  heading: string;
  points: string[];
}

export interface TrendingCategory {
  name: string;
  keywords: string[];
}
