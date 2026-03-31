import { randomUUID } from "crypto";
import { getAdminClient, type Database } from "@/lib/supabase/admin";

export type ApiUsageProvider = "openai" | "naver_search" | "naver_ads";

export type ApiUsageContext = {
  feature: string;
  requestId: string;
  userId?: string | null;
};

type OpenAITokenUsage = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
};

type ApiUsageLogInput = {
  provider: ApiUsageProvider;
  feature: string;
  requestId: string;
  userId?: string | null;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostKrw?: number;
  status?: string;
  latencyMs?: number | null;
  metaJson?: Record<string, unknown>;
};

type OpenAIUsageLogInput = {
  feature: string;
  requestId: string;
  userId?: string | null;
  model?: string | null;
  usage?: OpenAITokenUsage;
  status?: string;
  latencyMs?: number | null;
  metaJson?: Record<string, unknown>;
};

type OpenAIResultLike = {
  usage?: OpenAITokenUsage | null;
  model?: string | null;
};

type RunLoggedOpenAICallInput<TResult extends OpenAIResultLike> = {
  feature: string;
  requestId: string;
  userId?: string | null;
  model?: string | null;
  metaJson?: Record<string, unknown>;
  execute: () => Promise<TResult>;
};

function roundCurrency(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function parsePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export function createApiRequestId() {
  return randomUUID();
}

export function calcOpenAICostUsd(usage: { prompt_tokens: number; completion_tokens: number }) {
  const inputCost = (usage.prompt_tokens / 1_000_000) * 0.15;
  const outputCost = (usage.completion_tokens / 1_000_000) * 0.6;
  return roundCurrency(inputCost + outputCost);
}

export function calcOpenAICostKrw(usage: { prompt_tokens: number; completion_tokens: number }) {
  const usdToKrwRate = parsePositiveNumber(
    process.env.OPENAI_USD_TO_KRW_RATE ?? process.env.USD_TO_KRW_RATE,
    1400
  );
  return roundCurrency(calcOpenAICostUsd(usage) * usdToKrwRate);
}

export function getProviderRequestCostKrw(provider: Exclude<ApiUsageProvider, "openai">) {
  if (provider === "naver_ads") {
    return roundCurrency(parsePositiveNumber(process.env.NAVER_ADS_COST_KRW_PER_REQUEST, 0));
  }

  return roundCurrency(parsePositiveNumber(process.env.NAVER_SEARCH_COST_KRW_PER_REQUEST, 0));
}

function shouldPersistApiUsage() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.ENABLE_API_USAGE_LOGGING === "true"
  );
}

export async function logApiUsage({
  provider,
  feature,
  requestId,
  userId,
  model,
  inputTokens = 0,
  outputTokens = 0,
  totalTokens,
  estimatedCostKrw = 0,
  status = "success",
  latencyMs,
  metaJson = {},
}: ApiUsageLogInput) {
  if (!shouldPersistApiUsage()) return;

  const resolvedTotalTokens = totalTokens ?? inputTokens + outputTokens;
  const admin = getAdminClient();
  const payload: Database["public"]["Tables"]["api_usage_logs"]["Insert"] = {
    provider,
    feature,
    user_id: userId ?? null,
    request_id: requestId,
    model: model ?? null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: resolvedTotalTokens,
    estimated_cost_krw: roundCurrency(estimatedCostKrw),
    status,
    latency_ms: latencyMs ?? null,
    meta_json: metaJson,
  };

  const query = (admin.from("api_usage_logs") as unknown as {
    insert: (
      value: Database["public"]["Tables"]["api_usage_logs"]["Insert"]
    ) => PromiseLike<{ error: { message: string } | null }>;
  }).insert(payload);

  const { error } = await query;

  if (error) {
    console.error("[logApiUsage]", error.message);
  }
}

export async function logOpenAIUsage({
  feature,
  requestId,
  userId,
  model,
  usage,
  status = "success",
  latencyMs,
  metaJson = {},
}: OpenAIUsageLogInput) {
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;

  await logApiUsage({
    provider: "openai",
    feature,
    requestId,
    userId,
    model: model ?? null,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostKrw: calcOpenAICostKrw({
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
    }),
    status,
    latencyMs,
    metaJson,
  });
}

export async function runLoggedOpenAICall<TResult extends OpenAIResultLike>({
  feature,
  requestId,
  userId,
  model,
  metaJson = {},
  execute,
}: RunLoggedOpenAICallInput<TResult>): Promise<TResult> {
  const startedAt = Date.now();

  try {
    const result = await execute();
    await logOpenAIUsage({
      feature,
      requestId,
      userId,
      model: result.model ?? model ?? null,
      usage: result.usage ?? undefined,
      latencyMs: Date.now() - startedAt,
      metaJson,
    });
    return result;
  } catch (error) {
    await logApiUsage({
      provider: "openai",
      feature,
      requestId,
      userId,
      model: model ?? null,
      status: "error",
      latencyMs: Date.now() - startedAt,
      metaJson: {
        ...metaJson,
        error_message: error instanceof Error ? error.message : "unknown_error",
      },
    });
    throw error;
  }
}
