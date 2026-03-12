import { BarChart3 } from "lucide-react";

export default function Indicadores() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <BarChart3 className="mb-3 h-12 w-12 opacity-30" />
      <p className="text-lg font-medium">Indicadores</p>
      <p className="text-sm">Em breve</p>
    </div>
  );
}
