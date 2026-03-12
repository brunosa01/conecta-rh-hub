import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColaboradorDialog, ColaboradorForm } from "@/components/AddColaboradorDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UserPlus, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";


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
  escolaridade: string;
};

const generoLabel: Record<string, string> = {
  hetero: "Heterossexual",
  homo: "Homossexual",
  pan: "Pansexual",
  bi: "Bissexual"
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export default function Index() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<ColaboradorForm | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchColaboradores = async () => {
    setLoading(true);
    const { data } = await supabase.
    from("colaboradores").
    select("*").
    order("nome_completo");
    setColaboradores(data as Colaborador[] || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchColaboradores();
  }, []);

  const handleEdit = (c: Colaborador) => {
    setEditingId(c.id);
    setEditingData({
      nome_completo: c.nome_completo,
      documento: c.documento,
      genero: c.genero,
      sexo: c.sexo,
      setor: c.setor,
      cargo: c.cargo,
      data_admissao: c.data_admissao,
      idade: String(c.idade),
      escolaridade: c.escolaridade
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setEditingData(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("colaboradores").delete().eq("id", deleteId);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Colaborador excluído com sucesso!");
      fetchColaboradores();
    }
    setDeleteId(null);
  };

  return (
    <div className="bg-background">

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Colaboradores</h1>
            <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-medium text-accent-foreground">
              {colaboradores.length}
            </span>
          </div>
          <Button onClick={handleAdd} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Adicionar Colaborador
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          {loading ?
          <div className="flex items-center justify-center py-20 text-muted-foreground">
              Carregando...
            </div> :
          colaboradores.length === 0 ?
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Users className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-lg font-medium">Nenhum colaborador cadastrado</p>
              <p className="text-sm">Clique em "Adicionar Colaborador" para começar</p>
            </div> :

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
                  <TableHead className="w-24 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colaboradores.map((c) =>
              <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome_completo}</TableCell>
                    <TableCell>{c.documento}</TableCell>
                    <TableCell className="capitalize">{c.sexo}</TableCell>
                    <TableCell>{generoLabel[c.genero] || c.genero}</TableCell>
                    <TableCell>{c.setor}</TableCell>
                    <TableCell>{c.cargo}</TableCell>
                    <TableCell>{formatDate(c.data_admissao)}</TableCell>
                    <TableCell>{c.idade}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
              )}
              </TableBody>
            </Table>
          }
        </div>
      </main>

      <ColaboradorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchColaboradores}
        editingId={editingId}
        initialData={editingData} />
      

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O colaborador será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}