import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Brain, History, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

type EmploymentPeriod = {
  admissionDate: string;
  dismissalDate: string | null;
  dismissalReason: string | null;
  dismissalCost: number | null;
};

type PersonType = "colaborador" | "socio" | "prestador";

type Person = {
  id: string;
  nome_completo: string;
  setor: string;
  cargo: string;
  data_admissao: string;
  status: string;
  employment_periods: EmploymentPeriod[];
  person_type: PersonType;
};

type ProfileKey = "analista" | "planejador" | "executor" | "comunicador";

type Mapping = {
  id: string;
  person_id: string;
  person_name: string;
  person_sector: string;
  person_type: PersonType;
  mapping_date: string;
  cycle_number: number;
  analista: number;
  planejador: number;
  executor: number;
  comunicador: number;
  dominant_profile: ProfileKey;
  notes: string | null;
};

const personTypeLabels: Record<PersonType, string> = {
  colaborador: "Colaborador",
  socio: "Sócio",
  prestador: "Prestador",
};

const PROFILES: { key: ProfileKey; label: string; color: string }[] = [
  { key: "analista", label: "Analista", color: "#3B82F6" },
  { key: "planejador", label: "Planejador", color: "#8B5CF6" },
  { key: "executor", label: "Executor", color: "#EF4444" },
  { key: "comunicador", label: "Comunicador", color: "#F59E0B" },
];

const profileMap: Record<ProfileKey, { label: string; color: string }> = Object.fromEntries(
  PROFILES.map((p) => [p.key, { label: p.label, color: p.color }]),
) as Record<ProfileKey, { label: string; color: string }>;

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1 + months, d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function diffDays(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86400000);
}

function currentAdmission(p: Person): string {
  const periods = Array.isArray(p.employment_periods) ? p.employment_periods : [];
  const open = [...periods].reverse().find((pe) => !pe.dismissalDate);
  return open?.admissionDate || p.data_admissao;
}

type StatusKey = "atrasado" | "semana" | "30" | "60" | "90" | "emdia";

const STATUS_DEF: Record<StatusKey, { label: string; badge: string; dot: string }> = {
  atrasado: { label: "Atrasado", badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  semana: { label: "Esta Semana", badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  "30": { label: "Próximos 30 dias", badge: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-500" },
  "60": { label: "Próximos 60 dias", badge: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-400" },
  "90": { label: "Próximos 90 dias", badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  emdia: { label: "Em Dia", badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
};

function endOfWeekISO(iso: string): string {
  // ISO week ending on Sunday
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0=Sun..6=Sat
  const daysUntilSunday = (7 - day) % 7;
  date.setDate(date.getDate() + daysUntilSunday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function classifyStatus(nextISO: string): StatusKey {
  const today = todayISO();
  const days = diffDays(today, nextISO);
  if (days < 0) return "atrasado";
  const weekEnd = endOfWeekISO(today);
  if (nextISO <= weekEnd) return "semana";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  if (days <= 90) return "90";
  return "emdia";
}

function ordinalCycle(n: number): string {
  return `${n}º Mapeamento`;
}

function dominant(profiles: Record<ProfileKey, number>): ProfileKey {
  return (Object.keys(profiles) as ProfileKey[]).reduce((a, b) => (profiles[a] >= profiles[b] ? a : b));
}

// Radar chart for behavioral profiles
function RadarProfileChart({
  profiles,
  size = "md",
}: {
  profiles: Record<ProfileKey, number>;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? 100 : size === "lg" ? 320 : 200;
  const showLabels = size !== "sm";
  const fontSize = size === "lg" ? 12 : 10;

  const data = PROFILES.map((p) => ({
    profile: p.label,
    value: profiles[p.key] || 0,
    color: p.color,
  }));

  return (
    <div style={{ width: dim, height: dim }} className="shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="75%" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <PolarGrid stroke="#E5E7EB" gridType="polygon" />
          <PolarAngleAxis
            dataKey="profile"
            tick={
              showLabels
                ? ({ payload, x, y, textAnchor }: any) => {
                    const item = data.find((d) => d.profile === payload.value);
                    return (
                      <g>
                        <text
                          x={x}
                          y={y}
                          textAnchor={textAnchor}
                          fontSize={fontSize}
                          fontWeight={700}
                          fill={item?.color || "#111827"}
                        >
                          {payload.value}
                        </text>
                        <text
                          x={x}
                          y={y + fontSize + 2}
                          textAnchor={textAnchor}
                          fontSize={fontSize - 1}
                          fontWeight={600}
                          fill="#374151"
                        >
                          {item?.value ?? 0}%
                        </text>
                      </g>
                    );
                  }
                : false
            }
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
            tickCount={5}
          />
          <Radar
            dataKey="value"
            stroke="#7C3AED"
            strokeWidth={2}
            fill="#7C3AED"
            fillOpacity={0.3}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProfileBadge({ profile }: { profile: ProfileKey }) {
  const p = profileMap[profile];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: p.color }}
    >
      {p.label}
    </span>
  );
}

function TypeBadge({ type }: { type: PersonType }) {
  return (
    <Badge variant="outline" className="text-xs">
      {personTypeLabels[type]}
    </Badge>
  );
}

const ALL_STATUSES: StatusKey[] = ["atrasado", "semana", "30", "60", "90", "emdia"];

export default function MapeamentoComportamental() {
  const [people, setPeople] = useState<Person[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<Set<StatusKey>>(new Set(ALL_STATUSES));
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lockedPersonId, setLockedPersonId] = useState<string | null>(null);
  const [formPersonId, setFormPersonId] = useState<string>("");
  const [formDate, setFormDate] = useState<string>(todayISO());
  const [formAnalista, setFormAnalista] = useState<number>(25);
  const [formPlanejador, setFormPlanejador] = useState<number>(25);
  const [formExecutor, setFormExecutor] = useState<number>(25);
  const [formComunicador, setFormComunicador] = useState<number>(25);
  const [formNotes, setFormNotes] = useState<string>("");

  const [deleteTarget, setDeleteTarget] = useState<Mapping | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: pData, error: pErr }, { data: mData, error: mErr }] = await Promise.all([
      supabase.from("colaboradores").select("*").order("nome_completo"),
      supabase.from("behavioral_mappings").select("*").order("mapping_date", { ascending: false }),
    ]);
    if (pErr) toast.error("Erro ao carregar pessoas");
    if (mErr) toast.error("Erro ao carregar mapeamentos");
    setPeople((pData as any) || []);
    setMappings((mData as any) || []);
    setLoading(false);
  }

  // Per-person mappings filtered by current employment period (admissions onwards)
  const mappingsByPerson = useMemo(() => {
    const map = new Map<string, Mapping[]>();
    for (const m of mappings) {
      const arr = map.get(m.person_id) || [];
      arr.push(m);
      map.set(m.person_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.mapping_date < b.mapping_date ? 1 : -1));
    }
    return map;
  }, [mappings]);

  function nextMappingDateFor(person: Person): string {
    const adm = currentAdmission(person);
    const all = mappingsByPerson.get(person.id) || [];
    // only consider mappings from current cycle (>= admission date)
    const currentCycle = all.filter((m) => m.mapping_date >= adm);
    if (currentCycle.length === 0) return addDaysISO(adm, 7);
    const latest = currentCycle[0]; // sorted desc
    return addMonthsISO(latest.mapping_date, 6);
  }

  function cycleNumberFor(person: Person, atDate: string): number {
    const adm = currentAdmission(person);
    const all = mappingsByPerson.get(person.id) || [];
    const currentCycle = all
      .filter((m) => m.mapping_date >= adm && (!editingId || m.id !== editingId))
      .filter((m) => m.mapping_date <= atDate);
    return currentCycle.length + 1;
  }

  function currentProfileFor(personId: string): ProfileKey | null {
    const arr = mappingsByPerson.get(personId);
    if (!arr || arr.length === 0) return null;
    return arr[0].dominant_profile;
  }

  // Section 1 rows
  const upcomingRows = useMemo(() => {
    const activePeople = people.filter((p) => p.status === "active");
    return activePeople
      .map((p) => {
        const next = nextMappingDateFor(p);
        const status = classifyStatus(next);
        const cycle = cycleNumberFor(p, todayISO());
        const dom = currentProfileFor(p.id);
        return { person: p, next, status, cycle, dominant: dom };
      })
      .filter((r) => statusFilter.has(r.status))
      .sort((a, b) => (a.next < b.next ? -1 : 1));
  }, [people, mappingsByPerson, statusFilter]);

  // Section 2 rows
  const historyRows = useMemo(() => {
    let list = mappings;
    if (historyFilter !== "all") list = list.filter((m) => m.person_id === historyFilter);
    return list;
  }, [mappings, historyFilter]);

  const total = formAnalista + formPlanejador + formExecutor + formComunicador;
  const totalValid = total === 100;

  function resetForm() {
    setEditingId(null);
    setLockedPersonId(null);
    setFormPersonId("");
    setFormDate(todayISO());
    setFormAnalista(25);
    setFormPlanejador(25);
    setFormExecutor(25);
    setFormComunicador(25);
    setFormNotes("");
  }

  function openRegister(personId?: string) {
    resetForm();
    if (personId) {
      setFormPersonId(personId);
      setLockedPersonId(personId);
    }
    setDialogOpen(true);
  }

  function openEdit(m: Mapping) {
    setEditingId(m.id);
    setLockedPersonId(m.person_id);
    setFormPersonId(m.person_id);
    setFormDate(m.mapping_date);
    setFormAnalista(Number(m.analista));
    setFormPlanejador(Number(m.planejador));
    setFormExecutor(Number(m.executor));
    setFormComunicador(Number(m.comunicador));
    setFormNotes(m.notes || "");
    setDialogOpen(true);
  }

  const selectedPerson = people.find((p) => p.id === formPersonId);
  const formAdmission = selectedPerson ? currentAdmission(selectedPerson) : "";
  const formCycle = selectedPerson ? cycleNumberFor(selectedPerson, formDate || todayISO()) : 1;

  function validateForm(): string | null {
    if (!formPersonId) return "Selecione uma pessoa";
    if (!formDate) return "Selecione a data do mapeamento";
    if (formDate > todayISO()) return "A data não pode ser futura";
    if (selectedPerson && formDate < currentAdmission(selectedPerson))
      return "A data não pode ser anterior à admissão";
    if (!totalValid) return "A soma dos perfis deve ser exatamente 100%";
    if (formNotes.length > 500) return "Observações com mais de 500 caracteres";
    return null;
  }

  async function handleSave() {
    const err = validateForm();
    if (err) {
      toast.error(err);
      return;
    }
    if (!selectedPerson) return;
    const profilesObj: Record<ProfileKey, number> = {
      analista: formAnalista,
      planejador: formPlanejador,
      executor: formExecutor,
      comunicador: formComunicador,
    };
    const dom = dominant(profilesObj);

    const payload = {
      person_id: selectedPerson.id,
      person_name: selectedPerson.nome_completo,
      person_sector: selectedPerson.setor,
      person_type: selectedPerson.person_type,
      mapping_date: formDate,
      cycle_number: formCycle,
      analista: formAnalista,
      planejador: formPlanejador,
      executor: formExecutor,
      comunicador: formComunicador,
      dominant_profile: dom,
      notes: formNotes,
    };

    if (editingId) {
      const { error } = await supabase.from("behavioral_mappings").update(payload).eq("id", editingId);
      if (error) {
        toast.error("Erro ao atualizar mapeamento");
        return;
      }
      toast.success("Mapeamento atualizado");
    } else {
      const { error } = await supabase.from("behavioral_mappings").insert(payload);
      if (error) {
        toast.error("Erro ao registrar mapeamento");
        return;
      }
      toast.success("Mapeamento registrado");
    }
    setDialogOpen(false);
    resetForm();
    fetchAll();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("behavioral_mappings").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Erro ao excluir mapeamento");
      return;
    }
    toast.success("Mapeamento excluído");
    setDeleteTarget(null);
    fetchAll();
  }

  function toggleStatus(s: StatusKey) {
    const next = new Set(statusFilter);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setStatusFilter(next);
  }

  return (
    <div className="min-h-full bg-muted/30 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Mapeamento Comportamental
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe os perfis comportamentais e os ciclos de mapeamento das pessoas.
          </p>
        </div>
        <Button onClick={() => openRegister()} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1" />
          Registrar Mapeamento
        </Button>
      </div>

      {/* SECTION 1 */}
      <div className="bg-card rounded-lg border shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Próximos Mapeamentos</h2>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {ALL_STATUSES.map((s) => {
            const def = STATUS_DEF[s];
            const active = statusFilter.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active ? def.badge : "bg-muted text-muted-foreground border-transparent opacity-60",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", def.dot)} />
                {def.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : upcomingRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum mapeamento encontrado para os filtros selecionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Data de Admissão</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Próximo Mapeamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Perfil Atual</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingRows.map(({ person, next, status, cycle, dominant: dom }) => {
                  const def = STATUS_DEF[status];
                  const adm = currentAdmission(person);
                  return (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">{person.nome_completo}</TableCell>
                      <TableCell><TypeBadge type={person.person_type} /></TableCell>
                      <TableCell>{person.setor}</TableCell>
                      <TableCell>{person.cargo}</TableCell>
                      <TableCell>{formatDate(adm)}</TableCell>
                      <TableCell>{ordinalCycle(cycle)}</TableCell>
                      <TableCell>{formatDate(next)}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", def.badge)}>
                          {def.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {dom ? <ProfileBadge profile={dom} /> : <span className="text-xs text-muted-foreground">Sem mapeamento</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => openRegister(person.id)} className="bg-primary hover:bg-primary/90">
                          Registrar Mapeamento
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* SECTION 2 */}
      <div className="bg-card rounded-lg border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Histórico de Mapeamentos</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="w-72">
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as pessoas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as pessoas</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome_completo} — {p.setor} — {personTypeLabels[p.person_type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-muted-foreground">
            {historyRows.length} mapeamento{historyRows.length === 1 ? "" : "s"} registrado{historyRows.length === 1 ? "" : "s"}
          </span>
        </div>

        {historyFilter !== "all" && historyRows.length > 0 && (
          <div className="mb-6 flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Perfil mais recente — {historyRows[0].person_name} ({formatDate(historyRows[0].mapping_date)})
            </p>
            <RadarProfileChart
              size="lg"
              profiles={{
                analista: Number(historyRows[0].analista),
                planejador: Number(historyRows[0].planejador),
                executor: Number(historyRows[0].executor),
                comunicador: Number(historyRows[0].comunicador),
              }}
            />
          </div>
        )}

        {historyRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum mapeamento registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Analista</TableHead>
                  <TableHead>Planejador</TableHead>
                  <TableHead>Executor</TableHead>
                  <TableHead>Comunicador</TableHead>
                  <TableHead>Perfil Dominante</TableHead>
                  <TableHead>Visual</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.person_name}</TableCell>
                    <TableCell><TypeBadge type={m.person_type} /></TableCell>
                    <TableCell>{m.person_sector}</TableCell>
                    <TableCell>{formatDate(m.mapping_date)}</TableCell>
                    <TableCell>{ordinalCycle(m.cycle_number)}</TableCell>
                    <TableCell>{Number(m.analista)}%</TableCell>
                    <TableCell>{Number(m.planejador)}%</TableCell>
                    <TableCell>{Number(m.executor)}%</TableCell>
                    <TableCell>{Number(m.comunicador)}%</TableCell>
                    <TableCell><ProfileBadge profile={m.dominant_profile} /></TableCell>
                    <TableCell>
                      <RadarProfileChart
                        size="sm"
                        profiles={{
                          analista: Number(m.analista),
                          planejador: Number(m.planejador),
                          executor: Number(m.executor),
                          comunicador: Number(m.comunicador),
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(m)} aria-label="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* REGISTER / EDIT MODAL */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Mapeamento Comportamental" : "Registrar Mapeamento Comportamental"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Pessoa *</Label>
              <Select
                value={formPersonId}
                onValueChange={setFormPersonId}
                disabled={!!lockedPersonId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma pessoa" />
                </SelectTrigger>
                <SelectContent>
                  {people
                    .filter((p) => p.status === "active" || p.id === formPersonId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome_completo} — {p.setor} — {personTypeLabels[p.person_type]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data do Mapeamento *</Label>
                <Input
                  type="date"
                  value={formDate}
                  max={todayISO()}
                  min={formAdmission || undefined}
                  onChange={(e) => setFormDate(e.target.value)}
                />
                {selectedPerson && formDate && formDate > todayISO() && (
                  <p className="text-xs text-destructive mt-1">A data não pode ser futura</p>
                )}
                {selectedPerson && formDate && formDate < formAdmission && (
                  <p className="text-xs text-destructive mt-1">A data não pode ser anterior à admissão</p>
                )}
              </div>
              <div>
                <Label>Ciclo</Label>
                <Input value={ordinalCycle(formCycle)} readOnly className="bg-muted" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Distribuição de Perfis *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    { key: "analista", label: "Analista", color: "#3B82F6", value: formAnalista, setter: setFormAnalista },
                    { key: "planejador", label: "Planejador", color: "#8B5CF6", value: formPlanejador, setter: setFormPlanejador },
                    { key: "executor", label: "Executor", color: "#EF4444", value: formExecutor, setter: setFormExecutor },
                    { key: "comunicador", label: "Comunicador", color: "#F59E0B", value: formComunicador, setter: setFormComunicador },
                  ] as const
                ).map((p) => (
                  <div key={p.key} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <Label className="w-28 text-sm" style={{ color: p.color }}>{p.label}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={p.value}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0)));
                        p.setter(v);
                      }}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm">
                <span className={cn("font-semibold", totalValid ? "text-green-600" : "text-destructive")}>
                  Total: {total}% de 100%
                </span>
                {!totalValid && total < 100 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Faltam {100 - total}% para completar 100%
                  </span>
                )}
                {!totalValid && total > 100 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Total excede 100% em {total - 100}%
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-center py-2">
              <RadarProfileChart
                size="md"
                profiles={{
                  analista: formAnalista,
                  planejador: formPlanejador,
                  executor: formExecutor,
                  comunicador: formComunicador,
                }}
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações sobre o mapeamento..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{formNotes.length}/500</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!totalValid || !formPersonId} className="bg-primary hover:bg-primary/90">
              Salvar Mapeamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mapeamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O próximo mapeamento será recalculado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
