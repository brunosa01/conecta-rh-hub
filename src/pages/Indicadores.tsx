import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from "recharts";

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

const PIE_COLORS = [
  "hsl(263, 83%, 58%)",  // primary purple
  "hsl(220, 14%, 76%)",  // muted gray
  "hsl(263, 60%, 72%)",  // light purple
  "hsl(340, 65%, 60%)",  // pink accent
  "hsl(200, 60%, 55%)",  // blue accent
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
  { id: "genero", title: "Gênero", icon: Users },
];

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

  // --- Data for charts ---
  const sexoData = (() => {
    const counts: Record<string, number> = {};
    colaboradores.forEach((c) => {
      const label = c.sexo.charAt(0).toUpperCase() + c.sexo.slice(1);
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const generoData = (() => {
    const counts: Record<string, number> = {};
    colaboradores.forEach((c) => {
      const label = generoLabel[c.genero] || c.genero;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const sexoPorSetorData = (() => {
    const map: Record<string, { masculino: number; feminino: number }> = {};
    colaboradores.forEach((c) => {
      if (!map[c.setor]) map[c.setor] = { masculino: 0, feminino: 0 };
      if (c.sexo.toLowerCase() === "masculino") map[c.setor].masculino++;
      else if (c.sexo.toLowerCase() === "feminino") map[c.setor].feminino++;
    });
    return Object.entries(map).map(([setor, vals]) => ({ setor, ...vals }));
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
                  <p className="text-xs text-muted-foreground">Diversidade e inclusão</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Charts area */}
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
            {/* Chart 1 - Sexo */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Diversidade por Sexo</h2>
              {sexoData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={sexoData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      labelLine={false}
                      label={renderCustomLabel}
                      dataKey="value"
                    >
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

            {/* Chart 2 - Gênero */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-foreground">Diversidade por Gênero</h2>
              {generoData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={generoData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      labelLine={false}
                      label={renderCustomLabel}
                      dataKey="value"
                    >
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

            {/* Chart 3 - Sexo por Setor */}
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
        ) : null}
      </main>
    </div>
  );
}
