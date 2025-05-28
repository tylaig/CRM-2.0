import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Deal, LossReason } from '@shared/schema';

type DealOutcomeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  deal: Partial<Deal>;
  targetStageId: number;
  targetStageType: 'completed' | 'lost' | null;
};

export default function DealOutcomeModal({ isOpen, onClose, deal, targetStageId, targetStageType }: DealOutcomeModalProps) {
  const { toast } = useToast();

  // Estado para os campos do formulário
  const [salePerformance, setSalePerformance] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');

  // Buscar razões de perda
  const { data: lossReasons } = useQuery({
    queryKey: ['/api/loss-reasons'],
    enabled: targetStageType === 'lost',
  });
  
  // Adicionar logs para depuração
  console.log("Modal de resultado aberto:", targetStageType, targetStageId, deal?.id);

  // Mutação para atualizar o deal
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const updatedDeal: Partial<Deal> = {
        stageId: targetStageId,
        saleStatus: targetStageType === 'completed' ? 'won' : targetStageType === 'lost' ? 'lost' : null,
      };

      // Adicionar detalhes específicos baseados no tipo de estágio
      if (targetStageType === 'completed') {
        updatedDeal.salePerformance = salePerformance;
      } else if (targetStageType === 'lost') {
        // Para o lostReason, envie o ID como uma string que será tratada no backend
        // Isso evita problemas de tipagem com o Drizzle/PostgreSQL
        updatedDeal.lostReason = lostReason;
        updatedDeal.lostNotes = notes;
      }

      const response = await apiRequest('/api/deals/' + deal.id, 'PUT', updatedDeal);
      return response;
    },
    onSuccess: () => {
      // Registrar atividade de movimentação
      const activityDescription = targetStageType === 'completed' 
        ? `Negócio marcado como Venda Realizada (${salePerformance === 'above' ? 'Acima da cotação' : 
           salePerformance === 'below' ? 'Abaixo da cotação' : 'De acordo com a cotação'})` 
        : `Negócio marcado como Venda Perdida`;

      apiRequest('/api/lead-activities', 'POST', {
        dealId: deal.id,
        description: activityDescription,
        activityType: targetStageType === 'completed' ? 'sale_won' : 'sale_lost',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: targetStageType === 'completed' ? 'Venda realizada!' : 'Venda perdida registrada',
        description: targetStageType === 'completed' 
          ? 'O negócio foi movido para a coluna de vendas realizadas.'
          : 'O negócio foi movido para a coluna de vendas perdidas.',
      });
      onClose();
    },
    onError: (error) => {
      console.error('Erro ao atualizar negócio:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status do negócio.',
        variant: 'destructive',
      });
    },
  });

  // Verificar se todos os campos requeridos estão preenchidos
  const isFormValid = () => {
    if (targetStageType === 'completed') {
      return salePerformance !== null;
    } else if (targetStageType === 'lost') {
      return lostReason !== null;
    }
    return true;
  };

  // Resetar estados ao abrir o modal ou mudar de negócio
  useEffect(() => {
    if (isOpen) {
      setSalePerformance(null);
      setLostReason(null);
      setNotes('');
    }
  }, [isOpen, deal?.id, targetStageType]);

  // Renderizar formulário baseado no tipo de estágio
  const renderForm = () => {
    if (targetStageType === 'completed') {
      return (
        <div className="space-y-4 py-2">
          <div className="pb-4">
            <Label htmlFor="salePerformance" className="text-base font-semibold mb-3 block">
              Como foi o desempenho desta venda em relação à cotação?
            </Label>
            <RadioGroup
              value={salePerformance || ''}
              onValueChange={(value) => setSalePerformance(value)}
              className="gap-4"
            >
              <div className="flex items-center space-x-2 rounded-md border p-3 shadow-sm bg-white hover:bg-gray-50">
                <RadioGroupItem value="above" id="above" />
                <Label htmlFor="above" className="flex flex-col gap-1 font-normal">
                  <span className="font-medium">Acima da cotação</span>
                  <span className="text-xs text-muted-foreground">O valor final foi maior que o valor cotado</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border p-3 shadow-sm bg-white hover:bg-gray-50">
                <RadioGroupItem value="match" id="match" />
                <Label htmlFor="match" className="flex flex-col gap-1 font-normal">
                  <span className="font-medium">De acordo com a cotação</span>
                  <span className="text-xs text-muted-foreground">O valor final foi igual ao valor cotado</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border p-3 shadow-sm bg-white hover:bg-gray-50">
                <RadioGroupItem value="below" id="below" />
                <Label htmlFor="below" className="flex flex-col gap-1 font-normal">
                  <span className="font-medium">Abaixo da cotação</span>
                  <span className="text-xs text-muted-foreground">O valor final foi menor que o valor cotado</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor="notes" className="text-base font-semibold mb-3 block">
              Observações adicionais (opcional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Digite observações sobre esta venda, caso necessário"
              className="resize-none h-24"
            />
          </div>
        </div>
      );
    } else if (targetStageType === 'lost') {
      return (
        <div className="space-y-4 py-2">
          <div className="pb-4">
            <Label htmlFor="lossReason" className="text-base font-semibold mb-3 block">
              Qual o motivo da perda?
            </Label>
            <Select 
              value={lostReason || ''} 
              onValueChange={(value) => setLostReason(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo da perda" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(lossReasons) && lossReasons.map((reason: LossReason) => (
                  <SelectItem key={reason.id} value={reason.id.toString()}>
                    {reason.reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes" className="text-base font-semibold mb-3 block">
              Detalhes sobre a perda
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Forneça mais informações sobre o motivo da perda"
              className="resize-none h-24"
            />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {targetStageType === 'completed' ? 'Registrar Venda Realizada' : 'Registrar Venda Perdida'}
          </DialogTitle>
          <DialogDescription>
            {targetStageType === 'completed'
              ? 'Por favor, forneça informações sobre o desempenho desta venda.'
              : 'Por favor, informe o motivo da perda deste negócio.'}
          </DialogDescription>
        </DialogHeader>

        {renderForm()}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => mutate()} 
            disabled={isPending || !isFormValid()}
            className={targetStageType === 'completed' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {isPending ? 'Salvando...' : 'Confirmar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}