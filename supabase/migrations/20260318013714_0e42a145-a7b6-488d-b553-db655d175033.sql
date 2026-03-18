
CREATE TABLE public.absences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id UUID NOT NULL,
  collaborator_name TEXT NOT NULL,
  collaborator_sector TEXT NOT NULL,
  reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_hours INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to absences" ON public.absences
  FOR ALL TO public
  USING (true) WITH CHECK (true);
