import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/packages-data";
import { Link } from "wouter";
import type { AuditWithDetails } from "@shared/schema";
import {
  FileSearch,
  CreditCard,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Globe,
  Shield,
  ExternalLink,
  Zap,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: audits, isLoading: auditsLoading } = useQuery<AuditWithDetails[]>({
    queryKey: ["/api/audits"],
  });

  const { data: stats } = useQuery<{
    totalAudits: number;
    totalSpent: number;
    activeAudits: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const recentAudits = audits?.slice(0, 4) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Готов
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400">
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
      case "pending_payment":
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
            <CreditCard className="h-3 w-3" />
            Ожидает оплаты
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

  const statCards = [
    {
      title: "Всего проверок",
      value: stats?.totalAudits || audits?.length || 0,
      icon: FileSearch,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Потрачено",
      value: formatPrice(stats?.totalSpent || 0),
      icon: CreditCard,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Активные проверки",
      value: stats?.activeAudits || audits?.filter(a => a.status === "processing").length || 0,
      icon: Activity,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Добро пожаловать, {user?.name?.split(" ")[0] || "Пользователь"}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Ваша панель управления проверками сайтов
          </p>
        </div>
        <Button asChild data-testid="button-new-audit">
          <Link href="/dashboard/audits">
            Все проверки
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              {auditsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold" data-testid={`text-stat-${index}`}>
                  {stat.value}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Экспресс-проверка
            </CardTitle>
            <CardDescription>
              Бесплатная быстрая проверка сайта на соответствие законодательству
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Получите мгновенный анализ вашего сайта. После проверки можно заказать полный отчёт за 900 ₽.
            </p>
            <Button asChild className="w-full" data-testid="button-go-express">
              <Link href="/dashboard/express-checks">
                Перейти к проверкам
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Полный аудит
            </CardTitle>
            <CardDescription>
              Комплексная проверка с пакетом документов
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Детальный анализ на соответствие ФЗ-152 и ФЗ-149. Включает документы и рекомендации.
            </p>
            <Button asChild variant="outline" className="w-full" data-testid="button-go-audits">
              <Link href="/dashboard/audits">
                Перейти к аудитам
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Последние аудиты</CardTitle>
            <CardDescription>Ваши недавние заказы</CardDescription>
          </div>
          {audits && audits.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/audits">
                Все проверки
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {auditsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : recentAudits.length > 0 ? (
            <div className="space-y-3">
              {recentAudits.map((audit) => (
                <Link
                  key={audit.id}
                  href={`/dashboard/audits/${audit.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer group"
                  data-testid={`link-audit-${audit.id}`}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {audit.websiteUrlNormalized.replace(/^https?:\/\//, "")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {audit.package?.name || "Аудит"}
                    </p>
                  </div>
                  {getStatusBadge(audit.status)}
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <FileSearch className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">У вас пока нет аудитов</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Перейдите в раздел "Экспресс-проверки" или "Полные аудиты"
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
