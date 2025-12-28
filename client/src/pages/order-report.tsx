import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
  LogIn,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  User,
  Building2,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");
  const orderType = urlParams.get("type") || "express";
  
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    socialNetwork: "",
    websiteUrl: "",
    inn: "",
    isPhysicalPerson: false,
  });
  const [consents, setConsents] = useState({
    pdn: false,
    offer: false,
  });
  
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

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка входа");
      }
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Вход выполнен", description: "Перенаправляем к оплате..." });
      await handleCreateOrder();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка входа", description: error.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { 
      email: string; 
      password: string; 
      name?: string; 
      phone?: string;
      inn?: string;
    }) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка регистрации");
      }
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Регистрация успешна", description: "Перенаправляем к оплате..." });
      await handleCreateOrder();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка регистрации", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateOrder = async () => {
    setIsCreatingOrder(true);
    try {
      if (orderType === "express" && token) {
        const response = await apiRequest("POST", "/api/express-report/purchase", { token });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Ошибка при создании заказа");
        }
        
        toast({ title: "Заказ создан", description: "Переходим к оплате..." });
        navigate(`/checkout?auditId=${data.auditId}`);
      } else {
        toast({ 
          title: "Заявка принята", 
          description: "Мы свяжемся с вами в ближайшее время для уточнения деталей" 
        });
        navigate("/full-audit?submitted=true");
      }
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось создать заказ",
        variant: "destructive",
      });
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.isPhysicalPerson && !formData.inn.trim() && authMode === "register") {
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
    
    if (authMode === "login") {
      await loginMutation.mutateAsync({
        email: formData.email,
        password: formData.password,
      });
    } else {
      await registerMutation.mutateAsync({
        email: formData.email,
        password: formData.password,
        name: formData.name || undefined,
        phone: formData.phone || undefined,
        inn: formData.isPhysicalPerson ? undefined : formData.inn || undefined,
      });
    }
  };

  useEffect(() => {
    if (user && orderType === "express" && token && !isCreatingOrder && !loginMutation.isPending && !registerMutation.isPending) {
      handleCreateOrder();
    }
  }, []);

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

  if ((isExpressOrder && checkLoading) || authLoading) {
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
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
            <h2 className="text-xl font-semibold mb-2">Проверка выполняется</h2>
            <p className="text-muted-foreground mb-4">
              Дождитесь завершения экспресс-проверки
            </p>
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
              ? "Получите детальный анализ и рекомендации по исправлению"
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
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Отчёт на email в течение 24 часов
                  </li>
                </ul>
              </div>

              {isExpressOrder && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium">Итого к оплате:</span>
                    <span className="text-2xl font-bold text-primary" data-testid="text-report-price">
                      {reportPrice.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {user ? (
                  <>
                    <Shield className="h-5 w-5" />
                    Подтверждение заказа
                  </>
                ) : (
                  <>
                    {authMode === "login" ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                    {authMode === "login" ? "Вход в аккаунт" : "Оформление заказа"}
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {user 
                  ? "Нажмите кнопку для перехода к оплате" 
                  : authMode === "login" 
                    ? "Войдите в существующий аккаунт"
                    : "Заполните форму для оформления заказа"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <p className="text-sm text-muted-foreground">Вы вошли как:</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleCreateOrder}
                    disabled={isCreatingOrder}
                    data-testid="button-proceed-payment"
                  >
                    {isCreatingOrder ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Создание заказа...
                      </>
                    ) : (
                      <>
                        Перейти к оплате
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleAuth} className="space-y-4">
                  {authMode === "register" && (
                    <>
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
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email <span className="text-destructive">*</span>
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

                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Пароль <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Минимум 6 символов"
                        className="pl-10 pr-10"
                        required
                        minLength={6}
                        data-testid="input-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {authMode === "register" && (
                    <>
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
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

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
                    disabled={loginMutation.isPending || registerMutation.isPending}
                    data-testid="button-auth-submit"
                  >
                    {loginMutation.isPending || registerMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {authMode === "login" ? "Вход..." : "Оформление..."}
                      </>
                    ) : (
                      <>
                        {authMode === "login" ? "Войти и оплатить" : "Оформить и оплатить"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-primary underline-offset-4 hover:underline"
                      onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                      data-testid="button-toggle-auth-mode"
                    >
                      {authMode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
                    </Button>
                  </div>
                </form>
              )}
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
