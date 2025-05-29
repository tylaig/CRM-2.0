import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout>();

  // Sistema de polling automático para atualizar dados em tempo real
  const startPolling = () => {
    // Fazer polling a cada 3 segundos para manter dados atualizados
    intervalRef.current = setInterval(() => {
      // Invalidar os caches principais para refrescar os dados
      queryClient.invalidateQueries({ 
        queryKey: ['/api/deals'],
        refetchType: 'active' 
      });
    }, 3000);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  useEffect(() => {
    startPolling();
    
    return () => {
      stopPolling();
    };
  }, [queryClient]);

  // Função para forçar atualização imediata
  const forceUpdate = () => {
    queryClient.invalidateQueries({ 
      queryKey: ['/api/deals'],
      refetchType: 'all' 
    });
  };

  return {
    isConnected: true, // Sempre "conectado" com polling
    forceUpdate
  };
}