import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCheck, History, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type PersonType = "colaborador" | "socio" | "prestador";
const personTypeLabel: Record<PersonType, string> = {
  colaborador: "Colaborador",
  socio: "Sócio",
  prestador: "Prestador",
};

type EmploymentPeriod = {
  admissionDate: string;
  dismissalDate: string | null;
};

type Person = {
  id: string;
  nome_completo: string;
  setor: string;
  cargo: string;
  data_admissao: string;
  status: string;
  person_type: PersonType;
  employment_periods: EmploymentPeriod[];
};

type Evaluation = {
  id: string;
  evaluated_id: string;
  evaluated_name: string;
  evaluated_sector: string;
  evaluated_type: PersonType;
  evaluator_id: string;
  evaluator_name: string;
  evaluation_date: string;
  cycle_number: number;
  percentage_achieved: number;
  notes: string | null;
};

type StatusKey = "atrasado" | "mes" | "30" | "60" | "90" | "emdia";
const STATUS_META: Record<StatusKey, { label: string; classes: string; dot: string }> = {
  atrasado: { label: "Atrasado", classes: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  mes:      { label: "Este Mês", classes: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  "30":     { label: "30 dias", classes: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
  "60":     { label: "60 dias", classes: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  "90":     { label: "90 dias", classes: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  emdia:    { label: "Em Dia", classes: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
};

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + months);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diffDays(target: string, base: string): number {
  const [y1, m1, d1] = target.split("-").map(Number);
  const [y2, m2, d2] = base.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((a - b) / 86400000);
}

function classifyStatus(nextDate: string): StatusKey {
  const today = todayISO();
  const days = diffDays(nextDate, today);
  if (days < 0) return "atrasado";
  const [ty, tm] = today.split("-").map(Number);
  const [ny, nm] = nextDate.split("-").map(Number);
  if (ty === ny && tm === nm) return "mes";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  if (days <= 90) return "90";
  return "emdia";
}

function currentAdmission(p: Person): string {
  const periods = Array.isArray(p.employment_periods) ? p.employment_periods : [];
  const open = [...periods].reverse().find((pe) => !pe.dismissalDate);
  return open?.admissionDate || p.data_admissao;
}

function ordinal(n: number): string {
  return `${n}ª Avaliação`;
}

function percentColor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

export default function AvaliacaoDesempenho() {
  const [people, setPeople] = useState<Person[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter toggles for section 1
  const [filters, setFilters] = useState<Record<StatusKey, boolean>>({
    atrasado: true, mes: true, "30": true, "60": true, "90": true, emdia: true,
  });

  // History filter
  const [historyPersonId, setHistoryPersonId] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lockedEvaluatedId, setLockedEvaluatedId] = useState<string | null>(null);
  const [formEvaluatedId, setFormEvaluatedId] = useState("");
  const [formEvaluatorId, setFormEvaluatorId] = useState("");
  const [formDate, setFormDate] = useState(todayISO());
  const [formPct, setFormPct] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: pData }, { data: eData }] = await Promise.all([
      supabase.from("colaboradores").select("*").order("nome_completo"),
      supabase.from("evaluations").select("*").order("evaluation_date", { ascending: false }),
    ]);
    setPeople((pData as unknown as Person[]) || []);
    setEvaluations((eData as unknown as Evaluation[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const evalsByPerson = useMemo(() => {
    const map = new Map<string, Evaluation[]>();
    for (const e of evaluations) {
      const arr = map.get(e.evaluated_id) || [];
      arr.push(e);
      map.set(e.evaluated_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.evaluation_date.localeCompare(b.evaluation_date));
    }
    return map;
  }, [evaluations]);

  const computeNextDate = (personId: string, admission: string): string => {
    const list = evalsByPerson.get(personId) || [];
    if (list.length === 0) return addMonths(admission, 9);
    return addMonths(list[list.length - 1].evaluation_date, 6);
  };

  const nextCycleNumber = (personId: string): number => {
    const list = evalsByPerson.get(personId) || [];
    return list.length + 1;
  };

  // Section 1 rows
  const upcomingRows = useMemo(() => {
    const rows = people
      .filter((p) => p.status === "active")
      .map((p) => {
        const adm = currentAdmission(p);
        const nextDate = computeNextDate(p.id, adm);
        const cycle = nextCycleNumber(p.id);
        const status = classifyStatus(nextDate);
        return { person: p, admission: adm, nextDate, cycle, status };
      })
      .filter((r) => filters[r.status])
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    return rows;
  }, [people, evalsByPerson, filters]);

  // Section 2 rows
  const historyRows = useMemo(() => {
    const list = historyPersonId === "all"
      ? evaluations
      : evaluations.filter((e) => e.evaluated_id === historyPersonId);
    return [...list].sort((a, b) => b.evaluation_date.localeCompare(a.evaluation_date));
  }, [evaluations, historyPersonId]);

  const activePeople = useMemo(() => people.filter((p) => p.status === "active"), [people]);

  const openRegister = (personId?: string) => {
    setEditingId(null);
    setLockedEvaluatedId(personId || null);
    setFormEvaluatedId(personId || "");
    setFormEvaluatorId("");
    setFormDate(todayISO());
    setFormPct("");
    setFormNotes("");
    setDialogOpen(true);
  };

  const openEdit = (e: Evaluation) => {
    setEditingId(e.id);
    setLockedEvaluatedId(e.evaluated_id);
    setFormEvaluatedId(e.evaluated_id);
    setFormEvaluatorId(e.evaluator_id);
    setFormDate(e.evaluation_date);
    setFormPct(String(e.percentage_achieved));
    setFormNotes(e.notes || "");
    setDialogOpen(true);
  };

  const formCycleDisplay = useMemo(() => {
    if (!formEvaluatedId) return "—";
    if (editingId) {
      const ev = evaluations.find((x) => x.id === editingId);
      return ev ? ordinal(ev.cycle_number) : "—";
    }
    return ordinal(nextCycleNumber(formEvaluatedId));
  }, [formEvaluatedId, editingId, evaluations, evalsByPerson]);

  const handleSave = async () => {
    if (!formEvaluatedId) return toast.error("Selecione o avaliado");
    if (!formEvaluatorId) return toast.error("Selecione o avaliador");
    if (formEvaluatorId === formEvaluatedId) return toast.error("O avaliador não pode ser o próprio avaliado");
    if (!formDate) return toast.error("Informe a data");
    if (formDate > todayISO()) return toast.error("A data da avaliação não pode ser futura");
    const evaluated = people.find((p) => p.id === formEvaluatedId);
    const evaluator = people.find((p) => p.id === formEvaluatorId);
    if (!evaluated || !evaluator) return toast.error("Pessoa não encontrada");
    const adm = currentAdmission(evaluated);
    if (formDate < adm) return toast.error("A data não pode ser anterior à admissão do avaliado");
    const pct = Number(formPct);
    if (isNaN(pct) || pct < 0 || pct > 100) return toast.error("Informe um valor entre 0 e 100");

    if (editingId) {
      const existing = evaluations.find((e) => e.id === editingId);
      const { error } = await supabase
        .from("evaluations")
        .update({
          evaluator_id: evaluator.id,
          evaluator_name: evaluator.nome_completo,
          evaluation_date: formDate,
          percentage_achieved: pct,
          notes: formNotes,
          cycle_number: existing?.cycle_number ?? 1,
        })
        .eq("id", editingId);
      if (error) return toast.error("Erro: " + error.message);
      toast.success("Avaliação atualizada!");
    } else {
      const cycle = nextCycleNumber(formEvaluatedId);
      const { error } = await supabase.from("evaluations").insert({
        evaluated_id: evaluated.id,
        evaluated_name: evaluated.nome_completo,
        evaluated_sector: evaluated.setor,
        evaluated_type: evaluated.person_type || "colaborador",
        evaluator_id: evaluator.id,
        evaluator_name: evaluator.nome_completo,
        evaluation_date: formDate,
        cycle_number: cycle,
        percentage_achieved: pct,
        notes: formNotes,
      });
      if (error) return toast.error("Erro: " + error.message);
      toast.success("Avaliação registrada!");
    }
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("evaluations").delete().eq("id", deleteId);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Avaliação excluída!"); fetchAll(); }
    setDeleteId(null);
  };

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Avaliação de Desempenho</h1>
          </div>
          <Button onClick={() => openRegister()} className="gap-2">
            <Plus className="h-4 w-4" /> Registrar Avaliação
          </Button>
        </div>

        {/* SECTION 1 */}
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-6 py-4">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Próximas Avaliações</h2>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-border px-6 py-4">
            {(Object.keys(STATUS_META) as StatusKey[]).map((k) => {
              const meta = STATUS_META[k];
              const active = filters[k];
              return (
                <button
                  key={k}
                  onClick={() => setFilters((f) => ({ ...f, [k]: !f[k] }))}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active ? meta.classes : "bg-muted text-muted-foreground border-transparent opacity-60"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Carregando...</div>
          ) : upcomingRows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Nenhuma avaliação encontrada para os filtros selecionados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Data de Admissão</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Próxima Avaliação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingRows.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <TableRow key={r.person.id}>
                      <TableCell className="font-medium">{r.person.nome_completo}</TableCell>
                      <TableCell>
                        <span className="inline-block rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          {personTypeLabel[r.person.person_type || "colaborador"]}
                        </span>
                      </TableCell>
                      <TableCell>{r.person.setor}</TableCell>
                      <TableCell>{r.person.cargo}</TableCell>
                      <TableCell>{formatBR(r.admission)}</TableCell>
                      <TableCell>{ordinal(r.cycle)}</TableCell>
                      <TableCell>{formatBR(r.nextDate)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.classes}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" onClick={() => openRegister(r.person.id)} className="h-7 gap-1">
                          <Plus className="h-3.5 w-3.5" /> Registrar Avaliação
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        {/* SECTION 2 */}
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-6 py-4">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Histórico de Avaliações</h2>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Filtrar por:</Label>
              <Select value={historyPersonId} onValueChange={setHistoryPersonId}>
                <SelectTrigger className="w-[320px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os colaboradores</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome_completo} — {p.setor} — {personTypeLabel[p.person_type || "colaborador"]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">{historyRows.length} avaliações registradas</span>
          </div>

          {historyRows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Nenhuma avaliação registrada ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Avaliado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Avaliador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>% Atingido</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.evaluated_name}</TableCell>
                    <TableCell>
                      <span className="inline-block rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                        {personTypeLabel[e.evaluated_type] || e.evaluated_type}
                      </span>
                    </TableCell>
                    <TableCell>{e.evaluated_sector}</TableCell>
                    <TableCell>{e.evaluator_name}</TableCell>
                    <TableCell>{formatBR(e.evaluation_date)}</TableCell>
                    <TableCell>{ordinal(e.cycle_number)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${percentColor(Number(e.percentage_achieved))}`} />
                        {Number(e.percentage_achieved).toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </main>

      {/* Register/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Avaliação" : "Registrar Avaliação de Desempenho"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Avaliado *</Label>
              <Select
                value={formEvaluatedId}
                onValueChange={setFormEvaluatedId}
                disabled={!!lockedEvaluatedId || !!editingId}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o avaliado" /></SelectTrigger>
                <SelectContent>
                  {activePeople.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome_completo} — {p.setor} — {personTypeLabel[p.person_type || "colaborador"]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Avaliador *</Label>
              <Select value={formEvaluatorId} onValueChange={setFormEvaluatorId}>
                <SelectTrigger><SelectValue placeholder="Selecione o avaliador" /></SelectTrigger>
                <SelectContent>
                  {activePeople
                    .filter((p) => p.id !== formEvaluatedId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome_completo} — {p.setor} — {personTypeLabel[p.person_type || "colaborador"]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data da Avaliação *</Label>
                <Input type="date" max={todayISO()} value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div>
                <Label>% Atingido *</Label>
                <Input type="number" min={0} max={100} value={formPct} onChange={(e) => setFormPct(e.target.value)} placeholder="0 a 100" />
              </div>
            </div>
            <div>
              <Label>Ciclo</Label>
              <Input value={formCycleDisplay} disabled readOnly />
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar Avaliação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
