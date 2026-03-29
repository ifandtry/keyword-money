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
  getExactVolumes(keywords: string[]): Promise<VolumeData[]>;
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

export type DiscoveryRelatedKeywordDebugReason =
  | "missing_volume_data"
  | "missing_serp_data"
  | "missing_volume_and_serp_data";

export interface DiscoveryRelatedKeywordItem {
  keyword: string;
  pcVolume?: number | null;
  mobileVolume?: number | null;
  totalVolume?: number | null;
  totalDocCount?: number | null;
  moneyScore?: number | null;
  commercialWeight?: number | null;
  volumeWeight?: number | null;
  finalScore?: number | null;
  commercialTokens?: string[] | null;
  hasVolumeData: boolean;
  hasSerpData: boolean;
  debugReason?: DiscoveryRelatedKeywordDebugReason;
}

export interface DiscoveryRelatedKeywordsDebug {
  sourceCount: number;
  volumeMappedCount: number;
  serpAnalyzedCount: number;
  scoredCount: number;
  missingVolumeKeywords: string[];
  missingSerpKeywords: string[];
}

export interface DiscoveryResponse {
  keywords: MoneyKeywordItem[];
  relatedKeywords: DiscoveryRelatedKeywordItem[];
  relatedKeywordsDebug: DiscoveryRelatedKeywordsDebug;
  seed: string;
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

// ── Subscription & Billing Types ──

export type PlanType = "free" | "basic" | "pro";
export type ActionType = "discovery" | "analysis" | "production";

export interface PlanLimits {
  discovery: number;
  analysis: number;
  production: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: { discovery: 5, analysis: 10, production: 0 },
  basic: { discovery: 999999, analysis: 999999, production: 10 },
  pro: { discovery: 999999, analysis: 999999, production: 100 },
};

export interface UserProfile {
  user_id: string;
  plan: PlanType;
  plan_started_at: string | null;
  plan_expires_at: string | null;
}

export interface UserSubscription {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface UsageDaily {
  user_id: string;
  date: string;
  discovery_count: number;
  analysis_count: number;
  production_count: number;
}

export interface UsageCheckResult {
  allowed: boolean;
  plan: PlanType;
  used: number;
  limit: number;
  remaining: number;
}
