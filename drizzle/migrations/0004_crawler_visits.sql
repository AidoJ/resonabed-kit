CREATE TABLE public.crawler_visits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visited_at timestamptz NOT NULL DEFAULT now(),
  bot_name text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL
);

GRANT SELECT ON public.crawler_visits TO authenticated;
GRANT ALL ON public.crawler_visits TO service_role;

ALTER TABLE public.crawler_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read crawler visits"
ON public.crawler_visits FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX crawler_visits_visited_at_idx ON public.crawler_visits (visited_at);
CREATE INDEX crawler_visits_bot_visited_idx ON public.crawler_visits (bot_name, visited_at);

-- Visits per bot per week (weeks start Monday, Brisbane time). RLS limits rows to platform admins.
CREATE OR REPLACE FUNCTION public.crawler_visits_weekly()
RETURNS TABLE (week_start date, bot_name text, visits bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT (date_trunc('week', visited_at AT TIME ZONE 'Australia/Brisbane'))::date AS week_start,
         bot_name, count(*)::bigint AS visits
  FROM public.crawler_visits
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2;
$$;

-- Top 20 paths per bot over the retained 90 days. RLS limits rows to platform admins.
CREATE OR REPLACE FUNCTION public.crawler_top_paths()
RETURNS TABLE (bot_name text, path text, visits bigint, last_status integer, rank integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH counts AS (
    SELECT bot_name, path, count(*)::bigint AS visits,
           (array_agg(status_code ORDER BY visited_at DESC))[1] AS last_status
    FROM public.crawler_visits
    GROUP BY bot_name, path
  ), ranked AS (
    SELECT *, (row_number() OVER (PARTITION BY bot_name ORDER BY visits DESC, path))::integer AS rank
    FROM counts
  )
  SELECT bot_name, path, visits, last_status, rank FROM ranked WHERE rank <= 20
  ORDER BY bot_name, rank;
$$;

REVOKE EXECUTE ON FUNCTION public.crawler_visits_weekly() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crawler_top_paths() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crawler_visits_weekly() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crawler_top_paths() TO authenticated;

-- Keep only the last 90 days of crawler visits (runs daily).
SELECT cron.schedule(
  'crawler-visits-cleanup-daily',
  '41 2 * * *',
  $$DELETE FROM public.crawler_visits WHERE visited_at < now() - interval '90 days'$$
);