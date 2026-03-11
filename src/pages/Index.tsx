import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddColaboradorDialog } from "@/components/AddColaboradorDialog";
import { UserPlus, Users } from "lucide-react";
import logo from "@/assets/logo-conecta-ads.png";

type Colaborador = {
  id: string;
  nome_completo: string;
  documento: string;
  genero: string;
  sexo: string;
  setor: string;
  cargo: string;
  data_admissao: string;
  idade: number;
};

const generoLabel: Record<string, string> = {
  hetero: "Heterossexual",
  homo: "Homossexual",
  pan: "Pansexual",
  bi: "Bissexual",
};

export default function Index() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchColaboradores = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("colaboradores")
      .select("*")
      .order("nome_completo");
    setColaboradores((data as Colaborador[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchColaboradores();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Conecta Ads" className="h-10" />
            <div className="h-8 w-px bg-border" />
            <span className="text-lg font-semibold text-foreground">Gestão Humana</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Colaboradores</h1>
            <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-medium text-accent-foreground">
              {colaboradores.length}
            </span>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Adicionar Colaborador
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Carregando...
            </div>
          ) : colaboradores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Users className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-lg font-medium">Nenhum colaborador cadastrado</p>
              <p className="text-sm">Clique em "Adicionar Colaborador" para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead>Gênero</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead>Idade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colaboradores.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome_completo}</TableCell>
                    <TableCell>{c.documento}</TableCell>
                    <TableCell className="capitalize">{c.sexo}</TableCell>
                    <TableCell>{generoLabel[c.genero] || c.genero}</TableCell>
                    <TableCell>{c.setor}</TableCell>
                    <TableCell>{c.cargo}</TableCell>
                    <TableCell>{new Date(c.data_admissao).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{c.idade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      <AddColaboradorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchColaboradores}
      />
    </div>
  );
}
