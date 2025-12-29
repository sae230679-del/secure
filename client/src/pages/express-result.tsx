import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Globe,
  ArrowRight,
  Loader2,
  Shield,
  FileText,
  HelpCircle,
  MapPin,
  AlertCircle,
  Home,
} from "lucide-react";
import { Link } from "wouter";
import { AuditResultsView } from "@/components/audit/AuditResultsView";
import { AuditProgressBar } from "@/components/progress-bar";
import type { BriefResults, HostingInfo } from "@shared/schema";

interface ExpressCheckResult {
  token: string;
  websiteUrl: string;
  status: string;
  scorePercent: number | null;
  severity: string | null;
  passedCount: number | null;
  warningCount: number | null;
  failedCount: number | null;
  checks: Array<{
    name: string;
    description?: string;
    status: string;
  }>;
  briefResults: BriefResults | null;
  hostingInfo: HostingInfo | null;
  rknCheck: {
    found: boolean;
    message: string;
    operatorName?: string;
    registrationNumber?: string;
  } | null;
  siteType: {
    type: string;
    name: string;
    description: string;
    baseAuditPrice: number;
    confidence: "high" | "medium" | "low";
    signals: string[];
  } | null;
  fullReportPrice: number;
  fullReportPurchased: boolean;
}

export default function ExpressResultPage() {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const token = params.token;

  const { data: result, isLoading, error, refetch } = useQuery<ExpressCheckResult>({
    queryKey: ["/api/public/express-check", token],
    enabled: !!token,
    refetchInterval: (query) => {
      const data = query.state.data as ExpressCheckResult | undefined;
      if (data?.status === "processing") {
        return 3000;
      }
      return false;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">SecureLex.ru</span>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">SecureLex.ru</span>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Проверка не найдена</h2>
              <p className="text-muted-foreground mb-4">
                Возможно, ссылка устарела или проверка была удалена.
              </p>
              <Button onClick={() => navigate("/")} data-testid="button-go-home">
                <Home className="h-4 w-4 mr-2" />
                На главную
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const isProcessing = result.status === "processing";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">SecureLex.ru</span>
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/dashboard/express-checks">
              <Button variant="outline" size="sm" data-testid="button-to-dashboard">
                Личный кабинет
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold break-all" data-testid="text-website-url">
              {result.websiteUrl}
            </h1>
            {isProcessing ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Проверяем...
              </Badge>
            ) : result.status === "completed" ? (
              <Badge className="bg-emerald-500/10 text-emerald-600">Завершено</Badge>
            ) : (
              <Badge variant="destructive">Ошибка</Badge>
            )}
          </div>

          {isProcessing ? (
            <Card>
              <CardContent className="py-8">
                <AuditProgressBar 
                  isProcessing={true} 
                  onComplete={() => refetch()}
                />
              </CardContent>
            </Card>
          ) : result.briefResults ? (
            <>
              <AuditResultsView
                results={result.briefResults}
                isExpress={true}
                siteType={result.siteType}
                fullReportPrice={result.fullReportPrice}
                onPurchaseFullReport={() => navigate(`/order-report?token=${token}`)}
              />
              
              {!result.fullReportPurchased && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Заказать полный отчёт
                    </CardTitle>
                    <CardDescription>
                      Получите детальный анализ каждого нарушения с рекомендациями по исправлению
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-2xl font-bold">{result.fullReportPrice} ₽</p>
                        <p className="text-sm text-muted-foreground">Отчёт в течение 24 часов на email</p>
                      </div>
                      <Button onClick={() => navigate(`/order-report?token=${token}`)} data-testid="button-order-report">
                        Заказать отчёт
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Результаты недоступны</h2>
                <p className="text-muted-foreground mb-4">
                  Не удалось получить результаты проверки. Попробуйте обновить страницу.
                </p>
                <Button onClick={() => refetch()} data-testid="button-retry">
                  Обновить
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
