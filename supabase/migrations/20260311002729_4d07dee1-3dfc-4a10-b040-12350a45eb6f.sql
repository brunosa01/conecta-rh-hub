
CREATE TABLE public.colaboradores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  documento TEXT NOT NULL,
  genero TEXT NOT NULL,
  sexo TEXT NOT NULL,
  setor TEXT NOT NULL,
  cargo TEXT NOT NULL,
  data_admissao DATE NOT NULL,
  idade INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read" ON public.colaboradores FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.colaboradores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.colaboradores FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON public.colaboradores FOR DELETE USING (true);
