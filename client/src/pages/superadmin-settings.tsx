import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings, Globe, Mail, FileText, Bot, Key, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle, Power, BarChart3, Code, ShieldCheck, Phone, MessageCircle } from "lucide-react";
import { SiTelegram, SiWhatsapp, SiVk } from "react-icons/si";
import { Switch } from "@/components/ui/switch";

type SystemSetting = {
  id: number;
  key: string;
  value: string;
  updatedAt: string;
};

export default function SuperAdminSettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<SystemSetting[]>({
    queryKey: ["/api/superadmin/settings"],
  });

  const [formData, setFormData] = useState({
    site_name: "SecureLex.ru",
    site_description: "Проверка сайтов на соответствие ФЗ-152 и ФЗ-149",
    support_email: "support@securelex.ru",
    footer_text: "SecureLex.ru - Сервис проверки сайтов на соответствие законодательству",
    ai_mode: "gigachat_only",
    yandex_metrika_code: "",
    yandex_webmaster_verification: "",
  });

  const [contactData, setContactData] = useState({
    email: "",
    phone: "",
    telegram: "",
    whatsapp: "",
    vk: "",
    maxMessenger: "",
  });
  
  const [isHydrated, setIsHydrated] = useState(false);

  const { data: aiStatus, refetch: refetchAiStatus } = useQuery<{ 
    gigachat: boolean; 
    openai: boolean; 
    yandex: boolean;
    gigachatMasked: string | null;
    openaiMasked: string | null;
    yandexMasked: string | null;
    gigachatSource: string;
    openaiSource: string;
    yandexSource: string;
    currentMode: string;
  }>({
    queryKey: ["/api/superadmin/ai-status"],
  });

  const [gigachatKey, setGigachatKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [yandexKey, setYandexKey] = useState("");
  const [showGigachatKey, setShowGigachatKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showYandexKey, setShowYandexKey] = useState(false);

  const saveApiKeyMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const response = await apiRequest("POST", `/api/superadmin/api-keys/${provider}`, { apiKey });
      return response.json();
    },
    onSuccess: (data) => {
      refetchAiStatus();
      setGigachatKey("");
      setOpenaiKey("");
      setYandexKey("");
      toast({
        title: "Ключ сохранён",
        description: data.message,
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

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await apiRequest("DELETE", `/api/superadmin/api-keys/${provider}`);
      return response.json();
    },
    onSuccess: (data) => {
      refetchAiStatus();
      toast({
        title: "Ключ удалён",
        description: data.message,
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

  const { data: maintenanceData, refetch: refetchMaintenance } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/maintenance-mode"],
  });

  const maintenanceMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest("POST", "/api/superadmin/maintenance-mode", { enabled });
      return response.json();
    },
    onSuccess: (data) => {
      refetchMaintenance();
      toast({
        title: data.enabled ? "Режим техработ включён" : "Режим техработ выключен",
        description: data.enabled 
          ? "Сайт недоступен для посетителей" 
          : "Сайт работает в обычном режиме",
        variant: data.enabled ? "destructive" : "default",
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
      
      const contactSetting = settings.find(s => s.key === "contact_settings");
      if (contactSetting) {
        try {
          const parsed = JSON.parse(contactSetting.value);
          setContactData(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error("Failed to parse contact settings:", e);
        }
      }
      
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
      queryClient.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({
        title: "Настройка сохранена",
        description: "Изменения успешно применены.",
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

  const handleSave = (key: string) => {
    updateSettingMutation.mutate({ key, value: (formData as any)[key] });
  };

  const handleSaveContacts = () => {
    updateSettingMutation.mutate({ 
      key: "contact_settings", 
      value: JSON.stringify(contactData) 
    });
  };

  const handleSaveAll = () => {
    Object.entries(formData).forEach(([key, value]) => {
      updateSettingMutation.mutate({ key, value });
    });
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
          <h1 className="text-3xl font-bold">Системные настройки</h1>
          <p className="text-muted-foreground mt-1">
            Настройка названия сайта и системных параметров
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={updateSettingMutation.isPending || !isHydrated}>
          <Save className="h-4 w-4 mr-2" />
          Сохранить все
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className={maintenanceData?.enabled ? "border-red-500 bg-red-50 dark:bg-red-950/20" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${maintenanceData?.enabled ? "text-red-500" : ""}`} />
              Режим технических работ
            </CardTitle>
            <CardDescription>
              Временно закрыть сайт для посетителей
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Power className={`h-5 w-5 ${maintenanceData?.enabled ? "text-red-500" : "text-green-500"}`} />
                  <span className="font-medium">
                    {maintenanceData?.enabled ? "Сайт отключён" : "Сайт работает"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {maintenanceData?.enabled 
                    ? "Посетители видят страницу технических работ"
                    : "Сайт доступен для всех пользователей"
                  }
                </p>
              </div>
              <Switch
                checked={maintenanceData?.enabled || false}
                onCheckedChange={(checked) => maintenanceMutation.mutate(checked)}
                disabled={maintenanceMutation.isPending}
                data-testid="switch-maintenance-mode"
              />
            </div>
            
            {maintenanceData?.enabled && (
              <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-red-800 dark:text-red-200">
                      Внимание: Сайт недоступен!
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Все посетители сайта видят анимированную страницу "Технические работы". 
                      Администраторы могут продолжать работу в панели управления.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Основные настройки
            </CardTitle>
            <CardDescription>
              Название и описание сайта
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site_name">Название сайта</Label>
              <div className="flex gap-2">
                <Input
                  id="site_name"
                  value={formData.site_name}
                  onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                  placeholder="SecureLex.ru"
                  data-testid="input-site-name"
                />
                <Button
                  variant="outline"
                  onClick={() => handleSave("site_name")}
                  disabled={updateSettingMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="site_description">Описание сайта</Label>
              <div className="flex gap-2">
                <Textarea
                  id="site_description"
                  value={formData.site_description}
                  onChange={(e) => setFormData({ ...formData, site_description: e.target.value })}
                  placeholder="Описание для SEO и мета-тегов"
                  rows={3}
                  data-testid="input-site-description"
                />
                <Button
                  variant="outline"
                  onClick={() => handleSave("site_description")}
                  disabled={updateSettingMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Контактные данные
            </CardTitle>
            <CardDescription>
              Email, телефон и мессенджеры для связи
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={contactData.email}
                  onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                  placeholder="support@securelex.ru"
                  data-testid="input-contact-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contact_phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Телефон
                </Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  value={contactData.phone}
                  onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                  placeholder="+7 (800) 555-35-35"
                  data-testid="input-contact-phone"
                />
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Мессенджеры и соцсети
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact_telegram" className="flex items-center gap-2">
                    <SiTelegram className="h-4 w-4 text-[#0088cc]" />
                    Telegram
                  </Label>
                  <Input
                    id="contact_telegram"
                    value={contactData.telegram}
                    onChange={(e) => setContactData({ ...contactData, telegram: e.target.value })}
                    placeholder="@username или https://t.me/username"
                    data-testid="input-contact-telegram"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contact_whatsapp" className="flex items-center gap-2">
                    <SiWhatsapp className="h-4 w-4 text-[#25D366]" />
                    WhatsApp
                  </Label>
                  <Input
                    id="contact_whatsapp"
                    value={contactData.whatsapp}
                    onChange={(e) => setContactData({ ...contactData, whatsapp: e.target.value })}
                    placeholder="+79001234567"
                    data-testid="input-contact-whatsapp"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contact_vk" className="flex items-center gap-2">
                    <SiVk className="h-4 w-4 text-[#0077FF]" />
                    ВКонтакте
                  </Label>
                  <Input
                    id="contact_vk"
                    value={contactData.vk}
                    onChange={(e) => setContactData({ ...contactData, vk: e.target.value })}
                    placeholder="https://vk.com/username"
                    data-testid="input-contact-vk"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contact_max" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-[#FF6600]" />
                    Max (VK Мессенджер)
                  </Label>
                  <Input
                    id="contact_max"
                    value={contactData.maxMessenger}
                    onChange={(e) => setContactData({ ...contactData, maxMessenger: e.target.value })}
                    placeholder="https://max.me/username"
                    data-testid="input-contact-max"
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <Button
                onClick={handleSaveContacts}
                disabled={updateSettingMutation.isPending}
                data-testid="button-save-contacts"
              >
                <Save className="h-4 w-4 mr-2" />
                Сохранить контакты
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Контент
            </CardTitle>
            <CardDescription>
              Тексты и сообщения на сайте
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="footer_text">Текст в футере</Label>
              <div className="flex gap-2">
                <Textarea
                  id="footer_text"
                  value={formData.footer_text}
                  onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
                  placeholder="Текст для нижней части сайта"
                  rows={2}
                  data-testid="input-footer-text"
                />
                <Button
                  variant="outline"
                  onClick={() => handleSave("footer_text")}
                  disabled={updateSettingMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Настройки ИИ-анализа
            </CardTitle>
            <CardDescription>
              Выбор провайдера и статус API ключей
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="ai_mode">Режим ИИ-анализа</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.ai_mode}
                  onValueChange={(value) => setFormData({ ...formData, ai_mode: value })}
                  disabled={!isHydrated}
                >
                  <SelectTrigger className="flex-1" data-testid="select-ai-mode">
                    <SelectValue placeholder={!isHydrated ? "Загрузка..." : "Выберите режим"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gigachat_only">Только GigaChat (Сбер)</SelectItem>
                    <SelectItem value="openai_only">Только OpenAI (ChatGPT)</SelectItem>
                    <SelectItem value="yandex_only">Только YandexGPT</SelectItem>
                    <SelectItem value="hybrid">Гибридный (OpenAI + GigaChat)</SelectItem>
                    <SelectItem value="tri_hybrid">Три-гибрид (все 3 провайдера)</SelectItem>
                    <SelectItem value="none">Отключён (без ИИ-анализа)</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => handleSave("ai_mode")}
                  disabled={updateSettingMutation.isPending || !isHydrated}
                  data-testid="button-save-ai-mode"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {formData.ai_mode === "gigachat_only" && "GigaChat используется для анализа на русском языке"}
                {formData.ai_mode === "openai_only" && "OpenAI обеспечивает высокое качество анализа"}
                {formData.ai_mode === "yandex_only" && "YandexGPT для анализа через Яндекс Cloud"}
                {formData.ai_mode === "hybrid" && "Используются OpenAI и GigaChat для максимальной точности"}
                {formData.ai_mode === "tri_hybrid" && "Параллельный вызов всех 3 провайдеров, выбор лучшего ответа"}
                {formData.ai_mode === "none" && "ИИ-анализ отключён, проверка выполняется только базовыми правилами"}
              </p>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Key className="h-4 w-4" />
                <span className="font-medium">Управление API ключами</span>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 rounded-md bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">GigaChat API</span>
                      {aiStatus?.gigachat ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Настроен
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Не настроен
                        </Badge>
                      )}
                      {aiStatus?.gigachatSource === "database" && (
                        <Badge variant="outline" className="text-xs">БД</Badge>
                      )}
                      {aiStatus?.gigachatSource === "env" && (
                        <Badge variant="outline" className="text-xs">ENV</Badge>
                      )}
                    </div>
                    {aiStatus?.gigachatMasked && (
                      <span className="text-sm text-muted-foreground font-mono">{aiStatus.gigachatMasked}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showGigachatKey ? "text" : "password"}
                        value={gigachatKey}
                        onChange={(e) => setGigachatKey(e.target.value)}
                        placeholder="Введите GigaChat API ключ"
                        data-testid="input-gigachat-key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowGigachatKey(!showGigachatKey)}
                      >
                        {showGigachatKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      onClick={() => saveApiKeyMutation.mutate({ provider: "gigachat", apiKey: gigachatKey })}
                      disabled={!gigachatKey || saveApiKeyMutation.isPending}
                      data-testid="button-save-gigachat-key"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    {aiStatus?.gigachatSource === "database" && (
                      <Button
                        variant="outline"
                        onClick={() => deleteApiKeyMutation.mutate("gigachat")}
                        disabled={deleteApiKeyMutation.isPending}
                        data-testid="button-delete-gigachat-key"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-md bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">OpenAI API</span>
                      {aiStatus?.openai ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Настроен
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Не настроен
                        </Badge>
                      )}
                      {aiStatus?.openaiSource === "database" && (
                        <Badge variant="outline" className="text-xs">БД</Badge>
                      )}
                      {aiStatus?.openaiSource === "env" && (
                        <Badge variant="outline" className="text-xs">ENV</Badge>
                      )}
                    </div>
                    {aiStatus?.openaiMasked && (
                      <span className="text-sm text-muted-foreground font-mono">{aiStatus.openaiMasked}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showOpenaiKey ? "text" : "password"}
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                        placeholder="Введите OpenAI API ключ"
                        data-testid="input-openai-key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      >
                        {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      onClick={() => saveApiKeyMutation.mutate({ provider: "openai", apiKey: openaiKey })}
                      disabled={!openaiKey || saveApiKeyMutation.isPending}
                      data-testid="button-save-openai-key"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    {aiStatus?.openaiSource === "database" && (
                      <Button
                        variant="outline"
                        onClick={() => deleteApiKeyMutation.mutate("openai")}
                        disabled={deleteApiKeyMutation.isPending}
                        data-testid="button-delete-openai-key"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-md bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">YandexGPT API (IAM Token)</span>
                      {aiStatus?.yandex ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Настроен
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Не настроен
                        </Badge>
                      )}
                      {aiStatus?.yandexSource === "database" && (
                        <Badge variant="outline" className="text-xs">БД</Badge>
                      )}
                      {aiStatus?.yandexSource === "env" && (
                        <Badge variant="outline" className="text-xs">ENV</Badge>
                      )}
                    </div>
                    {aiStatus?.yandexMasked && (
                      <span className="text-sm text-muted-foreground font-mono">{aiStatus.yandexMasked}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showYandexKey ? "text" : "password"}
                        value={yandexKey}
                        onChange={(e) => setYandexKey(e.target.value)}
                        placeholder="Введите YandexGPT IAM токен"
                        data-testid="input-yandex-key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowYandexKey(!showYandexKey)}
                      >
                        {showYandexKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      onClick={() => saveApiKeyMutation.mutate({ provider: "yandex", apiKey: yandexKey })}
                      disabled={!yandexKey || saveApiKeyMutation.isPending}
                      data-testid="button-save-yandex-key"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    {aiStatus?.yandexSource === "database" && (
                      <Button
                        variant="outline"
                        onClick={() => deleteApiKeyMutation.mutate("yandex")}
                        disabled={deleteApiKeyMutation.isPending}
                        data-testid="button-delete-yandex-key"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Источники ключей:</strong> Ключи из БД имеют приоритет над переменными среды (ENV). 
                  При удалении ключа из БД будет использоваться ENV, если он задан.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Яндекс Метрика
            </CardTitle>
            <CardDescription>
              Код счётчика для отслеживания посетителей
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="yandex_metrika_code">Код счётчика Яндекс Метрики</Label>
              <div className="flex gap-2">
                <Textarea
                  id="yandex_metrika_code"
                  value={formData.yandex_metrika_code}
                  onChange={(e) => setFormData({ ...formData, yandex_metrika_code: e.target.value })}
                  placeholder="<!-- Yandex.Metrika counter -->&#10;<script type='text/javascript'>&#10;   (function(m,e,t,r,i,k,a){...&#10;</script>"
                  rows={8}
                  className="font-mono text-sm"
                  data-testid="input-yandex-metrika"
                />
                <Button
                  variant="outline"
                  onClick={() => handleSave("yandex_metrika_code")}
                  disabled={updateSettingMutation.isPending}
                  data-testid="button-save-yandex-metrika"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Вставьте полный код счётчика из Яндекс Метрики. Код будет автоматически добавлен на все страницы сайта.
              </p>
            </div>

            <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Code className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Инструкция:</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Войдите в Яндекс Метрику (metrika.yandex.ru)</li>
                    <li>Создайте или откройте счётчик для вашего сайта</li>
                    <li>Скопируйте код счётчика из раздела "Настройка"</li>
                    <li>Вставьте полный код в поле выше</li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Яндекс Вебмастер
            </CardTitle>
            <CardDescription>
              Верификация сайта в Яндекс Вебмастере
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="yandex_webmaster_verification">Код верификации (content)</Label>
              <div className="flex gap-2">
                <Input
                  id="yandex_webmaster_verification"
                  value={formData.yandex_webmaster_verification}
                  onChange={(e) => setFormData({ ...formData, yandex_webmaster_verification: e.target.value })}
                  placeholder="e493e99ce1e2db08"
                  className="font-mono"
                  data-testid="input-yandex-webmaster"
                />
                <Button
                  variant="outline"
                  onClick={() => handleSave("yandex_webmaster_verification")}
                  disabled={updateSettingMutation.isPending}
                  data-testid="button-save-yandex-webmaster"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Введите только значение атрибута content из метатега верификации.
              </p>
            </div>

            <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Инструкция:</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Войдите в Яндекс Вебмастер (webmaster.yandex.ru)</li>
                    <li>Добавьте сайт и выберите способ подтверждения "Мета-тег"</li>
                    <li>Скопируйте значение content из предложенного метатега</li>
                    <li>Например, из <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">&lt;meta name="yandex-verification" content="e493e99ce1e2db08" /&gt;</code> нужно скопировать только <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">e493e99ce1e2db08</code></li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
