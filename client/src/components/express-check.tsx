import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { URLInput } from "@/components/url-input";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, ArrowRight, Loader2, AlertTriangle, CheckCircle2, XCircle, FileText, CreditCard, Zap, Building2, HelpCircle, Search, Lock, Cookie, FileCheck, Globe, Users, UserCheck, ClipboardList, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScoreIndicator, FineEstimate, ResultsSummary } from "@/components/score-indicator";
import { AuditResultsView } from "@/components/audit/AuditResultsView";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BriefResults } from "@shared/schema";

const AUDIT_CRITERIA = [
  { id: "https", name: "HTTPS/SSL сертификат", icon: Lock, description: "Проверка защищённого соединения" },
  { id: "privacy_policy", name: "Политика конфиденциальности", icon: FileText, description: "Наличие и полнота документа" },
  { id: "pdn_consent", name: "Согласие на обработку ПДн", icon: FileCheck, description: "Формы согласия на обработку данных" },
  { id: "cookies", name: "Cookie-баннер", icon: Cookie, description: "Уведомление об использовании cookies" },
  { id: "foreign_resources", name: "Иностранные ресурсы", icon: Globe, description: "Скрипты и сервисы зарубежных компаний" },
  { id: "forms", name: "Формы сбора данных", icon: ClipboardList, description: "Корректность полей и согласий" },
  { id: "contacts", name: "Контактная информация", icon: Users, description: "Реквизиты оператора ПДн" },
  { id: "auth", name: "Авторизация", icon: UserCheck, description: "Безопасность входа и регистрации" },
  { id: "rkn_registry", name: "Реестр Роскомнадзора", icon: Building2, description: "Проверка регистрации оператора" },
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

type SiteTypeInfo = {
  type: string;
  name: string;
  description: string;
  baseAuditPrice: number;
  confidence: "high" | "medium" | "low";
  signals: string[];
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
  siteType?: SiteTypeInfo | null;
  fullReportPrice?: number;
};

function getScoreColor(score: number): "green" | "yellow" | "red" {
  if (score >= 80) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Сайт соответствует требованиям";
  if (score >= 50) return "Требуется доработка";
  return "Критические нарушения";
}

function SemaphoreProgress({ 
  criterionIndex, 
  passedCount, 
  warningCount, 
  failedCount,
  isComplete,
  finalScore,
  rknAttempt,
  rknMaxAttempts
}: { 
  criterionIndex: number; 
  passedCount: number; 
  warningCount: number; 
  failedCount: number;
  isComplete: boolean;
  finalScore?: number;
  rknAttempt?: number;
  rknMaxAttempts?: number;
}) {
  const [cycleColor, setCycleColor] = useState<"green" | "yellow" | "red">("green");
  const [pulseIntensity, setPulseIntensity] = useState(1);
  const totalCriteria = AUDIT_CRITERIA.length;
  const progress = Math.min(100, ((criterionIndex + 1) / totalCriteria) * 100);
  
  const activeColor = isComplete && finalScore !== undefined
    ? getScoreColor(finalScore)
    : cycleColor;

  useEffect(() => {
    if (isComplete) return;
    
    const colors: Array<"green" | "yellow" | "red"> = ["green", "yellow", "red"];
    let colorIndex = 0;
    
    const cycleInterval = setInterval(() => {
      colorIndex = (colorIndex + 1) % colors.length;
      setCycleColor(colors[colorIndex]);
    }, 600);

    const pulseInterval = setInterval(() => {
      setPulseIntensity(0.5 + Math.random() * 0.5);
    }, 200);

    return () => {
      clearInterval(cycleInterval);
      clearInterval(pulseInterval);
    };
  }, [isComplete]);

  const getLightStyles = (light: "green" | "yellow" | "red") => {
    const isActive = activeColor === light;
    const colors = {
      green: { bg: "bg-emerald-500", glow: "shadow-emerald-500/80" },
      yellow: { bg: "bg-amber-500", glow: "shadow-amber-500/80" },
      red: { bg: "bg-rose-500", glow: "shadow-rose-500/80" },
    };
    
    return `w-5 h-5 rounded-full transition-all duration-300 ${
      isActive 
        ? `${colors[light].bg} ${colors[light].glow} shadow-lg` 
        : "bg-muted-foreground/20"
    }`;
  };

  const currentCriterion = criterionIndex < totalCriteria 
    ? AUDIT_CRITERIA[criterionIndex] 
    : AUDIT_CRITERIA[totalCriteria - 1];
  const CriterionIcon = currentCriterion.icon;
  
  const isCheckingRkn = rknAttempt !== undefined && rknAttempt > 0;
  const statusText = isComplete 
    ? "Проверка завершена" 
    : isCheckingRkn 
      ? `Соединение с сервером РКН - попытка ${rknAttempt} из ${rknMaxAttempts || 5}` 
      : currentCriterion.name;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50 border">
          <div 
            className={getLightStyles("green")} 
            style={{ opacity: activeColor === "green" ? pulseIntensity : 0.3 }}
          />
          <div 
            className={getLightStyles("yellow")} 
            style={{ opacity: activeColor === "yellow" ? pulseIntensity : 0.3 }}
          />
          <div 
            className={getLightStyles("red")} 
            style={{ opacity: activeColor === "red" ? pulseIntensity : 0.3 }}
          />
        </div>

        <div className="flex-1 space-y-3">
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                isComplete 
                  ? activeColor === "green" 
                    ? "bg-emerald-500" 
                    : activeColor === "yellow" 
                      ? "bg-amber-500" 
                      : "bg-rose-500"
                  : "bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              {isCheckingRkn ? (
                <Building2 className="w-4 h-4 text-amber-500 animate-pulse" />
              ) : (
                <CriterionIcon className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={`truncate ${isCheckingRkn ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
                {statusText}
              </span>
            </div>
            <span className="text-sm font-bold tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="font-medium">{passedCount}</span>
          <span className="text-muted-foreground text-xs hidden sm:inline">пройдено</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="font-medium">{warningCount}</span>
          <span className="text-muted-foreground text-xs hidden sm:inline">внимание</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-500" />
          <span className="font-medium">{failedCount}</span>
          <span className="text-muted-foreground text-xs hidden sm:inline">ошибок</span>
        </div>
      </div>

      {!isComplete && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {isCheckingRkn 
              ? "Проверяем регистрацию в реестре операторов персональных данных..."
              : `Проверяем ${criterionIndex + 1} из ${totalCriteria} критериев...`
            }
          </p>
        </div>
      )}
    </div>
  );
}

export function ExpressCheck() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkToken, setCheckToken] = useState<string | null>(null);
  const [checkStatus, setCheckStatus] = useState<{
    stageIndex: number;
    passedCount: number;
    warningCount: number;
    failedCount: number;
    rknAttempt?: number;
    rknMaxAttempts?: number;
  } | null>(null);
  const [result, setResult] = useState<ExpressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showInnModal, setShowInnModal] = useState(false);
  const [innInput, setInnInput] = useState("");
  const [isCheckingInn, setIsCheckingInn] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [pdnConsent, setPdnConsent] = useState(false);
  const [offerConsent, setOfferConsent] = useState(false);
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
    if (result?.rknCheck?.needsCompanyDetails && !showInnModal) {
      setShowInnModal(true);
    }
  }, [result?.rknCheck?.needsCompanyDetails]);

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
          rknAttempt: data.rknAttempt || 0,
          rknMaxAttempts: data.rknMaxAttempts || 5,
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
            siteType: data.siteType || null,
            fullReportPrice: data.fullReportPrice || 900,
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
    setPrivacyConsent(false);
    setPdnConsent(false);
    setOfferConsent(false);
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

  return (
    <>
      <Card id="check" className="lg:ml-auto w-full max-w-md lg:max-w-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Экспресс-проверка сайта
          </CardTitle>
          <CardDescription>
            Бесплатный анализ по 9 критериям за 2 минуты
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
                <p className="text-sm text-muted-foreground mb-1">Проверяем сайт</p>
                <p className="font-medium truncate text-sm">{websiteUrl}</p>
              </div>
              <SemaphoreProgress 
                criterionIndex={checkStatus.stageIndex}
                passedCount={checkStatus.passedCount}
                warningCount={checkStatus.warningCount}
                failedCount={checkStatus.failedCount}
                isComplete={false}
                rknAttempt={checkStatus.rknAttempt}
                rknMaxAttempts={checkStatus.rknMaxAttempts}
              />
              <p className="text-xs text-center text-muted-foreground">
                Пожалуйста, подождите. Проверка занимает около 30 секунд.
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
                siteType={result.siteType}
                fullReportPrice={result.fullReportPrice}
                isDownloading={isDownloading}
                isPurchasing={isPurchasing}
              />
            ) : (
              <div className="space-y-5">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className={`text-4xl font-bold mb-2 ${
                    getScoreColor(result.scorePercent) === "green" 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : getScoreColor(result.scorePercent) === "yellow" 
                        ? "text-amber-600 dark:text-amber-400" 
                        : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {result.scorePercent}%
                  </div>
                  <p className={`text-sm font-medium ${
                    getScoreColor(result.scorePercent) === "green" 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : getScoreColor(result.scorePercent) === "yellow" 
                        ? "text-amber-600 dark:text-amber-400" 
                        : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {getScoreLabel(result.scorePercent)}
                  </p>
                </div>

                <SemaphoreProgress 
                  criterionIndex={AUDIT_CRITERIA.length - 1}
                  passedCount={result.passedCount}
                  warningCount={result.warningCount}
                  failedCount={result.failedCount}
                  isComplete={true}
                  finalScore={result.scorePercent}
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

                {result.siteType && (
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Тип сайта</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-medium">{result.siteType.name}</span>
                        <p className="text-xs text-muted-foreground">{result.siteType.description}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {result.siteType.confidence === "high" ? "Уверенно" : 
                         result.siteType.confidence === "medium" ? "Вероятно" : "Приблизительно"}
                      </Badge>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-4">
                  <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        <span className="font-semibold">Полный PDF отчёт</span>
                      </div>
                      <span className="text-2xl font-bold text-primary">{result.fullReportPrice || 900} ₽</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        Детальный разбор каждого нарушения
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        Размер штрафов и ссылки на законы
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        Пошаговые рекомендации по исправлению
                      </li>
                    </ul>
                    <Button 
                      className="w-full" 
                      size="lg" 
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
                          Купить за {result.fullReportPrice || 900} ₽
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Полный аудит + документы</span>
                      <span className="text-sm text-muted-foreground">
                        от {result.siteType?.baseAuditPrice?.toLocaleString('ru-RU') || "4 900"} ₽
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Глубокий анализ + готовые документы для вашего сайта
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="w-full" 
                      asChild
                    >
                      <Link href="/full-audit">
                        Подробнее
                        <ArrowRight className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={resetCheck}
                    data-testid="button-reset-check"
                  >
                    Проверить другой сайт
                  </Button>
                </div>
              </div>
            )
          ) : (
            <>
              <Collapsible defaultOpen={false}>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between gap-2 font-medium text-emerald-700 dark:text-emerald-400">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 shrink-0" />
                        <span className="text-sm sm:text-base">9 критериев проверки</span>
                      </div>
                      <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3 text-xs sm:text-sm text-muted-foreground">
                      {AUDIT_CRITERIA.map((criterion) => (
                        <div key={criterion.id} className="flex items-center gap-1.5 py-0.5">
                          <criterion.icon className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="truncate">{criterion.name}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <URLInput 
                value={websiteUrl} 
                onChange={setWebsiteUrl}
              />

              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="privacy-consent-express"
                    checked={privacyConsent}
                    onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
                    disabled={isChecking}
                    data-testid="checkbox-privacy-consent-express"
                  />
                  <label
                    htmlFor="privacy-consent-express"
                    className="text-xs leading-tight cursor-pointer text-muted-foreground"
                  >
                    Я ознакомлен с{" "}
                    <Link href="/privacy-policy" className="text-primary hover:underline">
                      политикой конфиденциальности
                    </Link>
                  </label>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="pdn-consent-express"
                    checked={pdnConsent}
                    onCheckedChange={(checked) => setPdnConsent(checked === true)}
                    disabled={isChecking}
                    data-testid="checkbox-pdn-consent-express"
                  />
                  <label
                    htmlFor="pdn-consent-express"
                    className="text-xs leading-tight cursor-pointer text-muted-foreground"
                  >
                    Даю{" "}
                    <Link href="/personal-data-agreement" className="text-primary hover:underline">
                      согласие на обработку персональных данных
                    </Link>
                  </label>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="offer-consent-express"
                    checked={offerConsent}
                    onCheckedChange={(checked) => setOfferConsent(checked === true)}
                    disabled={isChecking}
                    data-testid="checkbox-offer-consent-express"
                  />
                  <label
                    htmlFor="offer-consent-express"
                    className="text-xs leading-tight cursor-pointer text-muted-foreground"
                  >
                    Принимаю условия{" "}
                    <Link href="/offer" className="text-primary hover:underline">
                      договора оферты
                    </Link>
                  </label>
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={runExpressCheck}
                disabled={!websiteUrl || isChecking || !privacyConsent || !pdnConsent || !offerConsent}
                data-testid="button-start-express-check"
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

              <p className="text-xs text-center text-muted-foreground">
                Бесплатно. Без регистрации. Результат за 30 секунд.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showInnModal} onOpenChange={setShowInnModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Проверка в реестре РКН</DialogTitle>
            <DialogDescription>
              ИНН организации не обнаружен на сайте. Введите ИНН для проверки регистрации в качестве оператора персональных данных.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Введите ИНН (10 или 12 цифр)"
              value={innInput}
              onChange={(e) => setInnInput(e.target.value.replace(/\D/g, "").slice(0, 12))}
              maxLength={12}
              data-testid="input-inn"
            />
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
              <p>ИНН можно найти:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>В подвале сайта (реквизиты)</li>
                <li>На странице «О компании» или «Контакты»</li>
                <li>В публичной оферте или договоре</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="ghost" 
              onClick={() => {
                setResult((prev) => prev ? {
                  ...prev,
                  rknCheck: {
                    status: "not_checked",
                    confidence: "none",
                    used: "manual",
                    query: {},
                    details: "Проверка пропущена. Требуется ручная проверка в реестре РКН.",
                    needsCompanyDetails: false,
                    evidence: {},
                  },
                } : null);
                setShowInnModal(false);
                toast({
                  title: "Проверка пропущена",
                  description: "Отчёт отмечен как требующий ручной проверки в реестре РКН",
                });
              }}
              data-testid="button-skip-inn"
            >
              Пропустить
            </Button>
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
    </>
  );
}
