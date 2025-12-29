import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AuditWithDetails } from "@shared/schema";
import { useState, useEffect } from "react";
import {
  Zap,
  Globe,
  CheckCircle2,
  Loader2,
  Search,
  Filter,
  Eye,
  RefreshCw,
  AlertCircle,
  Clock,
  Settings,
  Save,
} from "lucide-react";
import { Link } from "wouter";

export default function AdminExpressAuditsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reportPrice, setReportPrice] = useState<number>(900);
  const { toast } = useToast();

  const { data: audits, isLoading } = useQuery<AuditWithDetails[]>({
    queryKey: ["/api/admin/express-audits"],
  });

  const { data: expressSettings, isLoading: isLoadingSettings } = useQuery<{ fullReportPrice: number }>({
    queryKey: ["/api/admin/express-settings"],
  });

  useEffect(() => {
    if (expressSettings?.fullReportPrice !== undefined) {
      setReportPrice(expressSettings.fullReportPrice);
    }
  }, [expressSettings]);

  const updatePriceMutation = useMutation({
    mutationFn: async (newPrice: number) => {
      const response = await apiRequest("POST", "/api/admin/express-settings", {
        fullReportPrice: newPrice,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/express-settings"] });
      toast({
        title: "Цена обновлена",
        description: `Стоимость полного отчёта: ${reportPrice} руб.`,
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

  const reauditMutation = useMutation({
    mutationFn: async (auditId: number) => {
      const response = await apiRequest("POST", `/api/admin/audits/${auditId}/reaudit`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/express-audits"] });
      toast({
        title: "Переаудитирование запущено",
        description: "Проверка будет выполнена заново.",
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

  const filteredAudits = audits?.filter((audit) => {
    const matchesSearch =
      search === "" ||
      audit.websiteUrlNormalized.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || audit.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Готов
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Обработка
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Ошибка
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Ожидание
          </Badge>
        );
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-8 w-8 text-primary" />
          Экспресс-проверка
        </h1>
        <p className="text-muted-foreground mt-1">
          Экспресс-проверки сайтов (бесплатные с кратким результатом)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Настройки
          </CardTitle>
          <CardDescription>
            Настройка стоимости полного отчёта экспресс-проверки
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2">
              <Label htmlFor="report-price">Стоимость полного отчёта</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="report-price"
                  type="number"
                  min={0}
                  step={100}
                  value={reportPrice}
                  onChange={(e) => setReportPrice(Number(e.target.value))}
                  className="w-32"
                  disabled={isLoadingSettings}
                  data-testid="input-express-report-price"
                />
                <span className="text-muted-foreground">руб.</span>
              </div>
            </div>
            <Button
              onClick={() => updatePriceMutation.mutate(reportPrice)}
              disabled={updatePriceMutation.isPending || isLoadingSettings || reportPrice === expressSettings?.fullReportPrice}
              data-testid="button-save-price"
            >
              {updatePriceMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Сохранить
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Эта цена будет отображаться пользователям при предложении полного отчёта после экспресс-проверки
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по URL..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-express-audits"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="processing">Обработка</SelectItem>
                  <SelectItem value="completed">Готовые</SelectItem>
                  <SelectItem value="failed">Ошибка</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredAudits?.length || 0} проверок
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : filteredAudits && filteredAudits.length > 0 ? (
            <div className="space-y-4">
              {filteredAudits.map((audit) => (
                <div
                  key={audit.id}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                  data-testid={`express-audit-card-${audit.id}`}
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium font-mono truncate">
                      {audit.websiteUrlNormalized.replace(/^https?:\/\//, "")}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                      <span>Экспресс-проверка</span>
                      <span>{formatDate(audit.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {getStatusBadge(audit.status)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reauditMutation.mutate(audit.id)}
                      disabled={reauditMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Переаудит
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/audits/${audit.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Просмотр
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Zap className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Нет экспресс-проверок</h3>
              <p className="text-muted-foreground">
                {search || statusFilter !== "all"
                  ? "Попробуйте изменить параметры поиска"
                  : "Здесь будут отображаться экспресс-проверки"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
