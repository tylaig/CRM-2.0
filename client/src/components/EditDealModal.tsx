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
  
  // Campo de notas
  const [notes, setNotes] = useState("");
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
  
  // Filtra os estágios por pipeline
  const filteredStages = pipelineStages.filter(stage => {
    return pipelineId ? stage.pipelineId === parseInt(pipelineId) : true;
  });
  
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

  // Carregar dados do deal quando o modal abrir
  useEffect(() => {
    if (deal) {
      // Campos básicos do deal
      setName(deal.name || "");
      setPipelineId(deal.pipelineId?.toString() || "");
      setStageId(deal.stageId?.toString() || "");
      setValue(formatCurrency(deal.value || 0));
      setStatus(deal.status || "in_progress");
      setNotes(deal.notes || "");
      setQuoteCodeSao(deal.quoteCodeSao || "");
      setQuoteCodePara(deal.quoteCodePara || "");
    }
  }, [deal]);
  
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
      // Após atualizar o lead com sucesso, atualizar o deal
      if (leadUpdateDataRef.current) {
        const dealUpdate: Partial<Deal> = {
          ...deal,
          quoteCodeSao,
          quoteCodePara,
          notes,
        };
        // Remover campos que podem ser undefined/null e não são obrigatórios
        if (dealUpdate.id === undefined) delete dealUpdate.id;
        if (dealUpdate.leadId === undefined) delete dealUpdate.leadId;
        if (dealUpdate.stageId === undefined) delete dealUpdate.stageId;
        if (dealUpdate.pipelineId === undefined) delete dealUpdate.pipelineId;
        if (dealUpdate.userId === undefined) delete dealUpdate.userId;
        updateDealMutation.mutate(dealUpdate);
      }
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
      
      // Incluir o valor da cotação selecionada nos dados a serem atualizados
      if (selectedQuoteValue !== null) {
        data.quoteValue = selectedQuoteValue;
        data.value = selectedQuoteValue;
      }
      
      return apiRequest(`/api/deals/${deal.id}`, "PUT", data);
    },
    onSuccess: () => {
      // Limpar a referência aos dados do lead
      leadUpdateDataRef.current = null;
      
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
        const oldStageName = pipelineStages.find(s => s.id === deal.stageId)?.name || "Desconhecido";
        const newStageName = pipelineStages.find(s => s.id === parseInt(stageId))?.name || "Desconhecido";
        createActivityMutation.mutate({
          description: `Negócio movido da etapa "${oldStageName}" para "${newStageName}"`,
          dealId: deal.id ?? 0,
          activityType: "stage_change"
        });
      }
      
      // Invalidar consultas para atualizar a interface
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      
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
    leadUpdateDataRef.current = leadUpdateData;
    toast({
      title: "Salvando...",
      description: "Atualizando informações...",
    });
    // Garante que os valores mais recentes dos códigos de cotação sejam enviados
    updateLeadMutation.mutate(leadUpdateData, {
      onSuccess: () => {
        const dealUpdate: Partial<Deal> = {
          ...deal,
          quoteCodeSao,
          quoteCodePara,
          notes,
        };
        if (dealUpdate.id === undefined) delete dealUpdate.id;
        if (dealUpdate.leadId === undefined) delete dealUpdate.leadId;
        if (dealUpdate.stageId === undefined) delete dealUpdate.stageId;
        if (dealUpdate.pipelineId === undefined) delete dealUpdate.pipelineId;
        if (dealUpdate.userId === undefined) delete dealUpdate.userId;
        updateDealMutation.mutate(dealUpdate);
      }
    });
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
              <h3 className="text-lg font-medium">Notas do Negócio</h3>
              <div className="grid gap-2">
                <Label htmlFor="deal-notes">Anotações</Label>
                <textarea
                  id="deal-notes"
                  className="flex h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Adicione notas e observações sobre este negócio..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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