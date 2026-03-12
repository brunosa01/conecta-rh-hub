import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingId?: string | null;
  initialData?: ColaboradorForm | null;
}

export function ColaboradorDialog({ open, onOpenChange, onSuccess, editingId, initialData }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ColaboradorForm>(emptyForm);

  useEffect(() => {
    if (open) {
      setForm(initialData || emptyForm);
    }
  }, [open, initialData]);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isEditing = !!editingId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_completo || !form.documento || !form.genero || !form.sexo || !form.setor || !form.cargo || !form.data_admissao || !form.idade || !form.escolaridade) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    const payload = { ...form, idade: parseInt(form.idade) };

    const { error } = isEditing
      ? await supabase.from("colaboradores").update(payload).eq("id", editingId)
      : await supabase.from("colaboradores").insert(payload);

    setLoading(false);
    if (error) {
      toast.error(`Erro ao ${isEditing ? "atualizar" : "cadastrar"}: ${error.message}`);
    } else {
      toast.success(`Colaborador ${isEditing ? "atualizado" : "cadastrado"} com sucesso!`);
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isEditing ? "Editar Colaborador" : "Novo Colaborador"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 pt-2">
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
          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? "Salvando..." : isEditing ? "Salvar Alterações" : "Cadastrar Colaborador"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
