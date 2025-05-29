import { useState, useEffect, useRef } from "react";
import { Bell, X, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: number;
  userId: number;
  dealId: number | null;
  pipelineId: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCenterProps {
  activePipelineId?: number;
}

export function NotificationCenter({ activePipelineId }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const queryClient = useQueryClient();

  // Buscar notificações
  const { data: fetchedNotifications } = useQuery({
    queryKey: ['/api/notifications'],
    refetchInterval: 5000, // Verificar a cada 5 segundos
  });

  // Mutation para marcar como lida
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Erro ao marcar notificação como lida');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  // Mutation para marcar todas como lidas
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Erro ao marcar todas as notificações como lidas');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  // Atualizar notificações locais quando dados chegarem
  useEffect(() => {
    if (fetchedNotifications && Array.isArray(fetchedNotifications)) {
      setNotifications(fetchedNotifications);
    }
  }, [fetchedNotifications]);

  // WebSocket para notificações em tempo real
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('🔔 WebSocket de notificações conectado');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'notification') {
            const newNotification = message.data;
            
            // Verificar se a notificação é relevante para o pipeline atual
            if (activePipelineId && newNotification.pipelineId === activePipelineId) {
              // Tocar som de notificação
              if (audioRef.current) {
                audioRef.current.play().catch(e => console.log('Erro ao tocar som:', e));
              }
              
              // Atualizar lista de notificações
              setNotifications(prev => [newNotification, ...prev]);
              
              // Invalidar query para buscar dados atualizados
              queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            }
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('🔔 WebSocket de notificações desconectado');
      };
      
      ws.onerror = (error) => {
        console.error('Erro no WebSocket de notificações:', error);
      };
      
      return () => {
        ws.close();
      };
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
    }
  }, [activePipelineId, queryClient]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
    
    // Atualizar estado local imediatamente
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      )
    );
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
    
    // Atualizar estado local imediatamente
    setNotifications(prev => 
      prev.map(n => ({ ...n, isRead: true }))
    );
  };

  // Filtrar notificações do pipeline atual se estiver definido
  const relevantNotifications = activePipelineId 
    ? notifications.filter(n => n.pipelineId === activePipelineId)
    : notifications;

  const relevantUnreadCount = relevantNotifications.filter(n => !n.isRead).length;

  return (
    <>
      {/* Audio para notificações - som de sino suave */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMcBjuY3fPCdSUFWITK8dyNOQc=" type="audio/wav" />
      </audio>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="relative h-8 w-8 p-0 text-yellow-400 hover:text-blue-950 hover:bg-yellow-400 dark:text-yellow-400 dark:hover:text-blue-950 dark:hover:bg-yellow-400 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {relevantUnreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs min-w-[20px]"
              >
                {relevantUnreadCount > 99 ? '99+' : relevantUnreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent 
          className="w-80 p-0" 
          align="end"
          side="bottom"
        >
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-blue-950">Notificações</h3>
            <div className="flex items-center gap-2">
              {relevantUnreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsReadMutation.isPending}
                  className="text-xs h-7 px-2"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Marcar todas
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="h-96">
            {relevantNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y">
                {relevantNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                      !notification.isRead ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                    }`}
                    onClick={() => {
                      if (!notification.isRead) {
                        handleMarkAsRead(notification.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${
                          !notification.isRead ? 'text-blue-950' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="flex items-center gap-1 ml-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id);
                            }}
                            className="h-6 w-6 p-0 hover:bg-blue-100"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </>
  );
}