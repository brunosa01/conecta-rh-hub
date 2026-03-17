import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type Course = {
  id: string;
  name: string;
  date: string;
  sectors: string[];
  cost: number;
};

type CoursesProps = {
  allSectors: string[];
};

const PIE_COLORS = [
  "hsl(263, 83%, 58%)",
  "hsl(220, 14%, 76%)",
  "hsl(263, 60%, 72%)",
  "hsl(340, 65%, 60%)",
  "hsl(200, 60%, 55%)",
  "hsl(30, 70%, 55%)",
  "hsl(150, 50%, 50%)",
];

function formatCurrencyBR(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getMonthLabel(date: Date) {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
}

const RADIAN = Math.PI / 180;
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600}>
      {value} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

export default function CoursesSection({ allSectors }: CoursesProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formSectors, setFormSectors] = useState<string[]>([]);
  const [formCostRaw, setFormCostRaw] = useState("");
  const [formCostError, setFormCostError] = useState("");

  const fetchCourses = async () => {
    setLoading(true);
    const { data } = await supabase.from("cursos").select("*").order("date", { ascending: false });
    if (data) {
      setCourses(data.map((d: any) => ({
        id: d.id,
        name: d.name,
        date: d.date,
        sectors: Array.isArray(d.sectors) ? d.sectors : [],
        cost: d.cost ?? 0,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchCourses(); }, []);

  const resetForm = () => {
    setFormName("");
    setFormDate("");
    setFormSectors([]);
    setFormCostRaw("");
    setFormCostError("");
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (c: Course) => {
    setEditing(c);
    setFormName(c.name);
    setFormDate(c.date);
    setFormSectors([...c.sectors]);
    setFormCostRaw(c.cost.toFixed(2).replace(".", ","));
    setFormCostError("");
    setModalOpen(true);
  };

  const parseCost = (raw: string): number | null => {
    const cleaned = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
    const val = parseFloat(cleaned);
    if (isNaN(val) || val <= 0) return null;
    return val;
  };

  const handleSave = async () => {
    const cost = parseCost(formCostRaw);
    if (!cost) { setFormCostError("Informe um valor válido"); return; }
    if (formSectors.length === 0) return;

    const payload = {
      name: formName,
      date: formDate,
      sectors: formSectors,
      cost,
    };

    if (editing) {
      const { error } = await supabase.from("cursos").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar curso"); return; }
      toast.success("Curso atualizado!");
    } else {
      const { error } = await supabase.from("cursos").insert(payload);
      if (error) { toast.error("Erro ao salvar curso"); return; }
      toast.success("Curso adicionado!");
    }
    setModalOpen(false);
    resetForm();
    fetchCourses();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("cursos").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Erro ao excluir curso"); return; }
    toast.success("Curso excluído!");
    setDeleteTarget(null);
    fetchCourses();
  };

  const canSave = formName.trim() !== "" && formDate !== "" && formSectors.length > 0 && formCostRaw.trim() !== "" && !formCostError;

  // Summary calculations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const totalInvestment = useMemo(() => courses.reduce((s, c) => s + c.cost, 0), [courses]);
  const monthInvestment = useMemo(() => {
    return courses.filter((c) => {
      const [y, m] = c.date.split("-").map(Number);
      return y === currentYear && m - 1 === currentMonth;
    }).reduce((s, c) => s + c.cost, 0);
  }, [courses, currentMonth, currentYear]);

  // Monthly investment chart (last 13 months)
  const monthlyData = useMemo(() => {
    const result: { label: string; total: number }[] = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const label = getMonthLabel(d);
      const y = d.getFullYear();
      const m = d.getMonth();
      const total = courses.filter((c) => {
        const [cy, cm] = c.date.split("-").map(Number);
        return cy === y && cm - 1 === m;
      }).reduce((s, c) => s + c.cost, 0);
      result.push({ label, total });
    }
    return result;
  }, [courses, currentMonth, currentYear]);

  // Investment per sector (cost split equally)
  const sectorInvestment = useMemo(() => {
    const map: Record<string, number> = {};
    courses.forEach((c) => {
      if (c.sectors.length === 0) return;
      const share = c.cost / c.sectors.length;
      c.sectors.forEach((s) => { map[s] = (map[s] || 0) + share; });
    });
    return Object.entries(map)
      .map(([setor, total]) => ({ setor, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);
  }, [courses]);

  // Courses per sector (pie)
  const sectorCourseCount = useMemo(() => {
    const map: Record<string, number> = {};
    courses.forEach((c) => {
      c.sectors.forEach((s) => { map[s] = (map[s] || 0) + 1; });
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [courses]);

  if (allSectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-muted-foreground shadow-sm">
        <p className="text-lg font-medium">Cadastre colaboradores com setores antes de adicionar cursos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Cursos & Treinamentos</h2>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar Curso
        </Button>
      </div>

      {/* SECTION 1 — Cursos Cadastrados */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-foreground">Cursos Cadastrados</h3>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : courses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum curso cadastrado. Clique em + Adicionar Curso para começar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Setor(es)</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{formatDateBR(c.date)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.sectors.map((s) => (
                          <Badge key={s} variant="outline" className="border-primary text-primary text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrencyBR(c.cost)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}>
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

      {/* SECTION 2 — Resumo de Investimento */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-6 shadow-sm">
          <p className="text-xs text-muted-foreground">Investimento Total</p>
          <p className="mt-1 text-2xl font-bold text-primary">{formatCurrencyBR(totalInvestment)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-6 shadow-sm">
          <p className="text-xs text-muted-foreground">Investimento no Mês Atual</p>
          <p className="mt-1 text-2xl font-bold text-primary">{formatCurrencyBR(monthInvestment)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-6 shadow-sm">
          <p className="text-xs text-muted-foreground">Total de Cursos</p>
          <p className="mt-1 text-2xl font-bold text-primary">{courses.length}</p>
        </div>
      </div>

      {/* SECTION 3 — Investimento Mensal */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-foreground">Investimento Mensal em Cursos</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
            <Tooltip formatter={(value: number) => [formatCurrencyBR(value), "Investimento"]} />
            <Bar dataKey="total" name="Investimento" fill="hsl(263, 83%, 58%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* SECTION 4 — Investimento por Setor */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-foreground">Investimento por Setor</h3>
        {sectorInvestment.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, sectorInvestment.length * 50)}>
            <BarChart data={sectorInvestment} layout="vertical" margin={{ left: 20, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="setor" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [formatCurrencyBR(value), "Investimento"]} />
              <Bar dataKey="total" name="Investimento" fill="hsl(263, 83%, 58%)" radius={[0, 4, 4, 0]}
                label={{ position: "right", fontSize: 11, formatter: (v: number) => formatCurrencyBR(v) }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* SECTION 5 — Cursos por Setor */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-foreground">Quantidade de Cursos por Setor</h3>
        {sectorCourseCount.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={sectorCourseCount} cx="50%" cy="50%" outerRadius={110} innerRadius={50}
                labelLine={false} label={renderPieLabel} dataKey="value">
                {sectorCourseCount.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Curso" : "Adicionar Curso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome do Curso *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Treinamento de Liderança" />
            </div>
            <div>
              <Label>Data *</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div>
              <Label>Setor(es) *</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {allSectors.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={formSectors.includes(s)}
                      onCheckedChange={(checked) => {
                        setFormSectors((prev) =>
                          checked ? [...prev, s] : prev.filter((x) => x !== s)
                        );
                      }}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Valor (R$) *</Label>
              <Input
                value={formCostRaw}
                onChange={(e) => {
                  setFormCostRaw(e.target.value);
                  setFormCostError("");
                  const cost = parseCost(e.target.value);
                  if (e.target.value.trim() && !cost) setFormCostError("Informe um valor válido");
                }}
                placeholder="0,00"
              />
              {formCostError && <p className="mt-1 text-xs text-destructive">{formCostError}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!canSave}>Salvar Curso</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Curso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.name}"? Esta ação não pode ser desfeita.
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
    </div>
  );
}
