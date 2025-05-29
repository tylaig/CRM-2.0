import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type PipelineStage } from "@shared/schema";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon } from "lucide-react";

interface AddStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineStages: PipelineStage[];
  pipelineId: number;
}

export default function AddStageModal({ isOpen, onClose, pipelineStages, pipelineId }: AddStageModalProps) {
  const [name, setName] = useState("");
  const { toast } = useToast();
  
  const createStageMutation = useMutation({
    mutationFn: async () => {
      // Calcular a próxima ordem baseada nas etapas existentes
      const nextOrder = pipelineStages.length > 0 
        ? Math.max(...pipelineStages.map(stage => stage.order)) + 1 
        : 1;
      
      const payload = {
        name,
        order: nextOrder,
        pipelineId: pipelineId
      };
      // Corrigindo a ordem dos parâmetros para corresponder à função apiRequest
      return await apiRequest('/api/pipeline-stages', 'POST', payload);
    },
    onSuccess: async () => {
      toast({
        title: "Estágio criado",
        description: "O novo estágio foi adicionado com sucesso.",
        variant: "default",
      });
      // Invalidar e forçar recarregamento imediato
      await queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] });
      await queryClient.refetchQueries({ queryKey: ['/api/pipeline-stages'] });
      
      // Esperar um momento para garantir que tudo foi recarregado
      setTimeout(() => {
        // Também invalidar os negócios relacionados para garantir consistência
        queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      }, 100);
      
      setName("");
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar",
        description: "Não foi possível criar o estágio. Por favor, tente novamente.",
        variant: "destructive",
      });
      console.error("Create stage error:", error);
    }
  });
  
  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insira um nome para o estágio.",
        variant: "destructive",
      });
      return;
    }
    
    createStageMutation.mutate();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusIcon className="h-5 w-5 text-primary" />
            Adicionar Estágio
          </DialogTitle>
          <DialogDescription>
            Crie um novo estágio para o pipeline.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="stage-name">Nome do Estágio</Label>
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite o nome do estágio"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={createStageMutation.isPending}
          >
            {createStageMutation.isPending ? "Criando..." : "Criar Estágio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}