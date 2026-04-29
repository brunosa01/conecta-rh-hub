-- Create evaluations table
CREATE TABLE public.evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluated_id UUID NOT NULL,
  evaluated_name TEXT NOT NULL,
  evaluated_sector TEXT NOT NULL,
  evaluated_type TEXT NOT NULL DEFAULT 'colaborador',
  evaluator_id UUID NOT NULL,
  evaluator_name TEXT NOT NULL,
  evaluation_date DATE NOT NULL,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  percentage_achieved NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read evaluations" ON public.evaluations FOR SELECT USING (true);
CREATE POLICY "Allow all insert evaluations" ON public.evaluations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update evaluations" ON public.evaluations FOR UPDATE USING (true);
CREATE POLICY "Allow all delete evaluations" ON public.evaluations FOR DELETE USING (true);

CREATE INDEX idx_evaluations_evaluated_id ON public.evaluations(evaluated_id);
CREATE INDEX idx_evaluations_date ON public.evaluations(evaluation_date DESC);