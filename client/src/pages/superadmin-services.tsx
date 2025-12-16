import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  Package,
  Wrench,
  FileText,
  Zap,
  Star,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ServiceConfig = {
  id: number;
  serviceKey: string;
  displayName: string;
  description: string | null;
  basePrice: number;
  isEnabled: boolean;
  config: any;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ToolConfig = {
  id: number;
  toolKey: string;
  displayName: string;
  description: string | null;
  price: number;
  isFree: boolean;
  isEnabled: boolean;
  usageCount: number;
  config: any;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const serviceIcons: Record<string, any> = {
  express: Zap,
  tools: Wrench,
  fullAudit: Star,
};

export default function SuperAdminServicesPage() {
  const { toast } = useToast();
  const [editingService, setEditingService] = useState<number | null>(null);
  const [serviceForm, setServiceForm] = useState<Partial<ServiceConfig>>({});

  const { data: servicesData, isLoading: servicesLoading, refetch: refetchServices } = useQuery<{
    success: boolean;
    services: ServiceConfig[];
  }>({
    queryKey: ["/api/admin/services"],
  });

  const { data: toolsData, isLoading: toolsLoading, refetch: refetchTools } = useQuery<{
    success: boolean;
    tools: ToolConfig[];
  }>({
    queryKey: ["/api/admin/tools"],
  });

  const services = servicesData?.services || [];
  const tools = toolsData?.tools || [];

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ServiceConfig> }) => {
      const response = await apiRequest("PUT", `/api/admin/services/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      setEditingService(null);
      setServiceForm({});
      toast({
        title: "Сохранено",
        description: "Настройки услуги обновлены",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateToolMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ToolConfig> }) => {
      const response = await apiRequest("PATCH", `/api/admin/tools/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tools"] });
      toast({
        title: "Сохранено",
        description: "Настройки инструмента обновлены",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleToolMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: number; isEnabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/tools/${id}/toggle`, { isEnabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tools"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditService = (service: ServiceConfig) => {
    setEditingService(service.id);
    setServiceForm({
      displayName: service.displayName,
      description: service.description || "",
      basePrice: service.basePrice,
      isEnabled: service.isEnabled,
    });
  };

  const handleSaveService = (id: number) => {
    updateServiceMutation.mutate({ id, data: serviceForm });
  };

  const handleCancelEdit = () => {
    setEditingService(null);
    setServiceForm({});
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (servicesLoading || toolsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Управление услугами
          </h1>
          <p className="text-muted-foreground">
            Настройка трёх основных услуг и 10 инструментов
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchServices();
            refetchTools();
          }}
          data-testid="button-refresh-services"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Три услуги
        </h2>

        <div className="grid gap-6 lg:grid-cols-3">
          {services.length === 0 ? (
            <Card className="lg:col-span-3">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Услуги не настроены. Добавьте записи в таблицу service_configs.
              </CardContent>
            </Card>
          ) : (
            services.map((service) => {
              const IconComponent = serviceIcons[service.serviceKey] || Package;
              const isEditing = editingService === service.id;

              return (
                <Card key={service.id} className={isEditing ? "ring-2 ring-primary" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{service.displayName}</CardTitle>
                      </div>
                      <Badge variant={service.isEnabled ? "default" : "secondary"}>
                        {service.isEnabled ? "Активна" : "Отключена"}
                      </Badge>
                    </div>
                    <CardDescription>
                      Ключ: {service.serviceKey}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`name-${service.id}`}>Название</Label>
                          <Input
                            id={`name-${service.id}`}
                            value={serviceForm.displayName || ""}
                            onChange={(e) =>
                              setServiceForm({ ...serviceForm, displayName: e.target.value })
                            }
                            data-testid={`input-service-name-${service.id}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`desc-${service.id}`}>Описание</Label>
                          <Textarea
                            id={`desc-${service.id}`}
                            value={serviceForm.description || ""}
                            onChange={(e) =>
                              setServiceForm({ ...serviceForm, description: e.target.value })
                            }
                            rows={2}
                            data-testid={`input-service-desc-${service.id}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`price-${service.id}`}>Базовая цена (руб.)</Label>
                          <Input
                            id={`price-${service.id}`}
                            type="number"
                            value={serviceForm.basePrice || 0}
                            onChange={(e) =>
                              setServiceForm({
                                ...serviceForm,
                                basePrice: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            data-testid={`input-service-price-${service.id}`}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`enabled-${service.id}`}
                            checked={serviceForm.isEnabled}
                            onCheckedChange={(checked) =>
                              setServiceForm({ ...serviceForm, isEnabled: checked })
                            }
                            data-testid={`switch-service-enabled-${service.id}`}
                          />
                          <Label htmlFor={`enabled-${service.id}`}>Услуга активна</Label>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveService(service.id)}
                            disabled={updateServiceMutation.isPending}
                            data-testid={`button-save-service-${service.id}`}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Сохранить
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            data-testid={`button-cancel-service-${service.id}`}
                          >
                            Отмена
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {service.description || "Нет описания"}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-2xl font-bold">
                            {formatPrice(service.basePrice)}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditService(service)}
                            data-testid={`button-edit-service-${service.id}`}
                          >
                            Редактировать
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Инструменты (10 шт.)
        </h2>

        <Card>
          <CardContent className="pt-6">
            {tools.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Инструменты не настроены. Добавьте записи в таблицу tool_configs.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Инструмент</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Использований</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map((tool) => (
                    <TableRow key={tool.id} data-testid={`row-tool-${tool.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{tool.displayName}</div>
                          <div className="text-xs text-muted-foreground">{tool.toolKey}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tool.isFree ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                            Бесплатно
                          </Badge>
                        ) : (
                          <span className="font-medium">{formatPrice(tool.price)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{tool.usageCount}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tool.isEnabled ? "default" : "secondary"}>
                          {tool.isEnabled ? "Активен" : "Отключен"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            toggleToolMutation.mutate({
                              id: tool.id,
                              isEnabled: !tool.isEnabled,
                            })
                          }
                          disabled={toggleToolMutation.isPending}
                          data-testid={`button-toggle-tool-${tool.id}`}
                        >
                          {tool.isEnabled ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
