import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import Header from "@/components/Header";
import KanbanBoard from "@/components/KanbanBoard";
import ListView from "@/components/ListView";
import ChatwootContacts from "@/components/ChatwootContacts";
// Importação de SalesResultStages removida
import FilterBar, { FilterOptions } from "@/components/FilterBar";
import ApiConfigModal from "@/components/ApiConfigModal";
import AddDealModal from "@/components/AddDealModal";
import InitializeDB from "@/components/InitializeDB";
import { usePipeline } from "@/hooks/usePipeline";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Pipeline } from "@shared/schema";
import HeatmapView from "@/pages/Heatmap";
import { ChevronUpIcon, ChevronDownIcon, FilterIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "contacts" | "heatmap" | "results">("kanban");
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isAddDealModalOpen, setIsAddDealModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();
  
  // Função para atualizar o kanban manualmente
  const handleRefreshKanban = async () => {
    try {
      // Limpar todos os caches relacionados a deals
      queryClient.removeQueries({ queryKey: ['/api/deals'] });
      
      // Forçar refetch de todas as queries ativas
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/deals'],
        refetchType: 'active' 
      });
      
      toast({
        title: "Dados atualizados",
        description: "O kanban foi sincronizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Ocorreu um erro ao sincronizar os dados.",
        variant: "destructive",
      });
    }
  };
  
  // Estado para controlar o pipeline ativo
  const [activePipelineId, setActivePipelineId] = useState<number | null>(null);
  
  // Fetch a lista de pipelines disponíveis
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ['/api/pipelines'],
  });

  // Fetch o pipeline padrão
  const { data: defaultPipeline } = useQuery<Pipeline>({
    queryKey: ['/api/pipelines/default'],
  });
  
  useEffect(() => {
    if (defaultPipeline?.id && !activePipelineId) {
      console.log("Definindo pipeline padrão:", defaultPipeline.id);
      setActivePipelineId(defaultPipeline.id);
    }
  }, [defaultPipeline?.id, activePipelineId]);
  
  const { pipelineStages, refreshPipelineData, filters, updateFilters, deals } = usePipeline(activePipelineId);
  
  // Get settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery<Settings | undefined>({
    queryKey: ['/api/settings'],
  });

  useEffect(() => {
    if (settings?.activePipelineId) {
      setActivePipelineId(settings.activePipelineId);
    }
  }, [settings]);

  // Handle URL parameters for API configuration
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlApiKey = params.get('api_key');
    const urlChatwootUrl = params.get('url');
    const urlAccountId = params.get('id');

    // If URL has all parameters, save them
    if (urlApiKey && urlChatwootUrl && urlAccountId) {
      const saveSettings = async () => {
        try {
          // Save settings and get response
          await apiRequest('/api/settings', 'POST', {
            chatwootApiKey: urlApiKey,
            chatwootUrl: urlChatwootUrl,
            accountId: urlAccountId
          });
          
          // Clean URL and refresh page
          window.history.replaceState({}, '', '/');
          
          // Refresh settings first and wait for it
          await queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
          await queryClient.refetchQueries({ queryKey: ['/api/settings'] });
          
          // Wait for sync to complete
          const syncResponse = await apiRequest('/api/chatwoot/sync', 'POST', {});
          
          // Only after sync completes, refresh the deals and wait for the refetch
          if (syncResponse.success) {
            await queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
            await queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] });
            await queryClient.refetchQueries({ queryKey: ['/api/deals'] });
            await queryClient.refetchQueries({ queryKey: ['/api/pipeline-stages'] });
            // Force a state update to trigger re-render
            refreshPipelineData();
          }
        } catch (error) {
          console.error('Failed to save settings from URL:', error);
        }
      };
      saveSettings();
    }
    // Show modal only if no URL parameters and no existing config
    else if (!isLoadingSettings && !settings?.chatwootApiKey && !isApiModalOpen) {
      setIsApiModalOpen(true);
    }
  }, [isLoadingSettings]);
  
  // Sync with Chatwoot
  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/chatwoot/sync', 'POST', {});
    },
    onSuccess: async () => {
      // Invalidar todas as consultas relevantes
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chatwoot/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] });
      
      try {
        // Refetch das consultas em vez de recarregar a página
        await queryClient.refetchQueries({ queryKey: ['/api/deals'] });
        await queryClient.refetchQueries({ queryKey: ['/api/chatwoot/contacts'] });
        await queryClient.refetchQueries({ queryKey: ['/api/pipeline-stages'] });
        
        // Forçar atualização dos dados do pipeline
        refreshPipelineData();
      } catch (error) {
        console.error("Erro ao atualizar dados após sincronização:", error);
      }
    },
    onError: (error) => {
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar com o Chatwoot. Verifique suas configurações.",
        variant: "destructive",
      });
      console.error("Sync error:", error);
    }
  });
  
  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      
      // Exibir informações detalhadas sobre a sincronização
      if (result && result.synced !== undefined) {
        let description = "Os contatos foram sincronizados com sucesso.";
        
        // Se houver novos negócios, mostrar quantos
        if (result.newDeals && result.newDeals.length > 0) {
          description = `${result.synced} contatos sincronizados. ${result.newDeals.length} novo(s) negócio(s) criado(s).`;
        } else {
          description = `${result.synced} contatos sincronizados. Nenhum novo negócio criado.`;
        }
        
        toast({
          title: "Sincronização concluída",
          description: description,
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
    }
  };
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  const toggleViewMode = (mode: "kanban" | "list" | "contacts" | "heatmap" | "results") => {
    setViewMode(mode);
  };
  
  // Estado para controlar a exibição do modal de inicialização do DB
  const [showDBInitializer, setShowDBInitializer] = useState(false);
  // Flag para controlar a verificação do banco de dados
  const [dbCheckPerformed, setDbCheckPerformed] = useState(false);
  
  // Atualizar dados do pipeline ao montar
  useEffect(() => {
    refreshPipelineData();
  }, []);
  
  // Verificar erros 500 nas requisições para exibir o inicializador de DB
  // Mas apenas uma vez durante o carregamento da página
  useEffect(() => {
    // Não fazer a verificação se já foi realizada
    if (dbCheckPerformed) return;
    
    const checkDatabaseStatus = async () => {
      try {
        await apiRequest('/api/pipeline-stages');
        setDbCheckPerformed(true);
      } catch (error) {
        console.error('Erro ao verificar status do banco de dados:', error);
        setShowDBInitializer(true);
        setDbCheckPerformed(true);
      }
    };
    
    checkDatabaseStatus();
  }, [dbCheckPerformed]);

  // Buscar todos os usuários para o filtro (apenas admin)
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: user?.role === 'admin',
  });
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Cabeçalho fixo */}
      <div className="flex-none">
        <Header 
          toggleSidebar={toggleSidebar}
          viewMode={viewMode} 
          toggleViewMode={toggleViewMode}
          onOpenApiConfig={() => setIsApiModalOpen(true)}
          onAddDeal={() => setIsAddDealModalOpen(true)}
          hasApiConfig={!!settings?.chatwootApiKey}
          activePipelineId={activePipelineId}
          onPipelineChange={(pipelineId) => setActivePipelineId(pipelineId)}
          pipelineStages={pipelineStages}
          onRefreshKanban={handleRefreshKanban}
        />
      </div>
      
      {/* Conteúdo principal - tudo abaixo do cabeçalho */}
      <div className="flex-grow flex flex-col overflow-hidden">
        <main className="flex-grow flex flex-col overflow-hidden bg-gray-50">
          {/* Mostrar o inicializador de banco de dados quando necessário */}
          {showDBInitializer && (
            <div className="px-4 pt-6 pb-4 flex-none">
              <InitializeDB />
            </div>
          )}
          
          {/* Barra de filtros - tamanho fixo - somente quando um pipeline estiver selecionado */}
          {activePipelineId && viewMode !== "contacts" && viewMode !== "heatmap" && viewMode !== "results" && (
            <div className="border-b flex-none">
              {/* Barra com botão de toggle */}
              <div className="flex items-center justify-between px-4 py-2 bg-blue-950 dark:bg-blue-950">
                {/* Filtros */}
                <div className="flex items-center gap-2">
                  <FilterIcon className="h-4 w-4 text-yellow-400 dark:text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400 dark:text-yellow-400">Filtros</span>
                  {/* Filtro de usuário para admin */}
                  {user?.role === 'admin' && (
                    <div className="ml-4 flex items-center gap-1">
                      <label className="font-medium text-white text-xs" htmlFor="user-filter">Usuário:</label>
                      <select
                        id="user-filter"
                        className="border rounded px-2 py-1 text-xs bg-blue-900 text-white border-blue-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        value={selectedUserId || ''}
                        onChange={e => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Todos</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.email}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Ações do Pipeline - botões anteriormente no header */}
                  {viewMode === "kanban" && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-yellow-400 hover:bg-yellow-500 text-blue-950 shadow-sm border-none flex items-center gap-1"
                        onClick={() => setIsAddDealModalOpen(true)}
                        disabled={!activePipelineId}
                      >
                        <PlusIcon className="h-4 w-4" />
                        <span className="font-medium">Novo Negócio</span>
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 hover:bg-yellow-400 hover:text-blue-950 border-yellow-400 text-yellow-400"
                        onClick={() => {
                          // Ação para adicionar estágio
                          if (!activePipelineId) {
                            toast({
                              title: "Selecione um pipeline",
                              description: "É necessário selecionar um pipeline para adicionar estágios.",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          // Essa ação deve chamar a função no KanbanBoard
                          const kanbanBoardElement = document.getElementById('add-stage-button');
                          if (kanbanBoardElement) {
                            kanbanBoardElement.click();
                          }
                        }}
                        disabled={!activePipelineId}
                      >
                        <PlusIcon className="h-4 w-4" />
                        <span>Adicionar Estágio</span>
                      </Button>
                    </div>
                  )}
                  
                  {/* Botão de toggle para filtros */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-yellow-400 hover:text-blue-950 hover:bg-yellow-400 dark:text-yellow-400 dark:hover:text-blue-950 dark:hover:bg-yellow-400 transition-colors"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    {showFilters ? (
                      <ChevronUpIcon className="h-5 w-5" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Conteúdo dos filtros - exibido/oculto com base em showFilters */}
              {showFilters && (
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900">
                  <FilterBar 
                    onFilterChange={updateFilters}
                    activeFilters={filters}
                    activePipelineId={activePipelineId}
                    isDefaultPipeline={defaultPipeline?.id === activePipelineId}
                  />
                </div>
              )}
            </div>
          )}
          
          {/* Área de conteúdo com scroll */}
          <div className="flex-grow overflow-auto">
            {!activePipelineId && (
              <div className="flex items-center justify-center flex-col p-8">
                <div className="bg-blue-950 border-2 border-yellow-500 rounded-lg p-8 max-w-md text-center shadow-lg">
                  <h3 className="text-xl font-bold text-yellow-400 mb-3">Nenhum Pipeline Selecionado</h3>
                  <p className="text-white mb-4">
                    Selecione um pipeline no menu superior para visualizar e gerenciar seus negócios.
                  </p>
                  <p className="text-sm text-gray-200">
                    Se não houver nenhum pipeline disponível, entre em contato com o administrador para configurar os pipelines.
                  </p>
                </div>
              </div>
            )}
            
            {activePipelineId && viewMode === "kanban" && (
              <div className="h-full overflow-auto">
                {/* Debug: Verificar estágios antes de passar para KanbanBoard */}
                {console.log("Dashboard - Pipeline stages sendo passados:", pipelineStages.length)}
                {console.log("Dashboard - Pipeline ativo:", activePipelineId)}
                <KanbanBoard 
                  pipelineStages={pipelineStages} 
                  filters={{ 
                    ...filters, 
                    sortBy: filters.sortBy ?? 'name', 
                    sortOrder: filters.sortOrder ?? 'asc', 
                    hideClosed: Boolean(filters.hideClosed) 
                  }} 
                  activePipelineId={activePipelineId}
                  onAddDeal={() => setIsAddDealModalOpen(true)}
                  deals={deals}
                  userId={user?.role === 'admin' ? selectedUserId : user?.id}
                />
              </div>
            )}
            
            {activePipelineId && viewMode === "list" && (
              <div className="px-4 overflow-y-auto h-full">
                <ListView 
                  pipelineStages={pipelineStages} 
                  filters={filters} 
                  activePipelineId={activePipelineId} 
                />
              </div>
            )}
            
            {activePipelineId && viewMode === "contacts" && (
              <div className="px-4 overflow-y-auto h-full">
                <ChatwootContacts pipelineStages={pipelineStages} settings={settings} />
              </div>
            )}
            
            {activePipelineId && viewMode === "heatmap" && (
              <div className="px-4 overflow-y-auto h-full">
                <HeatmapView />
              </div>
            )}
            
            {/* Bloco de resultados de vendas removido conforme solicitado */}
          </div>
        </main>
      </div>
      
      <ApiConfigModal 
        isOpen={isApiModalOpen} 
        onClose={() => setIsApiModalOpen(false)} 
        existingSettings={settings}
      />
      
      <AddDealModal 
        isOpen={isAddDealModalOpen} 
        onClose={() => setIsAddDealModalOpen(false)} 
        pipelineStages={pipelineStages}
      />
    </div>
  );
}
