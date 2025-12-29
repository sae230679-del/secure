import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Search,
} from "lucide-react";
import { Link } from "wouter";
import { AuditResultsView } from "@/components/audit/AuditResultsView";
import { AuditProgressBar } from "@/components/progress-bar";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const token = params.token;

  const [showInnModal, setShowInnModal] = useState(false);
  const [innInput, setInnInput] = useState("");
  const [isCheckingInn, setIsCheckingInn] = useState(false);
  const [rknCheckResult, setRknCheckResult] = useState<{
    found: boolean;
    message: string;
    operatorName?: string;
    registrationNumber?: string;
    inn?: string;
  } | null>(null);

  const handleInnCheck = async () => {
    if (!innInput || innInput.replace(/\D/g, "").length < 10) {
      toast({
        title: "Ошибка",
        description: "Введите корректный ИНН (10 или 12 цифр)",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingInn(true);
    try {
      const response = await fetch("/api/public/rkn/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn: innInput }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Ошибка проверки ИНН");
      }
      
      if (data.found) {
        setRknCheckResult({
          found: true,
          message: data.message || "Организация найдена в реестре РКН",
          operatorName: data.operatorName,
          registrationNumber: data.registrationNumber,
          inn: innInput,
        });
        toast({
          title: "Найдено в реестре РКН",
          description: `${data.operatorName || "Организация"} зарегистрирована как оператор ПДн`,
        });
      } else {
        setRknCheckResult({
          found: false,
          message: data.message || "Организация не найдена в реестре РКН",
          inn: innInput,
        });
        toast({
          title: "Не найдено в реестре",
          description: "Организация не зарегистрирована как оператор персональных данных",
          variant: "destructive",
        });
      }
      setShowInnModal(false);
      setInnInput("");
    } catch (err: any) {
      toast({
        title: "Ошибка проверки",
        description: err.message || "Не удалось проверить ИНН",
        variant: "destructive",
      });
    } finally {
      setIsCheckingInn(false);
    }
  };

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

              {/* Блок проверки РКН */}
              <Card className={
                (rknCheckResult?.found || result.rknCheck?.found) 
                  ? "border-emerald-500/30 bg-emerald-500/5" 
                  : "border-rose-500/30 bg-rose-500/5"
              }>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5" />
                    Реестр операторов ПДн (РКН)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rknCheckResult ? (
                    rknCheckResult.found ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-medium">Организация найдена в реестре</span>
                        </div>
                        {rknCheckResult.operatorName && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Оператор:</span> {rknCheckResult.operatorName}
                          </p>
                        )}
                        {rknCheckResult.registrationNumber && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Рег. номер:</span> {rknCheckResult.registrationNumber}
                          </p>
                        )}
                        {rknCheckResult.inn && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">ИНН:</span> <span className="font-mono">{rknCheckResult.inn}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-rose-600">
                          <XCircle className="h-5 w-5" />
                          <span className="font-medium">Организация не найдена в реестре</span>
                          <Badge variant="destructive">Критично</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          ИНН {rknCheckResult.inn} не зарегистрирован как оператор персональных данных. 
                          Это нарушение ФЗ-152 влечёт штрафы до 300 000 ₽.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowInnModal(true)}
                          data-testid="button-recheck-inn"
                        >
                          <Search className="h-4 w-4 mr-2" />
                          Проверить другой ИНН
                        </Button>
                      </div>
                    )
                  ) : result.rknCheck ? (
                    result.rknCheck.found ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-medium">Организация найдена в реестре</span>
                        </div>
                        {result.rknCheck.operatorName && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Оператор:</span> {result.rknCheck.operatorName}
                          </p>
                        )}
                        {result.rknCheck.registrationNumber && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Рег. номер:</span> {result.rknCheck.registrationNumber}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-rose-600">
                          <XCircle className="h-5 w-5" />
                          <span className="font-medium">{result.rknCheck.message || "Не найдено в реестре"}</span>
                          <Badge variant="destructive">Критично</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          ИНН организации не был автоматически определён на сайте. 
                          Введите ИНН вручную для проверки регистрации в реестре операторов ПДн.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowInnModal(true)}
                          data-testid="button-check-inn"
                        >
                          <Search className="h-4 w-4 mr-2" />
                          Проверить по ИНН
                        </Button>
                      </div>
                    )
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">Проверка не выполнена</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Для проверки регистрации в реестре РКН введите ИНН организации.
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowInnModal(true)}
                        data-testid="button-check-inn-manual"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Проверить по ИНН
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
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

      {/* Диалог ввода ИНН */}
      <Dialog open={showInnModal} onOpenChange={setShowInnModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Проверка в реестре РКН</DialogTitle>
            <DialogDescription>
              Введите ИНН организации для проверки регистрации в качестве оператора персональных данных.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Введите ИНН (10 или 12 цифр)"
              value={innInput}
              onChange={(e) => setInnInput(e.target.value.replace(/\D/g, "").slice(0, 12))}
              maxLength={12}
              data-testid="input-inn"
            />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>ИНН можно найти:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>В подвале сайта (реквизиты)</li>
                <li>На странице «О компании» или «Контакты»</li>
                <li>В публичной оферте или договоре</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowInnModal(false)}
              data-testid="button-cancel-inn"
            >
              Отмена
            </Button>
            <Button
              onClick={handleInnCheck}
              disabled={isCheckingInn || innInput.length < 10}
              data-testid="button-submit-inn"
            >
              {isCheckingInn ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Проверяем...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Проверить
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
