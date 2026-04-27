CREATE TABLE IF NOT EXISTS public.enpssurveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  label TEXT NOT NULL,
  votes JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_responses INTEGER NOT NULL DEFAULT 0,
  active_collaborators_at_time INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

ALTER TABLE public.enpssurveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view enps surveys" ON public.enpssurveys;
DROP POLICY IF EXISTS "Anyone can insert enps surveys" ON public.enpssurveys;
DROP POLICY IF EXISTS "Anyone can update enps surveys" ON public.enpssurveys;
DROP POLICY IF EXISTS "Anyone can delete enps surveys" ON public.enpssurveys;

CREATE POLICY "Anyone can view enps surveys" ON public.enpssurveys FOR SELECT USING (true);
CREATE POLICY "Anyone can insert enps surveys" ON public.enpssurveys FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update enps surveys" ON public.enpssurveys FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete enps surveys" ON public.enpssurveys FOR DELETE USING (true);