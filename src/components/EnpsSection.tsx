import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, ChevronDown, ChevronUp, Smile } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Cell, LabelList, Legend,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

type Survey = {
  id: string;
  month: number;
  year: number;
  label: string;
  survey_name: string;
  votes: Record<string, number>;
  total_responses: number;
  active_collaborators_at_time: number;
  created_at: string;
};

const MONTH_NAMES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function scoreColor(score: number) {
  if (score <= 6) return "#DC2626";
  if (score <= 8) return "#9CA3AF";
  return "#16A34A";
}

function classifyEnps(enps: number): { label: string; color: string } {
  if (enps >= 75) return { label: "Excelente", color: "#16A34A" };
  if (enps >= 50) return { label: "Muito Bom", color: "#65A30D" };
  if (enps >= 25) return { label: "Bom", color: "#CA8A04" };
  if (enps >= 0) return { label: "Razoável", color: "#EA580C" };
  return { label: "Crítico", color: "#DC2626" };
}

function formatBR(n: number, decimals = 1) {
  return n.toFixed(decimals).replace(".", ",");
}
function formatSigned(n: number, decimals = 1) {
  const v = formatBR(Math.abs(n), decimals);
  return (n >= 0 ? "+" : "-") + v;
}
function buildLabel(month: number, year: number) {
  return `${MONTH_NAMES_SHORT[month - 1]}/${year}`;
}

function computeMetrics(votes: Record<string, number>, activeCount: number) {
  let total = 0, sumScore = 0, det = 0, neu = 0, prom = 0;
  for (const s of SCORES) {
    const v = Number(votes[String(s)] || 0);
    total += v;
    sumScore += v * s;
    if (s <= 6) det += v;
    else if (s <= 8) neu += v;
    else prom += v;
  }
  const pctDet = total > 0 ? (det / total) * 100 : 0;
  const pctNeu = total > 0 ? (neu / total) * 100 : 0;
  const pctProm = total > 0 ? (prom / total) * 100 : 0;
  const enps = total > 0 ? pctProm - pctDet : 0;
  const avg = total > 0 ? sumScore / total : 0;
  const adherence = activeCount > 0 ? (total / activeCount) * 100 : 0;
  return { total, det, neu, prom, pctDet, pctNeu, pctProm, enps, avg, adherence };
}

const sb = supabase as any;

interface Props { activeCount: number; }

export default function EnpsSection({ activeCount }: Props) {
  const { toast } = useToast();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Survey | null>(null);
  const now = new Date();
  const [formMonth, setFormMonth] = useState<number>(now.getMonth() + 1);
  const [formYear, setFormYear] = useState<number>(now.getFullYear());
  const [formSurveyName, setFormSurveyName] = useState<string>("");
  const [formVotes, setFormVotes] = useState<Record<string, number>>(
    Object.fromEntries(SCORES.map((s) => [String(s), 0])),
  );

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null);

  // Distribuição de Notas — selected survey id
  const [distSurveyId, setDistSurveyId] = useState<string | null>(null);

  const fetchSurveys = async () => {
    setLoading(true);
    const { data, error } = await sb.from("enpssurveys").select("*");
    if (error) {
      toast({ title: "Erro ao carregar pesquisas", description: error.message, variant: "destructive" });
    } else {
      setSurveys((data as Survey[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSurveys(); }, []);

  const sortedSurveys = useMemo(
    () => [...surveys].sort((a, b) => a.year - b.year || a.month - b.month),
    [surveys],
  );
  const sortedDesc = useMemo(() => [...sortedSurveys].reverse(), [sortedSurveys]);
  const lastSurvey = sortedSurveys[sortedSurveys.length - 1] || null;

  const openCreate = () => {
    setEditing(null);
    setFormMonth(now.getMonth() + 1);
    setFormYear(now.getFullYear());
    setFormSurveyName("");
    setFormVotes(Object.fromEntries(SCORES.map((s) => [String(s), 0])));
    setModalOpen(true);
  };

  const openEdit = (s: Survey) => {
    setEditing(s);
    setFormMonth(s.month);
    setFormYear(s.year);
    setFormSurveyName(s.survey_name || "");
    setFormVotes({ ...Object.fromEntries(SCORES.map((sc) => [String(sc), 0])), ...s.votes });
    setModalOpen(true);
  };

  const formMetrics = computeMetrics(
    formVotes,
    editing ? editing.active_collaborators_at_time : activeCount,
  );

  const isDuplicatePeriod = surveys.some(
    (s) => s.month === formMonth && s.year === formYear && s.id !== editing?.id,
  );

  const trimmedName = formSurveyName.trim();
  const isDuplicateName = surveys.some(
    (s) =>
      (s.survey_name || "").trim().toLowerCase() === trimmedName.toLowerCase() &&
      trimmedName.length > 0 &&
      s.id !== editing?.id,
  );

  const canSave =
    formMetrics.total > 0 &&
    !isDuplicatePeriod &&
    !isDuplicateName &&
    trimmedName.length > 0 &&
    trimmedName.length <= 100;

  const handleSave = async () => {
    if (!canSave) return;
    const payload = {
      month: formMonth,
      year: formYear,
      label: buildLabel(formMonth, formYear),
      survey_name: trimmedName,
      votes: formVotes,
      total_responses: formMetrics.total,
      active_collaborators_at_time: editing ? editing.active_collaborators_at_time : activeCount,
    };
    if (editing) {
      const { error } = await sb.from("enpssurveys").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      toast({ title: "Pesquisa atualizada" });
    } else {
      const { error } = await sb.from("enpssurveys").insert(payload);
      if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      toast({ title: "Pesquisa registrada" });
    }
    setModalOpen(false);
    fetchSurveys();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await sb.from("enpssurveys").delete().eq("id", deleteTarget.id);
    if (error) return toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    toast({ title: "Pesquisa excluída" });
    setDeleteTarget(null);
    fetchSurveys();
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // ---------- RENDER ----------

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">Carregando pesquisas...</div>;
  }

  const lastMetrics = lastSurvey
    ? computeMetrics(lastSurvey.votes, lastSurvey.active_collaborators_at_time)
    : null;
  const lastClass = lastMetrics ? classifyEnps(lastMetrics.enps) : null;

  // Selected survey for the distribution chart (defaults to most recent)
  const distSurvey =
    sortedDesc.find((s) => s.id === distSurveyId) || lastSurvey;

  const distData = distSurvey
    ? SCORES.map((s) => ({ score: String(s), value: Number(distSurvey.votes[String(s)] || 0) }))
    : [];

  const evolutionData = sortedSurveys.map((s) => {
    const m = computeMetrics(s.votes, s.active_collaborators_at_time);
    const fullName = s.survey_name || s.label;
    const shortName = fullName.length > 15 ? fullName.slice(0, 15) + "…" : fullName;
    return {
      label: shortName,
      fullName,
      period: s.label,
      enps: Number(m.enps.toFixed(1)),
      media: Number(m.avg.toFixed(2)),
      aderencia: Number(m.adherence.toFixed(1)),
      respostas: m.total,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smile className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">E-NPS</h2>
        </div>
        <Button onClick={openCreate} style={{ backgroundColor: "#7C3AED" }} className="text-white hover:opacity-90">
          + Adicionar Pesquisa
        </Button>
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground shadow-sm">
          Nenhuma pesquisa registrada. Clique em + Adicionar Pesquisa para começar.
        </div>
      ) : (
        <>
          {/* SECTION 1 — Última Pesquisa */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">Última Pesquisa</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* E-NPS */}
              <div className="rounded-xl border-l-4 border border-border bg-card p-5 shadow-sm" style={{ borderLeftColor: lastClass!.color }}>
                <p className="text-xs text-muted-foreground">E-NPS</p>
                <p className="mt-1 text-3xl font-bold" style={{ color: lastClass!.color }}>
                  {formatSigned(lastMetrics!.enps, 1)}
                </p>
                <p className="text-sm font-medium" style={{ color: lastClass!.color }}>{lastClass!.label}</p>
                <p className="mt-2 text-xs font-medium text-foreground">{lastSurvey!.survey_name || lastSurvey!.label}</p>
                {lastSurvey!.survey_name ? (
                  <p className="text-[11px] text-muted-foreground">{lastSurvey!.label}</p>
                ) : null}
              </div>
              {/* Média */}
              <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
                <p className="text-xs text-muted-foreground">Média das Notas</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{formatBR(lastMetrics!.avg, 2)}</p>
                <p className="mt-2 text-xs text-muted-foreground">Média ponderada</p>
              </div>
              {/* Total */}
              <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
                <p className="text-xs text-muted-foreground">Total de Respostas</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{lastMetrics!.total} respostas</p>
                <p className="mt-2 text-xs text-muted-foreground">{lastSurvey!.label}</p>
              </div>
              {/* Aderência */}
              <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
                <p className="text-xs text-muted-foreground">Aderência</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{formatBR(lastMetrics!.adherence, 1)}%</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {lastMetrics!.total} de {lastSurvey!.active_collaborators_at_time} colaboradores
                </p>
              </div>
            </div>

            {/* Distribution bar */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex h-6 w-full overflow-hidden rounded">
                <div style={{ width: `${lastMetrics!.pctDet}%`, backgroundColor: "#DC2626" }} />
                <div style={{ width: `${lastMetrics!.pctNeu}%`, backgroundColor: "#9CA3AF" }} />
                <div style={{ width: `${lastMetrics!.pctProm}%`, backgroundColor: "#16A34A" }} />
              </div>
              <div className="mt-3 flex justify-between text-xs font-medium">
                <span style={{ color: "#DC2626" }}>Detratores {formatBR(lastMetrics!.pctDet, 1)}%</span>
                <span style={{ color: "#6B7280" }}>Neutros {formatBR(lastMetrics!.pctNeu, 1)}%</span>
                <span style={{ color: "#16A34A" }}>Promotores {formatBR(lastMetrics!.pctProm, 1)}%</span>
              </div>
            </div>
          </div>

          {/* SECTION 2 — Distribuição de Notas */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">
                Distribuição de Notas{distSurvey ? ` — ${distSurvey.label}` : ""}
              </h3>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Pesquisa:</Label>
                <Select
                  value={distSurvey?.id ?? ""}
                  onValueChange={(v) => setDistSurveyId(v)}
                >
                  <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sortedDesc.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
                <XAxis dataKey="score" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {distData.map((d) => (
                    <Cell key={d.score} fill={scoreColor(Number(d.score))} />
                  ))}
                  <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "#374151" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* SECTION 3 — Evolução */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-foreground">Evolução do E-NPS</h3>
            {evolutionData.length < 2 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Adicione mais pesquisas para visualizar a evolução
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={evolutionData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any, name: string, item: any) => {
                      const p = item?.payload || {};
                      if (name === "E-NPS") return [formatSigned(Number(value), 1), "E-NPS"];
                      if (name === "Média") return [formatBR(Number(value), 2), "Média"];
                      return [value, name];
                    }}
                    labelFormatter={(label, payload) => {
                      const p: any = payload?.[0]?.payload;
                      if (!p) return label;
                      return `${label} · Aderência ${formatBR(p.aderencia, 1)}% · ${p.respostas} respostas`;
                    }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="#FCA5A5" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="enps" name="E-NPS" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="media" name="Média" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* SECTION 4 — Histórico */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                <span className="text-base font-semibold text-foreground">
                  {historyOpen ? "Ocultar" : `Ver histórico completo (${surveys.length} pesquisa${surveys.length !== 1 ? "s" : ""})`}
                </span>
                {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                {sortedDesc.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma pesquisa registrada</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead>Respostas</TableHead>
                        <TableHead>Aderência</TableHead>
                        <TableHead>Detratores</TableHead>
                        <TableHead>Neutros</TableHead>
                        <TableHead>Promotores</TableHead>
                        <TableHead>E-NPS</TableHead>
                        <TableHead>Média</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDesc.map((s) => {
                        const m = computeMetrics(s.votes, s.active_collaborators_at_time);
                        const c = classifyEnps(m.enps);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.label}</TableCell>
                            <TableCell>{m.total}</TableCell>
                            <TableCell>{formatBR(m.adherence, 1)}%</TableCell>
                            <TableCell>{m.det} ({formatBR(m.pctDet, 1)}%)</TableCell>
                            <TableCell>{m.neu} ({formatBR(m.pctNeu, 1)}%)</TableCell>
                            <TableCell>{m.prom} ({formatBR(m.pctProm, 1)}%)</TableCell>
                            <TableCell style={{ color: c.color, fontWeight: 600 }}>{formatSigned(m.enps, 1)}</TableCell>
                            <TableCell>{formatBR(m.avg, 2)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </>
      )}

      {/* Add/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Pesquisa E-NPS" : "Registrar Pesquisa E-NPS"}</DialogTitle>
            <DialogDescription>
              Distribua o número de respondentes em cada nota de 0 a 10.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Mês/Ano</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select value={String(formMonth)} onValueChange={(v) => setFormMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES_FULL.map((n, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(formYear)} onValueChange={(v) => setFormYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isDuplicatePeriod && (
                <p className="mt-2 text-xs text-destructive">
                  Já existe uma pesquisa registrada para este período
                </p>
              )}
            </div>

            <div>
              <Label className="mb-2 block">Distribuição de Notas</Label>
              <div className="grid grid-cols-11 gap-1.5">
                {SCORES.map((s) => (
                  <div key={s} className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{s}</span>
                    <Input
                      type="number"
                      min={0}
                      value={formVotes[String(s)] ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setFormVotes((prev) => ({ ...prev, [String(s)]: val }));
                      }}
                      className="h-9 px-1 text-center text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">Total de respostas: {formMetrics.total}</p>
              <p className="mt-1 text-xs" style={{ color: "#16A34A" }}>
                Promotores (9-10): {formMetrics.prom} pessoas ({formBR(formMetrics.pctProm)})
              </p>
              <p className="text-xs" style={{ color: "#6B7280" }}>
                Neutros (7-8): {formMetrics.neu} pessoas ({formBR(formMetrics.pctNeu)})
              </p>
              <p className="text-xs" style={{ color: "#DC2626" }}>
                Detratores (0-6): {formMetrics.det} pessoas ({formBR(formMetrics.pctDet)})
              </p>
              <p className="mt-2 font-medium">
                E-NPS estimado: {formatSigned(formMetrics.enps, 1)} · Média estimada: {formatBR(formMetrics.avg, 2)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              style={{ backgroundColor: canSave ? "#7C3AED" : undefined }}
              className="text-white hover:opacity-90"
            >
              Salvar Pesquisa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir pesquisa</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a pesquisa de {deleteTarget?.label}? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formBR(n: number) {
  return formatBR(n, 1) + "%";
}
