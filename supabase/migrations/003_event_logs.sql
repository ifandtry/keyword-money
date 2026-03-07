CREATE TABLE IF NOT EXISTS public.event_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  user_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON public.event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON public.event_logs(created_at DESC);

ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert" ON public.event_logs
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow service role all" ON public.event_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
