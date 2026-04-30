CREATE TABLE public.behavioral_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL,
  person_name TEXT NOT NULL,
  person_sector TEXT NOT NULL,
  person_type TEXT NOT NULL DEFAULT 'colaborador',
  mapping_date DATE NOT NULL,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  analista NUMERIC NOT NULL DEFAULT 0,
  planejador NUMERIC NOT NULL DEFAULT 0,
  executor NUMERIC NOT NULL DEFAULT 0,
  comunicador NUMERIC NOT NULL DEFAULT 0,
  dominant_profile TEXT NOT NULL DEFAULT 'analista',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.behavioral_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read behavioral_mappings"
ON public.behavioral_mappings FOR SELECT USING (true);

CREATE POLICY "Allow all insert behavioral_mappings"
ON public.behavioral_mappings FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update behavioral_mappings"
ON public.behavioral_mappings FOR UPDATE USING (true);

CREATE POLICY "Allow all delete behavioral_mappings"
ON public.behavioral_mappings FOR DELETE USING (true);

CREATE INDEX idx_behavioral_mappings_person_id ON public.behavioral_mappings(person_id);
CREATE INDEX idx_behavioral_mappings_date ON public.behavioral_mappings(mapping_date DESC);