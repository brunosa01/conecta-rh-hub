import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  calculateAge,
  formatDocument,
  isValidBirthDate,
  isValidEmail,
  maxBirthDateISO,
  minBirthDateISO,
  personTypeFullLabels,
} from "@/lib/personHelpers";

export type PersonType = "colaborador" | "socio" | "prestador";

export type ColaboradorForm = {
  nome_completo: string;
  documento: string;
  genero: string;
  sexo: string;
  setor: string;
  cargo: string;
  data_admissao: string;
  data_nascimento: string;
  email: string;
  escolaridade: string;
  person_type: PersonType;
};

const emptyForm: ColaboradorForm = {
  nome_completo: "",
  documento: "",
  genero: "",
  sexo: "",
  setor: "",
  cargo: "",
  data_admissao: "",
  data_nascimento: "",
  email: "",
  escolaridade: "",
  person_type: "colaborador",
};

const escolaridadeOptions = [
  { group: "Fundamental", items: ["Fundamental Incompleto", "Fundamental Cursando", "Fundamental Trancado", "Fundamental Completo"] },
  { group: "Médio", items: ["Médio Incompleto", "Médio Cursando", "Médio Trancado", "Médio Completo"] },
  { group: "Superior", items: ["Superior Incompleto", "Superior Cursando", "Superior Trancado", "Superior Completo"] },
  { group: "Pós-Graduação", items: ["Pós-Graduação Cursando", "Pós-Graduação Trancado", "Pós-Graduação Completo"] },
  { group: "Mestrado", items: ["Mestrado Cursando", "Mestrado Trancado", "Mestrado Completo"] },
  { group: "Doutorado", items: ["Doutorado Cursando", "Doutorado Trancado", "Doutorado Completo"] },
  { group: "MBA", items: ["MBA Cursando", "MBA Trancado", "MBA Completo"] },
];

export const personTypeLabels: Record<PersonType, string> = {
  colaborador: "Colaborador(a)",
  socio: "Sócio(a)",
  prestador: "Prestador(a)",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingId?: string | null;
  initialData?: ColaboradorForm | null;
  defaultPersonType?: PersonType;
  lockPersonType?: boolean;
}

export function ColaboradorDialog({ open, onOpenChange, onSuccess, editingId, initialData, defaultPersonType = "colaborador", lockPersonType = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ColaboradorForm>({ ...emptyForm, person_type: defaultPersonType });
  const [sectors, setSectors] = useState<string[]>([]);
  const [addingSector, setAddingSector] = useState(false);
  const [newSectorText, setNewSectorText] = useState("");

  const fetchSectors = async () => {
    const { data } = await supabase.from("sectors").select("name").order("name");
    setSectors((data || []).map((s: any) => s.name as string));
  };

  useEffect(() => {
    if (open) {
      setForm(initialData || { ...emptyForm, person_type: defaultPersonType });
      setAddingSector(false);
      setNewSectorText("");
      fetchSectors();
    }
  }, [open, initialData, defaultPersonType]);

  const update = (field: keyof ColaboradorForm, value: string) =>
    setForm((prev) => {
      // Re-format document when person_type changes
      if (field === "person_type") {
        return {
          ...prev,
          person_type: value as PersonType,
          documento: prev.documento ? formatDocument(prev.documento, value as PersonType) : "",
        };
      }
      if (field === "documento") {
        return { ...prev, documento: formatDocument(value, prev.person_type) };
      }
      return { ...prev, [field]: value };
    });

  const isEditing = !!editingId;
  const currentTypeLabel = personTypeFullLabels[form.person_type];
  const isPrestador = form.person_type === "prestador";
  const documentLabel = isPrestador ? "CNPJ" : "CPF";
  const documentDigitsRequired = isPrestador ? 14 : 11;
  const documentDigits = form.documento.replace(/\D/g, "").length;
  const documentValid = documentDigits === 0 || documentDigits === documentDigitsRequired;

  const computedAge = useMemo(() => calculateAge(form.data_nascimento), [form.data_nascimento]);
  const birthInvalid = !!form.data_nascimento && !isValidBirthDate(form.data_nascimento);
  const emailInvalid = !isValidEmail(form.email);

  const handleAddSector = async () => {
    const name = newSectorText.trim();
    if (!name) return;
    if (sectors.some((s) => s.toLowerCase() === name.toLowerCase())) {
      toast.error("Este setor já existe");
      return;
    }
    const { error } = await supabase.from("sectors").insert({ name });
    if (error) {
      toast.error("Erro ao adicionar setor: " + error.message);
      return;
    }
    setSectors((prev) => [...prev, name].sort());
    update("setor", name);
    setNewSectorText("");
    setAddingSector(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_completo || !form.documento || !form.genero || !form.sexo || !form.setor || !form.cargo || !form.data_admissao || !form.data_nascimento || !form.escolaridade) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (birthInvalid) {
      toast.error("Data de nascimento inválida");
      return;
    }
    if (!documentValid) {
      toast.error(`${documentLabel} inválido`);
      return;
    }
    if (emailInvalid) {
      toast.error("Informe um e-mail válido");
      return;
    }
    setLoading(true);
    const payload = {
      nome_completo: form.nome_completo,
      documento: form.documento,
      genero: form.genero,
      sexo: form.sexo,
      setor: form.setor,
      cargo: form.cargo,
      data_admissao: form.data_admissao,
      data_nascimento: form.data_nascimento,
      email: form.email || null,
      escolaridade: form.escolaridade,
      person_type: form.person_type,
      idade: calculateAge(form.data_nascimento),
    };

    let error;
    if (!isEditing) {
      const insertPayload = {
        ...payload,
        status: "active",
        employment_periods: [
          { admissionDate: form.data_admissao, dismissalDate: null, dismissalReason: null, dismissalCost: null },
        ] as any,
      };
      ({ error } = await supabase.from("colaboradores").insert(insertPayload));
    } else {
      ({ error } = await supabase.from("colaboradores").update(payload).eq("id", editingId));
    }

    setLoading(false);
    if (error) {
      toast.error(`Erro ao ${isEditing ? "atualizar" : "cadastrar"}: ${error.message}`);
    } else {
      toast.success(`${currentTypeLabel} ${isEditing ? "atualizado(a)" : "cadastrado(a)"} com sucesso!`);
      onOpenChange(false);
      onSuccess();
    }
  };

  const personTypeOptions: PersonType[] = ["colaborador", "socio", "prestador"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isEditing ? `Editar ${currentTypeLabel}` : `Novo ${currentTypeLabel}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 pt-2">
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-3 gap-2">
              {personTypeOptions.map((opt) => {
                const selected = form.person_type === opt;
                const disabled = lockPersonType || isEditing;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && update("person_type", opt)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    } ${disabled ? "cursor-not-allowed opacity-80" : ""}`}
                  >
                    {personTypeFullLabels[opt]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nome">Nome Completo</Label>
            <Input id="nome" value={form.nome_completo} onChange={(e) => update("nome_completo", e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="documento">{documentLabel}</Label>
              <Input
                id="documento"
                value={form.documento}
                onChange={(e) => update("documento", e.target.value)}
                placeholder={isPrestador ? "00.000.000/0000-00" : "000.000.000-00"}
                inputMode="numeric"
              />
              {form.documento && !documentValid && (
                <p className="text-xs text-destructive">{documentLabel} inválido</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nascimento">Data de Nascimento</Label>
              <Input
                id="nascimento"
                type="date"
                value={form.data_nascimento}
                onChange={(e) => update("data_nascimento", e.target.value)}
                min={minBirthDateISO()}
                max={maxBirthDateISO()}
              />
              {birthInvalid && (
                <p className="text-xs text-destructive">Data de nascimento inválida</p>
              )}
              {form.data_nascimento && !birthInvalid && (
                <p className="text-xs text-muted-foreground">Idade: {computedAge} anos</p>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail (opcional)</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="exemplo@empresa.com"
            />
            {emailInvalid && (
              <p className="text-xs text-destructive">Informe um e-mail válido</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Sexo</Label>
              <Select value={form.sexo} onValueChange={(v) => update("sexo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Gênero</Label>
              <Select value={form.genero} onValueChange={(v) => update("genero", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hetero">Heterossexual</SelectItem>
                  <SelectItem value="homo">Homossexual</SelectItem>
                  <SelectItem value="pan">Pansexual</SelectItem>
                  <SelectItem value="bi">Bissexual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Setor</Label>
              <Select
                value={form.setor}
                onValueChange={(v) => {
                  if (v === "__add_new__") {
                    setAddingSector(true);
                  } else {
                    update("setor", v);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                  {/* Include current sector if not in list (legacy data) */}
                  {form.setor && !sectors.includes(form.setor) && (
                    <SelectItem value={form.setor}>{form.setor}</SelectItem>
                  )}
                  <SelectItem value="__add_new__">
                    <span className="flex items-center gap-1">
                      <Plus className="h-3.5 w-3.5" /> Adicionar setor
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {addingSector && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Novo setor..."
                    value={newSectorText}
                    onChange={(e) => setNewSectorText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSector();
                      }
                    }}
                  />
                  <Button type="button" size="sm" onClick={handleAddSector}>Adicionar</Button>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input id="cargo" value={form.cargo} onChange={(e) => update("cargo", e.target.value)} placeholder="Analista" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="admissao">Data de Admissão</Label>
            <Input id="admissao" type="date" value={form.data_admissao} onChange={(e) => update("data_admissao", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Escolaridade</Label>
            <Select value={form.escolaridade} onValueChange={(v) => update("escolaridade", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {escolaridadeOptions.map((group) => (
                  <SelectGroup key={group.group}>
                    <SelectLabel>{group.group}</SelectLabel>
                    {group.items.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? "Salvando..." : isEditing ? "Salvar Alterações" : `Adicionar ${currentTypeLabel}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
