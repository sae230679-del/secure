import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, CreditCard, CheckCircle, XCircle, Eye, EyeOff, TestTube, AlertTriangle, Bug, ChevronDown, RefreshCw, Wallet } from "lucide-react";

type SystemSetting = {
  id: number;
  key: string;
  value: string;
  updatedAt: string;
};

type YookassaDiagnostics = {
  lastPayload: any;
  lastResponse: {
    statusCode: number;
    body: any;
  } | null;
  hasData: boolean;
};

export default function SuperAdminPaymentSettingsPage() {
  const { toast } = useToast();
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const { data: settings, isLoading } = useQuery<SystemSetting[]>({
    queryKey: ["/api/superadmin/settings"],
  });

  const { data: diagnostics, refetch: refetchDiagnostics } = useQuery<YookassaDiagnostics>({
    queryKey: ["/api/superadmin/yookassa-diagnostics"],
    enabled: diagnosticsOpen,
  });

  const [showRobokassaPass1, setShowRobokassaPass1] = useState(false);
  const [showRobokassaPass2, setShowRobokassaPass2] = useState(false);

  const [formData, setFormData] = useState({
    yookassa_shop_id: "",
    yookassa_secret_key: "",
    yookassa_enabled: "false",
    yookassa_test_mode: "true",
    robokassa_merchant_login: "",
    robokassa_password1: "",
    robokassa_password2: "",
    robokassa_enabled: "false",
    robokassa_test_mode: "true",
  });

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(prev => {
        const updated = { ...prev };
        settings.forEach((setting) => {
          if (setting.key in updated) {
            (updated as any)[setting.key] = setting.value;
          }
        });
        return updated;
      });
      setIsHydrated(true);
    }
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await apiRequest("PUT", `/api/superadmin/settings/${key}`, { value });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/superadmin/test-yookassa");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Подключение успешно",
        description: data.message || "ЮKassa API доступен",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка подключения",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveAll = async () => {
    try {
      await Promise.all(
        Object.entries(formData).map(([key, value]) =>
          updateSettingMutation.mutateAsync({ key, value })
        )
      );
      toast({
        title: "Настройки сохранены",
        description: "Все изменения успешно применены.",
      });
    } catch (error) {
    }
  };

  const handleToggleEnabled = (checked: boolean) => {
    setFormData(prev => ({ ...prev, yookassa_enabled: checked ? "true" : "false" }));
  };

  const handleToggleTestMode = (checked: boolean) => {
    setFormData(prev => ({ ...prev, yookassa_test_mode: checked ? "true" : "false" }));
  };

  const isYookassaConfigured = formData.yookassa_shop_id && formData.yookassa_secret_key;
  const isYookassaEnabled = formData.yookassa_enabled === "true";
  const isYookassaTestMode = formData.yookassa_test_mode === "true";

  const isRobokassaConfigured = formData.robokassa_merchant_login && formData.robokassa_password1 && formData.robokassa_password2;
  const isRobokassaEnabled = formData.robokassa_enabled === "true";
  const isRobokassaTestMode = formData.robokassa_test_mode === "true";

  const handleToggleRobokassaEnabled = (checked: boolean) => {
    setFormData(prev => ({ ...prev, robokassa_enabled: checked ? "true" : "false" }));
  };

  const handleToggleRobokassaTestMode = (checked: boolean) => {
    setFormData(prev => ({ ...prev, robokassa_test_mode: checked ? "true" : "false" }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Настройки платежей</h1>
          <p className="text-muted-foreground mt-1">
            Интеграция с платежными системами
          </p>
        </div>
        <Button 
          onClick={handleSaveAll} 
          disabled={updateSettingMutation.isPending || !isHydrated}
          data-testid="button-save-all"
        >
          <Save className="h-4 w-4 mr-2" />
          Сохранить все
        </Button>
      </div>

      <Tabs defaultValue="yookassa" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="yookassa" data-testid="tab-yookassa">
            <CreditCard className="h-4 w-4 mr-2" />
            ЮKassa
          </TabsTrigger>
          <TabsTrigger value="robokassa" data-testid="tab-robokassa">
            <Wallet className="h-4 w-4 mr-2" />
            Robokassa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="yookassa" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>Статус ЮKassa</CardTitle>
                {isYookassaConfigured && isYookassaEnabled ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Активна
                  </Badge>
                ) : isYookassaConfigured ? (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Отключена
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Не настроена
                  </Badge>
                )}
                {isYookassaTestMode && isYookassaConfigured && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                    <TestTube className="h-3 w-3 mr-1" />
                    Тестовый режим
                  </Badge>
                )}
              </div>
              <CardDescription>
                {isYookassaConfigured && isYookassaEnabled
                  ? "Платежная система подключена и готова к приему платежей."
                  : isYookassaConfigured
                    ? "API ключи настроены, но прием платежей отключен."
                    : "Введите Shop ID и секретный ключ из личного кабинета ЮKassa."}
              </CardDescription>
            </CardHeader>
          </Card>

        <Card>
          <CardHeader>
            <CardTitle>API ключи ЮKassa</CardTitle>
            <CardDescription>
              Данные для подключения к платежной системе
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="yookassa_shop_id">Shop ID</Label>
              <Input
                id="yookassa_shop_id"
                value={formData.yookassa_shop_id}
                onChange={(e) => setFormData(prev => ({ ...prev, yookassa_shop_id: e.target.value }))}
                placeholder="123456"
                data-testid="input-shop-id"
              />
              <p className="text-xs text-muted-foreground">
                Идентификатор магазина из личного кабинета ЮKassa
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="yookassa_secret_key">Секретный ключ</Label>
              <div className="relative">
                <Input
                  id="yookassa_secret_key"
                  type={showSecretKey ? "text" : "password"}
                  value={formData.yookassa_secret_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, yookassa_secret_key: e.target.value }))}
                  placeholder="live_xxxxxxxxxxxxxxxxxx"
                  data-testid="input-secret-key"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  data-testid="button-toggle-secret"
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Секретный ключ для API авторизации
              </p>
            </div>

            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => testConnectionMutation.mutate()}
                disabled={!isYookassaConfigured || testConnectionMutation.isPending}
                data-testid="button-test-connection"
              >
                <TestTube className="h-4 w-4 mr-2" />
                {testConnectionMutation.isPending ? "Проверка..." : "Проверить подключение"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Режим работы</CardTitle>
            <CardDescription>
              Управление приемом платежей
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Прием платежей</Label>
                <p className="text-sm text-muted-foreground">
                  Включить или отключить прием платежей через ЮKassa
                </p>
              </div>
              <Switch
                checked={isYookassaEnabled}
                onCheckedChange={handleToggleEnabled}
                disabled={!isYookassaConfigured}
                data-testid="switch-enabled"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Тестовый режим</Label>
                <p className="text-sm text-muted-foreground">
                  Используйте тестовые ключи для проверки интеграции
                </p>
              </div>
              <Switch
                checked={isYookassaTestMode}
                onCheckedChange={handleToggleTestMode}
                data-testid="switch-test-mode"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Способы оплаты</CardTitle>
            <CardDescription>
              Поддерживаемые способы оплаты через ЮKassa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-3 border rounded-md">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 via-blue-500 to-green-500 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">СБП</span>
                </div>
                <div>
                  <p className="text-sm font-medium">СБП</p>
                  <p className="text-xs text-green-600">0% комиссии</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 border rounded-md">
                <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">S</span>
                </div>
                <div>
                  <p className="text-sm font-medium">SberPay</p>
                  <p className="text-xs text-muted-foreground">2.8%</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 border rounded-md">
                <div className="w-8 h-8 bg-yellow-400 rounded flex items-center justify-center">
                  <span className="text-black text-xs font-bold">T</span>
                </div>
                <div>
                  <p className="text-sm font-medium">T-Pay</p>
                  <p className="text-xs text-muted-foreground">3.8%</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 border rounded-md">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-400 via-blue-600 to-green-500 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">Mir</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Mir Pay</p>
                  <p className="text-xs text-muted-foreground">2.8%</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 border rounded-md">
                <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">Ю</span>
                </div>
                <div>
                  <p className="text-sm font-medium">ЮMoney</p>
                  <p className="text-xs text-muted-foreground">2.8%</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 border rounded-md">
                <div className="w-8 h-8 bg-green-700 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">B2B</span>
                </div>
                <div>
                  <p className="text-sm font-medium">СберБизнес</p>
                  <p className="text-xs text-muted-foreground">B2B</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook URL</CardTitle>
            <CardDescription>
              URL для получения уведомлений о платежах от ЮKassa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-md">
              <code className="text-sm break-all" data-testid="text-webhook-url">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/yookassa/webhook` : '/api/yookassa/webhook'}
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              Добавьте этот URL в настройках HTTP-уведомлений в личном кабинете ЮKassa.
              Выберите события: payment.succeeded, payment.canceled, refund.succeeded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Инструкция по подключению</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Зарегистрируйтесь в <a href="https://yookassa.ru" target="_blank" rel="noopener noreferrer" className="text-primary underline">ЮKassa</a> и создайте магазин</li>
              <li>В личном кабинете ЮKassa перейдите в раздел "Интеграция" -&gt; "Ключи API"</li>
              <li>Скопируйте Shop ID и создайте секретный ключ</li>
              <li>Вставьте данные в форму выше и сохраните</li>
              <li>Добавьте Webhook URL в настройках ЮKassa</li>
              <li>Проверьте подключение и включите прием платежей</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <Bug className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Диагностика ЮKassa</CardTitle>
            </div>
            <CardDescription>
              Последний запрос и ответ API для отладки
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Collapsible open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
              <div className="flex items-center gap-2 flex-wrap">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-toggle-diagnostics">
                    <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${diagnosticsOpen ? "rotate-180" : ""}`} />
                    {diagnosticsOpen ? "Скрыть" : "Показать диагностику"}
                  </Button>
                </CollapsibleTrigger>
                {diagnosticsOpen && (
                  <Button variant="ghost" size="sm" onClick={() => refetchDiagnostics()} data-testid="button-refresh-diagnostics">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Обновить
                  </Button>
                )}
              </div>
              <CollapsibleContent className="mt-4 space-y-4">
                {diagnostics?.hasData ? (
                  <>
                    {diagnostics.lastResponse && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Label>Последний ответ API</Label>
                          {diagnostics.lastResponse.statusCode === 200 ? (
                            <Badge variant="default" className="bg-green-600">HTTP 200</Badge>
                          ) : (
                            <Badge variant="destructive">HTTP {diagnostics.lastResponse.statusCode}</Badge>
                          )}
                        </div>
                        <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto max-h-64 overflow-y-auto" data-testid="text-last-response">
                          {JSON.stringify(diagnostics.lastResponse.body, null, 2)}
                        </pre>
                      </div>
                    )}
                    {diagnostics.lastPayload && (
                      <div className="space-y-2">
                        <Label>Последний запрос (payload)</Label>
                        <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto max-h-64 overflow-y-auto" data-testid="text-last-payload">
                          {JSON.stringify(diagnostics.lastPayload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Пока нет данных диагностики. Данные появятся после первой попытки оплаты.
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="robokassa" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Wallet className="h-5 w-5 text-primary" />
                <CardTitle>Статус Robokassa</CardTitle>
                {isRobokassaConfigured && isRobokassaEnabled ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Активна
                  </Badge>
                ) : isRobokassaConfigured ? (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Отключена
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Не настроена
                  </Badge>
                )}
                {isRobokassaTestMode && isRobokassaConfigured && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                    <TestTube className="h-3 w-3 mr-1" />
                    Тестовый режим
                  </Badge>
                )}
              </div>
              <CardDescription>
                {isRobokassaConfigured && isRobokassaEnabled
                  ? "Платежная система подключена и готова к приему платежей."
                  : isRobokassaConfigured
                    ? "Данные настроены, но прием платежей отключен."
                    : "Введите логин и пароли из личного кабинета Robokassa."}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API ключи Robokassa</CardTitle>
              <CardDescription>
                Данные для подключения к платежной системе
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="robokassa_merchant_login">Логин магазина (MerchantLogin)</Label>
                <Input
                  id="robokassa_merchant_login"
                  value={formData.robokassa_merchant_login}
                  onChange={(e) => setFormData(prev => ({ ...prev, robokassa_merchant_login: e.target.value }))}
                  placeholder="myshop"
                  data-testid="input-robokassa-login"
                />
                <p className="text-xs text-muted-foreground">
                  Идентификатор магазина из личного кабинета Robokassa
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="robokassa_password1">Пароль 1 (Password #1)</Label>
                <div className="relative">
                  <Input
                    id="robokassa_password1"
                    type={showRobokassaPass1 ? "text" : "password"}
                    value={formData.robokassa_password1}
                    onChange={(e) => setFormData(prev => ({ ...prev, robokassa_password1: e.target.value }))}
                    placeholder="xxxxxxxxxxxxxxxx"
                    data-testid="input-robokassa-pass1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowRobokassaPass1(!showRobokassaPass1)}
                    data-testid="button-toggle-robokassa-pass1"
                  >
                    {showRobokassaPass1 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Пароль для формирования подписи при отправке запросов
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="robokassa_password2">Пароль 2 (Password #2)</Label>
                <div className="relative">
                  <Input
                    id="robokassa_password2"
                    type={showRobokassaPass2 ? "text" : "password"}
                    value={formData.robokassa_password2}
                    onChange={(e) => setFormData(prev => ({ ...prev, robokassa_password2: e.target.value }))}
                    placeholder="xxxxxxxxxxxxxxxx"
                    data-testid="input-robokassa-pass2"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowRobokassaPass2(!showRobokassaPass2)}
                    data-testid="button-toggle-robokassa-pass2"
                  >
                    {showRobokassaPass2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Пароль для проверки подписи в уведомлениях от Robokassa
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Режим работы</CardTitle>
              <CardDescription>
                Управление приемом платежей через Robokassa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Прием платежей</Label>
                  <p className="text-sm text-muted-foreground">
                    Включить или отключить прием платежей через Robokassa
                  </p>
                </div>
                <Switch
                  checked={isRobokassaEnabled}
                  onCheckedChange={handleToggleRobokassaEnabled}
                  disabled={!isRobokassaConfigured}
                  data-testid="switch-robokassa-enabled"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Тестовый режим</Label>
                  <p className="text-sm text-muted-foreground">
                    Использовать тестовый сервер Robokassa
                  </p>
                </div>
                <Switch
                  checked={isRobokassaTestMode}
                  onCheckedChange={handleToggleRobokassaTestMode}
                  data-testid="switch-robokassa-test-mode"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Result URL и Callback URL</CardTitle>
              <CardDescription>
                URL для получения уведомлений о платежах
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Result URL (серверный callback)</Label>
                <div className="bg-muted p-4 rounded-md">
                  <code className="text-sm break-all" data-testid="text-robokassa-result-url">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/robokassa/result` : '/api/robokassa/result'}
                  </code>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Success URL (успешная оплата)</Label>
                <div className="bg-muted p-4 rounded-md">
                  <code className="text-sm break-all" data-testid="text-robokassa-success-url">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/robokassa/success` : '/api/robokassa/success'}
                  </code>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fail URL (ошибка оплаты)</Label>
                <div className="bg-muted p-4 rounded-md">
                  <code className="text-sm break-all" data-testid="text-robokassa-fail-url">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/robokassa/fail` : '/api/robokassa/fail'}
                  </code>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Добавьте эти URL в настройках магазина в личном кабинете Robokassa.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Инструкция по подключению</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Зарегистрируйтесь в <a href="https://robokassa.ru" target="_blank" rel="noopener noreferrer" className="text-primary underline">Robokassa</a> и создайте магазин</li>
                <li>В личном кабинете Robokassa перейдите в раздел "Технические настройки"</li>
                <li>Скопируйте логин магазина, Пароль 1 и Пароль 2</li>
                <li>Вставьте данные в форму выше и сохраните</li>
                <li>Добавьте Result URL и Success/Fail URL в настройках магазина</li>
                <li>Включите прием платежей</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
