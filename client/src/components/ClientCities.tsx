import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Deal } from "@shared/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, MapPinned, Save, MapIcon } from "lucide-react";

interface ClientCitiesProps {
  dealId: number | null;
  leadId?: number | null; // Adicionando leadId como prop opcional
  isExisting: boolean;
  currentCity: string | null;
  currentState: string | null;
  onCityChange: (city: string, state: string) => void;
}

// Lista de estados brasileiros para o select
const ESTADOS_BRASILEIROS = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' }
];

// Lista de principais cidades para cada estado (simplificada)
const PRINCIPAIS_CIDADES: Record<string, string[]> = {
  'AC': ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira'],
  'AL': ['Maceió', 'Arapiraca', 'Palmeira dos Índios'],
  'AP': ['Macapá', 'Santana', 'Laranjal do Jari'],
  'AM': ['Manaus', 'Parintins', 'Itacoatiara'],
  'BA': ['Salvador', 'Feira de Santana', 'Vitória da Conquista'],
  'CE': ['Fortaleza', 'Caucaia', 'Juazeiro do Norte'],
  'DF': ['Brasília', 'Ceilândia', 'Taguatinga'],
  'ES': ['Vitória', 'Vila Velha', 'Serra'],
  'GO': ['Goiânia', 'Aparecida de Goiânia', 'Anápolis'],
  'MA': ['São Luís', 'Imperatriz', 'Timon'],
  'MT': ['Cuiabá', 'Várzea Grande', 'Rondonópolis'],
  'MS': ['Campo Grande', 'Dourados', 'Três Lagoas'],
  'MG': ['Belo Horizonte', 'Uberlândia', 'Contagem'],
  'PA': ['Belém', 'Ananindeua', 'Santarém'],
  'PB': ['João Pessoa', 'Campina Grande', 'Santa Rita'],
  'PR': ['Curitiba', 'Londrina', 'Maringá'],
  'PE': ['Recife', 'Jaboatão dos Guararapes', 'Olinda'],
  'PI': ['Teresina', 'Parnaíba', 'Picos'],
  'RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias'],
  'RN': ['Natal', 'Mossoró', 'Parnamirim'],
  'RS': ['Porto Alegre', 'Caxias do Sul', 'Pelotas'],
  'RO': ['Porto Velho', 'Ji-Paraná', 'Ariquemes'],
  'RR': ['Boa Vista', 'Rorainópolis', 'Caracaraí'],
  'SC': ['Florianópolis', 'Joinville', 'Blumenau'],
  'SP': ['São Paulo', 'Guarulhos', 'Campinas'],
  'SE': ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto'],
  'TO': ['Palmas', 'Araguaína', 'Gurupi']
};

export default function ClientCities({ dealId, leadId, isExisting, currentCity, currentState, onCityChange }: ClientCitiesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [city, setCity] = useState(currentCity || "");
  const [state, setState] = useState(currentState || "");
  const [displayedCities, setDisplayedCities] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(!isExisting);
  const [otherCity, setOtherCity] = useState("");
  
  // Observe mudanças no estado para atualizar a lista de cidades
  useEffect(() => {
    if (state && PRINCIPAIS_CIDADES[state]) {
      setDisplayedCities(PRINCIPAIS_CIDADES[state]);
    } else {
      setDisplayedCities([]);
    }
  }, [state]);
  
  // Observe mudanças nos props para atualizar o estado local
  useEffect(() => {
    if (currentCity !== null) {
      setCity(currentCity);
    }
    if (currentState !== null) {
      setState(currentState);
    }
  }, [currentCity, currentState]);
  
  // Query para obter os dados do deal (incluindo leadId)
  const { data: dealData } = useQuery({
    queryKey: [`/api/deals/${dealId}`],
    queryFn: async () => {
      if (!dealId) return null;
      const response = await apiRequest(`/api/deals/${dealId}`, 'GET');
      return response;
    },
    enabled: !!dealId && isExisting && !leadId,  // Só executa se não tivermos leadId direto e for um deal existente
  });
  
  // Determinar qual leadId usar - o passado diretamente ou o obtido via dealData
  const effectiveLeadId = leadId || dealData?.leadId;
  
  // Mutation para atualizar dados de cidade do lead
  const updateCityMutation = useMutation({
    mutationFn: async (data: { city: string, state: string }) => {
      if (!effectiveLeadId) {
        throw new Error("Dados do lead não encontrados");
      }
      
      console.log("Atualizando localização para o lead:", effectiveLeadId, data);
      
      // Atualizar os dados de cidade/estado diretamente no lead
      return await apiRequest(`/api/leads/${effectiveLeadId}`, 'PUT', {
        city: data.city,
        state: data.state
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Localização atualizada",
        description: "A cidade e estado foram atualizados com sucesso.",
      });
      
      // Atualizar cache para todas as queries afetadas
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      
      // Atualizar cache específico para este lead
      if (effectiveLeadId) {
        queryClient.invalidateQueries({ queryKey: [`/api/leads/${effectiveLeadId}`] });
      }
      
      // Fechar o modo de edição
      setIsEditing(false);
      
      // Garantir que o componente pai seja atualizado com os novos valores
      onCityChange(city, state);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar localização",
        description: String(error),
        variant: "destructive",
      });
    },
  });
  
  // Função para salvar alterações
  const saveChanges = () => {
    if (!state) {
      toast({ title: "Estado obrigatório", description: "Selecione um estado.", variant: "destructive" });
      return;
    }
    const finalCity = city === "Outra" ? otherCity : city;
    if (!finalCity) {
      toast({ title: "Cidade obrigatória", description: "Informe uma cidade.", variant: "destructive" });
      return;
    }
    if (isExisting && dealId) {
      updateCityMutation.mutate({ city: finalCity, state });
      return;
    }
    onCityChange(finalCity, state);
    setIsEditing(false);
    toast({ title: "Localização definida", description: `${finalCity}, ${state} configurado com sucesso.` });
  };
  
  // Quando selecionar cidade
  const handleCityChange = (value: string) => {
    setCity(value);
    if (value !== "Outra") setOtherCity("");
  };
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Localização do Cliente</h3>
        <p className="text-sm text-muted-foreground">
          Defina a cidade e estado do cliente para visualização no mapa de calor
        </p>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-md flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-primary" />
            Dados Geográficos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Estado</label>
                  <Select 
                    value={state}
                    onValueChange={(value) => setState(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BRASILEIROS.map((estado) => (
                        <SelectItem key={estado.sigla} value={estado.sigla}>
                          {estado.nome} ({estado.sigla})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium">Cidade</label>
                  {displayedCities.length > 0 ? (
                    <Select 
                      value={city}
                      onValueChange={handleCityChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a cidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {displayedCities.map((cidade) => (
                          <SelectItem key={cidade} value={cidade}>
                            {cidade}
                          </SelectItem>
                        ))}
                        <SelectItem value="Outra">Outra cidade...</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      placeholder="Digite o nome da cidade"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  )}
                </div>
              </div>
              
              {city === "Outra" && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Nome da cidade</label>
                  <Input 
                    placeholder="Digite o nome da cidade"
                    value={otherCity}
                    onChange={(e) => setOtherCity(e.target.value)}
                  />
                </div>
              )}
              
              <div className="flex justify-end">
                <Button onClick={saveChanges}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Localização
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-base font-medium">
                      {city || "Cidade não informada"}{city && state ? ", " : ""}{state || ""}
                    </p>
                    {(!city || !state) && (
                      <p className="text-sm text-gray-500">
                        {!city && !state 
                          ? "Defina a localização para visualizar no mapa de calor" 
                          : "Informações incompletas de localização"}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Editar
                </Button>
              </div>
              
              {city && state && (
                <div>
                  <div className="p-3 bg-gray-50 rounded-md text-sm flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-primary" />
                    <span>Esta localização está conectada ao mapa de calor e ajuda na visualização de dados por região.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}