import { useQuery } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressBar, Semaphore, CriteriaList, AuditProgressBar } from "@/components/progress-bar";
import { formatPrice } from "@/lib/packages-data";
import type { AuditWithDetails, CriteriaResult } from "@shared/schema";
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ArrowLeft,
  FileText,
  Download,
  RefreshCw,
  ExternalLink,
  CreditCard,
  Lock,
} from "lucide-react";

export default function AuditDetailPage() {
  const [, params] = useRoute("/dashboard/audits/:id");
  const [, navigate] = useLocation();
  const auditId = params?.id;

  const { data: audit, isLoading, refetch } = useQuery<AuditWithDetails>({
    queryKey: ["/api/audits", auditId],
    enabled: !!auditId,
    refetchInterval: (query) => {
      const data = query.state.data as AuditWithDetails | undefined;
      if (data?.status === "processing") {
        return 3000;
      }
      return false;
    },
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
      case "pending_payment":
        return (
          <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600">
            <CreditCard className="h-3 w-3" />
            Ожидает оплаты
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
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRecommendation = (score: number): "excellent" | "good" | "warning" | "poor" | "critical" => {
    if (score >= 90) return "excellent";
    if (score >= 75) return "good";
    if (score >= 50) return "warning";
    if (score >= 25) return "poor";
    return "critical";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">Аудит не найден</h3>
        <p className="text-muted-foreground mb-6">
          Запрошенный аудит не существует или был удален
        </p>
        <Button asChild>
          <Link href="/dashboard/audits">Вернуться к списку</Link>
        </Button>
      </div>
    );
  }

  const result = audit.results?.[0];
  const criteria = (result?.criteriaJson as CriteriaResult[]) || [];
  const score = result?.scorePercent || 0;

  const passedCount = criteria.filter((c) => c.status === "passed").length;
  const warningCount = criteria.filter((c) => c.status === "warning").length;
  const failedCount = criteria.filter((c) => c.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/audits">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono truncate">
              {audit.websiteUrlNormalized.replace(/^https?:\/\//, "")}
            </h1>
            {getStatusBadge(audit.status)}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {audit.package?.name} • {formatDate(audit.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <a
              href={audit.websiteUrlNormalized}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Открыть сайт
            </a>
          </Button>
          {audit.status === "processing" && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Обновить
            </Button>
          )}
        </div>
      </div>

      {audit.status === "pending_payment" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Заявка в обработке
            </CardTitle>
            <CardDescription>
              Ваша заявка на отчёт принята и находится в обработке
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{audit.package?.name || "Отчет"}</p>
                  <p className="text-sm text-muted-foreground">
                    {audit.websiteUrlNormalized}
                  </p>
                </div>
                <p className="text-2xl font-bold">
                  {audit.package?.price ? formatPrice(audit.package.price) : "900 ₽"}
                </p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  Детальный разбор каждого нарушения
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  Информация о штрафах и ссылки на законы
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  Пошаговые рекомендации по исправлению
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                  Отчёт на E-mail в течение 24 часов
                </li>
              </ul>
              <p className="text-sm text-center text-muted-foreground">
                Отчёт будет отправлен на ваш email после обработки
              </p>
            </div>
          </CardContent>
        </Card>
      ) : audit.status === "processing" ? (
        <Card>
          <CardHeader>
            <CardTitle>Проверка в процессе</CardTitle>
            <CardDescription>
              Пожалуйста, подождите. Результаты появятся автоматически.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AuditProgressBar 
              isProcessing={true}
              onComplete={() => refetch()}
            />
            <p className="text-sm text-muted-foreground text-center">
              Осталось примерно 2-3 минуты
            </p>
          </CardContent>
        </Card>
      ) : audit.status === "completed" && result ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Итоговый результат</CardTitle>
                  <CardDescription>
                    Общая оценка соответствия вашего сайта требованиям
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold">{score}%</p>
                  <p className="text-sm text-muted-foreground">
                    общий балл
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Semaphore
                green={passedCount}
                yellow={warningCount}
                red={failedCount}
                recommendation={getRecommendation(score)}
              />
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Результаты проверки</CardTitle>
                <CardDescription>
                  {criteria.length} критериев проверено
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CriteriaList criteria={criteria} showAll />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Отчеты</CardTitle>
                <CardDescription>
                  Скачайте детальный отчет с рекомендациями
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Краткий отчет</p>
                      <p className="text-sm text-muted-foreground">
                        Основные результаты на экране
                      </p>
                    </div>
                    <Badge variant="secondary">Бесплатно</Badge>
                  </div>
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Доступен выше
                  </p>
                </div>

                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Полный отчет</p>
                      <p className="text-sm text-muted-foreground">
                        Детальный анализ с рекомендациями по исправлению
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600">Включён</Badge>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Полный анализ по ФЗ-152, ФЗ-149
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Информация о штрафах и рисках
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Рекомендации по устранению нарушений
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Предложение полного юридического сопровождения
                    </li>
                  </ul>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-700 dark:text-amber-400 text-center font-medium">
                      Отчёт будет отправлен на ваш email в течение 24 часов
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : audit.status === "failed" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Ошибка проверки</CardTitle>
            <CardDescription>
              К сожалению, не удалось проверить указанный сайт
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Возможные причины:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Сайт недоступен или не отвечает</li>
              <li>Сайт заблокировал наш сервис</li>
              <li>Неверный URL адрес</li>
            </ul>
            <Button asChild>
              <Link href="/dashboard">Попробовать снова</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Ожидание обработки</CardTitle>
            <CardDescription>
              Ваш аудит находится в очереди на обработку
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressBar completed={0} total={100} status="pending" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
