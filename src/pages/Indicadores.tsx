import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users, Clock, Cake, GraduationCap, RefreshCw, BookOpen, TrendingUp, UserX } from "lucide-react";
import TurnoverSection from "@/components/TurnoverSection";
import CoursesSection from "@/components/CoursesSection";
import GrowthSection from "@/components/GrowthSection";
import AbsenteeismSection from "@/components/AbsenteeismSection";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  employment_periods: any;
};

const generoLabel: Record<string, string> = {
  hetero: "Heterossexual",
  homo: "Homossexual",
  pan: "Pansexual",
  bi: "Bissexual",
};

const PIE_COLORS = [
  "hsl(263, 83%, 58%)",
  "hsl(220, 14%, 76%)",
  "hsl(263, 60%, 72%)",
  "hsl(340, 65%, 60%)",
  "hsl(200, 60%, 55%)",
];

const BAR_COLORS = {
  masculino: "hsl(263, 83%, 58%)",
  feminino: "hsl(220, 14%, 76%)",
};

const RADIAN = Math.PI / 180;
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) {
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

const indicators = [
  { id: "genero", title: "Gênero", subtitle: "Diversidade e inclusão", icon: Users },
  { id: "tempo", title: "Tempo de Casa", subtitle: "Permanência e aniversários", icon: Clock },
  { id: "idade-escolaridade", title: "Idade & Escolaridade", subtitle: "Formação e faixa etária", icon: GraduationCap },
  { id: "turnover", title: "Turnover", subtitle: "Rotatividade e custos", icon: RefreshCw },
  { id: "cursos", title: "Cursos & Treinamentos", subtitle: "Investimento em capacitação", icon: BookOpen },
  { id: "crescimento", title: "Crescimento", subtitle: "Evolução do quadro de pessoal", icon: TrendingUp },
  { id: "absenteismo", title: "Absenteísmo", subtitle: "Afastamentos e ausências", icon: UserX },
];

function parseLocalDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

function calcTenure(admissao: string, ref: Date) {
  const { year, month, day } = parseLocalDate(admissao);
  let years = ref.getFullYear() - year;
  let months = ref.getMonth() + 1 - month;
  if (ref.getDate() < day) months--;
  if (months < 0) { years--; months += 12; }
  return { years, months, totalMonths: years * 12 + months };
}

function formatTenure(years: number, months: number) {
  const yPart = years > 0 ? `${years} ano${years !== 1 ? "s" : ""}` : "";
  const mPart = months > 0 ? `${months} ${months !== 1 ? "meses" : "mês"}` : "";
  if (yPart && mPart) return `${yPart} e ${mPart}`;
  if (yPart) return yPart;
  if (mPart) return mPart;
  return "Menos de 1 mês";
}

type Aniversariante = Colaborador & { anosCompletando: number };

function getAniversariantes(colaboradores: Colaborador[], targetMonth: number, targetYear: number): Aniversariante[] {
  return colaboradores
    .filter((c) => {
      const { month } = parseLocalDate(c.data_admissao);
      return month === targetMonth;
    })
    .map((c) => {
      const { year } = parseLocalDate(c.data_admissao);
      return { ...c, anosCompletando: targetYear - year };
    })
    .sort((a, b) => {
      const da = parseLocalDate(a.data_admissao).day;
      const db = parseLocalDate(b.data_admissao).day;
      return da - db;
    });
}

function formatDateBR(dateStr: string) {
  const { year, month, day } = parseLocalDate(dateStr);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

const MONTH_NAMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function Indicadores() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from("colaboradores").select("*").order("nome_completo");
      setColaboradores((data as Colaborador[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  // Inactive collaborators are excluded from all indicators except average tenure in Tempo de Casa
  const activeColaboradores = colaboradores.filter((c) => c.status === "active");

  // --- Gênero chart data (active only) ---
  const sexoData = (() => {
    const counts: Record<string, number> = {};
    activeColaboradores.forEach((c) => {
      const label = c.sexo.charAt(0).toUpperCase() + c.sexo.slice(1);
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const generoData = (() => {
    const counts: Record<string, number> = {};
    activeColaboradores.forEach((c) => {
      const label = generoLabel[c.genero] || c.genero;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const sexoPorSetorData = (() => {
    const map: Record<string, { masculino: number; feminino: number }> = {};
    activeColaboradores.forEach((c) => {
      if (!map[c.setor]) map[c.setor] = { masculino: 0, feminino: 0 };
      if (c.sexo.toLowerCase() === "masculino") map[c.setor].masculino++;
      else if (c.sexo.toLowerCase() === "feminino") map[c.setor].feminino++;
    });
    return Object.entries(map).map(([setor, vals]) => ({ setor, ...vals }));
  })();

  // --- Tempo de Casa data ---
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  // Average tenure: ACTIVE collaborators only, sum ALL their employment periods
  const avgTenure = (() => {
    if (activeColaboradores.length === 0) return { years: 0, months: 0 };
    let totalMonths = 0;
    activeColaboradores.forEach((c) => {
      const periods: any[] = Array.isArray(c.employment_periods) ? c.employment_periods : [];
      let personMonths = 0;
      periods.forEach((p: any) => {
        if (!p.admissionDate) return;
        if (p.dismissalDate) {
          // Completed period
          personMonths += calcTenure(p.admissionDate, new Date(p.dismissalDate + "T00:00:00")).totalMonths;
        } else {
          // Current active period
          personMonths += calcTenure(p.admissionDate, now).totalMonths;
        }
      });
      totalMonths += personMonths;
    });
    const avg = Math.round(totalMonths / activeColaboradores.length);
    return { years: Math.floor(avg / 12), months: avg % 12 };
  })();

  // Aniversariantes: active collaborators only, using CURRENT (most recent) employment period
  const getCurrentAdmissionDate = (c: Colaborador): string => {
    const periods: any[] = Array.isArray(c.employment_periods) ? c.employment_periods : [];
    if (periods.length > 0) {
      const last = periods[periods.length - 1];
      if (last.admissionDate) return last.admissionDate;
    }
    return c.data_admissao;
  };

  const anivThisMonth = getAniversariantes(
    activeColaboradores.map((c) => ({ ...c, data_admissao: getCurrentAdmissionDate(c) })),
    currentMonth, currentYear
  );
  const anivNextMonth = getAniversariantes(
    activeColaboradores.map((c) => ({ ...c, data_admissao: getCurrentAdmissionDate(c) })),
    nextMonth, nextMonthYear
  );

  const AniversarianteList = ({ list }: { list: Aniversariante[] }) => {
    if (list.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum aniversariante neste período
        </p>
      );
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((a) => (
          <div key={a.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="font-semibold text-foreground">{a.nome_completo}</p>
            <p className="text-sm text-muted-foreground">{a.setor} · {a.cargo}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {a.anosCompletando} ano{a.anosCompletando !== 1 ? "s" : ""} de casa
              </span>
              <span className="text-xs text-muted-foreground">{formatDateBR(a.data_admissao)}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // --- Idade & Escolaridade data (active only) ---
  const escolaridadeData = (() => {
    const counts: Record<string, number> = {};
    activeColaboradores.forEach((c) => {
      if (c.escolaridade) counts[c.escolaridade] = (counts[c.escolaridade] || 0) + 1;
    });
    const total = activeColaboradores.length;
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, percent: total > 0 ? ((value / total) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.value - a.value);
  })();

  const avgIdadeGeral = (() => {
    if (activeColaboradores.length === 0) return null;
    const sum = activeColaboradores.reduce((acc, c) => acc + c.idade, 0);
    return Math.round(sum / activeColaboradores.length);
  })();

  const idadePorSetorData = (() => {
    const map: Record<string, { sum: number; count: number }> = {};
    activeColaboradores.forEach((c) => {
      if (!map[c.setor]) map[c.setor] = { sum: 0, count: 0 };
      map[c.setor].sum += c.idade;
      map[c.setor].count++;
    });
    return Object.entries(map)
      .map(([setor, v]) => ({ setor, media: Math.round(v.sum / v.count) }))
      .sort((a, b) => b.media - a.media);
  })();

  const avgIdadePorSexo = (() => {
    const masc = activeColaboradores.filter((c) => c.sexo.toLowerCase() === "masculino");
    const fem = activeColaboradores.filter((c) => c.sexo.toLowerCase() === "feminino");
    return {
      masculino: masc.length > 0 ? Math.round(masc.reduce((a, c) => a + c.idade, 0) / masc.length) : null,
      feminino: fem.length > 0 ? Math.round(fem.reduce((a, c) => a + c.idade, 0) / fem.length) : null,
    };
  })();

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Indicadores</h1>
        </div>

        {/* Indicator cards grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {indicators.map((ind) => {
            const isActive = selected === ind.id;
            return (
              <button
                key={ind.id}
                onClick={() => setSelected(isActive ? null : ind.id)}
                className={`flex items-center gap-4 rounded-xl border-2 bg-card p-5 text-left shadow-sm transition-all hover:shadow-md ${
                  isActive
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-transparent hover:border-primary/30"
                }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-accent text-primary"
                }`}>
                  <ind.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{ind.title}</p>
                  <p className="text-xs text-muted-foreground">{ind.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Charts / content area */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Carregando dados...
          </div>
        ) : selected === null ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-muted-foreground shadow-sm">
            <BarChart3 className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">Selecione um indicador para visualizar os dados.</p>
          </div>
        ) : selected === "genero" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Diversidade por Sexo</h2>
              {sexoData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={sexoData} cx="50%" cy="50%" outerRadius={100} labelLine={false} label={renderCustomLabel} dataKey="value">
                      {sexoData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Diversidade por Gênero</h2>
              {generoData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={generoData} cx="50%" cy="50%" outerRadius={100} labelLine={false} label={renderCustomLabel} dataKey="value">
                      {generoData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-base font-semibold text-foreground">Diversidade de Sexo por Setor</h2>
              {sexoPorSetorData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={sexoPorSetorData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
                    <XAxis dataKey="setor" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="masculino" name="Masculino" fill={BAR_COLORS.masculino} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="feminino" name="Feminino" fill={BAR_COLORS.feminino} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        ) : selected === "tempo" ? (
          <div className="space-y-6">
            {/* Section 1 — Média de Tempo de Casa */}
            <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-1 text-base font-semibold text-foreground">Média de Tempo de Casa</h2>
              <p className="mb-4 text-xs text-muted-foreground">Média geral dos colaboradores ativos</p>
              {colaboradores.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <p className="text-3xl font-bold text-primary">
                  {formatTenure(avgTenure.years, avgTenure.months)}
                </p>
              )}
            </div>

            {/* Section 2 — Aniversariantes da Casa */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Cake className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Aniversariantes da Casa</h2>
              </div>

              <Tabs defaultValue="this">
                <TabsList className="mb-4">
                  <TabsTrigger value="this">
                    Este mês — {MONTH_NAMES[currentMonth]}
                  </TabsTrigger>
                  <TabsTrigger value="next">
                    Próximo mês — {MONTH_NAMES[nextMonth]}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="this">
                  <AniversarianteList list={anivThisMonth} />
                </TabsContent>
                <TabsContent value="next">
                  <AniversarianteList list={anivNextMonth} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : selected === "idade-escolaridade" ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Distribuição por Escolaridade</h2>
              {escolaridadeData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(280, escolaridadeData.length * 40)}>
                  <BarChart data={escolaridadeData} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number, _name: string, props: any) => [`${value} (${props.payload.percent}%)`, "Colaboradores"]} />
                    <Bar dataKey="value" name="Colaboradores" fill="hsl(263, 83%, 58%)" radius={[0, 4, 4, 0]}
                      label={{ position: "right", fontSize: 11, formatter: (v: number) => v }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-1 text-base font-semibold text-foreground">Média de Idade Geral</h2>
              <p className="mb-4 text-xs text-muted-foreground">Média geral dos colaboradores ativos</p>
              {avgIdadeGeral === null ? (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <p className="text-3xl font-bold text-primary">{avgIdadeGeral} anos</p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Média de Idade por Setor</h2>
              {idadePorSetorData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(280, idadePorSetorData.length * 50)}>
                  <BarChart data={idadePorSetorData} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="setor" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [`${value} anos`, "Média"]} />
                    <Bar dataKey="media" name="Média de Idade" fill="hsl(263, 83%, 58%)" radius={[0, 4, 4, 0]}
                      label={{ position: "right", fontSize: 12, formatter: (v: number) => `${v} anos` }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-1 text-base font-semibold text-foreground">
                  {avgIdadePorSexo.masculino !== null ? `${avgIdadePorSexo.masculino} anos` : "Sem dados"}
                </h2>
                <p className="text-xs text-muted-foreground">Média — Masculino</p>
              </div>
              <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-1 text-base font-semibold text-foreground">
                  {avgIdadePorSexo.feminino !== null ? `${avgIdadePorSexo.feminino} anos` : "Sem dados"}
                </h2>
                <p className="text-xs text-muted-foreground">Média — Feminino</p>
              </div>
           </div>
          </div>
        ) : selected === "turnover" ? (
          <TurnoverSection colaboradores={colaboradores} />
        ) : selected === "cursos" ? (
          <CoursesSection allSectors={[...new Set(colaboradores.map((c) => c.setor))].sort()} />
        ) : selected === "crescimento" ? (
          <GrowthSection colaboradores={colaboradores} />
        ) : null}
      </main>
    </div>
  );
}