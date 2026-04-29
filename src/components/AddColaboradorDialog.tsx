import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PersonType = "colaborador" | "socio" | "prestador";

export type ColaboradorForm = {
  nome_completo: string;
  documento: string;
  genero: string;
  sexo: string;
  setor: string;
  cargo: string;
  data_admissao: string;
  idade: string;
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
  idade: "",
  escolaridade: "",
  person_type: "colaborador",
};

const escolaridadeOptions = [
  { group: "Fundamental", items: ["Fundamental Incompleto", "Fundamental Cursando", "Fundamental Completo"] },
  { group: "Médio", items: ["Médio Incompleto", "Médio Cursando", "Médio Completo"] },
  { group: "Superior", items: ["Superior Incompleto", "Superior Cursando", "Superior Completo"] },
  { group: "Pós-Graduação", items: ["Pós-Graduação Cursando", "Pós-Graduação Completo"] },
  { group: "Mestrado", items: ["Mestrado Cursando", "Mestrado Completo"] },
  { group: "Doutorado", items: ["Doutorado Cursando", "Doutorado Completo"] },
  { group: "MBA", items: ["MBA Cursando", "MBA Completo"] },
];

export const personTypeLabels: Record<PersonType, string> = {
  colaborador: "Colaborador",
  socio: "Sócio",
  prestador: "Prestador",
};

const personTypeFullLabels: Record<PersonType, string> = {
  colaborador: "Colaborador",
  socio: "Sócio",
  prestador: "Prestador de Serviço",
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

  useEffect(() => {
    if (open) {
      setForm(initialData || { ...emptyForm, person_type: defaultPersonType });
    }
  }, [open, initialData, defaultPersonType]);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isEditing = !!editingId;
  const currentTypeLabel = personTypeFullLabels[form.person_type];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_completo || !form.documento || !form.genero || !form.sexo || !form.setor || !form.cargo || !form.data_admissao || !form.idade || !form.escolaridade) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    const payload = { ...form, idade: parseInt(form.idade) };

    if (!isEditing) {
      const insertPayload = {
        ...payload,
        status: "active",
        employment_periods: [
          { admissionDate: form.data_admissao, dismissalDate: null, dismissalReason: null },
        ],
      };
      var { error } = await supabase.from("colaboradores").insert(insertPayload);
    } else {
      var { error } = await supabase.from("colaboradores").update(payload).eq("id", editingId);
    }

    setLoading(false);
    if (error) {
      toast.error(`Erro ao ${isEditing ? "atualizar" : "cadastrar"}: ${error.message}`);
    } else {
      toast.success(`${currentTypeLabel} ${isEditing ? "atualizado" : "cadastrado"} com sucesso!`);
      onOpenChange(false);
      onSuccess();
    }
  };

  const personTypeOptions: PersonType[] = ["colaborador", "socio", "prestador"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
              <Label htmlFor="documento">Documento (CPF/RG)</Label>
              <Input id="documento" value={form.documento} onChange={(e) => update("documento", e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="idade">Idade</Label>
              <Input id="idade" type="number" value={form.idade} onChange={(e) => update("idade", e.target.value)} placeholder="25" />
            </div>
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
              <Label htmlFor="setor">Setor</Label>
              <Input id="setor" value={form.setor} onChange={(e) => update("setor", e.target.value)} placeholder="Marketing" />
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
