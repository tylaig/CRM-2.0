import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return; // Já conectado
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        console.log('WebSocket conectado');
        setIsConnected(true);
        // Limpar timeout de reconexão se existir
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('Mensagem WebSocket recebida:', message);
          
          // Processar diferentes tipos de mensagens
          switch (message.type) {
            case 'deal:updated':
              console.log('Deal atualizado via WebSocket:', message.data);
              
              // Limpar completamente o cache de deals
              queryClient.removeQueries({ queryKey: ['/api/deals'] });
              
              // Invalidar diretamente
              queryClient.invalidateQueries({ 
                queryKey: ['/api/deals'],
                refetchType: 'all' 
              });
              
              // Se houver dealId específico, invalidar também
              if (message.data.dealId) {
                queryClient.invalidateQueries({ 
                  queryKey: ['/api/deals', message.data.dealId],
                  refetchType: 'all' 
                });
              }
              
              console.log('✅ Cache atualizado via WebSocket');
              break;
              
            case 'deal:created':
              console.log('Deal criado via WebSocket:', message.data);
              queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
              break;
              
            case 'deal:deleted':
              console.log('Deal deletado via WebSocket:', message.data);
              queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
              break;
              
            case 'lead:updated':
              console.log('Lead atualizado via WebSocket:', message.data);
              queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
              queryClient.invalidateQueries({ queryKey: ['/api/leads', message.data.leadId] });
              break;
              
            default:
              console.log('Tipo de mensagem WebSocket não reconhecido:', message.type);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket desconectado');
        setIsConnected(false);
        // Tentar reconectar após 3 segundos
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Tentando reconectar WebSocket...');
          connect();
        }, 3000);
      };

      ws.current.onerror = (error) => {
        console.error('Erro WebSocket:', error);
        setIsConnected(false);
      };
      
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    connect,
    disconnect
  };
}