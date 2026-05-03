
-- Add date of birth and email to colaboradores
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill data_nascimento from idade (approximate: today - idade years) so existing records remain valid
UPDATE public.colaboradores
SET data_nascimento = (CURRENT_DATE - (idade || ' years')::interval)::date
WHERE data_nascimento IS NULL AND idade IS NOT NULL;

-- Make data_nascimento NOT NULL after backfill
ALTER TABLE public.colaboradores
  ALTER COLUMN data_nascimento SET NOT NULL;

-- Create sectors table
CREATE TABLE IF NOT EXISTS public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read sectors" ON public.sectors FOR SELECT USING (true);
CREATE POLICY "Allow all insert sectors" ON public.sectors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update sectors" ON public.sectors FOR UPDATE USING (true);
CREATE POLICY "Allow all delete sectors" ON public.sectors FOR DELETE USING (true);

-- Seed default sectors
INSERT INTO public.sectors (name) VALUES
  ('Diretoria'),
  ('Gestão Humana'),
  ('Financeiro'),
  ('Comercial'),
  ('Operacional'),
  ('Infraestrutura'),
  ('Desenvolvimento'),
  ('Zeladoria')
ON CONFLICT (name) DO NOTHING;
