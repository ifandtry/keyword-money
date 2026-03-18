CREATE TABLE IF NOT EXISTS public.blog_views (
  slug text PRIMARY KEY,
  count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.blog_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read" ON public.blog_views
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow service role all" ON public.blog_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Atomic increment function
CREATE OR REPLACE FUNCTION increment_blog_view(post_slug text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  new_count bigint;
BEGIN
  INSERT INTO public.blog_views (slug, count, updated_at)
  VALUES (post_slug, 1, now())
  ON CONFLICT (slug)
  DO UPDATE SET count = blog_views.count + 1, updated_at = now()
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;
