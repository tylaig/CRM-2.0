import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ListIcon,
  MenuIcon,
  LayoutIcon,
  PlusIcon,
  KeyIcon,
  BarChart3Icon,
  GanttChartIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Settings as SettingsIcon,
  UserIcon,
  UsersIcon,
  MapIcon,
  FilterIcon,
  RefreshCwIcon
} from "lucide-react";
import SettingsModal from "./SettingsModal";
import PipelineSelector from "./PipelineSelector";
import { toast } from "@/hooks/use-toast";
import tbcLogo from "../assets/tbc-logo.png";
import { useAuth } from "@/components/AuthProvider";

interface HeaderProps {
  toggleSidebar: () => void;
  viewMode: "kanban" | "list" | "contacts" | "heatmap" | "results";
  toggleViewMode: (mode: "kanban" | "list" | "contacts" | "heatmap" | "results") => void;
  onOpenApiConfig: () => void;
  onAddDeal?: () => void; // Adicionado novamente para ser usado no Header
  hasApiConfig?: boolean; // Indica se a API já foi configurada
  activePipelineId?: number | null;
  onPipelineChange?: (pipelineId: number) => void;
  pipelineStages?: any[]; // Adicionado para verificar se existem estágios
  onRefreshKanban?: () => void; // Nova função para atualizar o kanban
}

export default function Header({
  toggleSidebar,
  viewMode,
  toggleViewMode,
  onOpenApiConfig,
  onAddDeal,
  hasApiConfig = false,
  activePipelineId,
  onPipelineChange,
  pipelineStages = [],
  onRefreshKanban
}: HeaderProps) {
  const [location] = useLocation();
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const { user, logout } = useAuth();
  return (
    <header className="bg-[hsl(var(--header-background))] text-[hsl(var(--header-foreground))] border-b border-[hsl(var(--header-border))]">
      <div className="container mx-auto px-4">
        <div className="h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src={tbcLogo} alt="Grupo TBC Logo" className="h-10" />
            <span className="text-[10px] font-medium py-1 px-2 bg-primary/20 text-primary rounded-full">
              Beta
            </span>
            {/* Pipeline Selector */}
            {hasApiConfig && onPipelineChange && (
              <div className="ml-4 flex items-center">
                <PipelineSelector 
                  onPipelineChange={onPipelineChange}
                  activePipelineId={activePipelineId}
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* E-mail do usuário sempre visível */}
            {user && (
              <span className="text-xs text-white bg-black/30 px-2 py-1 rounded-md mr-2">{user.email}</span>
            )}
            {/* Botão de configurações só para admin */}
            {hasApiConfig && user?.role === 'admin' && (
              <Button 
                variant="ghost"
                size="sm"
                className="relative group text-white hover:text-primary hover:bg-white/10 hidden sm:flex"
                onClick={() => setIsSettingsModalOpen(true)}
              >
                <SettingsIcon className="h-4 w-4 text-white group-hover:text-primary transition-colors" />
                <span className="ml-2">Configurações</span>
              </Button>
            )}
            {/* Botão de logout sempre visível */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:text-primary hover:bg-white/10"
              onClick={logout}
            >
              Sair
            </Button>
          </div>
        </div>
      
        <div className="border-t border-[hsl(var(--header-border))]">
          <div className="flex items-center justify-between py-4">
            <div className="flex space-x-2">
              <Link href="/">
                <Button 
                  variant={location === "/" ? "default" : "ghost"} 
                  size="sm"
                  className={location === "/" 
                    ? "flex items-center gap-2 bg-primary text-black hover:bg-primary/90 hover:text-black" 
                    : "flex items-center gap-2 text-white hover:text-primary hover:bg-white/10"}
                >
                  <GanttChartIcon className="h-4 w-4" />
                  <span>Funis de Vendas</span>
                </Button>
              </Link>
              
              <Link href="/historical">
                <Button 
                  variant={location === "/historical" ? "default" : "ghost"} 
                  size="sm"
                  className={location === "/historical" 
                    ? "flex items-center gap-2 bg-primary text-black hover:bg-primary/90 hover:text-black" 
                    : "flex items-center gap-2 text-white hover:text-primary hover:bg-white/10"}
                >
                  <BarChart3Icon className="h-4 w-4" />
                  <span>Histórico</span>
                </Button>
              </Link>
              
              <div className="flex items-center pl-4 border-l border-[hsl(var(--header-border))]">
                <Link href="/sales">
                  <Button 
                    variant={location === "/sales" ? "default" : "ghost"} 
                    size="sm"
                    className={location === "/sales" 
                    ? "flex items-center gap-2 bg-primary text-black hover:bg-primary/90 hover:text-black" 
                    : "flex items-center gap-2 text-white hover:text-primary hover:bg-white/10"}
                  >
                    <CheckCircle2Icon className="h-4 w-4" />
                    <span>Vendas</span>
                  </Button>
                </Link>
                
                <Link href="/losses">
                  <Button 
                    variant={location === "/losses" ? "default" : "ghost"} 
                    size="sm"
                    className={location === "/losses" 
                    ? "flex items-center gap-2 bg-primary text-black hover:bg-primary/90 hover:text-black ml-1" 
                    : "flex items-center gap-2 text-white hover:text-primary hover:bg-white/10 ml-1"}
                  >
                    <XCircleIcon className="h-4 w-4" />
                    <span>Perdas</span>
                  </Button>
                </Link>
              </div>
            </div>
            
            {location === "/" && (
              <div className="flex items-center space-x-2">
                <div className="relative group">
                  <Button 
                    variant={viewMode === "kanban" ? "default" : "ghost"} 
                    size="icon"
                    onClick={() => toggleViewMode("kanban")}
                    className={viewMode === "kanban" 
                      ? "h-9 w-9 rounded bg-primary text-black hover:bg-primary/90 hover:text-black" 
                      : "h-9 w-9 rounded text-white hover:text-primary hover:bg-white/10"}
                    title="Visão Kanban"
                  >
                    <LayoutIcon className="h-5 w-5" />
                  </Button>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    Visão Kanban
                  </div>
                </div>
                
                <div className="relative group">
                  <Button 
                    variant={viewMode === "list" ? "default" : "ghost"} 
                    size="icon"
                    onClick={() => toggleViewMode("list")}
                    className={viewMode === "list" 
                      ? "h-9 w-9 rounded bg-primary text-black hover:bg-primary/90 hover:text-black" 
                      : "h-9 w-9 rounded text-white hover:text-primary hover:bg-white/10"}
                  >
                    <ListIcon className="h-5 w-5" />
                  </Button>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    Visão Lista
                  </div>
                </div>
                

                
                {hasApiConfig && (
                  <div className="relative group">
                    <Button 
                      variant={viewMode === "contacts" ? "default" : "ghost"} 
                      size="icon"
                      onClick={() => toggleViewMode("contacts")}
                      className={viewMode === "contacts" 
                      ? "h-9 w-9 rounded bg-primary text-black hover:bg-primary/90 hover:text-black" 
                      : "h-9 w-9 rounded text-white hover:text-primary hover:bg-white/10"}
                    >
                      <UsersIcon className="h-5 w-5" />
                    </Button>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Contatos Chatwoot
                    </div>
                  </div>
                )}
                
                <div className="relative group">
                  <Button 
                    variant={viewMode === "heatmap" ? "default" : "ghost"} 
                    size="icon"
                    onClick={() => toggleViewMode("heatmap")}
                    className={viewMode === "heatmap" 
                      ? "h-9 w-9 rounded bg-primary text-black hover:bg-primary/90 hover:text-black" 
                      : "h-9 w-9 rounded text-white hover:text-primary hover:bg-white/10"}
                  >
                    <MapIcon className="h-5 w-5" />
                  </Button>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    Mapa de Calor
                  </div>
                </div>
                
                {/* Botão de atualização do kanban */}
                {(viewMode === "kanban" || viewMode === "list") && onRefreshKanban && (
                  <div className="relative group">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={onRefreshKanban}
                      className="h-9 w-9 rounded text-white hover:text-primary hover:bg-white/10"
                      title="Atualizar dados"
                    >
                      <RefreshCwIcon className="h-5 w-5" />
                    </Button>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Atualizar dados
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal de Configurações */}
      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
      />
    </header>
  );
}
