CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL,
  feature text NOT NULL,
  user_id uuid,
  request_id text NOT NULL,
  model text,
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens integer NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  estimated_cost_krw numeric(12,4) NOT NULL DEFAULT 0 CHECK (estimated_cost_krw >= 0),
  status text NOT NULL DEFAULT 'success',
  latency_ms integer CHECK (latency_ms >= 0),
  meta_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT api_usage_logs_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at
  ON public.api_usage_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_provider_created_at
  ON public.api_usage_logs(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_feature_created_at
  ON public.api_usage_logs(feature, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_created_at
  ON public.api_usage_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_request_id
  ON public.api_usage_logs(request_id);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role all on api_usage_logs" ON public.api_usage_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
