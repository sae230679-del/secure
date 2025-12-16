import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { URLInput } from "@/components/url-input";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, ArrowRight, Loader2, AlertTriangle, CheckCircle2, XCircle, FileText, CreditCard, Zap, FileCheck, Building2, HelpCircle, Search } from "lucide-react";
import { ScoreIndicator, FineEstimate, ResultsSummary } from "@/components/score-indicator";
import { AuditResultsView } from "@/components/audit/AuditResultsView";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BriefResults } from "@shared/schema";

type CheckCategory = 
  | "landing"
  | "corporate"
  | "ecommerce"
  | "saas"
  | "portal"
  | "marketplace"
  | "media"
  | "medical"
  | "children"
  | "other";

const ALL_SITE_TYPES: { id: CheckCategory; label: string }[] = [
  { id: "landing", label: "Лендинг" },
  { id: "ecommerce", label: "Интернет-магазин" },
  { id: "portal", label: "Портал / Сообщество" },
  { id: "media", label: "Медиа / Блог" },
  { id: "medical", label: "Медицинские услуги" },
  { id: "corporate", label: "Корпоративный сайт" },
  { id: "saas", label: "SaaS / Сервис" },
  { id: "marketplace", label: "Маркетплейс" },
  { id: "children", label: "Детские услуги" },
  { id: "other", label: "Другое" },
];

const auditStages = [
  { name: "Подключение к сайту", duration: 4000 },
  { name: "Анализ SSL-сертификата", duration: 5000 },
  { name: "Проверка cookie-баннера", duration: 5000 },
  { name: "Анализ политики конфиденциальности", duration: 6000 },
  { name: "Проверка форм согласия", duration: 5000 },
  { name: "Анализ контактных данных", duration: 4000 },
  { name: "Финальная проверка", duration: 5000 },
];

type RknCheckResult = {
  status: "passed" | "warning" | "failed" | "pending" | "not_checked";
  confidence: "high" | "medium" | "low" | "none";
  used: "inn" | "name" | "manual" | "none";
  query: { inn?: string; name?: string };
  details: string;
  needsCompanyDetails?: boolean;
  evidence?: { innFound?: string; nameFound?: string; urls?: string[] };
};

type ExpressResult = {
  scorePercent: number;
  severity: string;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  summary: any[];
  rknCheck?: RknCheckResult | null;
  briefResults?: BriefResults | null;
  hostingInfo?: any | null;
};

function ExpressProgressBar({ 
  stageIndex, 
  passedCount, 
  warningCount, 
  failedCount 
}: { 
  stageIndex: number; 
  passedCount: number; 
  warningCount: number; 
  failedCount: number;
}) {
  const [activeLight, setActiveLight] = useState<"green" | "yellow" | "red">("green");
  const [pulseIntensity, setPulseIntensity] = useState(1);
  const totalStages = auditStages.length;
  const progress = Math.min(100, (stageIndex / totalStages) * 100);

  useEffect(() => {
    let lightIndex = 0;
    const lights: Array<"green" | "yellow" | "red"> = ["green", "yellow", "red"];
    
    const semaphoreInterval = setInterval(() => {
      lightIndex = (lightIndex + 1) % lights.length;
      setActiveLight(lights[lightIndex]);
      setPulseIntensity(0.6 + Math.random() * 0.4);
    }, 400);

    return () => clearInterval(semaphoreInterval);
  }, []);

  const getLightStyles = (light: "green" | "yellow" | "red") => {
    const isActive = activeLight === light;
    const baseColor = {
      green: "bg-emerald-500",
      yellow: "bg-amber-500",
      red: "bg-rose-500",
    }[light];
    
    const glowColor = {
      green: "shadow-emerald-500/80",
      yellow: "shadow-amber-500/80",
      red: "shadow-rose-500/80",
    }[light];

    return `w-4 h-4 rounded-full transition-all duration-150 ${
      isActive 
        ? `${baseColor} ${glowColor} shadow-lg` 
        : "bg-muted-foreground/20"
    }`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
          <div 
            className={getLightStyles("green")} 
            style={{ opacity: activeLight === "green" ? pulseIntensity : 0.3 }}
          />
          <div 
            className={getLightStyles("yellow")} 
            style={{ opacity: activeLight === "yellow" ? pulseIntensity : 0.3 }}
          />
          <div 
            className={getLightStyles("red")} 
            style={{ opacity: activeLight === "red" ? pulseIntensity : 0.3 }}
          />
        </div>

        <div className="flex-1 space-y-2">
          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{stageIndex < totalStages ? auditStages[stageIndex]?.name : "Завершено"}</span>
            <span className="font-semibold text-foreground">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 p-2 bg-muted/30 rounded-md text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{passedCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>{warningCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="w-4 h-4 text-rose-500" />
          <span>{failedCount}</span>
        </div>
      </div>
    </div>
  );
}

export function ExpressCheck() {
  const [activeTab, setActiveTab] = useState<"quick" | "full">("quick");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [selectedType, setSelectedType] = useState<CheckCategory | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkToken, setCheckToken] = useState<string | null>(null);
  const [checkStatus, setCheckStatus] = useState<{
    stageIndex: number;
    passedCount: number;
    warningCount: number;
    failedCount: number;
  } | null>(null);
  const [result, setResult] = useState<ExpressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showInnModal, setShowInnModal] = useState(false);
  const [innInput, setInnInput] = useState("");
  const [isCheckingInn, setIsCheckingInn] = useState(false);
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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
      const response = await apiRequest("POST", "/api/public/rkn/check", { inn: innInput });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ошибка проверки");
      }

      setResult((prev) => prev ? {
        ...prev,
        rknCheck: {
          status: data.status,
          confidence: data.confidence,
          used: "inn",
          query: { inn: innInput },
          details: data.details,
          needsCompanyDetails: false,
          evidence: {
            innFound: innInput,
            nameFound: data.companyName,
          },
        },
      } : null);

      setShowInnModal(false);
      setInnInput("");
      
      toast({
        title: data.status === "passed" ? "Организация найдена" : "Не найдено",
        description: data.details,
      });
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось проверить ИНН",
        variant: "destructive",
      });
    } finally {
      setIsCheckingInn(false);
    }
  };

  useEffect(() => {
    if (!checkToken || !isChecking) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/public/express-check/${checkToken}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Ошибка проверки");
        }

        setCheckStatus({
          stageIndex: data.stageIndex || 0,
          passedCount: data.passedCount || 0,
          warningCount: data.warningCount || 0,
          failedCount: data.failedCount || 0,
        });

        if (data.status === "completed") {
          setResult({
            scorePercent: data.scorePercent || 0,
            severity: data.severity || "low",
            passedCount: data.passedCount || 0,
            warningCount: data.warningCount || 0,
            failedCount: data.failedCount || 0,
            summary: data.summary || [],
            rknCheck: data.rknCheck || null,
            briefResults: data.briefResults || null,
            hostingInfo: data.hostingInfo || null,
          });
          setIsChecking(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } else if (data.status === "failed") {
          setError("Проверка не удалась. Попробуйте еще раз.");
          setIsChecking(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err: any) {
        console.error("Polling error:", err);
      }
    };

    pollingRef.current = setInterval(pollStatus, 1000);
    pollStatus();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [checkToken, isChecking]);

  const runExpressCheck = async () => {
    if (!websiteUrl) return;
    
    setIsChecking(true);
    setResult(null);
    setError(null);
    setCheckStatus(null);

    try {
      const response = await apiRequest("POST", "/api/public/express-check", { 
        websiteUrl 
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Ошибка при создании проверки");
      }

      setCheckToken(data.token);
      setCheckStatus({
        stageIndex: 0,
        passedCount: 0,
        warningCount: 0,
        failedCount: 0,
      });
    } catch (err: any) {
      setError(err.message || "Произошла ошибка");
      setIsChecking(false);
    }
  };

  const resetCheck = () => {
    setResult(null);
    setCheckToken(null);
    setCheckStatus(null);
    setError(null);
    setWebsiteUrl("");
    setSelectedType(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handlePurchaseReport = async () => {
    if (!checkToken) return;
    
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    setIsPurchasing(true);
    try {
      const response = await apiRequest("POST", "/api/express-report/purchase", { token: checkToken });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Ошибка при создании отчета");
      }

      toast({
        title: "Отчет создан",
        description: "Переходим к оплате...",
      });
      
      navigate(`/checkout/${data.auditId}`);
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось создать отчет",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!checkToken) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/public/express-check/${checkToken}/pdf`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Ошибка при генерации PDF");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `express-report-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "PDF скачан",
        description: "Краткий отчёт успешно сохранён",
      });
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось скачать PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleProceedToPackages = () => {
    if (!websiteUrl || !selectedType) return;
    
    const params = new URLSearchParams({
      url: websiteUrl,
      type: selectedType,
    });
    
    if (isAuthenticated) {
      navigate(`/dashboard?${params.toString()}`);
    } else {
      navigate(`/auth?redirect=/dashboard&${params.toString()}`);
    }
  };

  return (
    <Card id="check" className="lg:ml-auto w-full max-w-md lg:max-w-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Проверка сайта
        </CardTitle>
        <CardDescription>
          Выберите подходящий вариант проверки
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            {error}
          </div>
        )}

        {isChecking && checkStatus ? (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground mb-2">Проверяем сайт</p>
              <p className="font-medium truncate">{websiteUrl}</p>
            </div>
            <ExpressProgressBar 
              stageIndex={checkStatus.stageIndex}
              passedCount={checkStatus.passedCount}
              warningCount={checkStatus.warningCount}
              failedCount={checkStatus.failedCount}
            />
            <p className="text-xs text-center text-muted-foreground">
              Пожалуйста, подождите. Проверка занимает около 35 секунд.
            </p>
          </div>
        ) : result ? (
          result.briefResults ? (
            <AuditResultsView
              results={result.briefResults}
              isExpress={true}
              onDownloadPdf={handleDownloadPdf}
              onPurchaseFullReport={handlePurchaseReport}
              onReset={resetCheck}
              isDownloading={isDownloading}
              isPurchasing={isPurchasing}
            />
          ) : (
          <div className="space-y-5">
            <div className="text-center">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Общий уровень соответствия
              </h3>
              <ScoreIndicator score={result.scorePercent} size="md" />
            </div>

            <ResultsSummary 
              passedCount={result.passedCount}
              warningCount={result.warningCount}
              failedCount={result.failedCount}
            />

            <FineEstimate 
              failedCount={result.failedCount}
              warningCount={result.warningCount}
              severity={result.severity === "low" ? "low" : result.severity === "medium" ? "medium" : "high"}
            />

            {result.rknCheck && (
              <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Проверка реестра РКН</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {result.rknCheck.status === "passed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : result.rknCheck.status === "pending" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : result.rknCheck.status === "not_checked" ? (
                    <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span className="text-muted-foreground">{result.rknCheck.details}</span>
                </div>
                {result.rknCheck.evidence?.innFound && (
                  <div className="text-xs text-muted-foreground">
                    ИНН: <span className="font-mono">{result.rknCheck.evidence.innFound}</span>
                  </div>
                )}
                {result.rknCheck.evidence?.nameFound && (
                  <div className="text-xs text-muted-foreground">
                    Организация: {result.rknCheck.evidence.nameFound}
                  </div>
                )}
                {result.rknCheck.needsCompanyDetails && (
                  <div className="mt-2 space-y-2">
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                      ИНН не найден на сайте. Укажите ИНН для проверки в реестре РКН
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setShowInnModal(true)}
                      data-testid="button-open-inn-modal"
                    >
                      <Search className="w-3 h-3 mr-2" />
                      Проверить по ИНН
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-4 space-y-4">
              <div className="text-center text-sm font-medium">
                Что дальше?
              </div>
              
              <div className="p-3 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="font-semibold">Полный отчёт</span>
                  </div>
                  <span className="text-xl font-bold text-primary">900 ₽</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                    PDF с разбором каждого нарушения
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                    Штрафы и ссылки на законы
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                    Пошаговые рекомендации
                  </li>
                </ul>
                <Button 
                  className="w-full" 
                  size="default" 
                  onClick={handlePurchaseReport}
                  disabled={isPurchasing}
                  data-testid="button-purchase-report"
                >
                  {isPurchasing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Купить за 900 ₽
                    </>
                  )}
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Полный аудит + документы</span>
                  <span className="text-sm text-muted-foreground">от 3 900 ₽</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  10 готовых документов для вашего сайта
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full" 
                  asChild
                >
                  <Link href={isAuthenticated ? "/dashboard" : "/auth"}>
                    Выбрать тип сайта
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </div>

              <Button 
                variant="ghost" 
                size="sm"
                className="w-full" 
                onClick={resetCheck}
                data-testid="button-new-check"
              >
                Проверить другой сайт
              </Button>
            </div>
          </div>
        )) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "quick" | "full")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 relative">
              <TabsTrigger value="quick" className="flex items-center gap-1.5" data-testid="tab-quick-check">
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">Быстрая</span> проверка
              </TabsTrigger>
              <TabsTrigger value="full" className="flex items-center gap-1.5 relative" data-testid="tab-full-audit">
                <FileCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Полный</span> аудит
                <span className="absolute -top-3 -right-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full text-white animate-traffic-light">
                  ТОП
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-4 mt-0">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
                <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                  <Zap className="w-4 h-4" />
                  Бесплатная экспресс-проверка
                </div>
                <p className="text-xs text-muted-foreground">
                  Быстрый анализ основных требований. После проверки можно купить полный PDF-отчёт за 900 ₽
                </p>
              </div>

              <URLInput value={websiteUrl} onChange={setWebsiteUrl} />

              <Button 
                className="w-full" 
                size="lg" 
                onClick={runExpressCheck}
                disabled={!websiteUrl || isChecking}
                data-testid="button-run-express-check"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    Проверить бесплатно
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="full" className="space-y-4 mt-0">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <FileCheck className="w-4 h-4 text-primary" />
                  Полный аудит + документы
                </div>
                <p className="text-xs text-muted-foreground">
                  Глубокий анализ по 60+ критериям + 10 готовых документов для вашего сайта. От 3 900 ₽
                </p>
              </div>

              <URLInput value={websiteUrl} onChange={setWebsiteUrl} />
              
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-sm font-medium">Выберите тип вашего сайта</Label>
                  <label 
                    className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setSelectedType("other")}
                    data-testid="select-type-all"
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedType === "other" 
                        ? "border-primary bg-primary" 
                        : "border-muted-foreground/50"
                    }`}>
                      {selectedType === "other" && (
                        <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span>Не знаю / Выбрать все</span>
                  </label>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_SITE_TYPES.map((type) => (
                    <div 
                      key={type.id} 
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                        selectedType === type.id 
                          ? "bg-primary/10 border border-primary/30" 
                          : "bg-muted/30 border border-transparent"
                      }`}
                      onClick={() => setSelectedType(type.id)}
                      data-testid={`select-type-${type.id}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedType === type.id 
                          ? "border-primary bg-primary" 
                          : "border-muted-foreground/50"
                      }`}>
                        {selectedType === type.id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <Label 
                        className="text-xs sm:text-sm font-normal cursor-pointer"
                      >
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleProceedToPackages}
                disabled={!websiteUrl || !selectedType}
                data-testid="button-proceed-to-packages"
              >
                Выбрать пакет
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Вы будете перенаправлены к выбору пакета и оплате
              </p>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      <Dialog open={showInnModal} onOpenChange={setShowInnModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Проверка в реестре РКН
            </DialogTitle>
            <DialogDescription>
              Введите ИНН организации для проверки регистрации в реестре операторов персональных данных Роскомнадзора
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inn-input">ИНН организации</Label>
              <Input
                id="inn-input"
                type="text"
                placeholder="Например: 7707083893"
                value={innInput}
                onChange={(e) => setInnInput(e.target.value.replace(/\D/g, "").slice(0, 12))}
                maxLength={12}
                data-testid="input-inn"
              />
              <p className="text-xs text-muted-foreground">
                10 цифр для юрлиц, 12 для ИП
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowInnModal(false);
                setInnInput("");
              }}
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Проверить
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
