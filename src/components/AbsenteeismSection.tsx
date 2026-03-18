import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

const PIE_COLORS = [
  "hsl(263, 83%, 58%)",
  "hsl(220, 14%, 76%)",
  "hsl(263, 60%, 72%)",
  "hsl(340, 65%, 60%)",
  "hsl(200, 60%, 55%)",
  "hsl(150, 50%, 50%)",
];

const DEFAULT_REASONS = ["Atestado Médico", "Acidente de Trabalho", "Licença Maternidade"];

type Colaborador = {
  id: string;
  nome_completo: string;
  setor: string;
  status: string;
};

type Absence = {
  id: string;
  collaborator_id: string;
  collaborator_name: string;
  collaborator_sector: string;
  reason: string;
  start_date: string;
  end_date: string;
  total_hours: number;
};

/**
 * Calculate business hours between two datetimes.
 * Business hours: Mon–Fri, 08:00–18:00 (10h/day).
 */
function calcBusinessHours(startDt: Date, endDt: Date): number {
  if (endDt <= startDt) return 0;

  let totalMinutes = 0;
  const WORK_START = 8; // 08:00
  const WORK_END = 18;  // 18:00

  // Iterate day by day
  const cursor = new Date(startDt);
  while (cursor < endDt) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      // It's a weekday
      const dayStart = new Date(cursor);
      dayStart.setHours(WORK_START, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(WORK_END, 0, 0, 0);

      const effectiveStart = cursor > dayStart ? cursor : dayStart;
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      const periodEnd = endDt < nextDay ? endDt : nextDay;
      const effectiveEnd = periodEnd < dayEnd ? periodEnd : dayEnd;

      if (effectiveStart < effectiveEnd && effectiveStart < dayEnd && effectiveEnd > dayStart) {
        const clampedStart = effectiveStart < dayStart ? dayStart : effectiveStart;
        const clampedEnd = effectiveEnd > dayEnd ? dayEnd : effectiveEnd;
        if (clampedEnd > clampedStart) {
          totalMinutes += (clampedEnd.getTime() - clampedStart.getTime()) / 60000;
        }
      }
    }
    // Move to next day 00:00
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return Math.round(totalMinutes / 60 * 10) / 10; // 1 decimal
}

function formatDateTimeBR(isoStr: string) {
  const d = new Date(isoStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

function formatHoursBR(h: number) {
  return h.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export default function AbsenteeismSection({ activeColaboradores }: { activeColaboradores: Colaborador[] }) {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Absence | null>(null);
  const [listOpen, setListOpen] = useState(false);

  // Form state
  const [formCollaboratorId, setFormCollaboratorId] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formStartDate, setFormStartDate] = useState<Date | undefined>();
  const [formStartTime, setFormStartTime] = useState("08:00");
  const [formEndDate, setFormEndDate] = useState<Date | undefined>();
  const [formEndTime, setFormEndTime] = useState("18:00");
  const [customReasons, setCustomReasons] = useState<string[]>([]);
  const [addingReason, setAddingReason] = useState(false);
  const [newReason, setNewReason] = useState("");

  const allReasons = [...DEFAULT_REASONS, ...customReasons];

  const fetchAbsences = async () => {
    setLoading(true);
    const { data } = await supabase.from("absences").select("*").order("start_date", { ascending: false });
    setAbsences((data as Absence[]) || []);
    if (data) {
      const existing = new Set(DEFAULT_REASONS);
      const extras = [...new Set((data as Absence[]).map(a => a.reason).filter(r => !existing.has(r)))];
      setCustomReasons(extras);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAbsences(); }, []);

  // Build full datetime from date + time
  const buildDateTime = (date: Date | undefined, time: string): Date | null => {
    if (!date) return null;
    const [hh, mm] = time.split(":").map(Number);
    const dt = new Date(date);
    dt.setHours(hh, mm, 0, 0);
    return dt;
  };

  const startDateTime = buildDateTime(formStartDate, formStartTime);
  const endDateTime = buildDateTime(formEndDate, formEndTime);

  const dateError = startDateTime && endDateTime && endDateTime < startDateTime;

  const calcHours = useMemo(() => {
    if (!startDateTime || !endDateTime || endDateTime < startDateTime) return null;
    const hours = calcBusinessHours(startDateTime, endDateTime);
    return hours;
  }, [formStartDate, formStartTime, formEndDate, formEndTime]);

  const resetForm = () => {
    setFormCollaboratorId("");
    setFormReason("");
    setFormStartDate(undefined);
    setFormStartTime("08:00");
    setFormEndDate(undefined);
    setFormEndTime("18:00");
    setEditing(null);
  };

  const openAdd = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (a: Absence) => {
    setEditing(a);
    setFormCollaboratorId(a.collaborator_id);
    setFormReason(a.reason);
    const sd = new Date(a.start_date);
    const ed = new Date(a.end_date);
    setFormStartDate(sd);
    setFormStartTime(`${String(sd.getHours()).padStart(2, "0")}:${String(sd.getMinutes()).padStart(2, "0")}`);
    setFormEndDate(ed);
    setFormEndTime(`${String(ed.getHours()).padStart(2, "0")}:${String(ed.getMinutes()).padStart(2, "0")}`);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formCollaboratorId || !formReason || !startDateTime || !endDateTime || dateError || calcHours === null) return;
    const collab = activeColaboradores.find(c => c.id === formCollaboratorId);
    if (!collab && !editing) return;

    const record = {
      collaborator_id: formCollaboratorId,
      collaborator_name: collab?.nome_completo || editing?.collaborator_name || "",
      collaborator_sector: collab?.setor || editing?.collaborator_sector || "",
      reason: formReason,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      total_hours: calcHours,
    };

    if (editing) {
      await supabase.from("absences").update(record).eq("id", editing.id);
      toast.success("Afastamento atualizado");
    } else {
      await supabase.from("absences").insert(record);
      toast.success("Afastamento registrado");
    }
    setDialogOpen(false);
    resetForm();
    fetchAbsences();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("absences").delete().eq("id", deleteId);
    toast.success("Afastamento removido");
    setDeleteId(null);
    fetchAbsences();
  };

  const handleAddReason = () => {
    const trimmed = newReason.trim();
    if (trimmed && !allReasons.includes(trimmed)) {
      setCustomReasons(prev => [...prev, trimmed]);
      setFormReason(trimmed);
    }
    setNewReason("");
    setAddingReason(false);
  };

  // --- Calculations ---
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const absInMonth = absences.filter(a => {
    const d = new Date(a.start_date);
    return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
  });
  const absInYear = absences.filter(a => {
    const d = new Date(a.start_date);
    return d.getFullYear() === currentYear;
  });

  const hoursMonth = absInMonth.reduce((s, a) => s + a.total_hours, 0);
  const hoursYear = absInYear.reduce((s, a) => s + a.total_hours, 0);
  const uniqueCollabs = new Set(absences.map(a => a.collaborator_id)).size;

  const MONTH_NAMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const hoursBySectorMonth = useMemo(() => {
    const map: Record<string, number> = {};
    absInMonth.forEach(a => { map[a.collaborator_sector] = (map[a.collaborator_sector] || 0) + a.total_hours; });
    return Object.entries(map).map(([setor, hours]) => ({ setor, hours })).sort((a, b) => b.hours - a.hours);
  }, [absInMonth]);

  const hoursBySectorYear = useMemo(() => {
    const map: Record<string, number> = {};
    absInYear.forEach(a => { map[a.collaborator_sector] = (map[a.collaborator_sector] || 0) + a.total_hours; });
    return Object.entries(map).map(([setor, hours]) => ({ setor, hours })).sort((a, b) => b.hours - a.hours);
  }, [absInYear]);

  const reasonData = useMemo(() => {
    const map: Record<string, number> = {};
    absences.forEach(a => { map[a.reason] = (map[a.reason] || 0) + a.total_hours; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [absences]);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando dados...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Absenteísmo</h2>
        <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="mr-1.5 h-4 w-4" /> Registrar Afastamento
        </Button>
      </div>

      {/* SECTION 1: Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
          <p className="text-2xl font-bold text-primary">{formatHoursBR(hoursMonth)} horas</p>
          <p className="text-sm font-medium text-foreground">Horas no Mês Atual</p>
          <p className="text-xs text-muted-foreground">Mês de {MONTH_NAMES[currentMonth]}/{currentYear}</p>
        </div>
        <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
          <p className="text-2xl font-bold text-primary">{formatHoursBR(hoursYear)} horas</p>
          <p className="text-sm font-medium text-foreground">Horas no Ano Atual</p>
          <p className="text-xs text-muted-foreground">Ano de {currentYear}</p>
        </div>
        <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
          <p className="text-2xl font-bold text-primary">{absences.length}</p>
          <p className="text-sm font-medium text-foreground">Total de Afastamentos</p>
          <p className="text-xs text-muted-foreground">Registros totais</p>
        </div>
        <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
          <p className="text-2xl font-bold text-primary">{uniqueCollabs}</p>
          <p className="text-sm font-medium text-foreground">Colaboradores Afastados</p>
          <p className="text-xs text-muted-foreground">Colaboradores únicos</p>
        </div>
      </div>

      {/* SECTION 2: Hours by sector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-foreground">Horas Ausentes — Mês Atual</h3>
          {hoursBySectorMonth.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem afastamentos no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, hoursBySectorMonth.length * 50)}>
              <BarChart data={hoursBySectorMonth} layout="vertical" margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="setor" width={140} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${formatHoursBR(v)}h`, "Horas"]} />
                <Bar dataKey="hours" name="Horas" fill="hsl(263, 83%, 58%)" radius={[0, 4, 4, 0]}
                  label={{ position: "right", fontSize: 11, formatter: (v: number) => `${formatHoursBR(v)}h` }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-foreground">Horas Ausentes — Ano Atual</h3>
          {hoursBySectorYear.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem afastamentos no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, hoursBySectorYear.length * 50)}>
              <BarChart data={hoursBySectorYear} layout="vertical" margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="setor" width={140} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${formatHoursBR(v)}h`, "Horas"]} />
                <Bar dataKey="hours" name="Horas" fill="hsl(263, 83%, 58%)" radius={[0, 4, 4, 0]}
                  label={{ position: "right", fontSize: 11, formatter: (v: number) => `${formatHoursBR(v)}h` }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* SECTION 3: Reason distribution */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-foreground">Distribuição por Motivo de Afastamento</h3>
        {reasonData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum afastamento registrado</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={reasonData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="value" labelLine={false}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) => {
                  if (percent < 0.05) return null;
                  const RADIAN = Math.PI / 180;
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>{formatHoursBR(value)}h</text>;
                }}>
                {reasonData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${formatHoursBR(v)} horas`, "Total"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* SECTION 4: Collapsible list */}
      <Collapsible open={listOpen} onOpenChange={setListOpen}>
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between p-5 text-left hover:bg-accent/50 transition-colors rounded-xl">
              <span className="text-base font-semibold text-foreground">
                {listOpen ? "Ocultar" : `Ver todos os afastamentos (${absences.length} registros)`}
              </span>
              {listOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border px-5 pb-5">
              {absences.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum afastamento registrado</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Colaborador</th>
                        <th className="pb-2 pr-4 font-medium">Setor</th>
                        <th className="pb-2 pr-4 font-medium">Motivo</th>
                        <th className="pb-2 pr-4 font-medium">Saída</th>
                        <th className="pb-2 pr-4 font-medium">Retorno</th>
                        <th className="pb-2 pr-4 font-medium">Horas</th>
                        <th className="pb-2 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absences.map(a => (
                        <tr key={a.id} className="border-b border-border last:border-0">
                          <td className="py-3 pr-4 font-medium text-foreground">{a.collaborator_name}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{a.collaborator_sector}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{a.reason}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{formatDateTimeBR(a.start_date)}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{formatDateTimeBR(a.end_date)}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{formatHoursBR(a.total_hours)}h</td>
                          <td className="py-3">
                            <div className="flex gap-1">
                              <button onClick={() => openEdit(a)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => setDeleteId(a.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Afastamento" : "Registrar Afastamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select value={formCollaboratorId} onValueChange={setFormCollaboratorId}>
                <SelectTrigger><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
                <SelectContent>
                  {activeColaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_completo} — {c.setor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo</Label>
              {addingReason ? (
                <div className="flex gap-2">
                  <Input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Novo motivo" />
                  <Button size="sm" onClick={handleAddReason}>OK</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingReason(false)}>✕</Button>
                </div>
              ) : (
                <Select value={formReason} onValueChange={(v) => { if (v === "__add__") { setAddingReason(true); } else setFormReason(v); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>
                    {allReasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    <SelectItem value="__add__">+ Adicionar motivo</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Departure datetime */}
            <div>
              <Label>Data e Hora de Saída</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !formStartDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formStartDate ? format(formStartDate, "dd/MM/yyyy") : "Data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={formStartDate} onSelect={setFormStartDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={e => setFormStartTime(e.target.value)}
                  className="w-28"
                />
              </div>
            </div>

            {/* Return datetime */}
            <div>
              <Label>Data e Hora de Retorno</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !formEndDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formEndDate ? format(formEndDate, "dd/MM/yyyy") : "Data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={formEndDate} onSelect={setFormEndDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={e => setFormEndTime(e.target.value)}
                  className="w-28"
                />
              </div>
              {dateError && <p className="mt-1 text-xs text-destructive">A data/hora de retorno não pode ser anterior à saída</p>}
            </div>

            {calcHours !== null && (
              <div className="rounded-lg bg-accent/50 px-3 py-2 text-sm font-medium text-foreground">
                {formatHoursBR(calcHours)} horas
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!formCollaboratorId || !formReason || !startDateTime || !endDateTime || !!dateError}>
              {editing ? "Salvar Alterações" : "Salvar Afastamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este afastamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
