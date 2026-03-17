import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

type Colaborador = {
  id: string;
  nome_completo: string;
  setor: string;
  status: string;
  employment_periods: any;
};

type Props = {
  colaboradores: Colaborador[];
};

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0); // month is 1-indexed here: new Date(2026,3,0) = Mar 31
}

function lastDayOfYear(year: number): Date {
  return new Date(year, 12, 0); // Dec 31
}

function countActiveAt(colaboradores: Colaborador[], endDate: Date): number {
  const endStr = formatISO(endDate);
  let count = 0;
  colaboradores.forEach((c) => {
    const periods: any[] = Array.isArray(c.employment_periods) ? c.employment_periods : [];
    for (const p of periods) {
      if (!p.admissionDate) continue;
      if (p.admissionDate <= endStr && (!p.dismissalDate || p.dismissalDate > endStr)) {
        count++;
        break; // count person once
      }
    }
  });
  return count;
}

function countActiveAtBySector(colaboradores: Colaborador[], endDate: Date): Record<string, number> {
  const endStr = formatISO(endDate);
  const map: Record<string, number> = {};
  colaboradores.forEach((c) => {
    const periods: any[] = Array.isArray(c.employment_periods) ? c.employment_periods : [];
    for (const p of periods) {
      if (!p.admissionDate) continue;
      if (p.admissionDate <= endStr && (!p.dismissalDate || p.dismissalDate > endStr)) {
        map[c.setor] = (map[c.setor] || 0) + 1;
        break;
      }
    }
  });
  return map;
}

function countEventsInMonth(colaboradores: Colaborador[], year: number, month: number, field: "admissionDate" | "dismissalDate"): number {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  let count = 0;
  colaboradores.forEach((c) => {
    const periods: any[] = Array.isArray(c.employment_periods) ? c.employment_periods : [];
    periods.forEach((p: any) => {
      if (p[field] && (p[field] as string).startsWith(prefix)) count++;
    });
  });
  return count;
}

function countEventsInYear(colaboradores: Colaborador[], year: number, field: "admissionDate" | "dismissalDate"): number {
  const prefix = `${year}-`;
  let count = 0;
  colaboradores.forEach((c) => {
    const periods: any[] = Array.isArray(c.employment_periods) ? c.employment_periods : [];
    periods.forEach((p: any) => {
      if (p[field] && (p[field] as string).startsWith(prefix)) count++;
    });
  });
  return count;
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatBRPercent(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "" : "";
  return `${sign}${v.toFixed(2).replace(".", ",")}%`;
}

function formatGrowthAbs(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "" : "";
  return `${sign}${v} pessoa${Math.abs(v) !== 1 ? "s" : ""}`;
}

function growthColor(v: number): string {
  if (v > 0) return "text-green-600";
  if (v < 0) return "text-red-600";
  return "text-muted-foreground";
}

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const FULL_MONTHS = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function GrowthSection({ colaboradores }: Props) {
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
  const prevMonthYear = curMonth === 1 ? curYear - 1 : curYear;

  // Section 1 — Monthly growth
  const monthly = useMemo(() => {
    const endCur = lastDayOfMonth(curYear, curMonth);
    const endPrev = lastDayOfMonth(prevMonthYear, prevMonth);
    const activeCur = countActiveAt(colaboradores, endCur);
    const activePrev = countActiveAt(colaboradores, endPrev);
    const abs = activeCur - activePrev;
    const pct = activePrev > 0 ? (abs / activePrev) * 100 : null;
    const admissions = countEventsInMonth(colaboradores, curYear, curMonth, "admissionDate");
    const dismissals = countEventsInMonth(colaboradores, curYear, curMonth, "dismissalDate");
    return { activeCur, activePrev, abs, pct, admissions, dismissals };
  }, [colaboradores, curMonth, curYear, prevMonth, prevMonthYear]);

  // Section 2 — Yearly growth
  const yearly = useMemo(() => {
    const endCur = lastDayOfYear(curYear);
    const endPrev = lastDayOfYear(curYear - 1);
    const activeCur = countActiveAt(colaboradores, endCur);
    const activePrev = countActiveAt(colaboradores, endPrev);
    const abs = activeCur - activePrev;
    const pct = activePrev > 0 ? (abs / activePrev) * 100 : null;
    const admissions = countEventsInYear(colaboradores, curYear, "admissionDate");
    const dismissals = countEventsInYear(colaboradores, curYear, "dismissalDate");
    return { activeCur, activePrev, abs, pct, admissions, dismissals };
  }, [colaboradores, curYear]);

  // Section 3 — Headcount evolution (13 months)
  const evolutionData = useMemo(() => {
    const points: { label: string; headcount: number; growth: number }[] = [];
    let prevHC: number | null = null;
    for (let i = 12; i >= 0; i--) {
      let m = curMonth - i;
      let y = curYear;
      while (m <= 0) { m += 12; y--; }
      const end = lastDayOfMonth(y, m);
      const hc = countActiveAt(colaboradores, end);
      const growth = prevHC !== null ? hc - prevHC : 0;
      points.push({
        label: `${SHORT_MONTHS[m - 1]}/${String(y).slice(2)}`,
        headcount: hc,
        growth,
      });
      prevHC = hc;
    }
    return points;
  }, [colaboradores, curMonth, curYear]);

  // Section 4 — Growth by sector (current month)
  const sectorGrowth = useMemo(() => {
    const endCur = lastDayOfMonth(curYear, curMonth);
    const endPrev = lastDayOfMonth(prevMonthYear, prevMonth);
    const curMap = countActiveAtBySector(colaboradores, endCur);
    const prevMap = countActiveAtBySector(colaboradores, endPrev);
    const allSectors = new Set([...Object.keys(curMap), ...Object.keys(prevMap)]);
    return [...allSectors]
      .map((setor) => ({
        setor,
        growth: (curMap[setor] || 0) - (prevMap[setor] || 0),
      }))
      .sort((a, b) => b.growth - a.growth);
  }, [colaboradores, curMonth, curYear, prevMonth, prevMonthYear]);

  const InfoPill = ({ text }: { text: string }) => (
    <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-foreground">
      {text}
    </span>
  );

  return (
    <div className="space-y-6">
      {/* Section 1 — Monthly */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">Crescimento no Mês</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Crescimento Líquido — Mês</p>
            <p className={`mt-1 text-3xl font-bold ${growthColor(monthly.abs)}`}>
              {formatGrowthAbs(monthly.abs)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {FULL_MONTHS[curMonth]}/{curYear} vs {FULL_MONTHS[prevMonth]}/{prevMonthYear}
            </p>
          </div>
          <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Variação Percentual — Mês</p>
            <p className={`mt-1 text-3xl font-bold ${monthly.pct !== null ? growthColor(monthly.pct) : "text-muted-foreground"}`}>
              {monthly.pct !== null ? formatBRPercent(monthly.pct) : "Sem base de comparação"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <InfoPill text={`${monthly.activeCur} ativos ao final de ${FULL_MONTHS[curMonth]}`} />
          <InfoPill text={`${monthly.activePrev} ativos ao final de ${FULL_MONTHS[prevMonth]}`} />
          <InfoPill text={`${monthly.admissions} admissões em ${FULL_MONTHS[curMonth]}`} />
          <InfoPill text={`${monthly.dismissals} demissões em ${FULL_MONTHS[curMonth]}`} />
        </div>
      </div>

      {/* Section 2 — Yearly */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">Crescimento no Ano</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Crescimento Líquido — Ano</p>
            <p className={`mt-1 text-3xl font-bold ${growthColor(yearly.abs)}`}>
              {formatGrowthAbs(yearly.abs)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {curYear} vs {curYear - 1}
            </p>
          </div>
          <div className="rounded-xl border-l-4 border-l-primary border border-border bg-card p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Variação Percentual — Ano</p>
            <p className={`mt-1 text-3xl font-bold ${yearly.pct !== null ? growthColor(yearly.pct) : "text-muted-foreground"}`}>
              {yearly.pct !== null ? formatBRPercent(yearly.pct) : "Sem base de comparação"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <InfoPill text={`${yearly.activeCur} ativos ao final de ${curYear}`} />
          <InfoPill text={`${yearly.activePrev} ativos ao final de ${curYear - 1}`} />
          <InfoPill text={`${yearly.admissions} admissões em ${curYear}`} />
          <InfoPill text={`${yearly.dismissals} demissões em ${curYear}`} />
        </div>
      </div>

      {/* Section 3 — Headcount evolution */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">Evolução do Headcount</h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={evolutionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="headcount" name="Headcount" stroke="hsl(263, 83%, 58%)" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="growth" name="Crescimento Líquido" stroke="hsl(220, 14%, 56%)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Section 4 — Growth by sector */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          Crescimento por Setor (Mês Atual)
        </h2>
        {sectorGrowth.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sem dados suficientes para comparação
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, sectorGrowth.length * 50)}>
            <BarChart data={sectorGrowth} layout="vertical" margin={{ left: 20, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="setor" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`${value > 0 ? "+" : ""}${value}`, "Crescimento"]} />
              <Bar dataKey="growth" name="Crescimento">
                {sectorGrowth.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.growth > 0 ? "#16A34A" : entry.growth < 0 ? "#DC2626" : "hsl(220, 14%, 76%)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
