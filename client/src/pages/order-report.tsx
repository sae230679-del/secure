import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Shield,
  Globe,
  AlertCircle,
  AlertTriangle,
  Mail,
  Phone,
  User,
  Building2,
  MessageCircle,
  Clock,
  Send,
  XCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AuditProgressBar } from "@/components/progress-bar";

interface SiteTypeInfo {
  type: string;
  name: string;
  description: string;
  baseAuditPrice: number;
  confidence: "high" | "medium" | "low";
  signals: string[];
}

interface ExpressCheckResult {
  token: string;
  status: string;
  websiteUrl: string;
  scorePercent: number;
  severity: string;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  siteType?: SiteTypeInfo | null;
  fullReportPrice?: number;
}

export default function OrderReportPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");
  const orderType = urlParams.get("type") || "express";
  const urlFromParam = urlParams.get("url") || "";
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    socialNetwork: "",
    messengerContact: "",
    email: "",
    websiteUrl: urlFromParam,
    inn: "",
    isPhysicalPerson: false,
  });
  const [consents, setConsents] = useState({
    pdn: false,
    offer: false,
  });
  const [innCheckResult, setInnCheckResult] = useState<{
    status: "idle" | "checking" | "found" | "not_found" | "error" | "needs_manual";
    message?: string;
    companyName?: string;
  }>({ status: "idle" });

  const checkInnInRegistry = useCallback(async (inn: string) => {
    if (!inn || inn.length < 10) {
      setInnCheckResult({ status: "idle" });
      return;
    }
    
    const cleanedInn = inn.replace(/\D/g, "");
    if (cleanedInn.length !== 10 && cleanedInn.length !== 12) {
      setInnCheckResult({ status: "idle" });
      return;
    }
    
    setInnCheckResult({ status: "checking" });
    
    try {
      const response = await fetch("/api/public/check-inn-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn: cleanedInn }),
      });
      
      const data = await response.json();
      
      if (data.found === true) {
        setInnCheckResult({ 
          status: "found", 
          companyName: data.companyName,
          message: `Найден в реестре: ${data.companyName || "Оператор зарегистрирован"}` 
        });
      } else if (data.found === false) {
        setInnCheckResult({ 
          status: "not_found", 
          message: "Организация НЕ найдена в реестре операторов персональных данных Роскомнадзора. Это критическое нарушение ФЗ-152!" 
        });
      } else if (data.found === null) {
        setInnCheckResult({ 
          status: "needs_manual", 
          message: "Требуется ручная проверка на сайте pd.rkn.gov.ru" 
        });
      } else {
        setInnCheckResult({ status: "idle" });
      }
    } catch (error) {
      setInnCheckResult({ 
        status: "error", 
        message: "Не удалось проверить ИНН в реестре" 
      });
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.inn && !formData.isPhysicalPerson) {
        checkInnInRegistry(formData.inn);
      } else {
        setInnCheckResult({ status: "idle" });
      }
    }, 800);
    
    return () => clearTimeout(timeoutId);
  }, [formData.inn, formData.isPhysicalPerson, checkInnInRegistry]);
  
  const { data: expressCheck, isLoading: checkLoading, error: checkError } = useQuery<ExpressCheckResult>({
    queryKey: ["/api/public/express-check", token],
    queryFn: async () => {
      const response = await fetch(`/api/public/express-check/${token}`);
      if (!response.ok) {
        throw new Error("Проверка не найдена");
      }
      return response.json();
    },
    enabled: !!token && orderType === "express",
  });

  const submitOrderMutation = useMutation({
    mutationFn: async (data: {
      name?: string;
      phone?: string;
      socialNetwork?: string;
      messengerContact?: string;
      email: string;
      websiteUrl: string;
      inn?: string;
      isPhysicalPerson: boolean;
      expressCheckToken?: string;
      orderType: string;
    }) => {
      const response = await apiRequest("POST", "/api/orders/express-report", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка при отправке заявки");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({ 
        title: "Заявка отправлена!", 
        description: "Мы свяжемся с вами в ближайшее время" 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Ошибка", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      toast({
        title: "Укажите E-mail",
        description: "E-mail обязателен для связи",
        variant: "destructive",
      });
      return;
    }

    const websiteUrl = orderType === "express" && expressCheck 
      ? expressCheck.websiteUrl 
      : formData.websiteUrl;

    if (!websiteUrl.trim()) {
      toast({
        title: "Укажите URL сайта",
        description: "URL сайта обязателен",
        variant: "destructive",
      });
      return;
    }

    if (!formData.isPhysicalPerson && !formData.inn.trim()) {
      toast({
        title: "Укажите ИНН",
        description: "Укажите ИНН или отметьте что вы физическое лицо",
        variant: "destructive",
      });
      return;
    }
    
    if (!consents.pdn || !consents.offer) {
      toast({
        title: "Необходимо согласие",
        description: "Пожалуйста, подтвердите согласие с условиями",
        variant: "destructive",
      });
      return;
    }

    await submitOrderMutation.mutateAsync({
      name: formData.name || undefined,
      phone: formData.phone || undefined,
      socialNetwork: formData.socialNetwork || undefined,
      messengerContact: formData.messengerContact || undefined,
      email: formData.email,
      websiteUrl,
      inn: formData.isPhysicalPerson ? undefined : formData.inn || undefined,
      isPhysicalPerson: formData.isPhysicalPerson,
      expressCheckToken: token || undefined,
      orderType,
    });
  };

  const isExpressOrder = orderType === "express";

  if (isExpressOrder && !token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Проверка не найдена</h2>
            <p className="text-muted-foreground mb-4">
              Для заказа отчёта сначала выполните экспресс-проверку сайта
            </p>
            <Button onClick={() => navigate("/")} data-testid="button-go-home">
              На главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpressOrder && checkLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isExpressOrder && (checkError || !expressCheck)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Проверка не найдена</h2>
            <p className="text-muted-foreground mb-4">
              Данная проверка не существует или была удалена
            </p>
            <Button onClick={() => navigate("/")} data-testid="button-go-home">
              На главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpressOrder && expressCheck?.status !== "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Globe className="h-5 w-5 text-primary" />
              <span className="font-medium text-lg break-all">{expressCheck?.websiteUrl}</span>
            </div>
            <Badge variant="secondary" className="mx-auto">
              <Clock className="h-3 w-3 mr-1 animate-spin" />
              Проверяем...
            </Badge>
          </CardHeader>
          <CardContent className="pt-4">
            <AuditProgressBar 
              isProcessing={true} 
              onComplete={() => window.location.reload()}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Заявка отправлена!</h2>
            <p className="text-muted-foreground mb-6">
              {isExpressOrder 
                ? "Полный отчёт будет отправлен на указанный E-mail в течение 24 часов."
                : "Мы свяжемся с вами в ближайшее время для уточнения деталей заказа."
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate("/")} data-testid="button-go-home">
                На главную
              </Button>
              {isExpressOrder && token && (
                <Button onClick={() => navigate(`/express-result/${token}`)} data-testid="button-back-to-result">
                  Вернуться к результатам
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reportPrice = expressCheck?.fullReportPrice || 900;
  const pageTitle = isExpressOrder ? "Заказ полного отчёта" : "Заказ аудита сайта";

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{pageTitle}</h1>
          <p className="text-muted-foreground">
            {isExpressOrder 
              ? "Заполните форму для получения детального анализа"
              : "Закажите полный аудит сайта на соответствие законодательству РФ"
            }
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Информация о заказе
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isExpressOrder && expressCheck && (
                <>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Проверяемый сайт</span>
                    </div>
                    <p className="font-mono text-sm truncate" data-testid="text-website-url">
                      {expressCheck.websiteUrl}
                    </p>
                  </div>

                  {expressCheck.siteType && (
                    <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{expressCheck.siteType.name}</span>
                        <Badge variant="secondary">
                          {expressCheck.siteType.confidence === "high" ? "Уверенно" : 
                           expressCheck.siteType.confidence === "medium" ? "Вероятно" : "Приблизительно"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{expressCheck.siteType.description}</p>
                    </div>
                  )}

                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">Результат проверки</span>
                      <Badge 
                        variant={expressCheck.severity === "low" ? "default" : 
                                 expressCheck.severity === "medium" ? "secondary" : "destructive"}
                      >
                        {expressCheck.scorePercent}%
                      </Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="text-emerald-600">OK: {expressCheck.passedCount}</span>
                      <span className="text-amber-600">Внимание: {expressCheck.warningCount}</span>
                      <span className="text-rose-600">Ошибки: {expressCheck.failedCount}</span>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">
                  {isExpressOrder ? "Что входит в полный отчёт:" : "Что входит в аудит:"}
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Детальный разбор каждого нарушения
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Размер штрафов со ссылками на законы
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Пошаговые рекомендации по исправлению
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                    Отчёт на E-mail в течение 24 часов
                  </li>
                </ul>
              </div>

              {isExpressOrder && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium">Стоимость:</span>
                    <span className="text-2xl font-bold text-primary" data-testid="text-report-price">
                      {reportPrice.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Оплата после получения отчёта или по реквизитам
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Форма заказа
              </CardTitle>
              <CardDescription>
                Заполните контактные данные для оформления заказа
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Имя</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Иван Иванов"
                      className="pl-10"
                      data-testid="input-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+7 (999) 123-45-67"
                      className="pl-10"
                      data-testid="input-phone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="socialNetwork">Соцсеть для связи</Label>
                  <Select
                    value={formData.socialNetwork}
                    onValueChange={(value) => setFormData({ ...formData, socialNetwork: value })}
                  >
                    <SelectTrigger data-testid="select-social-network">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Выберите мессенджер" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telegram">Телеграм</SelectItem>
                      <SelectItem value="whatsapp">Вацап</SelectItem>
                      <SelectItem value="max">Макс</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.socialNetwork && (
                  <div className="space-y-2">
                    <Label htmlFor="messengerContact">
                      Контакт в {formData.socialNetwork === "telegram" ? "Телеграме" : formData.socialNetwork === "whatsapp" ? "Вацапе" : "Максе"}
                    </Label>
                    <div className="relative">
                      <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="messengerContact"
                        type="text"
                        value={formData.messengerContact}
                        onChange={(e) => setFormData({ ...formData, messengerContact: e.target.value })}
                        placeholder={formData.socialNetwork === "telegram" ? "@username или +7..." : formData.socialNetwork === "whatsapp" ? "+7 (999) 123-45-67" : "Ваш контакт"}
                        className="pl-10"
                        data-testid="input-messenger-contact"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Укажите ваш юзернейм, номер телефона или ссылку на профиль
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">
                    E-mail <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      className="pl-10"
                      required
                      data-testid="input-email"
                    />
                  </div>
                </div>

                {!isExpressOrder && (
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">
                      URL сайта <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="websiteUrl"
                        type="url"
                        value={formData.websiteUrl}
                        onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                        placeholder="https://example.ru"
                        className="pl-10"
                        required
                        data-testid="input-website-url"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="isPhysicalPerson"
                      checked={formData.isPhysicalPerson}
                      onCheckedChange={(checked) => setFormData({ 
                        ...formData, 
                        isPhysicalPerson: !!checked,
                        inn: checked ? "" : formData.inn 
                      })}
                      data-testid="checkbox-physical-person"
                    />
                    <Label htmlFor="isPhysicalPerson" className="text-sm leading-tight cursor-pointer">
                      У меня нет ИНН, я физическое лицо
                    </Label>
                  </div>

                  {!formData.isPhysicalPerson && (
                    <div className="space-y-2">
                      <Label htmlFor="inn">
                        ИНН компании/ИП/самозанятого <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="inn"
                          value={formData.inn}
                          onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                          placeholder="1234567890"
                          className="pl-10"
                          maxLength={12}
                          data-testid="input-inn"
                        />
                        {innCheckResult.status === "checking" && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {innCheckResult.status === "found" && (
                          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                        )}
                        {innCheckResult.status === "not_found" && (
                          <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                        )}
                      </div>
                      
                      {innCheckResult.status === "not_found" && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Критическое нарушение ФЗ-152!</AlertTitle>
                          <AlertDescription className="text-sm">
                            {innCheckResult.message}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {innCheckResult.status === "found" && (
                        <p className="text-xs text-emerald-600 mt-1">
                          {innCheckResult.message}
                        </p>
                      )}
                      
                      {innCheckResult.status === "needs_manual" && (
                        <p className="text-xs text-amber-600 mt-1">
                          {innCheckResult.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="pdn"
                      checked={consents.pdn}
                      onCheckedChange={(checked) => setConsents({ ...consents, pdn: !!checked })}
                      data-testid="checkbox-pdn"
                    />
                    <Label htmlFor="pdn" className="text-sm leading-tight cursor-pointer">
                      Даю согласие на{" "}
                      <Link href="/privacy-policy" className="text-primary underline">
                        обработку персональных данных
                      </Link>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="offer"
                      checked={consents.offer}
                      onCheckedChange={(checked) => setConsents({ ...consents, offer: !!checked })}
                      data-testid="checkbox-offer"
                    />
                    <Label htmlFor="offer" className="text-sm leading-tight cursor-pointer">
                      Принимаю условия{" "}
                      <Link href="/offer" className="text-primary underline">
                        публичной оферты
                      </Link>
                    </Label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitOrderMutation.isPending}
                  data-testid="button-submit-order"
                >
                  {submitOrderMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      Отправить заявку
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Card className="inline-block">
            <CardContent className="pt-6 px-8">
              <p className="text-sm text-muted-foreground">
                {isExpressOrder ? (
                  <>
                    Хотите полный аудит с документами?{" "}
                    <Link href="/full-audit" className="text-primary font-medium underline">
                      Узнать подробнее
                    </Link>
                  </>
                ) : (
                  <>
                    Хотите быструю проверку?{" "}
                    <Link href="/" className="text-primary font-medium underline">
                      Экспресс-проверка
                    </Link>
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
