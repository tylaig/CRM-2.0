import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  PieChartIcon,
  UsersIcon,
  BuildingIcon,
  HandshakeIcon,
  Filter,
  SettingsIcon,
  RefreshCwIcon,
  Map,
  CheckCircleIcon,
  XCircleIcon,
  HistoryIcon,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

interface SidebarProps {
  isOpen: boolean;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  return (
    <aside 
      className={cn(
        "w-64 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] border-r border-[hsl(var(--sidebar-border))] transition-all duration-300 ease-in-out",
        isOpen ? "fixed inset-y-0 left-0 z-50 lg:static lg:translate-x-0" : "-translate-x-full lg:translate-x-0 lg:block hidden"
      )}
    >
      <div className="p-4">
        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Visão Geral</h2>
          <nav className="space-y-1">
            <Link href="/">
              <a className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md",
                location === "/" 
                  ? "bg-primary text-black font-medium" 
                  : "text-white hover:bg-white/10 hover:text-primary"
              )}>
                <PieChartIcon className="w-5 h-5 mr-2" />
                <span>Dashboard</span>
              </a>
            </Link>
            <Link href="/pipeline">
              <a className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md",
                location === "/pipeline" 
                  ? "bg-primary text-black font-medium" 
                  : "text-white hover:bg-white/10 hover:text-primary"
              )}>
                <Filter className="w-5 h-5 mr-2" />
                <span>Funil de Vendas</span>
              </a>
            </Link>
            <Link href="/sales">
              <a className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md",
                location === "/sales" 
                  ? "bg-primary text-black font-medium" 
                  : "text-white hover:bg-white/10 hover:text-primary"
              )}>
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                <span>Vendas Concluídas</span>
              </a>
            </Link>
            <Link href="/losses">
              <a className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md",
                location === "/losses" 
                  ? "bg-primary text-black font-medium" 
                  : "text-white hover:bg-white/10 hover:text-primary"
              )}>
                <XCircleIcon className="w-5 h-5 mr-2" />
                <span>Oportunidades Perdidas</span>
              </a>
            </Link>
            <Link href="/historical">
              <a className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md",
                location === "/historical" 
                  ? "bg-primary text-black font-medium" 
                  : "text-white hover:bg-white/10 hover:text-primary"
              )}>
                <HistoryIcon className="w-5 h-5 mr-2" />
                <span>Histórico</span>
              </a>
            </Link>
            <Link href="/activities">
              <a className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md",
                location === "/activities" 
                  ? "bg-primary text-black font-medium" 
                  : "text-white hover:bg-white/10 hover:text-primary"
              )}>
                <RefreshCwIcon className="w-5 h-5 mr-2" />
                <span>Atividades</span>
              </a>
            </Link>
          </nav>
        </div>
        
        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Gerenciamento</h2>
          <nav className="space-y-1">
            <Link href="/contacts">
              <a className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md",
                location === "/contacts" 
                  ? "bg-primary text-black font-medium" 
                  : "text-white hover:bg-white/10 hover:text-primary"
              )}>
                <UsersIcon className="w-5 h-5 mr-2" />
                <span>Contatos</span>
              </a>
            </Link>
            <Link href="/companies">
              <a className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md",
                location === "/companies" 
                  ? "bg-primary text-black font-medium" 
                  : "text-white hover:bg-white/10 hover:text-primary"
              )}>
                <BuildingIcon className="w-5 h-5 mr-2" />
                <span>Empresas</span>
              </a>
            </Link>
            <Link href="/deals">
              <a className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md",
                location === "/deals" 
                  ? "bg-primary text-black font-medium" 
                  : "text-white hover:bg-white/10 hover:text-primary"
              )}>
                <HandshakeIcon className="w-5 h-5 mr-2" />
                <span>Negócios</span>
              </a>
            </Link>
          </nav>
        </div>
        
        <div>
          {user?.role === 'admin' && (
            <>
              <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Configurações</h2>
              <nav className="space-y-1">
                <Link href="/settings">
                  <a className={cn(
                    "flex items-center px-3 py-2 text-sm rounded-md",
                    location === "/settings" 
                      ? "bg-primary text-black font-medium" 
                      : "text-white hover:bg-white/10 hover:text-primary"
                  )}>
                    <SettingsIcon className="w-5 h-5 mr-2" />
                    <span>Geral</span>
                  </a>
                </Link>
                <Link href="/pipeline-config">
                  <a className={cn(
                    "flex items-center px-3 py-2 text-sm rounded-md",
                    location === "/pipeline-config" 
                      ? "bg-primary text-black font-medium" 
                      : "text-white hover:bg-white/10 hover:text-primary"
                  )}>
                    <Map className="w-5 h-5 mr-2" />
                    <span>Etapas do Funil</span>
                  </a>
                </Link>
                <Link href="/chatwoot-integration">
                  <a className={cn(
                    "flex items-center px-3 py-2 text-sm rounded-md",
                    location === "/chatwoot-integration" 
                      ? "bg-primary text-black font-medium" 
                      : "text-white hover:bg-white/10 hover:text-primary"
                  )}>
                    <RefreshCwIcon className="w-5 h-5 mr-2" />
                    <span>Integração Chatwoot</span>
                  </a>
                </Link>
              </nav>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
