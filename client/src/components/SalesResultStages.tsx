import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Deal, PipelineStage } from "@shared/schema";
import { formatCurrency } from "@/lib/formatters";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Edit2Icon,
  MoreVerticalIcon,
  Building,
  UserCircle,
  InfoIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EditDealModal from "@/components/EditDealModal";
import { FilterOptions } from "@/components/FilterBar";

interface SalesResultStagesProps {
  pipelineStages: PipelineStage[];
  filters?: FilterOptions;
  pipelineId: number;
}

export default function SalesResultStages({ pipelineStages, filters, pipelineId }: SalesResultStagesProps) {
  // State para filtro de performance de vendas
  const [salePerformanceFilter, setSalePerformanceFilter] = useState<string>("all");
  // State para filtro de razão de perda
  const [lossReasonFilter, setLossReasonFilter] = useState<string>("all");
  const [isEditDealModalOpen, setIsEditDealModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Use os filtros do componente pai ou crie um padrão
  const activeFilters = filters || {
    search: "",
    status: [],
    sortBy: "date",
    sortOrder: "desc",
    hideClosed: false
  };

  // Get deals com configurações para garantir atualização imediata - filtrando por pipeline
  const { data: deals, isLoading } = useQuery<Deal[]>({
    queryKey: ['/api/deals', pipelineId],
    queryFn: async () => {
      const response = await fetch(`/api/deals?pipelineId=${pipelineId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch deals');
      }
      return response.json();
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
    refetchInterval: 2000,
  });

  // Get loss reasons para filtrar as vendas perdidas
  const { data: lossReasons } = useQuery({
    queryKey: ['/api/loss-reasons'],
  });

  // Função para filtrar os deals por status de venda (perdido/ganho) e filtros adicionais
  const getFilteredDeals = (status: 'won' | 'lost') => {
    if (!deals) return [];

    let filteredDeals = deals.filter(deal => deal.saleStatus === status);

    // Aplicar filtro de texto de busca
    if (activeFilters.search) {
      const searchLower = activeFilters.search.toLowerCase();
      filteredDeals = filteredDeals.filter(deal => 
        deal.name.toLowerCase().includes(searchLower)
      );
    }

    // Para vendas ganhas, filtrar por performance se um filtro específico estiver selecionado
    if (status === 'won' && salePerformanceFilter !== 'all') {
      filteredDeals = filteredDeals.filter(deal => 
        deal.salePerformance === salePerformanceFilter
      );
    }

    // Para vendas perdidas, filtrar por motivo de perda se um filtro específico estiver selecionado
    if (status === 'lost' && lossReasonFilter !== 'all') {
      filteredDeals = filteredDeals.filter(deal => 
        deal.lostReason && deal.lostReason.toString() === lossReasonFilter
      );
    }

    // Ordenação
    if (activeFilters.sortBy === 'date') {
      filteredDeals.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return activeFilters.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    } else if (activeFilters.sortBy === 'value') {
      filteredDeals.sort((a, b) => {
        const valueA = a.value || 0;
        const valueB = b.value || 0;
        return activeFilters.sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
      });
    } else if (activeFilters.sortBy === 'name') {
      filteredDeals.sort((a, b) => {
        return activeFilters.sortOrder === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      });
    }

    return filteredDeals;
  };

  // Função para abrir o modal de edição de um deal
  const handleEditDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsEditDealModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Seção de Vendas Ganhas */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm border stage-completed">
        <div className="flex flex-col mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
              <span className="bg-green-600 dark:bg-green-500 h-3 w-3 rounded-full"></span>
              Vendas Realizadas
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {getFilteredDeals('won').length} negócios encontrados
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-medium">Filtrar por performance:</span>
            <div className="flex gap-1 flex-wrap">
              <Badge 
                variant={salePerformanceFilter === "all" ? "default" : "outline"}
                className={salePerformanceFilter === "all" ? "bg-gray-200 text-gray-800 hover:bg-gray-300" : ""}
                onClick={() => setSalePerformanceFilter("all")}
                style={{ cursor: "pointer" }}
              >
                Todas
              </Badge>
              <Badge 
                variant={salePerformanceFilter === "below" ? "default" : "outline"}
                className={salePerformanceFilter === "below" ? "bg-red-100 text-red-800 hover:bg-red-200" : ""}
                onClick={() => setSalePerformanceFilter("below")}
                style={{ cursor: "pointer" }}
              >
                Abaixo da cotação
              </Badge>
              <Badge 
                variant={salePerformanceFilter === "on_target" ? "default" : "outline"}
                className={salePerformanceFilter === "on_target" ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : ""}
                onClick={() => setSalePerformanceFilter("on_target")}
                style={{ cursor: "pointer" }}
              >
                Conforme a cotação
              </Badge>
              <Badge 
                variant={salePerformanceFilter === "above" ? "default" : "outline"}
                className={salePerformanceFilter === "above" ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}
                onClick={() => setSalePerformanceFilter("above")}
                style={{ cursor: "pointer" }}
              >
                Acima da cotação
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!isLoading && getFilteredDeals('won').map(deal => (
            <Card key={deal.id} className="p-4 border-green-200 dark:border-green-800 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate">{deal.name}</h3>
                <div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
                        <span className="sr-only">Abrir menu</span>
                        <MoreVerticalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditDeal(deal)}>
                        <Edit2Icon className="mr-2 h-4 w-4" />
                        <span>Editar negócio</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Building className="mr-1 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300 truncate">{deal.companyName || 'Sem empresa'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Valor: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(deal.value || 0)}</span>
                  </div>
                  
                  <div className={`
                    ${deal.salePerformance === 'below' ? 'performance-below' : ''}
                    ${deal.salePerformance === 'on_target' ? 'performance-according' : ''}
                    ${deal.salePerformance === 'above' ? 'performance-above' : ''}
                  `}>
                    {deal.salePerformance === 'below' && 'Abaixo da cotação'}
                    {deal.salePerformance === 'on_target' && 'Conforme a cotação'}
                    {deal.salePerformance === 'above' && 'Acima da cotação'}
                    {!deal.salePerformance && 'Não categorizado'}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {getFilteredDeals('won').length === 0 && (
            <div className="col-span-full flex justify-center items-center p-6 border rounded-lg border-dashed text-gray-500 dark:text-gray-400">
              Nenhuma venda realizada encontrada com os filtros atuais
            </div>
          )}
        </div>
      </div>

      {/* Seção de Vendas Perdidas */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm border stage-lost">
        <div className="flex flex-col mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <span className="bg-red-600 dark:bg-red-500 h-3 w-3 rounded-full"></span>
              Vendas Perdidas
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {getFilteredDeals('lost').length} negócios encontrados
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-medium">Filtrar por motivo:</span>
            <div className="flex gap-1 flex-wrap">
              <Badge 
                variant={lossReasonFilter === "all" ? "default" : "outline"}
                className={lossReasonFilter === "all" ? "bg-gray-200 text-gray-800 hover:bg-gray-300" : ""}
                onClick={() => setLossReasonFilter("all")}
                style={{ cursor: "pointer" }}
              >
                Todos os motivos
              </Badge>
              
              {lossReasons && lossReasons.map((reason: any) => (
                <Badge 
                  key={reason.id}
                  variant={lossReasonFilter === reason.id.toString() ? "default" : "outline"}
                  className={lossReasonFilter === reason.id.toString() ? "bg-red-100 text-red-800 hover:bg-red-200" : ""}
                  onClick={() => setLossReasonFilter(reason.id.toString())}
                  style={{ cursor: "pointer" }}
                >
                  {reason.reason}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!isLoading && getFilteredDeals('lost').map(deal => (
            <Card key={deal.id} className="p-4 border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate">{deal.name}</h3>
                <div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
                        <span className="sr-only">Abrir menu</span>
                        <MoreVerticalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditDeal(deal)}>
                        <Edit2Icon className="mr-2 h-4 w-4" />
                        <span>Editar negócio</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Building className="mr-1 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300 truncate">{deal.companyName || 'Sem empresa'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Valor cotado: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(deal.quoteValue || 0)}</span>
                  </div>
                  
                  <span className="performance-below">
                    {deal.lostReason || 'Motivo não especificado'}
                  </span>
                </div>

                {deal.lostNotes && (
                  <div className="mt-2 text-sm border-t border-gray-100 dark:border-gray-700 pt-2">
                    <p className="font-medium text-gray-700 dark:text-gray-300">Observações:</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{deal.lostNotes}</p>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {getFilteredDeals('lost').length === 0 && (
            <div className="col-span-full flex justify-center items-center p-6 border rounded-lg border-dashed text-gray-500 dark:text-gray-400">
              Nenhuma venda perdida encontrada com os filtros atuais
            </div>
          )}
        </div>
      </div>

      {/* Modal de edição de negócio */}
      {selectedDeal && (
        <EditDealModal
          isOpen={isEditDealModalOpen}
          onClose={() => setIsEditDealModalOpen(false)}
          deal={selectedDeal}
          pipelineStages={pipelineStages}
          onSaved={() => setIsEditDealModalOpen(false)}
        />
      )}
    </div>
  );
}