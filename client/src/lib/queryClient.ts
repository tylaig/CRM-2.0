import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(url: string, method: string = 'GET', body?: any) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Se o queryKey for um array com múltiplos valores, use os valores adicionais como query params
    let url = queryKey[0] as string;
    
    // Se houver parâmetros adicionais (como pipelineId), adicioná-los como query params
    if (queryKey.length > 1 && queryKey[1] !== undefined && queryKey[1] !== null) {
      const queryParams = new URLSearchParams();
      
      // Se o segundo item for um número, assumimos que é pipelineId para compatibilidade
      if (typeof queryKey[1] === 'number') {
        queryParams.append('pipelineId', queryKey[1].toString());
      } 
      // Se for um objeto, iterar sobre as propriedades e adicionar como query params
      else if (typeof queryKey[1] === 'object' && queryKey[1] !== null) {
        Object.entries(queryKey[1]).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString());
          }
        });
      }
      
      // Se houver params, adicionar à URL
      const paramsStr = queryParams.toString();
      if (paramsStr) {
        url += url.includes('?') ? `&${paramsStr}` : `?${paramsStr}`;
      }
    }
    
    console.log(`Fetching URL with params: ${url}`);
    
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,  // Revalidar quando a janela ganhar foco
      staleTime: 10000,            // Dados serão considerados obsoletos após 10 segundos
      retry: false,
      refetchOnMount: true,        // Revalidar quando o componente for montado
    },
    mutations: {
      retry: false,
    },
  },
});