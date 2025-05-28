import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Deal, PipelineStage } from "@shared/schema";
import { FilterOptions } from "@/components/FilterBar";

// Tipo expandido para lidar com os campos mesclados do lead que vêm na API
type ExtendedDeal = Deal & {
  // Campos do Lead que vêm junto no objeto
  companyName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  address?: string;
  chatwootContactId?: string;
  chatwootAgentName?: string;
  clientCategory?: string;
  clientType?: string;
};

// Estendendo a interface FilterOptions para incluir os campos de ordenação
interface InternalFilterOptions extends FilterOptions {
  sortBy?: string;
  sortOrder?: string;
}

export function usePipeline(activePipelineId?: number | null) {
  const [filteredDeals, setFilteredDeals] = useState<ExtendedDeal[]>([]);
  const [filters, setFilters] = useState<InternalFilterOptions>({
    search: "",
    status: [],
    sortBy: "date",
    sortOrder: "desc",
    hideClosed: false // Alterado para false para mostrar todos os negócios incluindo Won/Lost
  });

  // Buscar negócios com configurações para garantir atualização imediata
  const { data: allDeals = [], isLoading: isDealsLoading } = useQuery<ExtendedDeal[]>({
    queryKey: ['/api/deals', activePipelineId],
    staleTime: 0,                // Considerar dados obsoletos imediatamente (sempre buscar dados frescos)
    refetchOnMount: true,        // Recarregar quando o componente for montado
    refetchOnWindowFocus: true,  // Recarregar quando a janela ganhar foco
  });

  // Buscar estágios do pipeline
  const { data: pipelineStages = [], isLoading: isLoadingStages } = useQuery<PipelineStage[]>({
    queryKey: ['/api/pipeline-stages'],
    enabled: true, // Busca todos os estágios sempre
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchOnMount: true,
    onSuccess: (data) => {
      console.log("usePipeline - Estágios carregados:", data.length);
      console.log("usePipeline - Estágios por pipeline:", data.reduce((acc, stage) => {
        acc[stage.pipelineId] = (acc[stage.pipelineId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>));
    }
  });

  // Aplicar filtros e ordenação aos negócios
  useEffect(() => {
    let result = [...allDeals];

    // Aplicar filtro de pesquisa textual
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(deal => {
        // Nome do negócio é garantido que existe
        if (deal.name.toLowerCase().includes(searchLower)) {
          return true;
        }

        // Verificamos todos os campos disponíveis (incluindo os de lead que vêm junto no mesmo objeto)
        // Na API, o objeto já vem com todos os campos mesclados
        return (
          // Campos do Deal
          (deal.notes && deal.notes.toLowerCase().includes(searchLower)) ||

          // Campos do Lead que vêm junto
          (deal.companyName && deal.companyName.toLowerCase().includes(searchLower)) ||
          (deal.email && deal.email.toLowerCase().includes(searchLower)) ||
          (deal.phone && deal.phone.toLowerCase().includes(searchLower)) ||
          (deal.city && deal.city.toLowerCase().includes(searchLower)) ||
          (deal.state && deal.state.toLowerCase().includes(searchLower)) ||
          (deal.address && deal.address.toLowerCase().includes(searchLower))
        );
      });
    }

    // Aplicar filtros de status
    if (filters.status && filters.status.length > 0) {
      result = result.filter(deal => 
        deal.status && filters.status.includes(deal.status)
      );
    }

    // Aplicar filtro de motivo de ganho (vendas realizadas)
    if (filters.winReason) {
      // Mostrar apenas negócios com status "won" (vendidos)
      result = result.filter(deal => 
        deal.saleStatus === 'won' && 
        deal.salePerformance === filters.winReason
      );

      // Quando filtro de ganho estiver ativo, remover a ocultação de negócios fechados
      // para mostrar os resultados mesmo que hideClosed seja true
      if (filters.hideClosed) {
        console.log("Ignorando hideClosed por causa do filtro de ganho");
      }
    }

    // Aplicar filtro de motivo de perda (vendas perdidas)
    if (filters.lostReason) {
      // Mostrar apenas negócios com status "lost" (perdidos)
      result = result.filter(deal => 
        deal.saleStatus === 'lost' && 
        deal.lostReason === filters.lostReason
      );

      // Quando filtro de perda estiver ativo, remover a ocultação de negócios fechados
      // para mostrar os resultados mesmo que hideClosed seja true
      if (filters.hideClosed) {
        console.log("Ignorando hideClosed por causa do filtro de perda");
      }
    }

    // Removendo o filtro hideClosed para permitir que negócios "Won" e "Lost" apareçam no Kanban
    // Os estágios específicos de "Vendas Realizadas" e "Vendas Perdidas" já fazem a filtragem adequada
    // if (filters.hideClosed && !filters.winReason && !filters.lostReason && activePipelineId === 1) {
    //   result = result.filter(deal => 
    //     deal.saleStatus !== 'won' && 
    //     deal.saleStatus !== 'lost'
    //   );
    // }

    // Aplicar filtro de estágio
    if (filters.stageId !== undefined) {
      result = result.filter(deal => deal.stageId === filters.stageId);
    }

    // Aplicar ordenação
    if (filters.sortBy && filters.sortOrder) {
      result.sort((a, b) => {
        const sortMultiplier = filters.sortOrder === "asc" ? 1 : -1;

        switch (filters.sortBy) {
          case "name":
            return sortMultiplier * (a.name || "").localeCompare(b.name || "");
          case "value":
            return sortMultiplier * ((a.value || 0) - (b.value || 0));
          case "company":
            // Use companyName que já vem no objeto
            const companyA = a.companyName || "";
            const companyB = b.companyName || ""; 
            return sortMultiplier * companyA.localeCompare(companyB);
          case "date":
          default:
            // Se a data for inválida, use a data atual como fallback
            const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : Date.now();
            const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : Date.now();
            return sortMultiplier * (dateA - dateB);
        }
      });
    }

    setFilteredDeals(result);
    console.log("Filtros aplicados:", filters);
    console.log("Negócios filtrados:", result.length);
  }, [allDeals, filters]);

  // Calculate stats for a stage
  const calculateStageStats = (stageId: number) => {
    console.log(`Calculando estatísticas para o estágio ${stageId} no pipeline ${activePipelineId}`);
    const stageDeals = filteredDeals.filter(deal => deal.stageId === stageId);
    const value = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    return {
      count: stageDeals.length,
      value
    };
  };

  // Update filters
  const updateFilters = (newFilters: FilterOptions) => {
    // Garantir que sempre temos um valor para hideClosed (true por padrão)
    const updatedFilters = {
      ...newFilters,
      hideClosed: newFilters.hideClosed !== undefined ? newFilters.hideClosed : true
    };

    console.log("Aplicando filtros:", updatedFilters);
    setFilters(updatedFilters);
  };

  // Calculate total pipeline value
  const calculateTotalValue = () => {
    return filteredDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  };

  // Organize deals by stage
  const getDealsByStage = (stageId: number) => {
    return filteredDeals.filter(deal => deal.stageId === stageId);
  };

  // Refresh pipeline data manually com recarregamento forçado
  const refreshPipelineData = async () => {
    try {
      // Invalidar o cache para forçar uma nova requisição
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/deals', activePipelineId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages', activePipelineId] })
      ]);

      // Forçar recarregamento imediato dos dados
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/deals', activePipelineId] }),
        queryClient.refetchQueries({ queryKey: ['/api/pipeline-stages', activePipelineId] })
      ]);
    } catch (error) {
      console.error("Erro ao atualizar dados do pipeline:", error);
    }
  };

  return {
    deals: filteredDeals,
    pipelineStages,
    filters,
    updateFilters,
    isLoading: isDealsLoading || isLoadingStages,
    calculateStageStats,
    calculateTotalValue,
    getDealsByStage,
    refreshPipelineData
  };
}