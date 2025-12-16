import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Mail, Send, CheckCircle, XCircle, Eye, EyeOff, RefreshCw, Info, AlertTriangle } from "lucide-react";

interface SmtpStatus {
  configured: boolean;
  enabled: boolean;
  hasPassword: boolean;
  reason?: string;
}

interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  user: string;
  from: string;
  fromName: string;
  replyTo: string;
  hasPassword: boolean;
}

interface EmailSettingsResponse {
  status: SmtpStatus;
  settings: SmtpSettings;
}

export default function SuperAdminEmailSettingsPage() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data, isLoading, refetch } = useQuery<EmailSettingsResponse>({
    queryKey: ["/api/admin/settings/email"],
  });

  const [formData, setFormData] = useState({
    enabled: true,
    host: "mail.securelex.ru",
    port: 465,
    secure: true,
    requireTls: false,
    user: "support@securelex.ru",
    from: "support@securelex.ru",
    fromName: "SecureLex",
    replyTo: "support@securelex.ru",
  });

  useEffect(() => {
    if (data?.settings) {
      setFormData({
        enabled: data.settings.enabled,
        host: data.settings.host,
        port: data.settings.port,
        secure: data.settings.secure,
        requireTls: data.settings.requireTls,
        user: data.settings.user,
        from: data.settings.from,
        fromName: data.settings.fromName,
        replyTo: data.settings.replyTo || "",
      });
    }
  }, [data]);

  const handlePortChange = (portStr: string) => {
    const port = parseInt(portStr);
    setFormData(prev => ({
      ...prev,
      port,
      secure: port === 465,
      requireTls: port === 587,
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...formData };
      if (password.trim()) {
        payload.pass = password;
      }
      const response = await apiRequest("PUT", "/api/admin/settings/email", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/email"] });
      setPassword("");
      toast({
        title: "Настройки сохранены",
        description: "Настройки SMTP успешно обновлены",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/settings/email/verify", {});
      return response.json();
    },
    onSuccess: (result) => {
      setVerifyResult({ success: true, message: "Соединение с SMTP сервером установлено успешно" });
      toast({
        title: "Соединение установлено",
        description: "SMTP сервер доступен",
      });
    },
    onError: (error: Error) => {
      setVerifyResult({ success: false, message: error.message });
      toast({
        title: "Ошибка соединения",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (toEmail: string) => {
      const response = await apiRequest("POST", "/api/admin/settings/email/test", { toEmail });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Тестовое письмо отправлено",
        description: `Проверьте почту ${testEmail}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка отправки",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTestEmail = () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast({
        title: "Введите email",
        description: "Укажите корректный адрес для тестового письма",
        variant: "destructive",
      });
      return;
    }
    testEmailMutation.mutate(testEmail);
  };

  const isConfigured = data?.status?.configured ?? false;
  const hasPassword = data?.settings?.hasPassword ?? false;

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
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Настройки Email / SMTP</h1>
          <p className="text-muted-foreground mt-1">
            Настройка SMTP сервера для отправки email уведомлений
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending}
            data-testid="button-save-all"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Статус Email</CardTitle>
              {isConfigured ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Настроен
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  Не настроен
                </span>
              )}
            </div>
            <CardDescription>
              {isConfigured 
                ? "SMTP сервер настроен. Отправка email уведомлений активна."
                : `Требуется настройка: ${data?.status?.reason || "заполните все поля"}`}
            </CardDescription>
          </CardHeader>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Инструкция по настройке</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p><strong>Рекомендуемые настройки для REG.RU:</strong></p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-2">
              <li><strong>Порт 465 (SSL/TLS)</strong> - рекомендуется, самый надежный</li>
              <li><strong>Порт 587 (STARTTLS)</strong> - альтернатива, если 465 не работает</li>
              <li><strong>Порт 25</strong> - не рекомендуется, часто блокируется</li>
              <li><strong>Логин</strong> - полный email адрес (например, support@securelex.ru)</li>
              <li><strong>Пароль</strong> - пароль от почтового ящика</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Настройки SMTP</CardTitle>
            <CardDescription>
              Параметры подключения к почтовому серверу
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="smtp-enabled">Email включен</Label>
                <p className="text-sm text-muted-foreground">
                  Включить/выключить отправку email уведомлений
                </p>
              </div>
              <Switch
                id="smtp-enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                data-testid="switch-smtp-enabled"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP Хост</Label>
                <Input
                  id="smtp_host"
                  value={formData.host}
                  onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                  placeholder="mail.securelex.ru"
                  data-testid="input-smtp-host"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_port">Порт</Label>
                <Select value={String(formData.port)} onValueChange={handlePortChange}>
                  <SelectTrigger data-testid="select-smtp-port">
                    <SelectValue placeholder="Выберите порт" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="465">465 (SSL/TLS) - рекомендуется</SelectItem>
                    <SelectItem value="587">587 (STARTTLS)</SelectItem>
                    <SelectItem value="25">25 (без шифрования) - не рекомендуется</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label>SSL/TLS</Label>
                  <p className="text-xs text-muted-foreground">Для порта 465</p>
                </div>
                <Switch
                  checked={formData.secure}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, secure: checked }))}
                  data-testid="switch-smtp-secure"
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label>STARTTLS</Label>
                  <p className="text-xs text-muted-foreground">Для порта 587</p>
                </div>
                <Switch
                  checked={formData.requireTls}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requireTls: checked }))}
                  data-testid="switch-smtp-starttls"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_user">Логин (Email)</Label>
              <Input
                id="smtp_user"
                type="email"
                value={formData.user}
                onChange={(e) => setFormData(prev => ({ ...prev, user: e.target.value }))}
                placeholder="support@securelex.ru"
                data-testid="input-smtp-user"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="smtp_pass">Пароль</Label>
                {hasPassword && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Пароль установлен
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  id="smtp_pass"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={hasPassword ? "Оставьте пустым, чтобы не менять" : "Введите пароль от почтового ящика"}
                  data-testid="input-smtp-pass"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_from_name">Имя отправителя</Label>
                <Input
                  id="smtp_from_name"
                  value={formData.fromName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fromName: e.target.value }))}
                  placeholder="SecureLex"
                  data-testid="input-smtp-from-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_from">Email отправителя</Label>
                <Input
                  id="smtp_from"
                  type="email"
                  value={formData.from}
                  onChange={(e) => setFormData(prev => ({ ...prev, from: e.target.value }))}
                  placeholder="support@securelex.ru"
                  data-testid="input-smtp-from"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_reply_to">Reply-To (необязательно)</Label>
              <Input
                id="smtp_reply_to"
                type="email"
                value={formData.replyTo}
                onChange={(e) => setFormData(prev => ({ ...prev, replyTo: e.target.value }))}
                placeholder="support@securelex.ru"
                data-testid="input-smtp-reply-to"
              />
              <p className="text-xs text-muted-foreground">
                Адрес для ответов на письма
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Проверка и тестирование</CardTitle>
            <CardDescription>
              Проверьте соединение и отправьте тестовое письмо
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {verifyResult && (
              <Alert variant={verifyResult.success ? "default" : "destructive"}>
                {verifyResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>{verifyResult.success ? "Успешно" : "Ошибка"}</AlertTitle>
                <AlertDescription>{verifyResult.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4 flex-wrap">
              <Button
                variant="outline"
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending || !isConfigured}
                data-testid="button-verify-connection"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${verifyMutation.isPending ? "animate-spin" : ""}`} />
                {verifyMutation.isPending ? "Проверка..." : "Проверить соединение"}
              </Button>
            </div>

            <div className="border-t pt-4 mt-4">
              <Label className="mb-2 block">Отправить тестовое письмо</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Введите email для теста"
                    data-testid="input-test-email"
                  />
                </div>
                <Button 
                  onClick={handleTestEmail}
                  disabled={testEmailMutation.isPending || !isConfigured}
                  data-testid="button-send-test"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {testEmailMutation.isPending ? "Отправка..." : "Отправить тест"}
                </Button>
              </div>
              {!isConfigured && (
                <p className="text-sm text-muted-foreground mt-2">
                  Сначала сохраните настройки SMTP для тестирования
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
