import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddColaboradorDialog({ open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome_completo: "",
    documento: "",
    genero: "",
    sexo: "",
    setor: "",
    cargo: "",
    data_admissao: "",
    idade: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_completo || !form.documento || !form.genero || !form.sexo || !form.setor || !form.cargo || !form.data_admissao || !form.idade) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("colaboradores").insert({
      ...form,
      idade: parseInt(form.idade),
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao cadastrar: " + error.message);
    } else {
      toast.success("Colaborador cadastrado com sucesso!");
      setForm({ nome_completo: "", documento: "", genero: "", sexo: "", setor: "", cargo: "", data_admissao: "", idade: "" });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Novo Colaborador</DialogTitle>
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
            {loading ? "Salvando..." : "Cadastrar Colaborador"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
