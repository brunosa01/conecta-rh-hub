ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS person_type text NOT NULL DEFAULT 'colaborador';
UPDATE public.colaboradores SET person_type = 'colaborador' WHERE person_type IS NULL;