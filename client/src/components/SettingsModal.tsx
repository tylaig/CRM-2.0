import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  PlusCircle, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  Settings, 
  MessageSquare,
  Layers,
  XCircle,
  Car,
  BuildingIcon,
  FileLineChart,
  UserIcon
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Settings as SettingsType, PipelineStage, LossReason, MachineBrand, SalePerformanceReason, Pipeline, MachineModel } from "@shared/schema";
import { useAuth } from "@/components/AuthProvider";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState("chatwoot");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Consulta para carregar configurações
  const { data: settings } = useQuery<SettingsType>({
    queryKey: ['/api/settings'],
  });

  // Consulta para carregar os pipelines disponíveis
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ['/api/pipelines'],
  });
  
  // Estado para controlar pipeline selecionado na tela de configurações
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  
  // Consulta para carregar estágios do pipeline selecionado
  const { data: pipelineStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['/api/pipeline-stages', selectedPipelineId],
    queryFn: async () => {
      const url = selectedPipelineId 
        ? `/api/pipeline-stages?pipelineId=${selectedPipelineId}` 
        : '/api/pipeline-stages';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Falha ao carregar estágios do pipeline');
      }
      return response.json();
    },
    enabled: !!selectedPipelineId,
  });

  // Consulta para carregar motivos de perdas
  const { data: lossReasons = [] } = useQuery<LossReason[]>({
    queryKey: ['/api/loss-reasons'],
  });

  // Consulta para carregar marcas de máquinas
  const { data: machineBrands = [] } = useQuery<MachineBrand[]>({
    queryKey: ['/api/machine-brands'],
    enabled: activeTab === "machine-brands" || activeTab === "models",
  });
  
  // Estado para controlar a marca selecionada para filtrar modelos
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  
  // Consulta para carregar modelos de máquinas
  const { data: machineModels = [] } = useQuery<MachineModel[]>({
    queryKey: ['/api/machine-models', selectedBrandId],
    queryFn: async () => {
      const url = selectedBrandId 
        ? `/api/machine-models?brandId=${selectedBrandId}` 
        : '/api/machine-models';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Falha ao carregar modelos de máquinas');
      }
      return response.json();
    },
    enabled: activeTab === "models" && !!selectedBrandId,
  });
  
  // Consulta para carregar motivos de desempenho de vendas
  const { data: performanceReasons = [] } = useQuery<SalePerformanceReason[]>({
    queryKey: ['/api/sale-performance-reasons'],
  });

  // Campos para a configuração do Chatwoot
  const [chatwootUrl, setChatwootUrl] = useState(settings?.chatwootUrl || "");
  const [chatwootApiKey, setChatwootApiKey] = useState(settings?.chatwootApiKey || "");
  const [accountId, setAccountId] = useState(settings?.accountId || "");
  
  // Estado para controlar o pipeline padrão
  const [defaultPipelineId, setDefaultPipelineId] = useState<number | null>(settings?.activePipelineId || null);

  // Inicializa o selectedPipelineId quando os pipelines são carregados
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [pipelines, selectedPipelineId]);
  
  // Estados para edição de estágios
  const [newStageName, setNewStageName] = useState("");
  const [editingStage, setEditingStage] = useState<{ id: number, name: string } | null>(null);

  // Estados para edição de motivos de perda
  const [newLossReason, setNewLossReason] = useState("");
  const [editingLossReason, setEditingLossReason] = useState<{ id: number, reason: string } | null>(null);

  // Estados para edição de marcas de máquinas
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandDescription, setNewBrandDescription] = useState("");
  const [editingBrand, setEditingBrand] = useState<{ id: number, name: string, description: string | null } | null>(null);
  
  // Estados para edição de modelos de máquinas
  const [newModelName, setNewModelName] = useState("");
  const [editingModel, setEditingModel] = useState<{ id: number, name: string, brandId: number } | null>(null);
  
  // Estados para edição de motivos de desempenho de vendas
  const [newPerformanceReason, setNewPerformanceReason] = useState("");
  const [newPerformanceValue, setNewPerformanceValue] = useState("");
  const [newPerformanceDescription, setNewPerformanceDescription] = useState("");
  const [editingPerformance, setEditingPerformance] = useState<{ id: number, reason: string, value: string, description: string | null } | null>(null);

  // Mutation para salvar configurações
  const saveChatwootMutation = useMutation({
    mutationFn: async (data: { chatwootApiKey: string, chatwootUrl: string, accountId: string }) => {
      return await apiRequest('/api/settings', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Configurações salvas",
        description: "As configurações do Chatwoot foram salvas com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: `Ocorreu um erro ao salvar as configurações: ${error}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para salvar o pipeline padrão
  const saveDefaultPipelineMutation = useMutation({
    mutationFn: async (data: { activePipelineId: number | null }) => {
      return await apiRequest('/api/settings', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Pipeline padrão",
        description: "O pipeline padrão foi configurado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: `Ocorreu um erro ao definir o pipeline padrão: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para criar estágio
  const createStageMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      if (!selectedPipelineId) {
        throw new Error("Selecione um pipeline primeiro");
      }
      return await apiRequest('/api/pipeline-stages', 'POST', {
        name: data.name,
        order: pipelineStages.length + 1,
        pipelineId: selectedPipelineId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages', selectedPipelineId] });
      setNewStageName("");
      toast({
        title: "Estágio criado",
        description: "O estágio foi criado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar",
        description: `Ocorreu um erro ao criar o estágio: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para atualizar estágio
  const updateStageMutation = useMutation({
    mutationFn: async (data: { id: number, name: string }) => {
      console.log("Chamando API para atualizar estágio:", data);
      if (!selectedPipelineId) {
        throw new Error("Selecione um pipeline primeiro");
      }
      // Certificando-se de passar os argumentos na ordem correta
      return await apiRequest(`/api/pipeline-stages/${data.id}`, 'PUT', {
        name: data.name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages', selectedPipelineId] });
      setEditingStage(null);
      toast({
        title: "Estágio atualizado",
        description: "O estágio foi atualizado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: `Ocorreu um erro ao atualizar o estágio: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para excluir estágio
  const deleteStageMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!selectedPipelineId) {
        throw new Error("Selecione um pipeline primeiro");
      }
      return await apiRequest(`/api/pipeline-stages/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages', selectedPipelineId] });
      toast({
        title: "Estágio excluído",
        description: "O estágio foi excluído com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir",
        description: `Ocorreu um erro ao excluir o estágio: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para criar motivo de perda
  const createLossReasonMutation = useMutation({
    mutationFn: async (data: { reason: string }) => {
      return await apiRequest('/api/loss-reasons', 'POST', {
        reason: data.reason,
        active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loss-reasons'] });
      setNewLossReason("");
      toast({
        title: "Motivo criado",
        description: "O motivo de perda foi criado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar",
        description: `Ocorreu um erro ao criar o motivo de perda: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para atualizar motivo de perda
  const updateLossReasonMutation = useMutation({
    mutationFn: async (data: { id: number, reason: string }) => {
      return await apiRequest(`/api/loss-reasons/${data.id}`, 'PUT', {
        reason: data.reason
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loss-reasons'] });
      setEditingLossReason(null);
      toast({
        title: "Motivo atualizado",
        description: "O motivo de perda foi atualizado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: `Ocorreu um erro ao atualizar o motivo: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para excluir motivo de perda
  const deleteLossReasonMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/loss-reasons/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loss-reasons'] });
      toast({
        title: "Motivo excluído",
        description: "O motivo de perda foi excluído com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir",
        description: `Ocorreu um erro ao excluir o motivo: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para criar marca
  const createBrandMutation = useMutation({
    mutationFn: async (data: { name: string, description: string }) => {
      return await apiRequest('/api/machine-brands', 'POST', {
        name: data.name,
        description: data.description,
        active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/machine-brands'] });
      setNewBrandName("");
      setNewBrandDescription("");
      toast({
        title: "Marca criada",
        description: "A marca foi criada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar",
        description: `Ocorreu um erro ao criar a marca: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para atualizar marca
  const updateBrandMutation = useMutation({
    mutationFn: async (data: { id: number, name: string, description: string }) => {
      return await apiRequest(`/api/machine-brands/${data.id}`, 'PUT', {
        name: data.name,
        description: data.description
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/machine-brands'] });
      setEditingBrand(null);
      toast({
        title: "Marca atualizada",
        description: "A marca foi atualizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: `Ocorreu um erro ao atualizar a marca: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para excluir marca
  const deleteBrandMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const response = await fetch(`/api/machine-brands/${id}`, {
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
          throw new Error(errorData.message || 'Erro ao excluir marca');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Delete brand error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/machine-brands'] });
      toast({
        title: "Marca excluída",
        description: "A marca foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Ocorreu um erro ao excluir a marca.",
        variant: "destructive",
      });
    }
  });
  
  // Mutation para criar modelo
  const createModelMutation = useMutation({
    mutationFn: async (data: { name: string, brandId: number }) => {
      return await apiRequest('/api/machine-models', 'POST', {
        name: data.name,
        brandId: data.brandId,
        active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/machine-models', selectedBrandId] });
      setNewModelName("");
      toast({
        title: "Modelo criado",
        description: "O modelo foi criado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar",
        description: `Ocorreu um erro ao criar o modelo: ${error}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para atualizar modelo
  const updateModelMutation = useMutation({
    mutationFn: async (data: { id: number, name: string, brandId: number }) => {
      return await apiRequest(`/api/machine-models/${data.id}`, 'PUT', {
        name: data.name,
        brandId: data.brandId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/machine-models', selectedBrandId] });
      setEditingModel(null);
      toast({
        title: "Modelo atualizado",
        description: "O modelo foi atualizado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: `Ocorreu um erro ao atualizar o modelo: ${error}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para excluir modelo
  const deleteModelMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const response = await fetch(`/api/machine-models/${id}`, {
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
          throw new Error(errorData.message || 'Erro ao excluir modelo');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Delete model error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/machine-models', selectedBrandId] });
      toast({
        title: "Modelo excluído",
        description: "O modelo foi excluído com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Ocorreu um erro ao excluir o modelo.",
        variant: "destructive",
      });
    }
  });
  // Mutation para criar motivo de desempenho
  const createPerformanceReasonMutation = useMutation({
    mutationFn: async (data: { reason: string, value: string, description: string }) => {
      return await apiRequest('/api/sale-performance-reasons', 'POST', {
        reason: data.reason,
        value: data.value,
        description: data.description || null,
        active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sale-performance-reasons'] });
      setNewPerformanceReason("");
      setNewPerformanceValue("");
      setNewPerformanceDescription("");
      toast({
        title: "Motivo criado",
        description: "O motivo de desempenho foi criado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar",
        description: `Ocorreu um erro ao criar o motivo de desempenho: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para atualizar motivo de desempenho
  const updatePerformanceReasonMutation = useMutation({
    mutationFn: async (data: { id: number, reason: string, value: string, description: string }) => {
      return await apiRequest(`/api/sale-performance-reasons/${data.id}`, 'PUT', {
        reason: data.reason,
        value: data.value,
        description: data.description
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sale-performance-reasons'] });
      setEditingPerformance(null);
      toast({
        title: "Motivo atualizado",
        description: "O motivo de desempenho foi atualizado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: `Ocorreu um erro ao atualizar o motivo: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para excluir motivo de desempenho
  const deletePerformanceReasonMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/sale-performance-reasons/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sale-performance-reasons'] });
      toast({
        title: "Motivo excluído",
        description: "O motivo de desempenho foi excluído com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir",
        description: `Ocorreu um erro ao excluir o motivo: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Função para salvar configurações do Chatwoot
  const saveChatwootSettings = () => {
    saveChatwootMutation.mutate({
      chatwootApiKey,
      chatwootUrl,
      accountId
    });
  };
  
  // Função para salvar o pipeline padrão
  const saveDefaultPipeline = () => {
    saveDefaultPipelineMutation.mutate({
      activePipelineId: defaultPipelineId
    });
  };

  // Função para criar estágio
  const createStage = () => {
    if (!newStageName.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do estágio é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    createStageMutation.mutate({ name: newStageName });
  };

  // Função para atualizar estágio
  const updateStage = () => {
    if (!editingStage) return;
    if (!editingStage.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do estágio é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    console.log("Atualizando estágio:", editingStage);
    
    // Chamada direta para debugar
    try {
      updateStageMutation.mutate({
        id: editingStage.id,
        name: editingStage.name
      });
    } catch (error) {
      console.error("Erro ao atualizar estágio:", error);
    }
  };

  // Função para criar motivo de perda
  const createLossReason = () => {
    if (!newLossReason.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O motivo de perda é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    createLossReasonMutation.mutate({ reason: newLossReason });
  };

  // Função para atualizar motivo de perda
  const updateLossReason = () => {
    if (!editingLossReason) return;
    if (!editingLossReason.reason.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O motivo de perda é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    updateLossReasonMutation.mutate({
      id: editingLossReason.id,
      reason: editingLossReason.reason
    });
  };

  // Função para criar marca
  const createBrand = () => {
    if (!newBrandName.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome da marca é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    createBrandMutation.mutate({ 
      name: newBrandName,
      description: newBrandDescription 
    });
  };

  // Função para atualizar marca
  const updateBrand = () => {
    if (!editingBrand) return;
    if (!editingBrand.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome da marca é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    updateBrandMutation.mutate({
      id: editingBrand.id,
      name: editingBrand.name,
      description: editingBrand.description || ""
    });
  };
  
  // Função para criar modelo
  const createModel = () => {
    if (!selectedBrandId) {
      toast({
        title: "Marca obrigatória",
        description: "Selecione uma marca para adicionar o modelo.",
        variant: "destructive"
      });
      return;
    }
    
    if (!newModelName.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do modelo é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    createModelMutation.mutate({ 
      name: newModelName,
      brandId: selectedBrandId
    });
  };

  // Função para atualizar modelo
  const updateModel = () => {
    if (!editingModel) return;
    
    if (!editingModel.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do modelo é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    updateModelMutation.mutate({
      id: editingModel.id,
      name: editingModel.name,
      brandId: editingModel.brandId
    });
  };

  // --- Usuários ---
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: user?.role === 'admin',
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; role: string }) => {
      return await apiRequest('/api/users', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');
      toast({ title: 'Usuário criado', description: 'Usuário criado com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar usuário', description: String(error), variant: 'destructive' });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number; role: string }) => {
      return await apiRequest(`/api/users/${data.id}`, 'PUT', { role: data.role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setEditingUserId(null);
      toast({ title: 'Usuário atualizado', description: 'Permissão atualizada.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar usuário', description: String(error), variant: 'destructive' });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/users/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: 'Usuário excluído', description: 'Usuário removido com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir usuário', description: String(error), variant: 'destructive' });
    }
  });

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUserRole, setEditingUserRole] = useState('user');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações do Sistema
          </DialogTitle>
          <DialogDescription>
            Gerencie as configurações e recursos do CRM
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="chatwoot" value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            className="flex gap-2 px-2 py-1 bg-gray-100 rounded-lg overflow-x-auto items-center whitespace-nowrap"
          >
            <TabsTrigger value="chatwoot" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Chatwoot
            </TabsTrigger>
            <TabsTrigger value="pipelines" className="flex items-center gap-1">
              <FileLineChart className="h-4 w-4" />
              Pipelines
            </TabsTrigger>
            <TabsTrigger value="machine-brands" className="flex items-center gap-1">
              <Car className="h-4 w-4" />
              Marcas
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="10" x="3" y="8" rx="2" />
                <path d="M10 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                <path d="M8 16v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
              </svg>
              Modelos
            </TabsTrigger>
            <TabsTrigger value="loss-reasons" className="flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              Motivos de Perda
            </TabsTrigger>
            <TabsTrigger value="sale-performance" className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m22 7-7.9 7.9-4.1-4.1L2 19"></path>
                <circle cx="22" cy="7" r="2"></circle>
                <circle cx="2" cy="19" r="2"></circle>
              </svg>
              Desempenho
            </TabsTrigger>
            {user?.role === 'admin' && (
              <TabsTrigger value="users" className="flex items-center gap-1">
                <UserIcon className="h-4 w-4" />
                Usuários
              </TabsTrigger>
            )}
          </TabsList>

          {/* Aba Chatwoot */}
          <TabsContent value="chatwoot">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Integração com Chatwoot</CardTitle>
                <CardDescription>
                  Configure a integração com o Chatwoot para sincronizar contatos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="chatwoot-url">URL do Chatwoot</Label>
                  <Input
                    id="chatwoot-url"
                    placeholder="https://app.chatwoot.com"
                    value={chatwootUrl}
                    onChange={(e) => setChatwootUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: https://app.chatwoot.com ou seu domínio personalizado
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-key">Chave de API</Label>
                  <Input
                    id="api-key"
                    placeholder="Sua chave de API do Chatwoot"
                    value={chatwootApiKey}
                    onChange={(e) => setChatwootApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Você pode gerar uma chave de API nas configurações do seu perfil no Chatwoot
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-id">ID da Conta</Label>
                  <Input
                    id="account-id"
                    placeholder="ID da sua conta no Chatwoot"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    O ID da conta pode ser encontrado na URL ao navegar no Chatwoot (Ex: /app/accounts/1)
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button 
                  onClick={saveChatwootSettings} 
                  disabled={saveChatwootMutation.isPending}
                >
                  {saveChatwootMutation.isPending ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Aba Pipelines */}
          <TabsContent value="pipelines">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileLineChart className="h-5 w-5" />
                    Gerenciamento de Pipelines
                  </div>
                </CardTitle>
                <CardDescription>
                  Escolha o pipeline padrão que será mostrado quando o sistema for carregado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="defaultPipeline">Pipeline Padrão</Label>
                    <div className="grid gap-4">
                      <select
                        id="defaultPipeline"
                        className="w-full p-2 rounded-md border"
                        value={defaultPipelineId || ""}
                        onChange={(e) => setDefaultPipelineId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Selecione um pipeline</option>
                        {pipelines.map((pipeline) => (
                          <option key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                          </option>
                        ))}
                      </select>
                      
                      <p className="text-sm text-gray-500">
                        O pipeline selecionado será carregado automaticamente quando o usuário abrir o sistema.
                      </p>
                      
                      <Button 
                        onClick={saveDefaultPipeline} 
                        className="w-full md:w-auto"
                        disabled={saveDefaultPipelineMutation.isPending}
                      >
                        {saveDefaultPipelineMutation.isPending ? "Salvando..." : "Salvar Pipeline Padrão"}
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-lg font-medium mb-2">Gerenciar Estágios dos Pipelines</h3>
                    <div className="space-y-4">
                      <Label htmlFor="selectedPipeline">Selecione o Pipeline para Editar Estágios</Label>
                      <select
                        id="selectedPipeline"
                        className="w-full p-2 rounded-md border"
                        value={selectedPipelineId || ""}
                        onChange={(e) => setSelectedPipelineId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Selecione um pipeline</option>
                        {pipelines.map((pipeline) => (
                          <option key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-sm text-gray-500 mb-4">
                        Selecione um pipeline para gerenciar seus estágios abaixo.
                      </p>
                      
                      {selectedPipelineId && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="text-md font-medium mb-3">Estágios do Pipeline</h4>
                          
                          <div className="mb-4 flex items-center gap-2">
                            <Input
                              placeholder="Nome do novo estágio"
                              value={newStageName}
                              onChange={(e) => setNewStageName(e.target.value)}
                            />
                            <Button 
                              onClick={createStage} 
                              disabled={createStageMutation.isPending || !newStageName.trim()}
                              size="sm"
                            >
                              <PlusCircle className="h-4 w-4 mr-1" />
                              Adicionar
                            </Button>
                          </div>
                          
                          {pipelineStages.length > 0 ? (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {pipelineStages.map((stage) => (
                                <div 
                                  key={stage.id}
                                  className="flex items-center justify-between p-3 border rounded-md"
                                >
                                  {editingStage?.id === stage.id ? (
                                    <form 
                                      className="flex items-center gap-2 flex-1"
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        updateStage();
                                      }}
                                    >
                                      <Input
                                        value={editingStage.name}
                                        onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            updateStage();
                                          }
                                        }}
                                      />
                                      <Button variant="ghost" size="sm" type="submit">
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setEditingStage(null)}
                                        type="button"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </form>
                                  ) : (
                                    <>
                                      <div className="flex items-center">
                                        <span className="text-sm font-medium">{stage.name}</span>
                                        {stage.isSystem && (
                                          <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                            Sistema
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          onClick={() => setEditingStage({ id: stage.id, name: stage.name })}
                                          disabled={!!stage.isSystem}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          onClick={() => {
                                            if (stage.isSystem) {
                                              toast({
                                                title: "Operação não permitida",
                                                description: "Não é possível excluir estágios do sistema.",
                                                variant: "destructive"
                                              });
                                              return;
                                            }
                                            
                                            if (window.confirm("Tem certeza que deseja excluir este estágio?")) {
                                              deleteStageMutation.mutate(stage.id);
                                            }
                                          }}
                                          disabled={!!stage.isSystem}
                                        >
                                          <Trash2 className={`h-4 w-4 ${stage.isSystem ? 'text-muted-foreground' : 'text-red-500'}`} />
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">
                              Nenhum estágio encontrado. Adicione um novo estágio acima.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-2">Pipelines Disponíveis</h3>
                  <div className="border rounded-md divide-y">
                    {pipelines.map((pipeline) => (
                      <div key={pipeline.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{pipeline.name}</p>
                          <p className="text-sm text-gray-500">{pipeline.description}</p>
                          {pipeline.isDefault && (
                            <span className="inline-flex items-center px-2 py-1 mt-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Padrão
                            </span>
                          )}
                          {pipeline.hasFixedStages && (
                            <span className="inline-flex items-center px-2 py-1 mt-1 ml-2 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              Estágios Fixos
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Pipeline */}
          <TabsContent value="pipeline">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estágios do Pipeline</CardTitle>
                <CardDescription>
                  Gerencie os estágios do seu funil de vendas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center gap-2">
                  <Input
                    placeholder="Nome do novo estágio"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                  />
                  <Button 
                    onClick={createStage} 
                    disabled={createStageMutation.isPending}
                    size="sm"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                <div className="space-y-2">
                  {pipelineStages.map((stage) => (
                    <div 
                      key={stage.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      {editingStage?.id === stage.id ? (
                        <form 
                          className="flex items-center gap-2 flex-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            updateStage();
                          }}
                        >
                          <Input
                            value={editingStage.name}
                            onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                updateStage();
                              }
                            }}
                          />
                          <Button variant="ghost" size="sm" type="submit">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setEditingStage(null)}
                            type="button"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <span className="text-sm font-medium">{stage.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setEditingStage({ id: stage.id, name: stage.name })}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                if (window.confirm("Tem certeza que deseja excluir este estágio?")) {
                                  deleteStageMutation.mutate(stage.id)
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Motivos de Perda */}
          <TabsContent value="loss-reasons">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Motivos de Perda</CardTitle>
                <CardDescription>
                  Gerencie os motivos de perda de negócios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center gap-2">
                  <Input
                    placeholder="Novo motivo de perda"
                    value={newLossReason}
                    onChange={(e) => setNewLossReason(e.target.value)}
                  />
                  <Button 
                    onClick={createLossReason} 
                    disabled={createLossReasonMutation.isPending}
                    size="sm"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                <div className="space-y-2">
                  {lossReasons.map((reason) => (
                    <div 
                      key={reason.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      {editingLossReason?.id === reason.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingLossReason.reason}
                            onChange={(e) => setEditingLossReason({ ...editingLossReason, reason: e.target.value })}
                            autoFocus
                          />
                          <Button variant="ghost" size="sm" onClick={updateLossReason}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setEditingLossReason(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <span className="text-sm font-medium">{reason.reason}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setEditingLossReason({ id: reason.id, reason: reason.reason })}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                if (window.confirm("Tem certeza que deseja excluir este motivo?")) {
                                  deleteLossReasonMutation.mutate(reason.id)
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Marcas de Máquinas */}
          <TabsContent value="machine-brands">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Marcas de Máquinas</CardTitle>
                <CardDescription>
                  Gerencie as marcas de máquinas disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 space-y-2">
                  <Input
                    placeholder="Nome da marca"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    placeholder="Descrição (opcional)"
                    value={newBrandDescription}
                    onChange={(e) => setNewBrandDescription(e.target.value)}
                  />
                  <Button 
                    onClick={createBrand} 
                    disabled={createBrandMutation.isPending}
                    className="w-full"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Adicionar Nova Marca
                  </Button>
                </div>

                <div className="space-y-2">
                  {machineBrands.map((brand) => (
                    <div 
                      key={brand.id}
                      className="flex flex-col p-3 border rounded-md"
                    >
                      {editingBrand?.id === brand.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editingBrand.name}
                            onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                            autoFocus
                          />
                          <Input
                            value={editingBrand.description || ''}
                            onChange={(e) => setEditingBrand({ ...editingBrand, description: e.target.value })}
                            placeholder="Descrição (opcional)"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={updateBrand}>
                              <Check className="h-4 w-4 mr-1" />
                              Salvar
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setEditingBrand(null)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{brand.name}</span>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setEditingBrand({ 
                                  id: brand.id, 
                                  name: brand.name,
                                  description: brand.description
                                })}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  if (window.confirm("Tem certeza que deseja excluir esta marca?")) {
                                    deleteBrandMutation.mutate(brand.id)
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          {brand.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {brand.description}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Desempenho de Vendas */}
          <TabsContent value="sale-performance">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Motivos de Desempenho de Vendas</CardTitle>
                <CardDescription>
                  Gerencie os motivos de desempenho utilizados na classificação de vendas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 space-y-2">
                  <Input
                    placeholder="Motivo (ex: Acima do esperado, Conforme cotação)"
                    value={newPerformanceReason}
                    onChange={(e) => setNewPerformanceReason(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    placeholder="Valor (ex: above, on_target, below)"
                    value={newPerformanceValue}
                    onChange={(e) => setNewPerformanceValue(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    placeholder="Descrição (opcional)"
                    value={newPerformanceDescription}
                    onChange={(e) => setNewPerformanceDescription(e.target.value)}
                  />
                  <Button 
                    onClick={() => {
                      if (!newPerformanceReason.trim()) {
                        toast({
                          title: "Campo obrigatório",
                          description: "O motivo de desempenho é obrigatório.",
                          variant: "destructive"
                        });
                        return;
                      }
                      if (!newPerformanceValue.trim()) {
                        toast({
                          title: "Campo obrigatório",
                          description: "O valor é obrigatório.",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      createPerformanceReasonMutation.mutate({
                        reason: newPerformanceReason,
                        value: newPerformanceValue,
                        description: newPerformanceDescription
                      });
                    }} 
                    disabled={createPerformanceReasonMutation.isPending}
                    className="w-full"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Adicionar Motivo de Desempenho
                  </Button>
                </div>

                <div className="space-y-2">
                  {performanceReasons.map((reason) => (
                    <div 
                      key={reason.id}
                      className="flex flex-col p-3 border rounded-md"
                    >
                      {editingPerformance?.id === reason.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editingPerformance.reason}
                            onChange={(e) => setEditingPerformance({ ...editingPerformance, reason: e.target.value })}
                            autoFocus
                          />
                          <Input
                            value={editingPerformance.value}
                            onChange={(e) => setEditingPerformance({ ...editingPerformance, value: e.target.value })}
                            placeholder="Valor (ex: above, on_target, below)"
                          />
                          <Input
                            value={editingPerformance.description || ''}
                            onChange={(e) => setEditingPerformance({ ...editingPerformance, description: e.target.value })}
                            placeholder="Descrição (opcional)"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              if (!editingPerformance.reason.trim()) {
                                toast({
                                  title: "Campo obrigatório",
                                  description: "O motivo de desempenho é obrigatório.",
                                  variant: "destructive"
                                });
                                return;
                              }
                              if (!editingPerformance.value.trim()) {
                                toast({
                                  title: "Campo obrigatório",
                                  description: "O valor é obrigatório.",
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              updatePerformanceReasonMutation.mutate({
                                id: editingPerformance.id,
                                reason: editingPerformance.reason,
                                value: editingPerformance.value,
                                description: editingPerformance.description || ''
                              });
                            }}>
                              <Check className="h-4 w-4 mr-1" />
                              Salvar
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setEditingPerformance(null)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">{reason.reason}</span>
                              <span className="ml-2 px-2 py-0.5 bg-muted text-xs rounded-full">
                                {reason.value}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setEditingPerformance({ 
                                  id: reason.id, 
                                  reason: reason.reason,
                                  value: reason.value,
                                  description: reason.description
                                })}
                                disabled={!!reason.isSystem}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  if (reason.isSystem) {
                                    toast({
                                      title: "Operação não permitida",
                                      description: "Não é possível excluir motivos de desempenho do sistema.",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                  
                                  if (window.confirm("Tem certeza que deseja excluir este motivo de desempenho?")) {
                                    deletePerformanceReasonMutation.mutate(reason.id);
                                  }
                                }}
                                disabled={!!reason.isSystem}
                              >
                                <Trash2 className={`h-4 w-4 ${reason.isSystem ? 'text-muted-foreground' : 'text-red-500'}`} />
                              </Button>
                            </div>
                          </div>
                          {reason.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {reason.description}
                            </p>
                          )}
                          {reason.isSystem && (
                            <div className="mt-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded-sm">
                              Este é um motivo de desempenho do sistema e não pode ser excluído.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Modelos */}
          <TabsContent value="models">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Modelos de Máquinas</CardTitle>
                <CardDescription>
                  Gerencie os modelos de máquinas disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Selecione uma Marca</Label>
                    <select
                      className="w-full p-2 rounded-md border"
                      value={selectedBrandId || ""}
                      onChange={(e) => setSelectedBrandId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Selecione uma marca</option>
                      {machineBrands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Selecione uma marca para gerenciar seus modelos
                    </p>
                  </div>

                  {selectedBrandId && (
                    <div className="space-y-2 border-t pt-4">
                      <Label>Adicionar Novo Modelo</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Nome do modelo"
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={createModel} 
                          disabled={createModelMutation.isPending}
                        >
                          <PlusCircle className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Modelos da Marca {machineBrands.find(b => b.id === selectedBrandId)?.name}</h4>
                        
                        {machineModels.length > 0 ? (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {machineModels.map((model) => (
                              <div 
                                key={model.id}
                                className="flex items-center justify-between p-3 border rounded-md"
                              >
                                {editingModel?.id === model.id ? (
                                  <form 
                                    className="flex items-center gap-2 flex-1"
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      updateModel();
                                    }}
                                  >
                                    <Input
                                      value={editingModel.name}
                                      onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value, brandId: selectedBrandId || editingModel.brandId })}
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          updateModel();
                                        }
                                      }}
                                    />
                                    <Button variant="ghost" size="sm" type="submit">
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => setEditingModel(null)}
                                      type="button"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </form>
                                ) : (
                                  <>
                                    <div className="flex items-center">
                                      <span className="text-sm font-medium">{model.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => setEditingModel({ id: model.id, name: model.name, brandId: model.brandId })}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => {
                                          if (window.confirm("Tem certeza que deseja excluir este modelo?")) {
                                            deleteModelMutation.mutate(model.id);
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            Nenhum modelo encontrado para esta marca. Adicione um novo modelo acima.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Usuários */}
          {user?.role === 'admin' && (
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserIcon className="h-5 w-5" />
                    Gerenciamento de Usuários
                  </CardTitle>
                  <CardDescription>Crie, edite e remova usuários do sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Formulário para novo usuário */}
                  <form className="flex flex-col md:flex-row gap-2 mb-6" onSubmit={e => {e.preventDefault(); createUserMutation.mutate({ email: newUserEmail, password: newUserPassword, role: newUserRole });}}>
                    <Input type="email" placeholder="E-mail" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required className="flex-1" />
                    <Input type="password" placeholder="Senha" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required className="flex-1" />
                    <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="rounded border px-2 py-1">
                      <option value="user">Usuário</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button type="submit" disabled={createUserMutation.isPending}>Adicionar</Button>
                  </form>
                  {/* Listagem de usuários */}
                  {isLoadingUsers ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando usuários...</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border">
                        <thead>
                          <tr className="bg-muted">
                            <th className="p-2 text-left">ID</th>
                            <th className="p-2 text-left">E-mail</th>
                            <th className="p-2 text-left">Permissão</th>
                            <th className="p-2 text-left">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map(u => (
                            <tr key={u.id} className="border-b">
                              <td className="p-2">{u.id}</td>
                              <td className="p-2">{u.email}</td>
                              <td className="p-2">
                                {editingUserId === u.id ? (
                                  <select value={editingUserRole} onChange={e => setEditingUserRole(e.target.value)} className="rounded border px-2 py-1">
                                    <option value="user">Usuário</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                ) : (
                                  u.role === 'admin' ? <span className="text-yellow-600 font-bold">Admin</span> : 'Usuário'
                                )}
                              </td>
                              <td className="p-2 flex gap-2">
                                {editingUserId === u.id ? (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => updateUserMutation.mutate({ id: u.id, role: editingUserRole })}>Salvar</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>Cancelar</Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => { setEditingUserId(u.id); setEditingUserRole(u.role); }}>Editar</Button>
                                    {u.id !== user.id && (
                                      <Button size="sm" variant="destructive" onClick={() => { if(window.confirm('Tem certeza que deseja excluir este usuário?')) deleteUserMutation.mutate(u.id); }}>Excluir</Button>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}