import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Deal, PipelineStage, Settings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  Phone,
  Mail,
  Search,
  PlusCircleIcon,
  Edit,
  Check,
  X,
  UserPlus,
  Loader2,
  RefreshCw
} from "lucide-react";
import AddDealModal from "@/components/AddDealModal";
import { toast } from "@/hooks/use-toast";
import { formatPhoneNumber } from "@/lib/formatters";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface ChatwootContactsProps {
  pipelineStages: PipelineStage[];
  settings: Settings | undefined;
}

interface ChatwootContact {
  id: number;
  name: string;
  email?: string;
  phone_number?: string;
  company_name?: string;
}

// Schema para validação do formulário de contato
const newContactSchema = z.object({
  name: z.string().min(2, { message: "Nome é obrigatório e deve ter pelo menos 2 caracteres" }),
  email: z.string().email({ message: "Email inválido" }).optional().or(z.literal("")),
  phone_number: z.string().optional().or(z.literal("")),
  company_name: z.string().optional().or(z.literal(""))
});

type NewContactFormValues = z.infer<typeof newContactSchema>;

export default function ChatwootContacts({ pipelineStages, settings }: ChatwootContactsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDealModalOpen, setIsAddDealModalOpen] = useState(false);
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ChatwootContact | null>(null);
  const [editingContact, setEditingContact] = useState<ChatwootContact | null>(null);
  const [editName, setEditName] = useState("");
  
  // Encontre o estágio padrão para contatos do Chatwoot
  const defaultStage = pipelineStages.find(stage => stage.isDefault);
  
  // Formulário para adicionar novo contato
  const form = useForm<NewContactFormValues>({
    resolver: zodResolver(newContactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone_number: "",
      company_name: ""
    }
  });
  
  // Mutação para sincronizar contatos
  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      await queryClient.removeQueries({ queryKey: ['/api/chatwoot/contacts'] });
      return await apiRequest("/api/chatwoot/contacts", "GET");
    },
    onSuccess: () => {
      toast({
        title: "Sincronização concluída",
        description: "A lista de contatos foi atualizada com sucesso.",
        variant: "default",
      });
    },
    onError: (error) => {
      console.error("Erro ao sincronizar contatos:", error);
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar a lista de contatos.",
        variant: "destructive",
      });
    }
  });

  // Mutação para criar contato
  const createContactMutation = useMutation({
    mutationFn: async (data: NewContactFormValues) => {
      return await apiRequest("/api/chatwoot/contacts", "POST", data);
    },
    onSuccess: async (data) => {
      // Obter nome do contato da estrutura correta da resposta
      const contactName = data.contact?.payload?.contact?.name || data.contact?.name || "contato";
      
      // Aguardar mais tempo para que o Chatwoot processe o contato
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Invalidação completa e múltipla do cache
      queryClient.removeQueries({ queryKey: ['/api/chatwoot/contacts'] });
      queryClient.removeQueries({ queryKey: ['/api/chatwoot/contacts', searchTerm] });
      queryClient.removeQueries({ queryKey: ['/api/chatwoot/contacts', ''] });
      
      // Aguardar um pouco antes de invalidar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await queryClient.invalidateQueries({ queryKey: ['/api/chatwoot/contacts'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/chatwoot/contacts', searchTerm] });
      
      // Forçar refetch com nova timestamp
      await refetch();
      
      // Aguardar e fazer mais um refetch para garantir
      setTimeout(async () => {
        await refetch();
      }, 1000);
      
      toast({
        title: "Contato criado com sucesso",
        description: `O contato ${contactName} foi criado no Chatwoot.`,
        variant: "default",
      });
      
      // Fechar modal e limpar formulário
      setIsAddContactModalOpen(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Erro ao criar contato:", error);
      toast({
        title: "Erro ao criar contato",
        description: "Não foi possível criar o contato no Chatwoot. Por favor, tente novamente.",
        variant: "destructive",
      });
    }
  });
  
  // Interfaces para resposta da API Chatwoot
  interface ChatwootResponse {
    payload: ChatwootContact[];
    meta: {
      count: number;
      current_page: number;
      total_pages: number;
    };
  }
  
  // Buscar contatos do Chatwoot quando há uma configuração válida
  const { data: chatwootResponse, isLoading, refetch } = useQuery<ChatwootResponse>({
    queryKey: ['/api/chatwoot/contacts', searchTerm],
    queryFn: async () => {
      let url = '/api/chatwoot/contacts';
      if (searchTerm && searchTerm.trim()) {
        url += `?q=${encodeURIComponent(searchTerm.trim())}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Erro ao buscar contatos do Chatwoot');
      }
      return response.json();
    },
    enabled: !!settings?.chatwootApiKey
  });
  
  // Extrair o array de contatos da resposta
  const chatwootContacts = chatwootResponse?.payload || [];
  
  // Busca negócios existentes no estágio padrão
  const { data: defaultStageDeals, isLoading: isLoadingDeals } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
    select: (deals) => deals.filter(deal => defaultStage && deal.stageId === defaultStage.id),
    enabled: !!defaultStage
  });
  
  // Verifica se um contato já está em um negócio
  const isContactInDeal = (contactId: number) => {
    return defaultStageDeals?.some(deal => {
      return deal.chatwootContactId === contactId.toString();
    });
  };
  
  // Função para iniciar a edição de um contato
  const startEditingContact = (contact: ChatwootContact) => {
    setEditingContact(contact);
    setEditName(contact.name || "");
  };
  
  // Função para salvar a alteração do nome do contato
  const saveContactName = async () => {
    if (!editingContact || !editName.trim()) return;
    
    try {
      // Lógica para atualizar o nome do contato via API do Chatwoot
      await apiRequest(`/api/chatwoot/contact/${editingContact.id}`, 'PUT', {
        name: editName.trim()
      });
      
      // Reset do estado de edição
      setEditingContact(null);
      setEditName("");
      
      // Atualizar cache de contatos
      queryClient.invalidateQueries({ queryKey: ['/api/chatwoot/contacts'] });
      
      toast({
        title: "Nome atualizado",
        description: "O nome do contato foi atualizado com sucesso.",
        variant: "default",
      });
    } catch (error) {
      console.error("Erro ao atualizar nome do contato:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o nome do contato. Tente novamente.",
        variant: "destructive",
      });
    }
  };
  
  // Função para cancelar a edição
  const cancelEditing = () => {
    setEditingContact(null);
    setEditName("");
  };
  
  // Renderização para quando não há conexão com Chatwoot
  if (!settings?.chatwootApiKey) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="text-center py-8">
          <Building className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">Sem conexão com Chatwoot</h3>
          <p className="mt-1 text-sm text-gray-500">
            Configure a API do Chatwoot para sincronizar contatos.
          </p>
        </div>
      </div>
    );
  }
  
  // Renderização durante o carregamento
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="text-gray-500">Carregando contatos do Chatwoot...</p>
        </div>
      </div>
    );
  }
  
  // Função para criar novo contato
  const onSubmit = (data: NewContactFormValues) => {
    // Se o telefone estiver presente, formate-o para enviar ao Chatwoot
    if (data.phone_number) {
      // Remover formatação e caracteres não numéricos
      data.phone_number = data.phone_number.replace(/\D/g, '');
      
      // Adicionar formato internacional se necessário
      if (data.phone_number && !data.phone_number.startsWith('+')) {
        data.phone_number = `+55${data.phone_number}`;
      }
    }
    
    createContactMutation.mutate(data);
  };

  return (
    <>
      <AddDealModal 
        isOpen={isAddDealModalOpen} 
        onClose={() => {
          setIsAddDealModalOpen(false);
          setSelectedContact(null);
        }} 
        pipelineStages={pipelineStages}
        selectedContact={selectedContact}
      />
      
      {/* Modal para adicionar novo contato */}
      <Dialog open={isAddContactModalOpen} onOpenChange={setIsAddContactModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar Contato no Chatwoot</DialogTitle>
            <DialogDescription>
              Crie um novo contato no Chatwoot para gerenciar seus leads e negócios.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do contato" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(99) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome da empresa (opcional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddContactModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={createContactMutation.isPending}
                >
                  {createContactMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : "Criar Contato"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center px-4 py-2 bg-white border-b">
          <h2 className="text-lg font-semibold">Contatos do Chatwoot</h2>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => syncContactsMutation.mutate()}
              disabled={syncContactsMutation.isPending}
            >
              {syncContactsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>Sincronizar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => setIsAddContactModalOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              <span>Criar Contato</span>
            </Button>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8 h-9 w-60"
                placeholder="Buscar contatos"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 flex-grow overflow-y-auto">
          {chatwootContacts && chatwootContacts.length > 0 ? (
            chatwootContacts.map((contact) => (
              <Card key={contact.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between">
                  {editingContact && editingContact.id === contact.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <Input 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-green-600"
                        onClick={saveContactName}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-600"
                        onClick={cancelEditing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{contact.name}</h3>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-6 w-6 opacity-70 hover:opacity-100" 
                          onClick={() => startEditingContact(contact)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {isContactInDeal(contact.id) ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          No funil
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                          onClick={() => {
                            setSelectedContact(contact);
                            setIsAddDealModalOpen(true);
                          }}
                        >
                          <PlusCircleIcon className="h-3.5 w-3.5" />
                          <span>Criar negócio</span>
                        </Button>
                      )}
                    </>
                  )}
                </div>
                
                {!(editingContact && editingContact.id === contact.id) && (
                  <div className="mt-2 space-y-1">
                    {contact.company_name && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Building className="mr-2 h-4 w-4 text-gray-400" />
                        <span>{contact.company_name}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="mr-2 h-4 w-4 text-gray-400" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                    {contact.phone_number && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="mr-2 h-4 w-4 text-gray-400" />
                        <span>{formatPhoneNumber(contact.phone_number)}</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))
          ) : (
            <div className="col-span-3 flex items-center justify-center h-40 text-gray-500">
              {searchTerm ? (
                <p>Nenhum contato encontrado com "{searchTerm}"</p>
              ) : (
                <p>Nenhum contato disponível. Sincronize contatos pelo Chatwoot.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}