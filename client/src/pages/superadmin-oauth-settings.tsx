import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, EyeOff, Info, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { SiVk } from "react-icons/si";

interface OAuthProviderSettings {
  id?: number;
  provider: string;
  enabled: boolean;
  clientId: string | null;
  clientSecret: string | null;
  hasSecret: boolean;
  updatedAt?: string;
}

export default function SuperAdminOAuthSettingsPage() {
  const { toast } = useToast();
  const [showVkSecret, setShowVkSecret] = useState(false);
  const [showYandexSecret, setShowYandexSecret] = useState(false);

  const [vkForm, setVkForm] = useState({
    enabled: false,
    clientId: "",
    clientSecret: "",
  });

  const [yandexForm, setYandexForm] = useState({
    enabled: false,
    clientId: "",
    clientSecret: "",
  });

  const { data: oauthSettings, isLoading } = useQuery<OAuthProviderSettings[]>({
    queryKey: ["/api/admin/settings/oauth"],
  });

  const { data: oauthStatus } = useQuery<{ vk: boolean; yandex: boolean }>({
    queryKey: ["/api/oauth/status"],
  });

  useEffect(() => {
    if (oauthSettings) {
      const vkSetting = oauthSettings.find(s => s.provider === "vk");
      const yandexSetting = oauthSettings.find(s => s.provider === "yandex");

      if (vkSetting) {
        setVkForm({
          enabled: vkSetting.enabled,
          clientId: vkSetting.clientId || "",
          clientSecret: "",
        });
      }

      if (yandexSetting) {
        setYandexForm({
          enabled: yandexSetting.enabled,
          clientId: yandexSetting.clientId || "",
          clientSecret: "",
        });
      }
    }
  }, [oauthSettings]);

  const saveVkMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        enabled: vkForm.enabled,
        clientId: vkForm.clientId,
      };
      if (vkForm.clientSecret.trim()) {
        payload.clientSecret = vkForm.clientSecret;
      }
      const response = await apiRequest("PUT", "/api/admin/settings/oauth/vk", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/oauth"] });
      queryClient.invalidateQueries({ queryKey: ["/api/oauth/status"] });
      setVkForm(prev => ({ ...prev, clientSecret: "" }));
      toast({
        title: "Настройки сохранены",
        description: "Настройки авторизации ВКонтакте обновлены",
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

  const saveYandexMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        enabled: yandexForm.enabled,
        clientId: yandexForm.clientId,
      };
      if (yandexForm.clientSecret.trim()) {
        payload.clientSecret = yandexForm.clientSecret;
      }
      const response = await apiRequest("PUT", "/api/admin/settings/oauth/yandex", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/oauth"] });
      queryClient.invalidateQueries({ queryKey: ["/api/oauth/status"] });
      setYandexForm(prev => ({ ...prev, clientSecret: "" }));
      toast({
        title: "Настройки сохранены",
        description: "Настройки авторизации Яндекс обновлены",
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

  const vkSetting = oauthSettings?.find(s => s.provider === "vk");
  const yandexSetting = oauthSettings?.find(s => s.provider === "yandex");

  if (isLoading) {
    return (
      <div className="container py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-oauth-title">Настройки OAuth авторизации</h1>
        <p className="text-muted-foreground">
          Управление входом через социальные сети
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Callback URL для настройки OAuth</AlertTitle>
        <AlertDescription className="space-y-1">
          <p><strong>ВКонтакте:</strong> https://securelex.ru/api/oauth/vk/callback</p>
          <p><strong>Яндекс:</strong> https://securelex.ru/api/oauth/yandex/callback</p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <SiVk className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle>ВКонтакте</CardTitle>
                  <CardDescription>vk.com/apps</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {oauthStatus?.vk ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="vk-enabled">Включить авторизацию</Label>
              <Switch
                id="vk-enabled"
                checked={vkForm.enabled}
                onCheckedChange={(checked) => setVkForm(prev => ({ ...prev, enabled: checked }))}
                data-testid="switch-vk-enabled"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vk-client-id">ID приложения (App ID)</Label>
              <Input
                id="vk-client-id"
                value={vkForm.clientId}
                onChange={(e) => setVkForm(prev => ({ ...prev, clientId: e.target.value }))}
                placeholder="12345678"
                data-testid="input-vk-client-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vk-client-secret">
                Защищённый ключ (Secret Key)
                {vkSetting?.hasSecret && (
                  <span className="text-xs text-muted-foreground ml-2">(сохранён)</span>
                )}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="vk-client-secret"
                    type={showVkSecret ? "text" : "password"}
                    value={vkForm.clientSecret}
                    onChange={(e) => setVkForm(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder={vkSetting?.hasSecret ? "Оставьте пустым, чтобы сохранить текущий" : "Введите ключ"}
                    data-testid="input-vk-client-secret"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowVkSecret(!showVkSecret)}
                  data-testid="button-toggle-vk-secret"
                >
                  {showVkSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => saveVkMutation.mutate()}
                disabled={saveVkMutation.isPending}
                className="flex-1"
                data-testid="button-save-vk"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveVkMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
              <Button
                variant="outline"
                asChild
              >
                <a href="https://vk.com/apps?act=manage" target="_blank" rel="noopener noreferrer" data-testid="link-vk-console">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Консоль VK
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <svg className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm10.7-4.3l-3.4 8.6h1.8l.6-1.6h3.6l.6 1.6h1.8l-3.4-8.6h-1.6zm.8 2.1l1.2 3.3h-2.4l1.2-3.3z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle>Яндекс</CardTitle>
                  <CardDescription>oauth.yandex.ru</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {oauthStatus?.yandex ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="yandex-enabled">Включить авторизацию</Label>
              <Switch
                id="yandex-enabled"
                checked={yandexForm.enabled}
                onCheckedChange={(checked) => setYandexForm(prev => ({ ...prev, enabled: checked }))}
                data-testid="switch-yandex-enabled"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yandex-client-id">Client ID</Label>
              <Input
                id="yandex-client-id"
                value={yandexForm.clientId}
                onChange={(e) => setYandexForm(prev => ({ ...prev, clientId: e.target.value }))}
                placeholder="abc123def456"
                data-testid="input-yandex-client-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yandex-client-secret">
                Client Secret
                {yandexSetting?.hasSecret && (
                  <span className="text-xs text-muted-foreground ml-2">(сохранён)</span>
                )}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="yandex-client-secret"
                    type={showYandexSecret ? "text" : "password"}
                    value={yandexForm.clientSecret}
                    onChange={(e) => setYandexForm(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder={yandexSetting?.hasSecret ? "Оставьте пустым, чтобы сохранить текущий" : "Введите секрет"}
                    data-testid="input-yandex-client-secret"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowYandexSecret(!showYandexSecret)}
                  data-testid="button-toggle-yandex-secret"
                >
                  {showYandexSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => saveYandexMutation.mutate()}
                disabled={saveYandexMutation.isPending}
                className="flex-1"
                data-testid="button-save-yandex"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveYandexMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
              <Button
                variant="outline"
                asChild
              >
                <a href="https://oauth.yandex.ru/" target="_blank" rel="noopener noreferrer" data-testid="link-yandex-console">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Консоль Яндекс
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Инструкция по настройке</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <h4 className="font-medium text-foreground mb-2">ВКонтакте</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Перейдите на <a href="https://vk.com/apps?act=manage" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">vk.com/apps?act=manage</a></li>
              <li>Создайте новое приложение (тип: Сайт)</li>
              <li>В настройках укажите базовый домен: securelex.ru</li>
              <li>Скопируйте ID приложения и Защищённый ключ</li>
              <li>В разделе "Авторизованные редирект URI" добавьте: https://securelex.ru/api/oauth/vk/callback</li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-2">Яндекс</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Перейдите на <a href="https://oauth.yandex.ru/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">oauth.yandex.ru</a></li>
              <li>Создайте новое приложение</li>
              <li>В разделе "Платформы" выберите "Веб-сервисы"</li>
              <li>Укажите Callback URL: https://securelex.ru/api/oauth/yandex/callback</li>
              <li>Выберите права: login:email, login:info, login:avatar</li>
              <li>Скопируйте Client ID и Client Secret</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
