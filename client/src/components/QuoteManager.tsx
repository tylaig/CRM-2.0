import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, ClipboardIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface QuoteItem {
  id?: number;
  dealId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  createdAt?: Date;
}

interface QuoteManagerProps {
  dealId: number;
  onSelectQuote?: (quoteTotal: number) => void;
}

export default function QuoteManager({ dealId, onSelectQuote }: QuoteManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estado local para gerenciar o modal de nova cotação
  const [isNewQuoteModalOpen, setIsNewQuoteModalOpen] = useState(false);
  const [newQuoteItems, setNewQuoteItems] = useState<Omit<QuoteItem, 'dealId'>[]>([
    { description: "", quantity: 1, unitPrice: 0 }
  ]);
  const [quoteName, setQuoteName] = useState("");
  
  // Carregar itens de cotação existentes
  const { data: quoteItems = [], isLoading, error } = useQuery({
    queryKey: [`/api/quote-items/${dealId}`],
    queryFn: async () => {
      const response = await fetch(`/api/quote-items/${dealId}`);
      if (!response.ok) {
        throw new Error("Falha ao carregar itens de cotação");
      }
      return response.json();
    }
  });

  // Mutation para adicionar item na cotação
  const addQuoteItemMutation = useMutation({
    mutationFn: async (item: Omit<QuoteItem, 'id' | 'createdAt'>) => {
      return apiRequest("/api/quote-items", "POST", item);
    },
    onSuccess: async () => {
      // Aguardar a invalidação das cotações primeiro
      await queryClient.invalidateQueries({ queryKey: [`/api/quote-items/${dealId}`] });
      
      // Depois invalidar e recarregar os negócios para mostrar o valor atualizado
      await queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      
      // Forçar refetch imediato
      await queryClient.refetchQueries({ queryKey: ["/api/deals"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao adicionar item à cotação. Por favor tente novamente.",
      });
      console.error("Erro ao adicionar item na cotação:", error);
    }
  });

  // Mutation para deletar item da cotação
  const deleteQuoteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/quote-items/${id}`, "DELETE");
    },
    onSuccess: async () => {
      // Aguardar a invalidação das cotações primeiro
      await queryClient.invalidateQueries({ queryKey: [`/api/quote-items/${dealId}`] });
      
      // Depois invalidar e recarregar os negócios para mostrar o valor atualizado
      await queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      
      // Forçar refetch imediato
      await queryClient.refetchQueries({ queryKey: ["/api/deals"] });
      
      toast({
        title: "Item removido",
        description: "Item da cotação removido com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao remover item da cotação.",
      });
      console.error("Erro ao remover item:", error);
    }
  });

  // Agrupar itens por data de criação (como se fossem cotações diferentes)
  const groupedQuotes = quoteItems.reduce((groups: Record<string, QuoteItem[]>, item: QuoteItem) => {
    const date = item.createdAt 
      ? new Date(item.createdAt).toISOString().split('T')[0]
      : 'unknown-date';
    
    if (!groups[date]) {
      groups[date] = [];
    }
    
    groups[date].push(item);
    return groups;
  }, {});

  // Adicionar novo item na cotação atual
  const addNewQuoteItem = () => {
    setNewQuoteItems([...newQuoteItems, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  // Atualizar item de cotação
  const updateNewQuoteItem = (index: number, field: keyof Omit<QuoteItem, 'id' | 'dealId' | 'createdAt'>, value: string | number) => {
    const updatedItems = [...newQuoteItems];
    if (field === 'description') {
      updatedItems[index] = { ...updatedItems[index], description: value as string };
    } else if (field === 'quantity') {
      updatedItems[index] = { ...updatedItems[index], quantity: Number(value) || 1 };
    } else if (field === 'unitPrice') {
      updatedItems[index] = { ...updatedItems[index], unitPrice: Number(value) || 0 };
    }
    setNewQuoteItems(updatedItems);
  };

  // Remover item de cotação
  const removeNewQuoteItem = (index: number) => {
    if (newQuoteItems.length > 1) {
      const updatedItems = [...newQuoteItems];
      updatedItems.splice(index, 1);
      setNewQuoteItems(updatedItems);
    } else {
      toast({
        variant: "default",
        title: "Aviso",
        description: "A cotação precisa ter pelo menos um item.",
      });
    }
  };

  // Calcular total da nova cotação
  const calculateNewQuoteTotal = () => {
    return newQuoteItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  // Calcular total de uma cotação existente
  const calculateQuoteTotal = (items: QuoteItem[]) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  // Salvar nova cotação
  const saveNewQuote = async () => {
    if (newQuoteItems.some(item => !item.description.trim())) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Todos os itens precisam ter uma descrição.",
      });
      return;
    }

    try {
      // Salvar cada item da cotação
      for (const item of newQuoteItems) {
        await addQuoteItemMutation.mutateAsync({
          dealId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        });
      }

      // Fechar modal e resetar formulário
      setIsNewQuoteModalOpen(false);
      setNewQuoteItems([{ description: "", quantity: 1, unitPrice: 0 }]);
      setQuoteName("");

      toast({
        title: "Sucesso!",
        description: "Cotação adicionada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao salvar cotação:", error);
    }
  };

  // Selecionar cotação (para marcar como vendido)
  const handleSelectQuote = (items: QuoteItem[]) => {
    const total = calculateQuoteTotal(items);
    if (onSelectQuote) {
      onSelectQuote(total);
      toast({
        title: "Cotação selecionada",
        description: `Cotação no valor de ${formatCurrency(total)} selecionada para venda.`,
      });
    }
  };

  // Copiar cotação para área de transferência
  const copyQuoteToClipboard = (items: QuoteItem[]) => {
    let quoteText = "Cotação:\n\n";
    
    items.forEach((item, index) => {
      quoteText += `${index + 1}. ${item.description}\n`;
      quoteText += `   Quantidade: ${item.quantity}\n`;
      quoteText += `   Valor unitário: ${formatCurrency(item.unitPrice)}\n`;
      quoteText += `   Subtotal: ${formatCurrency(item.quantity * item.unitPrice)}\n\n`;
    });
    
    quoteText += `\nValor Total: ${formatCurrency(calculateQuoteTotal(items))}`;
    
    navigator.clipboard.writeText(quoteText).then(() => {
      toast({
        title: "Cotação copiada",
        description: "Detalhes da cotação copiados para a área de transferência.",
      });
    }).catch(err => {
      console.error("Erro ao copiar cotação:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível copiar a cotação.",
      });
    });
  };

  // Exibe mensagem de carregamento
  if (isLoading) {
    return <div className="flex justify-center p-4">Carregando cotações...</div>;
  }

  // Exibe mensagem de erro
  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        Erro ao carregar cotações. Por favor, tente novamente.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Gerenciamento de Cotações</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsNewQuoteModalOpen(true)}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Nova Cotação
        </Button>
      </div>

      {/* Lista de cotações existentes */}
      {Object.keys(groupedQuotes).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedQuotes).map(([date, items], groupIndex) => (
            <Card key={date}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base">
                      Cotação #{groupIndex + 1} 
                    </CardTitle>
                    <CardDescription>
                      Criada em: {formatDate(new Date(date))}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyQuoteToClipboard(items)}
                    >
                      <ClipboardIcon className="h-4 w-4 mr-1" />
                      Copiar
                    </Button>
                    {onSelectQuote && (
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => handleSelectQuote(items)}
                      >
                        <CheckIcon className="h-4 w-4 mr-1" />
                        Selecionar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor unitário</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.quantity * item.unitPrice)}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => item.id && deleteQuoteItemMutation.mutate(item.id)}
                            className="h-8 w-8 p-0"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total:</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculateQuoteTotal(items))}</p>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border rounded-md border-dashed">
          <p className="text-muted-foreground">Nenhuma cotação encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em "Nova Cotação" para criar uma cotação para este negócio
          </p>
        </div>
      )}

      {/* Modal de nova cotação */}
      <Dialog open={isNewQuoteModalOpen} onOpenChange={setIsNewQuoteModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Nova Cotação</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            <div className="space-y-4">
              {newQuoteItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center border p-3 rounded-md">
                  <div className="col-span-6">
                    <Label htmlFor={`description-${index}`} className="mb-1 block text-sm">Descrição</Label>
                    <Input
                      id={`description-${index}`}
                      placeholder="Descrição do item"
                      value={item.description}
                      onChange={(e) => updateNewQuoteItem(index, 'description', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor={`quantity-${index}`} className="mb-1 block text-sm">Quantidade</Label>
                    <Input
                      id={`quantity-${index}`}
                      type="number"
                      placeholder="Qtd"
                      value={item.quantity}
                      onChange={(e) => updateNewQuoteItem(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Label htmlFor={`price-${index}`} className="mb-1 block text-sm">Preço unitário</Label>
                    <Input
                      id={`price-${index}`}
                      type="number"
                      step="0.01"
                      placeholder="Preço"
                      value={item.unitPrice}
                      onChange={(e) => updateNewQuoteItem(index, 'unitPrice', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 self-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeNewQuoteItem(index)}
                      className="h-10 w-10 p-0"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="col-span-12 text-right text-sm font-medium text-muted-foreground">
                    Subtotal: {formatCurrency(item.quantity * item.unitPrice)}
                  </div>
                </div>
              ))}

              <Button 
                variant="outline" 
                size="sm" 
                onClick={addNewQuoteItem}
                className="mt-2"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Adicionar Item
              </Button>
            </div>

            <div className="flex justify-end pt-2">
              <div className="px-4 py-2 bg-muted rounded-md">
                <span className="font-semibold">Total: {formatCurrency(calculateNewQuoteTotal())}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsNewQuoteModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={saveNewQuote}
              disabled={newQuoteItems.some(item => !item.description.trim())}
            >
              Salvar Cotação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}