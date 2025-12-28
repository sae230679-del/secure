import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { URLInput } from "./url-input";
import { PackageSelector } from "./package-selector";
import { PACKAGES_DATA, EXPRESS_PACKAGE, formatPrice, type PackageType } from "@/lib/packages-data";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, Loader2, Zap, FileCheck, ArrowRight, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const auditStages = [
  { name: "Подключение к сайту", duration: 4000 },
  { name: "Анализ SSL-сертификата", duration: 5000 },
  { name: "Проверка cookie-баннера", duration: 5000 },
  { name: "Анализ политики конфиденциальности", duration: 6000 },
  { name: "Проверка форм согласия", duration: 5000 },
  { name: "Анализ контактных данных", duration: 4000 },
  { name: "Финальная проверка", duration: 5000 },
];

type ExpressResult = {
  scorePercent: number;
  severity: string;
  passedCount: number;
  warningCount: number;
  failedCount: number;
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
  const totalStages = auditStages.length;
  const progress = Math.min(100, (stageIndex / totalStages) * 100);

  useEffect(() => {
    let lightIndex = 0;
    const lights: Array<"green" | "yellow" | "red"> = ["green", "yellow", "red"];
    const interval = setInterval(() => {
      lightIndex = (lightIndex + 1) % lights.length;
      setActiveLight(lights[lightIndex]);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const getLightStyles = (light: "green" | "yellow" | "red") => {
    const isActive = activeLight === light;
    const baseColor = { green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-rose-500" }[light];
    return `w-3 h-3 rounded-full transition-all duration-150 ${isActive ? `${baseColor} shadow-lg` : "bg-muted-foreground/20"}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-0.5 p-1.5 rounded-md bg-muted/50">
          <div className={getLightStyles("green")} />
          <div className={getLightStyles("yellow")} />
          <div className={getLightStyles("red")} />
        </div>
        <div className="flex-1 space-y-1">
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{stageIndex < totalStages ? auditStages[stageIndex]?.name : "Завершено"}</span>
            <span className="font-semibold">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>{passedCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span>{warningCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="w-3 h-3 text-rose-500" />
          <span>{failedCount}</span>
        </div>
      </div>
    </div>
  );
}

export function AuditForm() {
  const [activeTab, setActiveTab] = useState<"quick" | "full">("quick");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [packageType, setPackageType] = useState<PackageType>("landing");
  const [urlError, setUrlError] = useState<string>();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [isExpressChecking, setIsExpressChecking] = useState(false);
  const [expressCheckToken, setExpressCheckToken] = useState<string | null>(null);
  const [expressCheckStatus, setExpressCheckStatus] = useState<{
    stageIndex: number;
    passedCount: number;
    warningCount: number;
    failedCount: number;
  } | null>(null);
  const [expressResult, setExpressResult] = useState<ExpressResult | null>(null);
  const [expressError, setExpressError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [quickPrivacyConsent, setQuickPrivacyConsent] = useState(false);
  const [quickPdnConsent, setQuickPdnConsent] = useState(false);
  const [quickOfferConsent, setQuickOfferConsent] = useState(false);
  const [fullPrivacyConsent, setFullPrivacyConsent] = useState(false);
  const [fullPdnConsent, setFullPdnConsent] = useState(false);
  const [fullOfferConsent, setFullOfferConsent] = useState(false);

  useEffect(() => {
    if (!expressCheckToken || !isExpressChecking) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/public/express-check/${expressCheckToken}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Ошибка проверки");

        setExpressCheckStatus({
          stageIndex: data.stageIndex || 0,
          passedCount: data.passedCount || 0,
          warningCount: data.warningCount || 0,
          failedCount: data.failedCount || 0,
        });

        if (data.status === "completed") {
          setExpressResult({
            scorePercent: data.scorePercent || 0,
            severity: data.severity || "low",
            passedCount: data.passedCount || 0,
            warningCount: data.warningCount || 0,
            failedCount: data.failedCount || 0,
          });
          setIsExpressChecking(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } else if (data.status === "failed") {
          setExpressError("Проверка не удалась. Попробуйте еще раз.");
          setIsExpressChecking(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
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
  }, [expressCheckToken, isExpressChecking]);

  const runExpressCheck = async () => {
    if (!websiteUrl) return;

    setIsExpressChecking(true);
    setExpressResult(null);
    setExpressError(null);
    setExpressCheckStatus(null);

    try {
      const response = await apiRequest("POST", "/api/public/express-check", { websiteUrl });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || "Ошибка при создании проверки");

      setExpressCheckToken(data.token);
      setExpressCheckStatus({ stageIndex: 0, passedCount: 0, warningCount: 0, failedCount: 0 });
    } catch (err: any) {
      setExpressError(err.message || "Произошла ошибка");
      setIsExpressChecking(false);
    }
  };

  const resetExpressCheck = () => {
    setExpressResult(null);
    setExpressCheckToken(null);
    setExpressCheckStatus(null);
    setExpressError(null);
    setWebsiteUrl("");
    setQuickPdnConsent(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handlePurchaseReport = async () => {
    if (!expressCheckToken) return;
    
    setIsPurchasing(true);
    try {
      const response = await apiRequest("POST", "/api/express-report/purchase", { token: expressCheckToken });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || "Ошибка при создании отчета");

      toast({ title: "Отчет создан", description: "Переходим к вашему отчету..." });
      navigate(`/dashboard/audits/${data.auditId}`);
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message || "Не удалось создать отчет", variant: "destructive" });
    } finally {
      setIsPurchasing(false);
    }
  };

  const createAuditMutation = useMutation({
    mutationFn: async (data: { websiteUrl: string; packageType: string }) => {
      const response = await apiRequest("POST", "/api/audits", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/audits"] });
      toast({ title: "Аудит создан", description: "Ваш аудит успешно создан и будет обработан в ближайшее время." });
      navigate(`/dashboard/audits/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message || "Не удалось создать аудит. Попробуйте снова.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl.trim()) {
      setUrlError("Введите URL сайта");
      return;
    }
    const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
    if (!urlPattern.test(websiteUrl)) {
      setUrlError("Неверный формат URL");
      return;
    }
    setUrlError(undefined);
    createAuditMutation.mutate({ websiteUrl, packageType });
  };

  const selectedPackage = PACKAGES_DATA[packageType];

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Проверка сайта
        </CardTitle>
        <CardDescription>
          Выберите подходящий вариант проверки
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "quick" | "full")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 relative">
            <TabsTrigger value="quick" className="flex items-center gap-1.5" data-testid="tab-quick-check-dashboard">
              <Zap className="w-4 h-4" />
              Быстрая
            </TabsTrigger>
            <TabsTrigger value="full" className="flex items-center gap-1.5 relative" data-testid="tab-full-audit-dashboard">
              <FileCheck className="w-4 h-4" />
              Полный аудит
              <span className="absolute -top-3 -right-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full text-white animate-traffic-light">
                ТОП
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-4 mt-0">
            {expressError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                {expressError}
              </div>
            )}

            {isExpressChecking && expressCheckStatus ? (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-sm text-muted-foreground">Проверяем сайт</p>
                  <p className="font-medium text-sm truncate">{websiteUrl}</p>
                </div>
                <ExpressProgressBar 
                  stageIndex={expressCheckStatus.stageIndex}
                  passedCount={expressCheckStatus.passedCount}
                  warningCount={expressCheckStatus.warningCount}
                  failedCount={expressCheckStatus.failedCount}
                />
                <p className="text-xs text-center text-muted-foreground">
                  Проверка занимает около 35 секунд
                </p>
              </div>
            ) : expressResult ? (
              <div className="space-y-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold mb-1">{expressResult.scorePercent}%</div>
                  <div className="text-sm text-muted-foreground">Уровень соответствия</div>
                </div>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{expressResult.passedCount} ок</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{expressResult.warningCount} внимание</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-600">
                    <XCircle className="w-4 h-4" />
                    <span>{expressResult.failedCount} ошибок</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Полный отчёт</span>
                    <span className="text-xl font-bold text-primary">{formatPrice(EXPRESS_PACKAGE.price)}</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                      Детальный разбор каждого нарушения
                    </li>
                    <li className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                      Размер штрафов и ссылки на законы
                    </li>
                    <li className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                      Пошаговые рекомендации
                    </li>
                  </ul>
                  <Button className="w-full" onClick={handlePurchaseReport} disabled={isPurchasing} data-testid="button-purchase-report-dashboard">
                    {isPurchasing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Создание...</>
                    ) : (
                      <>Купить отчёт за {formatPrice(EXPRESS_PACKAGE.price)}</>
                    )}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={resetExpressCheck}>
                  Проверить другой сайт
                </Button>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
                  <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                    <Zap className="w-4 h-4" />
                    Бесплатная экспресс-проверка
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Быстрый анализ основных требований. После проверки можно купить полный отчёт за {formatPrice(EXPRESS_PACKAGE.price)}
                  </p>
                </div>
                <URLInput value={websiteUrl} onChange={setWebsiteUrl} error={urlError} />
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="privacy-consent-quick"
                      checked={quickPrivacyConsent}
                      onCheckedChange={(checked) => setQuickPrivacyConsent(checked === true)}
                      disabled={isExpressChecking}
                      data-testid="checkbox-privacy-consent-quick"
                    />
                    <label
                      htmlFor="privacy-consent-quick"
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
                      id="pdn-consent-quick"
                      checked={quickPdnConsent}
                      onCheckedChange={(checked) => setQuickPdnConsent(checked === true)}
                      disabled={isExpressChecking}
                      data-testid="checkbox-pdn-consent-quick"
                    />
                    <label
                      htmlFor="pdn-consent-quick"
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
                      id="offer-consent-quick"
                      checked={quickOfferConsent}
                      onCheckedChange={(checked) => setQuickOfferConsent(checked === true)}
                      disabled={isExpressChecking}
                      data-testid="checkbox-offer-consent-quick"
                    />
                    <label
                      htmlFor="offer-consent-quick"
                      className="text-xs leading-tight cursor-pointer text-muted-foreground"
                    >
                      Принимаю условия{" "}
                      <Link href="/offer" className="text-primary hover:underline">
                        договора оферты
                      </Link>
                    </label>
                  </div>
                </div>
                <Button className="w-full" size="lg" onClick={runExpressCheck} disabled={!websiteUrl || isExpressChecking || !quickPrivacyConsent || !quickPdnConsent || !quickOfferConsent} data-testid="button-run-express-dashboard">
                  {isExpressChecking ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Проверка...</>
                  ) : (
                    <>Проверить бесплатно<ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="full" className="space-y-4 mt-0">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
              <div className="flex items-center gap-2 font-medium mb-1">
                <FileCheck className="w-4 h-4 text-primary" />
                Полный аудит + документы
              </div>
              <p className="text-xs text-muted-foreground">
                Глубокий анализ по 60+ критериям + готовые документы для вашего сайта
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <URLInput value={websiteUrl} onChange={setWebsiteUrl} error={urlError} disabled={createAuditMutation.isPending} />
              <PackageSelector value={packageType} onChange={setPackageType} disabled={createAuditMutation.isPending} />
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="privacy-consent-full"
                    checked={fullPrivacyConsent}
                    onCheckedChange={(checked) => setFullPrivacyConsent(checked === true)}
                    disabled={createAuditMutation.isPending}
                    data-testid="checkbox-privacy-consent-full"
                  />
                  <label
                    htmlFor="privacy-consent-full"
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
                    id="pdn-consent-full"
                    checked={fullPdnConsent}
                    onCheckedChange={(checked) => setFullPdnConsent(checked === true)}
                    disabled={createAuditMutation.isPending}
                    data-testid="checkbox-pdn-consent-full"
                  />
                  <label
                    htmlFor="pdn-consent-full"
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
                    id="offer-consent-full"
                    checked={fullOfferConsent}
                    onCheckedChange={(checked) => setFullOfferConsent(checked === true)}
                    disabled={createAuditMutation.isPending}
                    data-testid="checkbox-offer-consent-full"
                  />
                  <label
                    htmlFor="offer-consent-full"
                    className="text-xs leading-tight cursor-pointer text-muted-foreground"
                  >
                    Принимаю условия{" "}
                    <Link href="/offer" className="text-primary hover:underline">
                      договора оферты
                    </Link>
                  </label>
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={createAuditMutation.isPending || !fullPrivacyConsent || !fullPdnConsent || !fullOfferConsent} data-testid="button-start-audit">
                {createAuditMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Создание аудита...</>
                ) : (
                  <>Начать проверку за {formatPrice(selectedPackage.price)}</>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
