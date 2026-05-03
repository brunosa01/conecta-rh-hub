import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColaboradorDialog, ColaboradorForm, PersonType } from "@/components/AddColaboradorDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateAge, personTypeAddLabels, personTypeFullLabels, personTypePluralLabels } from "@/lib/personHelpers";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Users, Pencil, ToggleLeft, ToggleRight, RotateCcw, Trash2, Plus, Briefcase, Wrench, User } from "lucide-react";
import { toast } from "sonner";

// All person types (colaborador, socio, prestador) are included equally in all indicators
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
  person_type: PersonType;
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

const TABS: { type: PersonType; label: string; addLabel: string; icon: typeof User }[] = [
  { type: "colaborador", label: "Colaboradores", addLabel: "Adicionar Colaborador", icon: User },
  { type: "socio", label: "Sócios", addLabel: "Adicionar Sócio", icon: Briefcase },
  { type: "prestador", label: "Prestadores de Serviço", addLabel: "Adicionar Prestador", icon: Wrench },
];

export default function Index() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<ColaboradorForm | null>(null);
  const [activeTab, setActiveTab] = useState<PersonType>("colaborador");
  const [showInactiveByTab, setShowInactiveByTab] = useState<Record<PersonType, boolean>>({
    colaborador: false,
    socio: false,
    prestador: false,
  });
  const [dialogType, setDialogType] = useState<PersonType>("colaborador");

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

  const showInactive = showInactiveByTab[activeTab];
  const tabRecords = colaboradores.filter((c) => (c.person_type || "colaborador") === activeTab);
  const activeList = tabRecords.filter((c) => c.status === "active");
  const inactiveList = tabRecords.filter((c) => c.status === "inactive");
  const displayList = showInactive ? inactiveList : activeList;

  const activeCounts: Record<PersonType, number> = {
    colaborador: colaboradores.filter((c) => (c.person_type || "colaborador") === "colaborador" && c.status === "active").length,
    socio: colaboradores.filter((c) => c.person_type === "socio" && c.status === "active").length,
    prestador: colaboradores.filter((c) => c.person_type === "prestador" && c.status === "active").length,
  };
  const totalActive = activeCounts.colaborador + activeCounts.socio + activeCounts.prestador;

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
      person_type: (c.person_type || "colaborador") as PersonType,
    });
    setDialogType((c.person_type || "colaborador") as PersonType);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setEditingData(null);
    setDialogType(activeTab);
    setDialogOpen(true);
  };

  // --- DEACTIVATION ---
  const openDeactivate = (c: Colaborador) => {
    setDeactivateTarget(c);
    setDeactivateDate("");
    setDeactivateReason("");
    setDeactivateCost("");
    setAddingNewReason(false);
    setNewReasonText("");
  };

  const parsedCost = parseFloat(deactivateCost.replace(/\./g, "").replace(",", "."));
  const isCostValid = deactivateCost !== "" && !isNaN(parsedCost) && parsedCost > 0;

  const confirmDeactivate = async () => {
    if (!deactivateTarget || !deactivateDate || !deactivateReason || !isCostValid) {
      toast.error("Preencha todos os campos");
      return;
    }

    const periods: EmploymentPeriod[] = Array.isArray(deactivateTarget.employment_periods)
      ? [...deactivateTarget.employment_periods]
      : [];

    if (periods.length > 0) {
      periods[periods.length - 1] = {
        ...periods[periods.length - 1],
        dismissalDate: deactivateDate,
        dismissalReason: deactivateReason,
        dismissalCost: parsedCost,
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
      toast.success("Desativado com sucesso!");
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
      dismissalCost: null,
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
      toast.success("Reativado com sucesso!");
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
      toast.success("Excluído com sucesso!");
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

  const currentTabConfig = TABS.find((t) => t.type === activeTab)!;

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Pessoas</h1>
        </div>

        {/* Summary pills */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Colaboradores Ativos</p>
            <p className="text-xl font-bold text-foreground">{activeCounts.colaborador}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Sócios Ativos</p>
            <p className="text-xl font-bold text-foreground">{activeCounts.socio}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Prestadores Ativos</p>
            <p className="text-xl font-bold text-foreground">{activeCounts.prestador}</p>
          </div>
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 shadow-sm">
            <p className="text-xs text-primary">Total Geral</p>
            <p className="text-xl font-bold text-primary">{totalActive}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.type;
            return (
              <button
                key={tab.type}
                onClick={() => setActiveTab(tab.type)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isActive ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground"}`}>
                  {activeCounts[tab.type]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab actions */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Exibindo {displayList.length} {showInactive ? "inativo(s)" : "ativo(s)"}
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactiveByTab((prev) => ({ ...prev, [activeTab]: !prev[activeTab] }))}
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
                {currentTabConfig.addLabel}
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
                {showInactive ? `Nenhum ${personTypeLabels[activeTab].toLowerCase()} inativo` : `Nenhum ${personTypeLabels[activeTab].toLowerCase()} cadastrado`}
              </p>
              {!showInactive && (
                <p className="text-sm">Clique em "{currentTabConfig.addLabel}" para começar</p>
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
                  {showInactive && <TableHead>Custo</TableHead>}
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
                      {showInactive && (
                        <TableCell>
                          {lastDismissal?.dismissalCost != null
                            ? `R$ ${lastDismissal.dismissalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </TableCell>
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
        defaultPersonType={dialogType}
        lockPersonType
      />

      {/* Deactivation Modal */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Desativar</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Nome: <span className="font-medium text-foreground">{deactivateTarget?.nome_completo}</span>
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
            <div className="grid gap-2">
              <Label>Custo da Demissão (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={deactivateCost}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d,\.]/g, "");
                  setDeactivateCost(raw);
                }}
              />
              {deactivateCost !== "" && !isCostValid && (
                <p className="text-sm text-destructive">Informe um valor válido</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmDeactivate}
                disabled={!deactivateDate || !deactivateReason || !isCostValid || (!!deactivateTarget && deactivateDate < deactivateTarget.data_admissao)}
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
            <DialogTitle className="text-xl font-bold">Reativar</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Nome: <span className="font-medium text-foreground">{reactivateTarget?.nome_completo}</span>
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
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente este registro? Esta ação não pode ser desfeita.
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
