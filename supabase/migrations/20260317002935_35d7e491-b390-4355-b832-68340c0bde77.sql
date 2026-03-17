CREATE TABLE public.cursos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  sectors TEXT[] NOT NULL DEFAULT '{}',
  cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to cursos" ON public.cursos
  FOR ALL USING (true) WITH CHECK (true);