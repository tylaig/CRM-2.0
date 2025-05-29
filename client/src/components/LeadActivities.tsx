import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Calendar, Mail, Phone, FileText, MessageCircle, Clock, ArrowRightLeft, GitBranch } from 'lucide-react';
import { formatTimeAgo, formatDateTime } from '@/lib/formatters';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { Deal, LeadActivity } from '@shared/schema';

interface LeadActivitiesProps {
  deal: Deal | null;
}

const activityTypes = [
  { value: 'email_sent', label: 'Email enviado', icon: Mail },
  { value: 'call_made', label: 'Ligação realizada', icon: Phone },
  { value: 'proposal_created', label: 'Proposta criada', icon: FileText },
  { value: 'meeting_scheduled', label: 'Reunião agendada', icon: Calendar },
  { value: 'note_added', label: 'Anotação', icon: MessageCircle },
  { value: 'pipeline_change', label: 'Mudança de Pipeline', icon: GitBranch },
  { value: 'stage_change', label: 'Mudança de Etapa', icon: ArrowRightLeft },
  { value: 'sale_won', label: 'Venda Realizada', icon: FileText },
  { value: 'sale_lost', label: 'Venda Perdida', icon: FileText },
  { value: 'quote_item_added', label: 'Item Adicionado à Cotação', icon: FileText },
  { value: 'quote_item_removed', label: 'Item Removido da Cotação', icon: FileText },
  { value: 'value_updated', label: 'Valor Atualizado', icon: FileText },
];

export default function LeadActivities({ deal }: LeadActivitiesProps) {
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['/api/lead-activities', deal?.id],
    queryFn: async () => {
      const response = await apiRequest(`/api/lead-activities/${deal?.id}`, 'GET');
      return (response as unknown) as LeadActivity[];
    },
    enabled: !!deal?.id,
    refetchInterval: deal?.id ? 3000 : false, // Polling a cada 3 segundos
    refetchOnWindowFocus: true,
    staleTime: 0, // Sempre considerar dados como obsoletos
    gcTime: 0 // Não manter cache
  });
  
  // Garantir que sempre seja um array, mesmo se a API retornar algo inesperado
  const activities = Array.isArray(data) ? data : [];

  const deleteActivityMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/lead-activities/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-activities', deal?.id] });
      toast({
        title: 'Atividade removida',
        description: 'A atividade foi removida com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a atividade.',
        variant: 'destructive',
      });
    },
  });



  const getActivityIcon = (type: string) => {
    const activity = activityTypes.find(a => a.value === type);
    const Icon = activity?.icon || MessageCircle;
    return <Icon className="h-4 w-4 mr-2" />;
  };

  const getActivityTitle = (type: string) => {
    return activityTypes.find(a => a.value === type)?.label || 'Atividade';
  };

  if (!deal) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Histórico de Atividades</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando atividades...</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity: LeadActivity) => (
              <Card key={activity.id} className="border-l-4 border-l-primary">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between">
                    <CardTitle className="text-base flex items-center">
                      {getActivityIcon(activity.activityType)}
                      {getActivityTitle(activity.activityType)}
                    </CardTitle>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      <span title={formatDateTime(new Date(activity.createdAt))}>
                        {formatTimeAgo(new Date(activity.createdAt))}
                      </span>
                    </div>
                  </div>
                  {activity.createdBy && (
                    <CardDescription className="text-xs">
                      Por: {activity.createdBy}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-0 pb-2">
                  <p className="text-sm">{activity.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}