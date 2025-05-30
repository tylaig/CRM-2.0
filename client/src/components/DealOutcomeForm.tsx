import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Deal, LossReason } from "@shared/schema";
import { formatCurrency } from "@/lib/formatters";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2Icon,
  XCircleIcon,
  AlertCircleIcon,
} from "lucide-react";

interface DealOutcomeFormProps {
  deal: Deal | null;
  onSuccess: () => void;
}

export default function DealOutcomeForm({ deal, onSuccess }: DealOutcomeFormProps) {
  const [outcome, setOutcome] = useState<"won" | "lost" | "">("");
  const [lossReason, setLossReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [notes, setNotes] = useState("");
  const [finalValue, setFinalValue] = useState(deal?.value ? formatCurrency(deal.value) : "");
  const [salePerformance, setSalePerformance] = useState<"below_quote" | "according_to_quote" | "above_quote" | "">("");
  
  const { toast } = useToast();
  
  // Carregar motivos de perda
  const { data: lossReasons = [] } = useQuery<LossReason[]>({
    queryKey: ['/api/loss-reasons'],
    enabled: outcome === "lost",
  });
  
  useEffect(() => {
    // Resetar estado quando o deal mudar
    if (deal) {
      setOutcome("");
      setLossReason("");
      setCustomReason("");
      setNotes("");
      setFinalValue(deal.value ? formatCurrency(deal.value) : "");
      setSalePerformance("");
    }
  }, [deal]);
  
  // Format currency input
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^\d]/g, "");
    const numericValue = parseInt(rawValue) / 100;
    
    if (!isNaN(numericValue)) {
      setFinalValue(formatCurrency(numericValue));
    } else if (rawValue === "") {
      setFinalValue("");
    }
  };
  
  // Buscar os estágios do pipeline para encontrar os estágios de "completed" e "lost"
  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['/api/pipeline-stages'],
    select: (data) => data || [],
  });
  
  const updateDealMutation = useMutation({
    mutationFn: async () => {
      if (!deal) return null;
      
      // Parsear valor numérico
      const numericValue = finalValue
        ? parseFloat(finalValue.replace(/[^\d,]/g, "").replace(",", "."))
        : 0;
      
      // Encontrar o estágio correto baseado no outcome (ganho ou perdido)
      const targetStageType = outcome === "won" ? "completed" : "lost";
      const targetStage = pipelineStages.find(
        (stage) => stage.stageType === targetStageType && stage.pipelineId === deal.pipelineId
      );
      
      console.log("Buscando estágio para mover o negócio:", { 
        outcome, 
        targetStageType, 
        foundStage: targetStage,
        pipelineId: deal.pipelineId,
        availableStages: pipelineStages.map(s => ({ id: s.id, name: s.name, type: s.stageType, pipelineId: s.pipelineId }))
      });
      
      const payload: any = {
        saleStatus: outcome,
        value: numericValue,
      };
      
      // Importante: Definir o novo stageId para mover o negócio para o estágio correto
      if (targetStage) {
        payload.stageId = targetStage.id;
        console.log(`Movendo negócio para o estágio ${targetStage.name} (ID: ${targetStage.id})`);
      } else {
        console.error(`Não foi possível encontrar estágio do tipo ${targetStageType} para o pipeline ${deal.pipelineId}`);
      }
      
      // Adicionar informações específicas com base no resultado
      if (outcome === "won") {
        // Adicionar o desempenho da venda quando o negócio for ganho
        payload.salePerformance = salePerformance;
      } else if (outcome === "lost") {
        // Se for "Outro", usar o motivo personalizado
        payload.lostReason = lossReason === "other" ? customReason : lossReason;
        payload.lostNotes = notes;
      }
      
      console.log("Enviando payload:", payload);
      return await apiRequest(`/api/deals/${deal.id}`, 'PUT', payload);
    },
    onSuccess: async () => {
      toast({
        title: outcome === "won" ? "Negócio Fechado!" : "Negócio Marcado como Perdido",
        description: outcome === "won" 
          ? "O negócio foi movido para a lista de vendas concluídas." 
          : "O negócio foi movido para a lista de oportunidades perdidas.",
        variant: "default",
      });
      
      // Sincronizar os estágios dos negócios (para garantir consistência)
      try {
        const syncResponse = await apiRequest('/api/deals/sync-stages', 'POST', {});
        console.log("Estágios dos negócios sincronizados com sucesso", syncResponse);
      } catch (syncError) {
        console.error("Erro ao sincronizar estágios:", syncError);
        // Continuamos mesmo se a sincronização falhar
      }
      
      // Invalidar cache para forçar atualização dos dados
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      
      // Notificar componente pai
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Erro ao Atualizar",
        description: "Não foi possível atualizar o status do negócio. Tente novamente.",
        variant: "destructive",
      });
      console.error("Update deal error:", error);
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!outcome) {
      toast({
        title: "Selecione um Resultado",
        description: "Você precisa selecionar se o negócio foi ganho ou perdido.",
        variant: "destructive",
      });
      return;
    }
    
    if (outcome === "won" && !salePerformance) {
      toast({
        title: "Desempenho Obrigatório",
        description: "Por favor, indique se a venda foi abaixo, de acordo ou acima da cotação.",
        variant: "destructive",
      });
      return;
    }
    
    if (outcome === "lost" && !lossReason) {
      toast({
        title: "Motivo Obrigatório",
        description: "Por favor, selecione um motivo para a perda do negócio.",
        variant: "destructive",
      });
      return;
    }
    
    updateDealMutation.mutate();
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Resultado do Negócio</Label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Button
              type="button"
              variant={outcome === "won" ? "default" : "outline"}
              className={`h-16 flex flex-col items-center justify-center gap-1 ${
                outcome === "won" ? "border-green-500 bg-green-50 text-green-700" : ""
              }`}
              onClick={() => setOutcome("won")}
            >
              <CheckCircle2Icon className={`h-5 w-5 ${outcome === "won" ? "text-green-500" : "text-gray-400"}`} />
              <span>Ganho</span>
            </Button>
            
            <Button
              type="button"
              variant={outcome === "lost" ? "default" : "outline"}
              className={`h-16 flex flex-col items-center justify-center gap-1 ${
                outcome === "lost" ? "border-red-500 bg-red-50 text-red-700" : ""
              }`}
              onClick={() => setOutcome("lost")}
            >
              <XCircleIcon className={`h-5 w-5 ${outcome === "lost" ? "text-red-500" : "text-gray-400"}`} />
              <span>Perdido</span>
            </Button>
          </div>
        </div>
        
        {outcome === "won" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="final-value">Valor Final</Label>
              <Input
                id="final-value"
                value={finalValue}
                onChange={handleValueChange}
                placeholder="R$ 0,00"
              />
              <p className="text-sm text-gray-500">Informe o valor final do negócio fechado.</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sale-performance">Desempenho da Venda</Label>
              <Select value={salePerformance} onValueChange={(value) => setSalePerformance(value as "below_quote" | "according_to_quote" | "above_quote" | "")}>
                <SelectTrigger id="sale-performance">
                  <SelectValue placeholder="Selecione o desempenho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="below_quote">Abaixo da cotação</SelectItem>
                  <SelectItem value="according_to_quote">De acordo com a cotação</SelectItem>
                  <SelectItem value="above_quote">Acima da cotação</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Indique como o valor final se compara com o valor cotado originalmente.
              </p>
            </div>
          </>
        )}
        
        {outcome === "lost" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="loss-reason">Motivo da Perda</Label>
              <Select value={lossReason} onValueChange={setLossReason}>
                <SelectTrigger id="loss-reason">
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent>
                  {lossReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.reason}>
                      {reason.reason}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Outro (especificar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {lossReason === "other" && (
              <div className="space-y-2">
                <Label htmlFor="custom-reason">Motivo Personalizado</Label>
                <Input
                  id="custom-reason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Especifique o motivo"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-1">
                <span>Observações</span>
                <AlertCircleIcon className="h-3.5 w-3.5 text-gray-400" />
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalhes adicionais sobre a perda"
                rows={3}
              />
              <p className="text-sm text-gray-500">
                Descreva qualquer informação adicional que possa ser útil para futura análise.
              </p>
            </div>
          </>
        )}
      </div>
      
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          type="submit"
          disabled={updateDealMutation.isPending}
          className={
            outcome === "won" 
              ? "bg-green-600 hover:bg-green-700" 
              : outcome === "lost" 
                ? "bg-red-600 hover:bg-red-700" 
                : ""
          }
        >
          {updateDealMutation.isPending 
            ? "Salvando..." 
            : outcome === "won" 
              ? "Confirmar Venda" 
              : outcome === "lost" 
                ? "Confirmar Perda" 
                : "Confirmar"
          }
        </Button>
      </div>
    </form>
  );
}