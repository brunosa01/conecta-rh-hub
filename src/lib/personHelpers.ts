import { PersonType } from "@/components/AddColaboradorDialog";

export const personTypeFullLabels: Record<PersonType, string> = {
  colaborador: "Colaborador(a)",
  socio: "Sócio(a)",
  prestador: "Prestador(a) de Serviço",
};

export const personTypePluralLabels: Record<PersonType, string> = {
  colaborador: "Colaboradores(as)",
  socio: "Sócios(as)",
  prestador: "Prestadores(as) de Serviço",
};

export const personTypeAddLabels: Record<PersonType, string> = {
  colaborador: "Adicionar Colaborador(a)",
  socio: "Adicionar Sócio(a)",
  prestador: "Adicionar Prestador(a) de Serviço",
};

/** Calculate full years between birthDate (YYYY-MM-DD) and today */
export function calculateAge(birthDate: string | null | undefined): number {
  if (!birthDate) return 0;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const today = new Date();
  let age = today.getFullYear() - y;
  const mDiff = today.getMonth() + 1 - m;
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) age--;
  return age;
}

export function todayISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function minBirthDateISO(): string {
  // earliest reasonable birth date (no constraint other than past)
  return "1900-01-01";
}

export function maxBirthDateISO(): string {
  // must be at least 14 years ago
  const t = new Date();
  const y = t.getFullYear() - 14;
  return `${y}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function isValidBirthDate(birthDate: string): boolean {
  if (!birthDate) return false;
  return birthDate <= maxBirthDateISO() && birthDate >= minBirthDateISO();
}

/** Strip non-digits */
const digits = (s: string) => s.replace(/\D/g, "");

export function formatCPF(value: string): string {
  const v = digits(value).slice(0, 11);
  if (v.length <= 3) return v;
  if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
  if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
}

export function formatCNPJ(value: string): string {
  const v = digits(value).slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

export function formatDocument(value: string, personType: PersonType): string {
  return personType === "prestador" ? formatCNPJ(value) : formatCPF(value);
}

export function isValidEmail(email: string): boolean {
  if (!email) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
