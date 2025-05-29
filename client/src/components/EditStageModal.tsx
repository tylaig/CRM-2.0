import { useState, useEffect } from "react";
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
import { Edit2Icon, Trash2Icon } from "lucide-react";

interface EditStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  stage: PipelineStage | null;
}

export default function EditStageModal({ isOpen, onClose, stage }: EditStageModalProps) {
  const [name, setName] = useState("");
  const { toast } = useToast();
  
  useEffect(() => {
    if (stage) {
      setName(stage.name);
    }
  }, [stage]);
  
  const updateStageMutation = useMutation({
    mutationFn: async () => {
      if (!stage) return null;
      
      const payload = {
        name,
        order: stage.order
      };
      // Corrigindo a ordem dos parâmetros para corresponder à função apiRequest
      return await apiRequest(`/api/pipeline-stages/${stage.id}`, 'PUT', payload);
    },
    onSuccess: () => {
      toast({
        title: "Estágio atualizado",
        description: "As alterações foram salvas com sucesso.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o estágio. Por favor, tente novamente.",
        variant: "destructive",
      });
      console.error("Update stage error:", error);
    }
  });
  
  const deleteStageMutation = useMutation({
    mutationFn: async () => {
      if (!stage) return null;
      try {
        const response = await fetch(`/api/pipeline-stages/${stage.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 204) {
          return true; // Sucesso na exclusão
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Erro ao excluir estágio');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Delete stage error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Estágio excluído",
        description: "O estágio foi excluído com sucesso.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o estágio. Verifique se não existem negócios associados a ele.",
        variant: "destructive",
      });
      console.error("Delete stage error:", error);
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
    
    updateStageMutation.mutate();
  };
  
  const handleDelete = () => {
    if (confirm("Tem certeza que deseja excluir este estágio? Todos os negócios associados serão afetados.")) {
      deleteStageMutation.mutate();
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2Icon className="h-5 w-5 text-primary" />
            Editar Estágio
          </DialogTitle>
          <DialogDescription>
            Modifique os detalhes do estágio do pipeline.
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
        
        <DialogFooter className="flex justify-between">
          <Button 
            variant="destructive" 
            className="flex items-center gap-2" 
            onClick={handleDelete}
          >
            <Trash2Icon className="h-4 w-4" />
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updateStageMutation.isPending || deleteStageMutation.isPending}
            >
              {updateStageMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}