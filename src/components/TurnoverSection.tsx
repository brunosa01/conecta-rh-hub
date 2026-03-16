import { useState, useMemo } from "react";
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
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
  escolaridade: string;
  status: string;
  employment_periods: any;
};

type Period = {
  admissionDate: string;
  dismissalDate: string | null;
  dismissalReason: string | null;
  dismissalCost: number | null;
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

const PERIOD_OPTIONS = [
  { value: "month", label: "Mês Atual" },
  { value: "12months", label: "Últimos 12 Meses" },
  { value: "year", label: "Ano Atual" },
] as const;

type PeriodValue = typeof PERIOD_OPTIONS[number]["value"];

function getPeriodRange(period: PeriodValue): { start: Date; end: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "month") {
    return {
      start: new Date(y, m, 1),
      end: new Date(y, m + 1, 0, 23, 59, 59),
      label: "Mês Atual",
    };
  }
  if (period === "year") {
    return {
      start: new Date(y, 0, 1),
      end: new Date(y, 11, 31, 23, 59, 59),
      label: "Ano Atual",
    };
  }
  // last 12 months
  const start = new Date(y, m - 11, 1);
  return {
    start,
    end: new Date(y, m + 1, 0, 23, 59, 59),
    label: "Últimos 12 Meses",
  };
}

function toDate(s: string) {
  return new Date(s + "T00:00:00");
}

function inRange(dateStr: string, start: Date, end: Date) {
  const d = toDate(dateStr);
  return d >= start && d <= end;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getAllPeriods(c: Colaborador): Period[] {
  return Array.isArray(c.employment_periods) ? c.employment_periods : [];
}

export default function TurnoverSection({ colaboradores }: { colaboradores: Colaborador[] }) {
  const [period, setPeriod] = useState<PeriodValue>("12months");

  const { start, end, label: periodLabel } = useMemo(() => getPeriodRange(period), [period]);

  // Admissions and dismissals in period (from all employment periods of all collaborators)
  const { admissions, dismissals, dismissalDetails } = useMemo(() => {
    let adm = 0;
    let dis = 0;
    const details: { nome: string; setor: string; reason: string; date: string; cost: number }[] = [];
    colaboradores.forEach((c) => {
      getAllPeriods(c).forEach((p) => {
        if (p.admissionDate && inRange(p.admissionDate, start, end)) adm++;
        if (p.dismissalDate && inRange(p.dismissalDate, start, end)) {
          dis++;
          details.push({
            nome: c.nome_completo,
            setor: c.setor,
            reason: p.dismissalReason || "Não informado",
            date: p.dismissalDate,
            cost: p.dismissalCost ?? 0,
          });
        }
      });
    });
    details.sort((a, b) => b.date.localeCompare(a.date));
    return { admissions: adm, dismissals: dis, dismissalDetails: details };
  }, [colaboradores, start, end]);

  // Active at end of period = collaborators whose latest period has no dismissalDate or dismissalDate > end
  const activeAtEnd = useMemo(() => {
    return colaboradores.filter((c) => {
      const periods = getAllPeriods(c);
      if (periods.length === 0) return c.status === "active";
      const last = periods[periods.length - 1];
      return !last.dismissalDate || toDate(last.dismissalDate) > end;
    }).length;
  }, [colaboradores, end]);

  const turnoverPct = useMemo(() => {
    if (activeAtEnd === 0) return 0;
    return Math.round((((admissions + dismissals) / 2) / activeAtEnd) * 10000) / 100;
  }, [admissions, dismissals, activeAtEnd]);

  // Monthly evolution (last 13 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const result: { month: string; turnover: number }[] = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      let mAdm = 0, mDis = 0;
      colaboradores.forEach((c) => {
        getAllPeriods(c).forEach((p) => {
          if (p.admissionDate && inRange(p.admissionDate, mStart, mEnd)) mAdm++;
          if (p.dismissalDate && inRange(p.dismissalDate, mStart, mEnd)) mDis++;
        });
      });
      const mActive = colaboradores.filter((c) => {
        const periods = getAllPeriods(c);
        if (periods.length === 0) return c.status === "active";
        const last = periods[periods.length - 1];
        return !last.dismissalDate || toDate(last.dismissalDate) > mEnd;
      }).length;
      const t = mActive > 0 ? Math.round((((mAdm + mDis) / 2) / mActive) * 10000) / 100 : 0;
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      result.push({
        month: `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        turnover: t,
      });
    }
    return result;
  }, [colaboradores]);

  // Turnover by sector
  const sectorData = useMemo(() => {
    const map: Record<string, { adm: number; dis: number; active: number }> = {};
    colaboradores.forEach((c) => {
      getAllPeriods(c).forEach((p) => {
        if (p.admissionDate && inRange(p.admissionDate, start, end)) {
          if (!map[c.setor]) map[c.setor] = { adm: 0, dis: 0, active: 0 };
          map[c.setor].adm++;
        }
        if (p.dismissalDate && inRange(p.dismissalDate, start, end)) {
          if (!map[c.setor]) map[c.setor] = { adm: 0, dis: 0, active: 0 };
          map[c.setor].dis++;
        }
      });
    });
    // Count active per sector at end of period
    colaboradores.forEach((c) => {
      const periods = getAllPeriods(c);
      const isActive = periods.length === 0
        ? c.status === "active"
        : (() => { const last = periods[periods.length - 1]; return !last.dismissalDate || toDate(last.dismissalDate) > end; })();
      if (isActive) {
        if (!map[c.setor]) map[c.setor] = { adm: 0, dis: 0, active: 0 };
        map[c.setor].active++;
      }
    });
    return Object.entries(map)
      .filter(([, v]) => v.adm > 0 || v.dis > 0)
      .map(([setor, v]) => ({
        setor,
        turnover: v.active > 0 ? Math.round((((v.adm + v.dis) / 2) / v.active) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.turnover - a.turnover);
  }, [colaboradores, start, end]);

  // Dismissal reasons
  const reasonData = useMemo(() => {
    const counts: Record<string, number> = {};
    dismissalDetails.forEach((d) => {
      counts[d.reason] = (counts[d.reason] || 0) + 1;
    });
    const total = dismissalDetails.length;
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, percent: total > 0 ? ((value / total) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.value - a.value);
  }, [dismissalDetails]);

  // Costs
  const { totalCost, avgCost } = useMemo(() => {
    if (dismissalDetails.length === 0) return { totalCost: 0, avgCost: 0 };
    const total = dismissalDetails.reduce((acc, d) => acc + d.cost, 0);
    return { totalCost: total, avgCost: total / dismissalDetails.length };
  }, [dismissalDetails]);

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

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              period === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-foreground hover:bg-accent/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Section 1 — Turnover Global */}
      <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-foreground">Turnover Global</h2>
        <p className="mb-4 text-xs text-muted-foreground">Período: {periodLabel}</p>
        <p className="text-4xl font-bold text-primary">
          {turnoverPct.toFixed(2).replace(".", ",")}%
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {admissions} admissões no período
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {dismissals} demissões no período
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {activeAtEnd} colaboradores ativos
          </span>
        </div>
      </div>

      {/* Section 2 — Evolução do Turnover */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">Evolução Mensal do Turnover</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(value: number) => [`${value.toFixed(2).replace(".", ",")}%`, "Turnover"]} />
            <Line
              type="monotone"
              dataKey="turnover"
              stroke="hsl(263, 83%, 58%)"
              strokeWidth={2}
              dot={{ fill: "hsl(263, 83%, 58%)", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Section 3 — Turnover por Setor */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">Turnover por Setor</h2>
        {sectorData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem dados no período selecionado</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, sectorData.length * 50)}>
            <BarChart data={sectorData} layout="vertical" margin={{ left: 20, right: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
              <XAxis type="number" tick={{ fontSize: 12 }} unit="%" />
              <YAxis type="category" dataKey="setor" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(2).replace(".", ",")}%`, "Turnover"]} />
              <Bar dataKey="turnover" name="Turnover" fill="hsl(263, 83%, 58%)" radius={[0, 4, 4, 0]}
                label={{ position: "right", fontSize: 11, formatter: (v: number) => `${v.toFixed(2).replace(".", ",")}%` }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Section 4 — Desligamentos por Motivo */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">Motivos de Desligamento</h2>
        {reasonData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum desligamento no período selecionado</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={reasonData}
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={50}
                labelLine={false}
                label={renderPieLabel}
                dataKey="value"
              >
                {reasonData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [`${value} (${reasonData.find(r => r.name === name)?.percent}%)`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Section 5 — Custos dos Desligamentos */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Custos de Desligamento</h2>
        {dismissalDetails.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground rounded-xl border border-border bg-card shadow-sm">
            Nenhum desligamento no período selecionado
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-6 shadow-sm">
                <p className="text-3xl font-bold text-primary">{formatBRL(totalCost)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Custo Total</p>
              </div>
              <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-6 shadow-sm">
                <p className="text-3xl font-bold text-primary">{formatBRL(avgCost)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Custo Médio por Demissão</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-accent/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Setor</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Motivo</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {dismissalDetails.map((d, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{d.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{d.setor}</td>
                      <td className="px-4 py-3 text-muted-foreground">{d.reason}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateBR(d.date)}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{formatBRL(d.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
