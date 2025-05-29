import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { 
  CalendarIcon, 
  MoreVerticalIcon, 
  Phone,
  User2Icon,
  Building,
  MessagesSquareIcon,
  PlusIcon,
  Edit2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Deal } from "@shared/schema";

import { Card } from "@/components/ui/card";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatTimeAgo } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

import EditStageModal from "./EditStageModal";
import AddStageModal from "./AddStageModal";
import EditDealModal from "./EditDealModal";
import DealOutcomeModal from "./DealOutcomeModal";
import AddDealModal from "./AddDealModal";

interface BaseDeal {
  id: number;
  name: string;
  leadId: number;
  stageId: number;
  pipelineId: number;
  value: number | null;
  status: string | null;
  saleStatus: string | null;
  lostReason: string | null;
  performanceReason: string | null;
  chatwootContactId: string | null;
  chatwootConversationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Deal extends BaseDeal {
  leadData?: {
    name: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

interface PipelineStage {
  id: number;
  name: string;
  pipelineId: number;
  order: number;
  createdAt: Date;
  isDefault: boolean | null;
  isHidden: boolean | null;
  isSystem: boolean | null;
  stageType: string | null;
}

interface FilterOptions {
  search: string;
  status: string[];
  sortBy: string;
  sortOrder: string;
  hideClosed: boolean;
  stageId?: number | null;
  winReason?: string | null;
  lostReason?: string | null;
}

interface KanbanBoardProps {
  pipelineStages: PipelineStage[];
  filters?: FilterOptions;
  activePipelineId: number | null;
  onAddDeal: () => void; // Função para abrir o modal de adicionar negócio
  deals?: any[]; // Aceita Deal[] ou ExtendedDeal[]
  userId?: number | null;
}

interface StageWithDeals extends PipelineStage {
  deals: Deal[];
  totalValue: number;
}

export default function KanbanBoard({ pipelineStages, filters, activePipelineId, onAddDeal, deals = [], userId }: KanbanBoardProps) {
  const [boardData, setBoardData] = useState<StageWithDeals[]>([]);
  const [isEditStageModalOpen, setIsEditStageModalOpen] = useState(false);
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [isAddDealModalOpen, setIsAddDealModalOpen] = useState(false);
  const [isEditDealModalOpen, setIsEditDealModalOpen] = useState(false);
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);
  const [selectedStageForNewDeal, setSelectedStageForNewDeal] = useState<PipelineStage | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [targetStageInfo, setTargetStageInfo] = useState<{ id: number, type: string | null }>({ id: 0, type: null });
  
  // Estados para o indicador de polling
  const [pollingProgress, setPollingProgress] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  
  // Estados para filtros de vendas realizadas e perdidas
  const [salePerformanceFilter, setSalePerformanceFilter] = useState<string>("all");
  const [lossReasonFilter, setLossReasonFilter] = useState<string>("all");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Buscar motivos de perda para filtros
  const { data: lossReasons } = useQuery({
    queryKey: ['/api/loss-reasons'],
  });
  
  // Buscar deals filtrados por userId se fornecido
  // Se userId for null ou undefined, mostrar todos (admin)
  const filteredDeals = userId ? deals.filter(d => d.userId === userId) : deals;
  
  // Invalidar cache quando pipeline muda
  useEffect(() => {
    if (activePipelineId) {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
    }
  }, [activePipelineId, queryClient]);
  
  useEffect(() => {
    const fetchDeals = async () => {
      if (!activePipelineId) {
        console.log("Nenhum pipeline ativo, retornando");
        setBoardData([]);
        return;
      }
      
      // Aguardar os estágios serem carregados antes de buscar os deals
      if (pipelineStages.length === 0) {
        console.log("Aguardando estágios serem carregados...");
        return;
      }
      
      console.log(`=== FETCH DEALS INICIADO PARA PIPELINE ${activePipelineId} ===`);
      console.log("Estágios disponíveis:", pipelineStages.length);
      
      let dealsData: Deal[] = [];
      
      // Sempre buscar os deals atualizados do servidor para garantir dados frescos
      try {
        let url = `/api/deals`;
        const params = new URLSearchParams();
        
        // Adicionar filtro por pipeline diretamente na API
        params.append('pipelineId', activePipelineId.toString());
        
        if (filters) {
          if (filters.search) params.append('search', filters.search);
          if (filters.stageId) params.append('stageId', filters.stageId.toString());
          if (filters.status && filters.status.length > 0) {
            filters.status.forEach(status => {
              params.append('status', status);
            });
          }
          if (filters.sortOrder && filters.sortBy) {
            params.append('sortBy', filters.sortBy);
            params.append('sortOrder', filters.sortOrder);
          }
          if (filters.hideClosed) {
            params.append('hideClosed', 'true');
          }
          if (filters.winReason) {
            params.append('winReason', filters.winReason);
          }
          if (filters.lostReason) {
            params.append('lostReason', filters.lossReason);
          }
        }
        
        if (userId) {
          params.append('userId', userId.toString());
        }
        
        // Adicionar timestamp para forçar busca sem cache
        params.append('_t', Date.now().toString());
        url += `?${params.toString()}`;
        
        dealsData = await apiRequest(url, 'GET');
        
      } catch (error) {
        console.error("Error fetching deals:", error);
        toast({
          title: "Erro ao carregar negócios",
          description: "Não foi possível carregar os negócios.",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`Fetched deals for pipeline ${activePipelineId}:`, dealsData.length);
      
      // Debug: Verificar estágios disponíveis
      console.log("Todos os estágios recebidos:", pipelineStages.length);
      console.log("Pipeline ativo:", activePipelineId);
      console.log("Estágios completos:", pipelineStages.map(s => ({ id: s.id, name: s.name, pipelineId: s.pipelineId })));
      
      // Usar estágios dos props filtrados pelo pipeline ativo
      const currentPipelineStages = pipelineStages.filter(stage => stage.pipelineId === activePipelineId);
      console.log("Estágios do pipeline atual:", currentPipelineStages.length);
      console.log("Estágios filtrados:", currentPipelineStages.map(s => ({ id: s.id, name: s.name, pipelineId: s.pipelineId })));
      
      // Preparar todos os negócios para processamento
      const processedDeals: { [id: number]: boolean } = {};
      
      if (currentPipelineStages.length === 0) {
        console.warn(`Nenhum estágio encontrado para o pipeline ${activePipelineId}`);
        console.warn("Verificar se os estágios estão sendo carregados corretamente");
        setBoardData([]);
        return;
      }
      
      const stagesWithDeals = currentPipelineStages
        .filter(stage => !stage.isHidden) // Só mostrar os estágios visíveis
        .map((stage) => {
          // Filtrar negócios para este estágio, com tratamento especial para estágios de vendas realizadas/perdidas
          let stageDeals: Deal[] = [];
          
          if (stage.stageType === "completed") {
            // Para estágio "Vendas Realizadas", mostrar TODOS os negócios com status "won"
            let wonDeals = dealsData.filter(deal => 
              (deal.stageId === stage.id || deal.saleStatus === "won")
            );
            
            // Aplicar filtro de performance de vendas se selecionado
            if (salePerformanceFilter !== "all") {
              wonDeals = wonDeals.filter(deal => 
                deal.performanceReason === salePerformanceFilter
              );
            }
            
            stageDeals = wonDeals;
          } else if (stage.stageType === "lost") {
            // Para estágio "Vendas Perdidas", mostrar TODOS os negócios com status "lost"
            let lostDeals = dealsData.filter(deal => 
              (deal.stageId === stage.id || deal.saleStatus === "lost")
            );
            
            // Aplicar filtro de motivo de perda se selecionado
            if (lossReasonFilter !== "all") {
              lostDeals = lostDeals.filter(deal => 
                deal.lostReason && deal.lostReason.toString() === lossReasonFilter
              );
            }
            
            stageDeals = lostDeals;
          } else {
            // Para estágios normais, só mostrar negócios deste estágio que NÃO estão completos/perdidos
            stageDeals = dealsData.filter(deal => 
              deal.stageId === stage.id && 
              deal.saleStatus !== "won" && 
              deal.saleStatus !== "lost"
            );
          }
          
          // Marcar todos os negócios deste estágio como processados
          stageDeals.forEach(deal => {
            processedDeals[deal.id] = true;
          });
          
          const totalValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
          
          return {
            ...stage,
            deals: stageDeals,
            totalValue
          };
        })
        .sort((a, b) => {
          // Ordenação especial para colocar estágios completados e perdidos por último
          if (a.stageType === "completed" && b.stageType !== "completed") return 1;
          if (a.stageType !== "completed" && b.stageType === "completed") return -1;
          if (a.stageType === "lost" && b.stageType !== "lost") return 1;
          if (a.stageType !== "lost" && b.stageType === "lost") return -1;
          return a.order - b.order;
        });
      
      console.log("=== RESULTADO FINAL ===");
      console.log("Estágios filtrados (visíveis):", stagesWithDeals.length);
      console.log("Stages with deals:", stagesWithDeals.map(s => `${s.name} (${s.deals.length})`));
      console.log("======================");
      setBoardData(stagesWithDeals);
    };
    
    fetchDeals();
    
    // Criar polling mais agressivo para atualizações em tempo real com indicador visual
    // PAUSA o polling quando modais estão abertos para não interferir com dropdowns
    const pollingInterval = setInterval(() => {
      // Pausa polling se algum modal estiver aberto
      if (isEditDealModalOpen || isAddStageModalOpen) {
        console.log("🚫 Polling pausado - modal aberto");
        return;
      }
      
      console.log("🔄 Polling: Verificando atualizações do kanban...");
      setIsPolling(true);
      
      // Atualizar tanto os deals quanto os estágios
      Promise.all([
        fetchDeals(),
        queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] })
      ]).finally(() => {
        setIsPolling(false);
        setPollingProgress(0);
      });
    }, 5000); // A cada 5 segundos
    
    // Indicador de progresso visual - também pausa quando modais estão abertos
    const progressInterval = setInterval(() => {
      if (isEditDealModalOpen || isAddStageModalOpen) {
        return; // Não atualiza o progresso se modal estiver aberto
      }
      
      setPollingProgress(prev => {
        if (prev >= 100) {
          return 0;
        }
        return prev + (100 / 50); // 50 steps over 5 seconds = 100ms per step
      });
    }, 100);
    
    return () => {
      clearInterval(pollingInterval);
      clearInterval(progressInterval);
    };
  }, [activePipelineId, pipelineStages.length, filters?.search, filters?.status, filters?.sortBy, filters?.sortOrder, filters?.hideClosed, filters?.stageId, filters?.winReason, filters?.lostReason, userId, isEditDealModalOpen, isAddStageModalOpen]);
  
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    // Se não tiver destino ou se o destino for o mesmo que a origem, não fazer nada
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return;
    }
    
    const sourceStage = boardData.find(stage => stage.id.toString() === source.droppableId);
    const destStage = boardData.find(stage => stage.id.toString() === destination.droppableId);
    
    if (!sourceStage || !destStage) {
      return;
    }
    
    const dealId = parseInt(draggableId);
    const deal = sourceStage.deals.find(d => d.id === dealId);
    
    if (!deal) {
      return;
    }
    
    // Verificar se é uma mudança para um estágio especial (completado/perdido)
    if (destStage.stageType === "completed" || destStage.stageType === "lost") {
      setSelectedDeal(deal);
      setTargetStageInfo({ id: destStage.id, type: destStage.stageType });
      setIsOutcomeModalOpen(true);
      return; // Não continuar com a movimentação aqui, será feita após o modal
    }
    
    // Reordenar localmente para feedback visual imediato
    const updatedBoardData = [...boardData];
    
    // Remover o negócio do estágio de origem
    const sourceBoardIndex = updatedBoardData.findIndex(stage => stage.id === sourceStage.id);
    const [movedDeal] = updatedBoardData[sourceBoardIndex].deals.splice(source.index, 1);
    
    // Adicionar o negócio ao estágio de destino
    const destBoardIndex = updatedBoardData.findIndex(stage => stage.id === destStage.id);
    updatedBoardData[destBoardIndex].deals.splice(destination.index, 0, movedDeal);
    
    // Atualizar o estado local imediatamente para feedback visual
    setBoardData(updatedBoardData);
    
    // Se for dentro do mesmo estágio, atualizar a ordem de todos os deals desse estágio
    if (sourceStage.id === destStage.id) {
      const orders = updatedBoardData[destBoardIndex].deals.map((d, idx) => ({ id: d.id, order: idx }));
      try {
        await apiRequest('/api/deals/order', 'PUT', { orders });
        queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      } catch (error) {
        toast({
          title: "Erro ao atualizar ordem",
          description: "Não foi possível atualizar a ordem dos negócios.",
          variant: "destructive",
        });
        fetchUpdatedData();
      }
      return;
    }
    
    // Se for para outro estágio, atualizar o stageId e pipelineId
    try {
      console.log(`Movendo negócio ${dealId} para estágio ${destStage.id} no pipeline ${destStage.pipelineId}`);
      
      const updateData: any = {
        stageId: destStage.id,
        pipelineId: destStage.pipelineId
      };
      
      // Se movendo para um estágio normal (não completed/lost), resetar saleStatus
      if (destStage.stageType === "normal") {
        updateData.saleStatus = "negotiation";
      }
      
      await apiRequest(`/api/deals/${dealId}`, 'PUT', updateData);
      
      // Invalidar múltiplas chaves de cache para garantir atualização
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/deals'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/deals', activePipelineId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/deals', destStage.pipelineId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] })
      ]);
      
      // Aguardar um pouco para o servidor processar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Forçar recarregamento dos dados
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/deals'] }),
        queryClient.refetchQueries({ queryKey: ['/api/deals', activePipelineId] }),
        queryClient.refetchQueries({ queryKey: ['/api/deals', destStage.pipelineId] })
      ]);
      
      toast({
        title: "Negócio movido",
        description: `"${deal.name}" foi movido para ${destStage.name}`,
      });
    } catch (error) {
      console.error("Error updating deal stage:", error);
      toast({
        title: "Erro ao mover negócio",
        description: "Não foi possível atualizar o estágio do negócio.",
        variant: "destructive",
      });
      // Reverter o estado local em caso de erro
      setBoardData([...boardData]);
      fetchUpdatedData();
    }
  };
  
  const fetchUpdatedData = async () => {
    queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
  };
  
  // Helper para gerar badges de status mais compactos
  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    return (
      <span className={`status-badge ${status.toLowerCase()} px-1 py-0 text-[8px] font-medium rounded-full border h-3.5 inline-flex items-center`}>
        {status === 'in_progress' && 'Em prog.'}
        {status === 'waiting' && 'Aguard.'}
        {status === 'completed' && 'Concl.'}
        {status === 'canceled' && 'Canc.'}
      </span>
    );
  };
  
  // Em caso de não ter estágios ou dados
  if (boardData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <MessagesSquareIcon className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Nenhum estágio encontrado</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2 mb-4">
          {activePipelineId 
            ? "Adicione estágios ao funil para começar a gerenciar seus negócios."
            : "Selecione um funil para visualizar os estágios."}
        </p>
        {activePipelineId && (
          <Button onClick={() => setIsAddStageModalOpen(true)}>
            Adicionar Estágio
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex flex-col h-full relative">
        {/* Indicador de Polling */}
        <div className="fixed top-4 right-4 z-50 flex items-center space-x-2 group">
          <div className="relative">
            {/* Esfera principal - Clicável para atualizar manualmente */}
            <button 
              onClick={() => {
                console.log("🔄 Atualização manual solicitada");
                setIsPolling(true);
                setPollingProgress(0);
                fetchDeals().finally(() => {
                  setIsPolling(false);
                  setPollingProgress(0);
                });
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                isPolling 
                  ? 'bg-blue-500 scale-110' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer'
              }`}
              title="Clique para atualizar agora"
            >
              <RefreshCwIcon className={`w-5 h-5 transition-all duration-300 ${
                isPolling 
                  ? 'text-white animate-spin' 
                  : 'text-gray-500 dark:text-gray-400 group-hover:text-blue-600'
              }`} />
            </button>
            
            {/* Barra de progresso circular */}
            <svg className="absolute top-0 left-0 w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-200 dark:text-gray-700"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`transition-all duration-100 ${
                  isPolling ? 'text-blue-300' : 'text-blue-500'
                }`}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={`${pollingProgress}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
          
          {/* Tooltip */}
          <div className="hidden group-hover:block absolute right-12 top-0 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
            {isPolling ? 'Sincronizando...' : `Próxima atualização: ${Math.ceil(2 - (pollingProgress / 50))}s`}
          </div>
        </div>
        
        {/* Botão oculto para ser clicado pelo Header para adicionar estágio */}
        <button
          id="add-stage-button"
          className="hidden"
          onClick={() => setIsAddStageModalOpen(true)}
          aria-hidden="true"
        />
        
        {/* Modais */}
        {selectedDeal && (
          <EditDealModal
            isOpen={isEditDealModalOpen}
            onClose={() => {
              setIsEditDealModalOpen(false);
              setSelectedDeal(null);
            }}
            deal={{
              order: null,
              userId: 0,
              quoteValue: null,
              salePerformance: null,
              ...selectedDeal
            }}
            pipelineStages={pipelineStages}
            onSaved={() => {
              fetchUpdatedData();
            }}
          />
        )}
        
        <EditStageModal 
          isOpen={isEditStageModalOpen}
          onClose={() => setIsEditStageModalOpen(false)}
          stage={selectedStage}
        />
        
        <AddStageModal 
          isOpen={isAddStageModalOpen}
          onClose={() => setIsAddStageModalOpen(false)}
          pipelineStages={pipelineStages}
          pipelineId={activePipelineId || 1}
        />
        
        {selectedDeal && (
          <DealOutcomeModal
            isOpen={isOutcomeModalOpen}
            onClose={() => {
              setIsOutcomeModalOpen(false);
              setSelectedDeal(null);
              setTargetStageInfo({ id: 0, type: null });
            }}
            deal={{
              order: null,
              userId: 0,
              quoteValue: null,
              salePerformance: null,
              ...selectedDeal
            }}
            targetStageId={targetStageInfo.id}
            targetStageType={targetStageInfo.type as any}
          />
        )}
        
        {/* Espaço oculto para o botão de adicionar estágio */}
        <div className="hidden">
          <button
            id="add-stage-button"
            onClick={() => setIsAddStageModalOpen(true)}
            aria-hidden="true"
          />
        </div>
        
        {/* Área principal de rolagem horizontal com os estágios */}
        <div className="flex overflow-x-auto px-2 board-container flex-1 mt-2">
          {boardData.map((stage) => (
            <div 
              key={stage.id} 
              className="kanban-column flex-shrink-0 w-64 mx-1.5 flex flex-col"
            >
              {/* Cabeçalho da coluna - sticky */}
              <div className={`p-2 rounded-t-lg border shadow-sm kanban-column-header ${
                stage.stageType === "completed" 
                  ? "bg-gradient-to-b from-green-100 to-green-50 border-green-300 dark:from-green-900/40 dark:to-green-900/20 dark:border-green-700" 
                  : stage.stageType === "lost" 
                    ? "bg-gradient-to-b from-red-100 to-red-50 border-red-300 dark:from-red-900/40 dark:to-red-900/20 dark:border-red-700"
                    : "bg-gradient-to-b from-gray-100 to-gray-50 border-gray-300 dark:from-gray-900/40 dark:to-gray-900/20 dark:border-gray-700"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {stage.stageType === "completed" && (
                      <span className="h-2.5 w-2.5 bg-green-600 dark:bg-green-500 rounded-full"></span>
                    )}
                    {stage.stageType === "lost" && (
                      <span className="h-2.5 w-2.5 bg-red-600 dark:bg-red-500 rounded-full"></span>
                    )}
                    {!stage.stageType && (
                      <span className="h-2.5 w-2.5 bg-blue-600 dark:bg-blue-500 rounded-full"></span>
                    )}
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{stage.name}</h3>
                    <Badge variant="outline" className="rounded-full px-1.5 py-0 h-4 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                      {stage.deals.length}
                    </Badge>
                  </div>
                  <div className="flex items-center">
                    {!stage.isSystem && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 p-0.5">
                            <MoreVerticalIcon className="h-3 w-3 text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedStage(stage);
                              setIsEditStageModalOpen(true);
                            }}
                            className="flex items-center gap-2"
                          >
                            <Edit2Icon className="h-4 w-4" />
                            <span>Editar Estágio</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{stage.deals.length} negócios</span>
                  <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">{formatCurrency(stage.totalValue)}</span>
                </div>
                
                {/* Filtros para estágios especiais */}
                {stage.stageType === "completed" && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge 
                      variant={salePerformanceFilter === "all" ? "default" : "outline"}
                      className={`text-[8px] px-1 py-0 h-4 cursor-pointer ${salePerformanceFilter === "all" ? "bg-gray-200 text-gray-800 hover:bg-gray-300" : ""}`}
                      onClick={() => setSalePerformanceFilter("all")}
                    >
                      Todas
                    </Badge>
                    <Badge 
                      variant={salePerformanceFilter === "below" ? "default" : "outline"}
                      className={`text-[8px] px-1 py-0 h-4 cursor-pointer ${salePerformanceFilter === "below" ? "bg-red-100 text-red-800 hover:bg-red-200" : ""}`}
                      onClick={() => setSalePerformanceFilter("below")}
                    >
                      Abaixo
                    </Badge>
                    <Badge 
                      variant={salePerformanceFilter === "on_target" ? "default" : "outline"}
                      className={`text-[8px] px-1 py-0 h-4 cursor-pointer ${salePerformanceFilter === "on_target" ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : ""}`}
                      onClick={() => setSalePerformanceFilter("on_target")}
                    >
                      Conforme
                    </Badge>
                    <Badge 
                      variant={salePerformanceFilter === "above" ? "default" : "outline"}
                      className={`text-[8px] px-1 py-0 h-4 cursor-pointer ${salePerformanceFilter === "above" ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}`}
                      onClick={() => setSalePerformanceFilter("above")}
                    >
                      Acima
                    </Badge>
                  </div>
                )}
                
                {stage.stageType === "lost" && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge 
                      variant={lossReasonFilter === "all" ? "default" : "outline"}
                      className={`text-[8px] px-1 py-0 h-4 cursor-pointer ${lossReasonFilter === "all" ? "bg-gray-200 text-gray-800 hover:bg-gray-300" : ""}`}
                      onClick={() => setLossReasonFilter("all")}
                    >
                      Todos
                    </Badge>
                    
                    {lossReasons && lossReasons.map((reason: any) => (
                      <Badge 
                        key={reason.id}
                        variant={lossReasonFilter === reason.id.toString() ? "default" : "outline"}
                        className={`text-[8px] px-1 py-0 h-4 cursor-pointer ${lossReasonFilter === reason.id.toString() ? "bg-red-100 text-red-800 hover:bg-red-200" : ""}`}
                        onClick={() => setLossReasonFilter(reason.id.toString())}
                      >
                        {reason.reason}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Botão de adicionar negócio removido da coluna */}
              </div>
              
              {/* Área de cards/droppable - altura ajustada para rolagem */}
              <Droppable droppableId={stage.id.toString()}>
                {(provided, snapshot) => (
                  <div
                    className={`deal-list p-2 rounded-b-lg border border-t-0 ${
                      snapshot.isDraggingOver
                        ? "droppable-hover bg-yellow-50 dark:bg-yellow-900/20"
                        : stage.stageType === "completed" 
                          ? "bg-green-50 dark:bg-green-900/30 border-green-300" 
                          : stage.stageType === "lost" 
                            ? "bg-red-50 dark:bg-red-900/30 border-red-300"
                            : "bg-gray-50 dark:bg-gray-900/20 border-gray-300"
                    } flex-1 overflow-y-auto`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {stage.deals.map((deal, index) => (
                      <Draggable
                        key={deal.id.toString()}
                        draggableId={deal.id.toString()}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              // Efeitos visuais durante o arraste
                              opacity: snapshot.isDragging ? 0.9 : 1,
                              boxShadow: snapshot.isDragging ? '0 8px 15px rgba(0, 0, 0, 0.15)' : '',
                              transform: snapshot.isDragging && provided.draggableProps.style?.transform 
                                ? `${provided.draggableProps.style.transform} rotate(1deg)` 
                                : provided.draggableProps.style?.transform,
                              zIndex: snapshot.isDragging ? 9999 : undefined,
                            }}
                            className={`mb-2 p-2 group border-l-4 ${
                              snapshot.isDragging
                                ? "shadow-lg dark:bg-gray-700 ring-2 ring-yellow-400 ring-opacity-50 deal-card-dragging"
                                : "shadow-sm hover:shadow-md bg-gray-50 dark:bg-gray-800"
                            } ${
                              deal.status === "completed" 
                                ? "border-l-green-500" 
                                : deal.status === "canceled" 
                                  ? "border-l-red-500"
                                  : "border-l-yellow-500"
                            } cursor-pointer rounded-md text-sm`}
                            onClick={() => {
                              setSelectedDeal(deal);
                              setIsEditDealModalOpen(true);
                            }}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[150px] text-[10px]">
                                  {deal.name}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {/* Badge para indicar se foi marcado como ganho ou perda */}
                                {deal.saleStatus === "won" && (
                                  <Badge className="bg-green-500 hover:bg-green-600 text-white text-[8px] px-1 py-0 h-4">
                                    GANHO
                                  </Badge>
                                )}
                                {deal.saleStatus === "lost" && (
                                  <Badge className="bg-red-500 hover:bg-red-600 text-white text-[8px] px-1 py-0 h-4">
                                    PERDA
                                  </Badge>
                                )}
                                {getStatusBadge(deal.status)}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-0.5">
                              <div className="flex items-center text-[9px] text-gray-600 dark:text-gray-400">
                                <User2Icon className="w-2.5 h-2.5 mr-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <span className="truncate">
                                  {deal.leadData?.name || "N/D"}
                                </span>
                              </div>
                              <div className="flex items-center text-[9px] text-gray-600 dark:text-gray-400">
                                <Building className="w-2.5 h-2.5 mr-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <span className="truncate">
                                  {deal.leadData?.companyName || "N/D"}
                                </span>
                              </div>
                            </div>
                            {/* Exibir e-mail do criador do negócio, se disponível */}
                            {deal.creatorUserEmail && (
                              <div className="text-[8px] text-gray-400 dark:text-gray-500 truncate mt-0.5" title={`Criado por: ${deal.creatorUserEmail}`}>Criado por: {deal.creatorUserEmail}</div>
                            )}
                            <div className="flex items-center justify-between mt-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-700">
                              <span className="text-[9px] text-gray-500 dark:text-gray-400 flex items-center">
                                <CalendarIcon className="w-2.5 h-2.5 mr-0.5" />
                                {formatTimeAgo(deal.updatedAt)}
                              </span>
                              <span className="px-1 py-0.5 text-[9px] font-medium bg-yellow-100 dark:bg-yellow-900/30 rounded text-yellow-800 dark:text-yellow-300">
                                {formatCurrency(deal.value || 0)}
                              </span>
                            </div>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
        
        {/* Modal de adição de negócio */}
        <AddDealModal
          isOpen={isAddDealModalOpen}
          onClose={() => {
            setIsAddDealModalOpen(false);
            setSelectedStageForNewDeal(null);
          }}
          initialStageId={selectedStageForNewDeal?.id}
          pipelineStages={pipelineStages}
        />
      </div>
    </DragDropContext>
  );
}