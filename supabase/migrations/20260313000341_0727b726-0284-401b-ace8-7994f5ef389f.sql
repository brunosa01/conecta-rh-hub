
ALTER TABLE public.colaboradores 
ADD COLUMN status text NOT NULL DEFAULT 'active',
ADD COLUMN employment_periods jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing rows: set employment_periods from their current data_admissao
UPDATE public.colaboradores
SET employment_periods = jsonb_build_array(
  jsonb_build_object(
    'admissionDate', data_admissao::text,
    'dismissalDate', null,
    'dismissalReason', null
  )
);
