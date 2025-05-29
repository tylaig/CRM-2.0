import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatPhoneNumber } from "@/lib/formatters";
import { type PipelineStage, type Deal, type Lead, type Pipeline } from "@shared/schema";
import QuoteManager from "./QuoteManager";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Edit2Icon, 
  Trash2Icon,
  MessageCircleIcon,
  ReceiptIcon,
  FileTextIcon,
  PlusIcon,
  TrashIcon,
  CheckCircle2Icon,
  XCircleIcon,
  PlusCircleIcon,
  UserIcon,
  BuildingIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  CreditCardIcon,
  CheckIcon,
  XIcon,
  MapIcon
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import DealOutcomeForm from "@/components/DealOutcomeForm";
import DealResultTab from "@/components/DealResultTab";
import ClientMachines from "@/components/ClientMachines";
import ClientCities from "@/components/ClientCities";
import LeadActivities from "@/components/LeadActivities";
import RelatedDeals from "@/components/RelatedDeals";

interface EditDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Partial<Deal> | null;
  pipelineStages: PipelineStage[];
}

export default function EditDealModal({ isOpen, onClose, deal, pipelineStages }: EditDealModalProps) {
  const [activeTab, setActiveTab] = useState("lead");
  
  // Buscar a lista de pipelines disponíveis
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ['/api/pipelines'],
  });
  
  // Buscar TODOS os estágios de TODOS os pipelines para poder filtrar corretamente
  const { data: allPipelineStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['/api/pipeline-stages'],
    staleTime: 0,
    refetchOnMount: true,
  });
  
  // Campos base do formulário
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("in_progress");
  
  // Tipo de cliente
  const [clientCategory, setClientCategory] = useState("final_consumer"); // "final_consumer" (Consumidor Final) ou "reseller" (Revenda)
  const [clientType, setClientType] = useState("person"); // "person" (Pessoa Física) ou "company" (Pessoa Jurídica)
  const [isCompany, setIsCompany] = useState(false); // campo legado
  
  // Campos pessoa jurídica
  const [cnpj, setCnpj] = useState("");
  const [corporateName, setCorporateName] = useState("");
  
  // Campos pessoa física
  const [cpf, setCpf] = useState("");
  const [stateRegistration, setStateRegistration] = useState("");
  
  // Campos de contato
  const [clientCodeSaoPaulo, setClientCodeSaoPaulo] = useState("");
  const [clientCodePara, setClientCodePara] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  // Campos de endereço
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  
  // Campo de notas com controle de sincronização
  const [notes, setNotes] = useState("");
  const [latestNotesFromDB, setLatestNotesFromDB] = useState("");
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  
  // Estado para armazenar o valor da cotação selecionada
  const [selectedQuoteValue, setSelectedQuoteValue] = useState<number | null>(null);
  
  // Ref para armazenar os dados do lead durante a atualização
  const leadUpdateDataRef = useRef<Partial<Lead> | null>(null);

  const { toast } = useToast();

  // Buscar os dados do lead associado
  const { data: leadData, refetch: refetchLeadData } = useQuery<Lead>({
    queryKey: [`/api/leads/${deal?.leadId}`],
    enabled: !!deal?.leadId,
  });
  
  // Já temos a query de pipelines definida acima
  
  // Buscar os itens da cotação para calcular o valor total
  const { data: quoteItems } = useQuery<any[]>({
    queryKey: [`/api/quote-items/${deal?.id}`],
    enabled: !!deal?.id
  });
  
  // Filtra os estágios por pipeline usando TODOS os estágios disponíveis
  const filteredStages = allPipelineStages.filter(stage => {
    if (!pipelineId) return false;
    const selectedPipelineId = parseInt(pipelineId);
    if (isNaN(selectedPipelineId)) return false;
    return stage.pipelineId === selectedPipelineId;
  });
  
  // Debug para verificar os estágios filtrados
  useEffect(() => {
    console.log("=== DEBUG ESTÁGIOS ===");
    console.log("Pipeline selecionado (string):", pipelineId);
    console.log("Pipeline selecionado (number):", parseInt(pipelineId || ""));
    console.log("Pipeline é válido:", pipelineId && !isNaN(parseInt(pipelineId)));
    console.log("Todos os estágios:", allPipelineStages.length);
    console.log("Estágios por pipeline:", allPipelineStages.reduce((acc, stage) => {
      acc[stage.pipelineId] = (acc[stage.pipelineId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>));
    console.log("Estágios filtrados:", filteredStages.length);
    console.log("Estágios filtrados detalhes:", filteredStages.map(s => `${s.id}: ${s.name} (Pipeline ${s.pipelineId})`));
    console.log("======================");
  }, [pipelineId, allPipelineStages, filteredStages]);
  
  // Limpar seleção de estágio quando o pipeline mudar
  useEffect(() => {
    if (pipelineId && deal) {
      const selectedPipelineId = parseInt(pipelineId);
      if (!isNaN(selectedPipelineId) && deal.pipelineId !== selectedPipelineId) {
        setStageId(""); // Limpar estágio quando pipeline muda
      }
    }
  }, [pipelineId, deal]);
  
  // Calcular o valor total da cotação quando os itens estiverem disponíveis
  useEffect(() => {
    if (quoteItems && quoteItems.length > 0) {
      const quoteTotal = quoteItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      if (quoteTotal > 0) {
        setSelectedQuoteValue(quoteTotal);
        setValue(formatCurrency(quoteTotal));
      }
    }
  }, [quoteItems]);

  // Carregar dados do deal quando o modal abrir ou quando o deal mudar
  useEffect(() => {
    if (isOpen && deal) {
      console.log('DEBUG MODAL: deal recebido', deal);
      setName(deal.name || "");
      setPipelineId(deal.pipelineId?.toString() || "");
      setStageId(deal.stageId?.toString() || "");
      setValue(formatCurrency(deal.value || 0));
      setStatus(deal.status || "in_progress");
      // Carregar as notas do deal - corrigindo o problema principal
      setNotes(deal.notes || "");
      setQuoteCodeSao(deal.quoteCodeSao || "");
      setQuoteCodePara(deal.quoteCodePara || "");
      // ... outros campos se necessário
      console.log("=== CARREGANDO DEAL NO MODAL ===");
      console.log("Deal status:", deal.status);
      console.log("Status definido:", deal.status || "in_progress");
      console.log("Deal completo:", deal);
      console.log("=================================");
    }
  }, [isOpen, deal]);
  
  // Carregar dados do lead quando estiverem disponíveis
  useEffect(() => {
    if (leadData) {
      console.log("Lead carregado:", leadData);
      
      // Campos básicos do lead
      setCompanyName(leadData.companyName || "");
      
      // Tipo de cliente
      setClientCategory(leadData.clientCategory || "final_consumer");
      setClientType(leadData.clientType || "person");
      setIsCompany(leadData.clientType === "company"); 
      
      // Campos pessoa jurídica
      setCnpj(leadData.cnpj || "");
      setCorporateName(leadData.corporateName || "");
      
      // Campos pessoa física
      setCpf(leadData.cpf || "");
      setStateRegistration(leadData.stateRegistration || "");
      
      // Campos de contato
      setClientCodeSaoPaulo(leadData.clientCodeSaoPaulo || "");
      setClientCodePara(leadData.clientCodePara || "");
      setEmail(leadData.email || "");
      setPhone(formatPhoneNumber(leadData.phone) || "");
      
      // Campos de endereço
      setAddress(leadData.address || "");
      setAddressNumber(leadData.addressNumber || "");
      setAddressComplement(leadData.addressComplement || "");
      setNeighborhood(leadData.neighborhood || "");
      setCity(leadData.city || "");
      setState(leadData.state || "");
      setZipCode(leadData.zipCode || "");
    }
  }, [leadData]);
  
  // Funções para gerenciar negócios relacionados
  const handleOpenDeal = (dealId: number) => {
    // Fechar este modal primeiro
    onClose();
    
    // Após um breve atraso, invalidar a query para atualizar e abrir o outro negócio
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
    }, 200);
  };
  
  // Mutation para atualizar lead
  const updateLeadMutation = useMutation({
    mutationFn: async (data: Partial<Lead>) => {
      if (!deal?.leadId) return null;
      return apiRequest(`/api/leads/${deal.leadId}`, "PUT", data);
    },
    onSuccess: (updatedLead) => {
      console.log("Lead atualizado com sucesso:", updatedLead);
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${deal?.leadId}`] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao atualizar dados do lead. Por favor tente novamente.",
      });
      console.error("Erro ao atualizar lead:", error);
    },
  });

  // Mutation para criar uma atividade quando o pipeline muda
  const createActivityMutation = useMutation({
    mutationFn: async (activityData: { description: string; dealId: number; activityType: string }) => {
      return apiRequest('/api/lead-activities', 'POST', activityData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/lead-activities/${deal?.id}`] });
    }
  });

  // Mutation para atualizar deal
  const updateDealMutation = useMutation({
    mutationFn: async (data: Partial<Deal>) => {
      if (!deal) return null;
      
      console.log("Executando mutation do deal com dados:", data);
      
      // Incluir o valor da cotação selecionada nos dados a serem atualizados
      if (selectedQuoteValue !== null) {
        data.quoteValue = selectedQuoteValue;
        data.value = selectedQuoteValue;
      }
      
      // Garantir que pipelineId e stageId sejam números válidos
      if (data.pipelineId && typeof data.pipelineId === 'string') {
        data.pipelineId = parseInt(data.pipelineId);
      }
      if (data.stageId && typeof data.stageId === 'string') {
        data.stageId = parseInt(data.stageId);
      }
      
      // Se o usuário está mudando o pipeline ou estágio manualmente,
      // resetar o saleStatus para 'negotiation' para permitir a movimentação
      if ((data.pipelineId && data.pipelineId !== deal.pipelineId) || 
          (data.stageId && data.stageId !== deal.stageId)) {
        
        console.log("Detectada mudança de pipeline/stage, resetando saleStatus");
        
        // Verificar se o novo estágio não é do tipo completed/lost
        const targetStage = allPipelineStages.find(s => s.id === data.stageId);
        if (targetStage && targetStage.stageType === "normal") {
          // Se movendo para um estágio normal, resetar o status de venda
          data.saleStatus = "negotiation";
        }
      }
      
      console.log("Dados finais que serão enviados para a API:", data);
      return apiRequest(`/api/deals/${deal.id}`, "PUT", data);
    },
    onSuccess: async (updatedDeal) => {
      // Limpar a referência aos dados do lead
      leadUpdateDataRef.current = null;
      
      // CORREÇÃO: Atualizar imediatamente as notas locais com os dados salvos
      if (updatedDeal && updatedDeal.notes !== undefined) {
        setNotes(updatedDeal.notes || "");
        console.log("✅ Notas atualizadas localmente:", updatedDeal.notes);
      }
      
      // Parar a proteção de edição para permitir que os dados atualizados sejam carregados
      setIsEditingNotes(false);
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
        typingTimeout.current = null;
      }
      
      toast({
        title: "Sucesso!",
        description: "Informações atualizadas com sucesso.",
      });
      
      // Verificar se o pipeline foi alterado e registrar atividade
      if (deal && pipelineId && deal.pipelineId !== parseInt(pipelineId)) {
        const oldPipelineName = pipelines.find(p => p.id === deal.pipelineId)?.name || "Desconhecido";
        const newPipelineName = pipelines.find(p => p.id === parseInt(pipelineId))?.name || "Desconhecido";
        createActivityMutation.mutate({
          description: `Negócio movido do pipeline "${oldPipelineName}" para "${newPipelineName}"`,
          dealId: deal.id ?? 0,
          activityType: "pipeline_change"
        });
      }
      // Verificar se o estágio foi alterado e registrar atividade
      if (deal && stageId && deal.stageId !== parseInt(stageId)) {
        const oldStageName = allPipelineStages.find(s => s.id === deal.stageId)?.name || "Desconhecido";
        const newStageName = allPipelineStages.find(s => s.id === parseInt(stageId))?.name || "Desconhecido";
        createActivityMutation.mutate({
          description: `Negócio movido da etapa "${oldStageName}" para "${newStageName}"`,
          dealId: deal.id ?? 0,
          activityType: "stage_change"
        });
      }
      
      // Invalidar múltiplas consultas para garantir atualização completa
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/deals"] }),
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal?.id}`] }),
        queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] }),
        // Se mudou de pipeline, invalidar ambos os pipelines
        deal?.pipelineId && pipelineId && deal.pipelineId !== parseInt(pipelineId) ? 
          Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/deals", deal.pipelineId] }),
            queryClient.invalidateQueries({ queryKey: ["/api/deals", parseInt(pipelineId)] })
          ]) : Promise.resolve()
      ]);
      
      // CORREÇÃO: Forçar refetch imediato dos dados específicos do deal
      await refetchDealData();
      
      // CORREÇÃO EXTRA: Aguardar um momento para garantir que os dados sejam atualizados
      setTimeout(() => {
        refetchDealData();
      }, 100);
      
      // Fechar o modal
      onClose();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao atualizar negócio. Por favor tente novamente.",
      });
      console.error("Erro ao atualizar deal:", error);
    },
  });
  
  // Mutation para excluir deal
  const deleteDealMutation = useMutation({
    mutationFn: async () => {
      if (!deal) return null;
      return apiRequest(`/api/deals/${deal.id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Negócio excluído com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      onClose();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao excluir negócio. Por favor tente novamente.",
      });
      console.error("Erro ao excluir deal:", error);
    },
  });
  
  // Função para manipular salvamento
  const handleSave = () => {
    if (!deal) return;
    
    toast({
      title: "Salvando...",
      description: "Atualizando informações...",
    });
    
    // Preparar dados do lead para atualização
    const leadUpdateData: Partial<Lead> = {
      companyName,
      clientCategory,
      clientType,
      cnpj: clientType === "company" ? cnpj : null,
      corporateName: clientType === "company" ? corporateName : null,
      stateRegistration: stateRegistration,
      cpf: clientType === "person" ? cpf : null,
      clientCodeSaoPaulo,
      clientCodePara,
      email,
      phone,
      address,
      addressNumber,
      addressComplement,
      neighborhood
    };
    if (zipCode) {
      leadUpdateData.zipCode = zipCode;
    }
    
    // Preparar dados do deal para atualização
    const dealUpdate: Partial<Deal> = {
      name,
      value: parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0,
      status: status || "in_progress", // Garantir que o status seja válido
      pipelineId: parseInt(pipelineId),
      stageId: parseInt(stageId),
      quoteCodeSao,
      quoteCodePara,
      notes,
    };
    
    console.log("=== DEBUG ATUALIZAÇÃO DEAL ===");
    console.log("Status original:", status);
    console.log("Status final:", dealUpdate.status);
    console.log("Dados que serão enviados para atualização do deal:", dealUpdate);
    console.log("Pipeline atual:", deal.pipelineId, "-> Novo pipeline:", dealUpdate.pipelineId);
    console.log("Stage atual:", deal.stageId, "-> Novo stage:", dealUpdate.stageId);
    console.log("================================");
    
    // Armazenar dados do lead para referência
    leadUpdateDataRef.current = leadUpdateData;
    
    // CORREÇÃO: Só atualizar lead se houver dados realmente alterados no lead
    const hasLeadChanges = leadData && (
      leadData.companyName !== companyName ||
      leadData.clientCategory !== clientCategory ||
      leadData.clientType !== clientType ||
      leadData.cnpj !== (clientType === "company" ? cnpj : null) ||
      leadData.corporateName !== (clientType === "company" ? corporateName : null) ||
      leadData.stateRegistration !== stateRegistration ||
      leadData.cpf !== (clientType === "person" ? cpf : null) ||
      leadData.clientCodeSaoPaulo !== clientCodeSaoPaulo ||
      leadData.clientCodePara !== clientCodePara ||
      leadData.email !== email ||
      leadData.phone !== phone ||
      leadData.address !== address ||
      leadData.addressNumber !== addressNumber ||
      leadData.addressComplement !== addressComplement ||
      leadData.neighborhood !== neighborhood ||
      leadData.zipCode !== zipCode
    );
    
    console.log("🔍 VERIFICAÇÃO DE ALTERAÇÕES NO LEAD:", {
      hasLeadChanges,
      leadDataExists: !!leadData
    });
    
    if (hasLeadChanges) {
      console.log("📝 Atualizando LEAD - dados alterados detectados");
      updateLeadMutation.mutate(leadUpdateData);
    } else {
      console.log("✅ LEAD não alterado - pulando atualização do lead");
    }
    
    // Atualizar deal diretamente com os dados corretos (sempre executar)
    updateDealMutation.mutate(dealUpdate);
  };
  
  // Confirmar exclusão
  const confirmDelete = () => {
    if (window.confirm("Tem certeza que deseja excluir este negócio? Esta ação não pode ser desfeita.")) {
      deleteDealMutation.mutate();
    }
  };
  
  // A função toggleClientType foi removida pois o tipo de cliente agora é
  // gerenciado pelo componente Select na interface
  
  // Limpar endereço
  const clearAddress = () => {
    setAddress("");
    setAddressNumber("");
    setAddressComplement("");
    setNeighborhood("");
    setCity("");
    setState("");
    setZipCode("");
  };

  // Não permite mais edição manual do valor
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // O valor é definido apenas pela cotação selecionada
    // Esta função permanece para compatibilidade, mas não faz nada
    return;
  };

  // Callback para quando uma cotação é selecionada
  const handleQuoteSelected = (quoteTotal: number) => {
    setSelectedQuoteValue(quoteTotal);
    setValue(formatCurrency(quoteTotal));
  };

  // Campos para código de cotação
  const [quoteCodeSao, setQuoteCodeSao] = useState("");
  const [quoteCodePara, setQuoteCodePara] = useState("");

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    setIsEditingNotes(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    // Aumentar o tempo para 10 segundos para dar tempo suficiente para salvar
    typingTimeout.current = setTimeout(() => setIsEditingNotes(false), 10000);
  };

  // Função para atualizar o campo com os dados mais recentes do banco
  const handleRefreshNotes = () => {
    console.log("🔄 Atualizando notas com dados do banco:", latestNotesFromDB);
    setNotes(latestNotesFromDB);
    setShowRefreshButton(false);
    setIsEditingNotes(false);
    toast({
      title: "Notas atualizadas",
      description: "Campo sincronizado com os dados mais recentes do banco.",
    });
  };

  // Pooling: buscar o deal atualizado do backend enquanto o modal estiver aberto
  const {
    data: dealDataFromApi,
    refetch: refetchDealData,
  } = useQuery<Deal | null>({
    queryKey: ["/api/deals", deal?.id],
    queryFn: () => deal?.id ? apiRequest(`/api/deals/${deal.id}`, "GET") : null,
    enabled: isOpen && !!deal?.id,
    refetchInterval: isOpen && !!deal?.id ? 3000 : false, // 3 segundos
  });

  // Sistema robusto de sincronização de notas com verificação em tempo real
  useEffect(() => {
    if (isOpen && deal) {
      // SEMPRE usar os dados da API se disponíveis, pois são os mais recentes
      const latestNotesFromDatabase = dealDataFromApi?.notes !== undefined ? dealDataFromApi.notes : deal.notes || "";
      console.log("=== USEEFFECT ATUALIZANDO NOTES ===");
      console.log("Deal notes:", deal.notes);
      console.log("API notes:", dealDataFromApi?.notes);
      console.log("Latest notes escolhido:", latestNotesFromDatabase);
      console.log("Valor atual do campo:", notes);
      console.log("isEditingNotes:", isEditingNotes);
      
      // Armazenar sempre as notas mais recentes do banco
      setLatestNotesFromDB(latestNotesFromDatabase || "");
      
      // Se não estiver editando, sincronizar automaticamente
      if (!isEditingNotes) {
        setNotes(latestNotesFromDatabase || "");
        setShowRefreshButton(false);
      } else {
        // Se estiver editando, verificar se há diferenças
        const hasDifferences = notes !== latestNotesFromDatabase && latestNotesFromDatabase !== "";
        setShowRefreshButton(hasDifferences);
        console.log("Diferenças detectadas (editando):", hasDifferences);
      }
      
      console.log("===================================");
    }
  }, [isOpen, deal?.id, deal?.notes, dealDataFromApi?.notes, isEditingNotes, notes]);

  // Não atualizar automaticamente com dados do backend para evitar sobrescrever edições
  // O refetch automático será usado apenas para verificar mudanças, não para atualizar o form

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2Icon className="h-5 w-5 text-primary" />
            {name || "Negócio"} {companyName ? `- ${companyName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Gerencie todos os detalhes do negócio.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="lead" className="flex items-center gap-1">
              <UserIcon className="h-4 w-4" />
              <span>Lead</span>
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-1">
              <MessageCircleIcon className="h-4 w-4" />
              <span>Atividades</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-1">
              <FileTextIcon className="h-4 w-4" />
              <span>Notas</span>
            </TabsTrigger>
            <TabsTrigger value="quote" className="flex items-center gap-1">
              <ReceiptIcon className="h-4 w-4" />
              <span>Cotação</span>
            </TabsTrigger>
            <TabsTrigger value="outcome" className="flex items-center gap-1">
              <CheckCircle2Icon className="h-4 w-4" />
              <span>Resultado</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Lead - Informações detalhadas do lead */}
          <TabsContent value="lead" className="p-1">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid grid-cols-4 w-full mb-4">
                <TabsTrigger value="details" className="text-xs">
                  Detalhes
                </TabsTrigger>
                <TabsTrigger value="client" className="text-xs">
                  Cliente
                </TabsTrigger>
                <TabsTrigger value="address" className="text-xs">
                  Endereço
                </TabsTrigger>
                <TabsTrigger value="machines" className="text-xs">
                  Máquinas
                </TabsTrigger>
              </TabsList>
              
              {/* Sub-aba Detalhes */}
              <TabsContent value="details" className="pt-2">
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="deal-name">Nome do Negócio</Label>
                    <Input
                      id="deal-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Digite o nome do negócio"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="deal-company">Empresa</Label>
                    <Input
                      id="deal-company"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Digite o nome da empresa"
                    />
                  </div>

                  <div className="grid gap-2 mb-2">
                    <Label htmlFor="deal-pipeline">Pipeline</Label>
                    <Select value={pipelineId} onValueChange={(value) => {
                      setPipelineId(value);
                      // Ao mudar o pipeline, limpe a seleção do estágio
                      setStageId("");
                    }}>
                      <SelectTrigger id="deal-pipeline">
                        <SelectValue placeholder="Selecione um pipeline" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines.map((pipeline) => (
                          <SelectItem key={pipeline.id} value={pipeline.id.toString()}>
                            {pipeline.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="deal-stage">Etapa</Label>
                      <Select 
                        value={stageId} 
                        onValueChange={setStageId}
                        disabled={!pipelineId}
                      >
                        <SelectTrigger id="deal-stage">
                          <SelectValue placeholder={!pipelineId ? "Selecione um pipeline primeiro" : "Selecione uma etapa"} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredStages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id.toString()}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="deal-value" className="flex items-center justify-between">
                        <span>Valor</span>
                        <span className="text-xs text-muted-foreground">(definido pela cotação)</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="deal-value"
                          value={value}
                          readOnly={true}
                          className="bg-muted pr-10"
                          placeholder="R$ 0,00"
                        />
                        <ReceiptIcon className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              {/* Sub-aba Cliente */}
              <TabsContent value="client" className="pt-2">
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="client-category">Categoria do Cliente</Label>
                    <Select 
                      value={clientCategory} 
                      onValueChange={(value) => {
                        setClientCategory(value);
                        // Se for Revenda, forçar para Pessoa Jurídica
                        if (value === "reseller") {
                          setClientType("company");
                          setIsCompany(true);
                          setCpf("");
                          // Não limpar a inscrição estadual, pois agora é usado para pessoa jurídica também
                        }
                      }}
                    >
                      <SelectTrigger id="client-category">
                        <SelectValue placeholder="Selecione a categoria do cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="final_consumer">Consumidor Final</SelectItem>
                        <SelectItem value="reseller">Revenda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {clientCategory === "final_consumer" && (
                    <div className="grid gap-2">
                      <Label htmlFor="client-type">Tipo de Cliente</Label>
                      <Select 
                        value={clientType} 
                        onValueChange={(value) => {
                          setClientType(value);
                          setIsCompany(value === "company"); // manter compatibilidade
                          
                          // Resetar campos não relevantes quando muda o tipo
                          if (value === "person") {
                            setCnpj("");
                            setCorporateName("");
                          } else if (value === "company") {
                            setCpf("");
                            // Não limpar a inscrição estadual, pois agora é usado para pessoa jurídica também
                          }
                        }}
                      >
                        <SelectTrigger id="client-type">
                          <SelectValue placeholder="Selecione o tipo de cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="person">Pessoa Física</SelectItem>
                          <SelectItem value="company">Pessoa Jurídica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {clientType === "company" ? (
                    // Campos pessoa jurídica
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <Input
                          id="cnpj"
                          value={cnpj}
                          onChange={(e) => setCnpj(e.target.value)}
                          placeholder="00.000.000/0000-00"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="corporate-name">Razão Social</Label>
                        <Input
                          id="corporate-name"
                          value={corporateName}
                          onChange={(e) => setCorporateName(e.target.value)}
                          placeholder="Razão Social da Empresa"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="state-registration">Inscrição Estadual</Label>
                        <Input
                          id="state-registration"
                          value={stateRegistration}
                          onChange={(e) => setStateRegistration(e.target.value)}
                          placeholder="Inscrição Estadual"
                        />
                      </div>
                    </>
                  ) : clientType === "person" ? (
                    // Campos pessoa física
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="cpf">CPF</Label>
                        <Input
                          id="cpf"
                          value={cpf}
                          onChange={(e) => setCpf(e.target.value)}
                          placeholder="000.000.000-00"
                        />
                      </div>
                      {/* Campo de Inscrição Estadual removido para Pessoa Física */}
                    </>
                  ) : (
                    // Consumidor final não tem campos específicos
                    <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">
                      Este tipo de cliente não requer documentos específicos.
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="client-code-sp">Código Sisrev São Paulo</Label>
                      <Input
                        id="client-code-sp"
                        value={clientCodeSaoPaulo}
                        onChange={(e) => setClientCodeSaoPaulo(e.target.value)}
                        placeholder="Código Sisrev São Paulo"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="client-code-pa">Código Sisrev Pará</Label>
                      <Input
                        id="client-code-pa"
                        value={clientCodePara}
                        onChange={(e) => setClientCodePara(e.target.value)}
                        placeholder="Código Sisrev Pará"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              {/* Sub-aba Endereço */}
              <TabsContent value="address" className="pt-2">
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Rua, Avenida, etc."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="address-number">Número</Label>
                      <Input
                        id="address-number"
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        placeholder="123"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="address-complement">Complemento</Label>
                      <Input
                        id="address-complement"
                        value={addressComplement}
                        onChange={(e) => setAddressComplement(e.target.value)}
                        placeholder="Apto, Sala, etc."
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input
                      id="neighborhood"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Bairro"
                    />
                  </div>
                  
                  <ClientCities
                    dealId={deal?.id || null}
                    leadId={deal?.leadId || null}
                    isExisting={!!deal}
                    currentCity={city}
                    currentState={state}
                    onCityChange={(updatedCity, updatedState) => {
                      // Atualizar os estados locais com os novos valores
                      setCity(updatedCity);
                      setState(updatedState);
                      
                      // Se a atualização foi feita pelo componente, também atualizar nosso objeto leadData
                      if (deal?.leadId && leadData) {
                        // Invalidar a query para que os dados sejam recarregados na próxima vez
                        queryClient.invalidateQueries({ queryKey: [`/api/leads/${deal.leadId}`] });
                        
                        // Forçar refetch para atualizar os dados em memória
                        refetchLeadData();
                      }
                    }}
                  />
                  
                  <div className="grid gap-2">
                    <Label htmlFor="zipcode">CEP</Label>
                    <Input
                      id="zipcode"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="00000-000"
                    />
                  </div>
                  
                  <Button 
                    variant="outline" 
                    onClick={clearAddress}
                    type="button"
                    className="w-full"
                  >
                    <TrashIcon className="h-4 w-4 mr-2" />
                    Limpar Endereço
                  </Button>
                </div>
              </TabsContent>
              
              {/* Sub-aba Máquinas */}
              <TabsContent value="machines" className="pt-2">
                {deal && (
                  <ClientMachines dealId={deal.id ?? null} isExisting={true} />
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Tab Atividades */}
          <TabsContent value="activities" className="p-1">
            {deal && (
              <LeadActivities deal={deal as Deal} />
            )}
          </TabsContent>

          {/* Tab Notas */}
          <TabsContent value="notes" className="p-1">
            <div className="grid gap-4 py-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Notas do Negócio</h3>
                {showRefreshButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshNotes}
                    className="flex items-center gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Atualizar do Banco
                  </Button>
                )}
              </div>
              {showRefreshButton && (
                <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
                  ⚠️ As notas no banco foram atualizadas por outro usuário. Clique em "Atualizar do Banco" para sincronizar.
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="deal-notes">Anotações</Label>
                <textarea
                  id="deal-notes"
                  className="flex h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Adicione notas e observações sobre este negócio..."
                  value={notes}
                  onChange={handleNotesChange}
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab Cotação */}
          <TabsContent value="quote" className="p-1">
            {deal && (
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="quote-code-sao">Código Cotação SP</Label>
                  <Input
                    id="quote-code-sao"
                    value={quoteCodeSao}
                    onChange={e => setQuoteCodeSao(e.target.value)}
                    placeholder="Código Cotação SP"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quote-code-para">Código Cotação Pará</Label>
                  <Input
                    id="quote-code-para"
                    value={quoteCodePara}
                    onChange={e => setQuoteCodePara(e.target.value)}
                    placeholder="Código Cotação Pará"
                  />
                </div>
              </div>
            )}
            {deal && deal.id !== undefined && (
              <QuoteManager
                dealId={deal.id}
                onSelectQuote={handleQuoteSelected}
              />
            )}
          </TabsContent>

          {/* Tab Resultado */}
          <TabsContent value="outcome" className="p-1">
            {deal && deal.id !== undefined && deal.leadId !== undefined && deal.stageId !== undefined && deal.pipelineId !== undefined && deal.userId !== undefined && (
              (deal.saleStatus === "won" || deal.saleStatus === "lost") ? (
                <DealResultTab deal={deal as Deal} />
              ) : (
                <DealOutcomeForm deal={deal as Deal} onSuccess={() => {
                  if (deal.status === "won" || deal.status === "lost") {
                    const hiddenStage = pipelineStages.find(s => s.isHidden) || pipelineStages[0];
                    if (hiddenStage) {
                      updateDealMutation.mutate({
                        stageId: hiddenStage.id
                      });
                    }
                  }
                  queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
                  onClose();
                }} />
              )
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col sm:flex-row justify-between">
          <Button 
            variant="destructive" 
            onClick={confirmDelete}
            disabled={updateDealMutation.isPending || deleteDealMutation.isPending}
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            Excluir
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button 
              onClick={handleSave}
              disabled={updateDealMutation.isPending || deleteDealMutation.isPending}
            >
              {updateDealMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}