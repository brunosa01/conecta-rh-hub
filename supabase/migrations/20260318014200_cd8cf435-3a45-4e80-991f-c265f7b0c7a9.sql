
ALTER TABLE public.absences
  ALTER COLUMN start_date TYPE timestamptz USING start_date::timestamptz,
  ALTER COLUMN end_date TYPE timestamptz USING end_date::timestamptz;
