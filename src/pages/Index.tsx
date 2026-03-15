import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColaboradorDialog, ColaboradorForm } from "@/components/AddColaboradorDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Users, Pencil, ToggleLeft, ToggleRight, RotateCcw, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type EmploymentPeriod = {
  admissionDate: string;
  dismissalDate: string | null;
  dismissalReason: string | null;
  dismissalCost: number | null;
};

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
  status: string;
  employment_periods: EmploymentPeriod[];
};

const generoLabel: Record<string, string> = {
  hetero: "Heterossexual",
  homo: "Homossexual",
  pan: "Pansexual",
  bi: "Bissexual",
};

const defaultDismissalReasons = [
  "Pedido de demissão",
  "Demissão sem justa causa",
  "Demissão por justa causa",
  "Término de contrato",
  "Aposentadoria",
  "Falecimento",
];

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
  const [showInactive, setShowInactive] = useState(false);

  // Deactivation state
  const [deactivateTarget, setDeactivateTarget] = useState<Colaborador | null>(null);
  const [deactivateDate, setDeactivateDate] = useState("");
  const [deactivateReason, setDeactivateReason] = useState("");
  const [dismissalReasons, setDismissalReasons] = useState(defaultDismissalReasons);
  const [addingNewReason, setAddingNewReason] = useState(false);
  const [newReasonText, setNewReasonText] = useState("");
  const [deactivateCost, setDeactivateCost] = useState("");

  // Reactivation state
  const [reactivateTarget, setReactivateTarget] = useState<Colaborador | null>(null);
  const [reactivateDate, setReactivateDate] = useState("");

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchColaboradores = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("colaboradores")
      .select("*")
      .order("nome_completo");
    setColaboradores((data as unknown as Colaborador[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchColaboradores();
  }, []);

  const activeList = colaboradores.filter((c) => c.status === "active");
  const inactiveList = colaboradores.filter((c) => c.status === "inactive");
  const displayList = showInactive ? inactiveList : activeList;

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
      escolaridade: c.escolaridade,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setEditingData(null);
    setDialogOpen(true);
  };

  // --- DEACTIVATION ---
  const openDeactivate = (c: Colaborador) => {
    setDeactivateTarget(c);
    setDeactivateDate("");
    setDeactivateReason("");
    setAddingNewReason(false);
    setNewReasonText("");
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget || !deactivateDate || !deactivateReason) {
      toast.error("Preencha todos os campos");
      return;
    }

    const periods: EmploymentPeriod[] = Array.isArray(deactivateTarget.employment_periods)
      ? [...deactivateTarget.employment_periods]
      : [];

    // Update the last period with dismissal info
    if (periods.length > 0) {
      periods[periods.length - 1] = {
        ...periods[periods.length - 1],
        dismissalDate: deactivateDate,
        dismissalReason: deactivateReason,
      };
    }

    const { error } = await supabase
      .from("colaboradores")
      .update({
        status: "inactive",
        employment_periods: periods as any,
      })
      .eq("id", deactivateTarget.id);

    if (error) {
      toast.error("Erro ao desativar: " + error.message);
    } else {
      toast.success("Colaborador desativado com sucesso!");
      fetchColaboradores();
    }
    setDeactivateTarget(null);
  };

  const handleAddNewReason = () => {
    if (newReasonText.trim() && !dismissalReasons.includes(newReasonText.trim())) {
      const reason = newReasonText.trim();
      setDismissalReasons((prev) => [...prev, reason]);
      setDeactivateReason(reason);
      setNewReasonText("");
      setAddingNewReason(false);
    }
  };

  // --- REACTIVATION ---
  const openReactivate = (c: Colaborador) => {
    setReactivateTarget(c);
    setReactivateDate("");
  };

  const confirmReactivate = async () => {
    if (!reactivateTarget || !reactivateDate) {
      toast.error("Preencha a data de admissão");
      return;
    }

    const periods: EmploymentPeriod[] = Array.isArray(reactivateTarget.employment_periods)
      ? [...reactivateTarget.employment_periods]
      : [];

    periods.push({
      admissionDate: reactivateDate,
      dismissalDate: null,
      dismissalReason: null,
    });

    const { error } = await supabase
      .from("colaboradores")
      .update({
        status: "active",
        data_admissao: reactivateDate,
        employment_periods: periods as any,
      })
      .eq("id", reactivateTarget.id);

    if (error) {
      toast.error("Erro ao reativar: " + error.message);
    } else {
      toast.success("Colaborador reativado com sucesso!");
      fetchColaboradores();
    }
    setReactivateTarget(null);
  };

  // --- DELETE ---
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

  const getLastDismissal = (c: Colaborador) => {
    const periods: EmploymentPeriod[] = Array.isArray(c.employment_periods) ? c.employment_periods : [];
    for (let i = periods.length - 1; i >= 0; i--) {
      if (periods[i].dismissalDate) return periods[i];
    }
    return null;
  };

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Colaboradores</h1>
            <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-medium text-accent-foreground">
              {displayList.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive((v) => !v)}
              className="gap-2 text-sm"
            >
              {showInactive ? (
                <>
                  <ToggleRight className="h-4 w-4" />
                  Ver Ativos
                </>
              ) : (
                <>
                  <ToggleLeft className="h-4 w-4" />
                  Ver Inativos
                </>
              )}
            </Button>
            {!showInactive && (
              <Button onClick={handleAdd} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Adicionar Colaborador
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Carregando...
            </div>
          ) : displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Users className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-lg font-medium">
                {showInactive ? "Nenhum colaborador inativo" : "Nenhum colaborador cadastrado"}
              </p>
              {!showInactive && (
                <p className="text-sm">Clique em "Adicionar Colaborador" para começar</p>
              )}
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
                  <TableHead>Escolaridade</TableHead>
                  {showInactive && <TableHead>Demissão</TableHead>}
                  {showInactive && <TableHead>Motivo</TableHead>}
                  <TableHead className="w-28 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayList.map((c) => {
                  const lastDismissal = showInactive ? getLastDismissal(c) : null;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome_completo}</TableCell>
                      <TableCell>{c.documento}</TableCell>
                      <TableCell className="capitalize">{c.sexo}</TableCell>
                      <TableCell>{generoLabel[c.genero] || c.genero}</TableCell>
                      <TableCell>{c.setor}</TableCell>
                      <TableCell>{c.cargo}</TableCell>
                      <TableCell>{formatDate(c.data_admissao)}</TableCell>
                      <TableCell>{c.idade}</TableCell>
                      <TableCell>{c.escolaridade}</TableCell>
                      {showInactive && (
                        <TableCell>
                          {lastDismissal?.dismissalDate
                            ? formatDate(lastDismissal.dismissalDate)
                            : "—"}
                        </TableCell>
                      )}
                      {showInactive && (
                        <TableCell>{lastDismissal?.dismissalReason || "—"}</TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {showInactive ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReactivate(c)}
                                className="h-7 gap-1 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reativar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteId(c.id)}
                                className="h-7 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Excluir
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(c)}
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeactivate(c)}
                                className="h-7 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                              >
                                Desativar
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      {/* Add/Edit Dialog */}
      <ColaboradorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchColaboradores}
        editingId={editingId}
        initialData={editingData}
      />

      {/* Deactivation Modal */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Desativar Colaborador</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Colaborador: <span className="font-medium text-foreground">{deactivateTarget?.nome_completo}</span>
            </p>
            <div className="grid gap-2">
              <Label>Data de Demissão</Label>
              <Input
                type="date"
                value={deactivateDate}
                onChange={(e) => setDeactivateDate(e.target.value)}
                min={deactivateTarget?.data_admissao || ""}
              />
              {deactivateDate && deactivateTarget && deactivateDate < deactivateTarget.data_admissao && (
                <p className="text-sm text-destructive">
                  A data de demissão não pode ser anterior à data de admissão
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Motivo da Demissão</Label>
              <Select value={deactivateReason} onValueChange={(v) => {
                if (v === "__add_new__") {
                  setAddingNewReason(true);
                } else {
                  setDeactivateReason(v);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {dismissalReasons.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                  <SelectItem value="__add_new__">
                    <span className="flex items-center gap-1">
                      <Plus className="h-3.5 w-3.5" /> Adicionar novo motivo
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {addingNewReason && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Novo motivo..."
                    value={newReasonText}
                    onChange={(e) => setNewReasonText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddNewReason()}
                  />
                  <Button size="sm" onClick={handleAddNewReason}>
                    Adicionar
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmDeactivate}
                disabled={!deactivateDate || !deactivateReason || (!!deactivateTarget && deactivateDate < deactivateTarget.data_admissao)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmar Demissão
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reactivation Modal */}
      <Dialog open={!!reactivateTarget} onOpenChange={(open) => !open && setReactivateTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Reativar Colaborador</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Colaborador: <span className="font-medium text-foreground">{reactivateTarget?.nome_completo}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Os dados pessoais serão mantidos. Um novo período de trabalho será iniciado.
            </p>
            <div className="grid gap-2">
              <Label>Nova Data de Admissão</Label>
              <Input
                type="date"
                value={reactivateDate}
                onChange={(e) => setReactivateDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReactivateTarget(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmReactivate}>
                Confirmar Reativação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente este colaborador? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
