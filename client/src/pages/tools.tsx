import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { Footer } from "@/components/footer";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield,
  FileText,
  Cookie,
  Search,
  Globe,
  Lock,
  AlertTriangle,
  Type,
  Server,
  Loader2,
  Check,
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tool = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  isFree: boolean;
  enabled: boolean;
  usageCount: number;
  hasPaid: boolean;
};

type CatalogResponse = {
  success: boolean;
  serviceEnabled: boolean;
  tools: Tool[];
};

type ToolResult = {
  success: boolean;
  [key: string]: any;
};

const toolIcons: Record<string, any> = {
  "privacy-generator": FileText,
  "consent-generator": Shield,
  "cookie-banner": Cookie,
  "seo-audit": Search,
  "cms-detector": Globe,
  "whois-lookup": Globe,
  "ssl-checker": Lock,
  "rkn-check": AlertTriangle,
  "font-localizer": Type,
  "hosting-recommendations": Server,
  "user-agreement-generator": FileText,
};

export default function ToolsPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolResult, setToolResult] = useState<ToolResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: catalogData, isLoading } = useQuery<CatalogResponse>({
    queryKey: ["/api/tools/catalog"],
  });

  const tools = catalogData?.tools || [];
  const serviceEnabled = catalogData?.serviceEnabled ?? true;

  const executeMutation = useMutation({
    mutationFn: async ({ toolKey, params }: { toolKey: string; params: any }) => {
      const response = await apiRequest("POST", `/api/tools/${toolKey}`, params);
      return response.json();
    },
    onSuccess: (data) => {
      setToolResult(data);
      toast({
        title: "Готово",
        description: "Результат получен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось выполнить инструмент",
        variant: "destructive",
      });
    },
  });

  const handleOpenTool = (tool: Tool) => {
    setSelectedTool(tool);
    setToolResult(null);
    setIsDialogOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg hidden sm:inline">SecureLex.ru</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <ColorModeToggle />
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="outline" size="sm" data-testid="link-dashboard">
                  Личный кабинет
                </Button>
              </Link>
            ) : (
              <Link href="/auth">
                <Button variant="outline" size="sm" data-testid="link-auth">
                  Войти
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              На главную
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Инструменты для сайта</h1>
          <p className="text-muted-foreground">
            Генераторы документов, чекеры и анализаторы для соответствия 152-ФЗ и 149-ФЗ
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => {
              const Icon = toolIcons[tool.slug] || Shield;
              return (
                <Card key={tool.slug} className="flex flex-col" data-testid={`card-tool-${tool.slug}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{tool.name}</CardTitle>
                        </div>
                      </div>
                      <Badge variant={tool.isFree ? "secondary" : "default"} className="shrink-0">
                        {tool.isFree ? "Бесплатно" : `${tool.price} ₽`}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pb-2">
                    <CardDescription>{tool.description}</CardDescription>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => handleOpenTool(tool)}
                      disabled={!tool.enabled}
                      data-testid={`button-use-tool-${tool.slug}`}
                    >
                      {tool.enabled ? "Использовать" : "Недоступно"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedTool && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {(() => {
                      const Icon = toolIcons[selectedTool.slug] || Shield;
                      return <Icon className="h-5 w-5 text-primary" />;
                    })()}
                    {selectedTool.name}
                  </DialogTitle>
                  <DialogDescription>{selectedTool.description}</DialogDescription>
                </DialogHeader>
                
                <ToolForm
                  tool={selectedTool}
                  onSubmit={(params) => executeMutation.mutate({ toolKey: selectedTool.slug, params })}
                  isLoading={executeMutation.isPending}
                  result={toolResult}
                  onCopy={copyToClipboard}
                />
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>

      <Footer />
    </div>
  );
}

function ToolForm({
  tool,
  onSubmit,
  isLoading,
  result,
  onCopy,
}: {
  tool: Tool;
  onSubmit: (params: any) => void;
  isLoading: boolean;
  result: ToolResult | null;
  onCopy: (text: string) => void;
}) {
  const [formData, setFormData] = useState<Record<string, any>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (result) {
    return <ToolResultDisplay tool={tool} result={result} onCopy={onCopy} />;
  }

  switch (tool.slug) {
    case "privacy-generator":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="operatorName">Наименование оператора</Label>
            <Input
              id="operatorName"
              required
              placeholder='ООО "Ромашка"'
              value={formData.operatorName || ""}
              onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
              data-testid="input-operator-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operatorInn">ИНН (опционально)</Label>
            <Input
              id="operatorInn"
              placeholder="1234567890"
              value={formData.operatorInn || ""}
              onChange={(e) => setFormData({ ...formData, operatorInn: e.target.value })}
              data-testid="input-operator-inn"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operatorAddress">Адрес организации</Label>
            <Input
              id="operatorAddress"
              required
              placeholder="г. Москва, ул. Примерная, д. 1"
              value={formData.operatorAddress || ""}
              onChange={(e) => setFormData({ ...formData, operatorAddress: e.target.value })}
              data-testid="input-operator-address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operatorEmail">Email для обращений</Label>
            <Input
              id="operatorEmail"
              type="email"
              required
              placeholder="privacy@company.ru"
              value={formData.operatorEmail || ""}
              onChange={(e) => setFormData({ ...formData, operatorEmail: e.target.value })}
              data-testid="input-operator-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">URL сайта</Label>
            <Input
              id="websiteUrl"
              required
              placeholder="https://example.ru"
              value={formData.websiteUrl || ""}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              data-testid="input-website-url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdnTypes">Типы персональных данных (через запятую)</Label>
            <Textarea
              id="pdnTypes"
              required
              placeholder="ФИО, email, телефон, адрес"
              value={formData.pdnTypesStr || ""}
              onChange={(e) => setFormData({ 
                ...formData, 
                pdnTypesStr: e.target.value,
                pdnTypes: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
              })}
              data-testid="input-pdn-types"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purposes">Цели обработки (через запятую)</Label>
            <Textarea
              id="purposes"
              required
              placeholder="Регистрация на сайте, Обратная связь, Рассылка"
              value={formData.purposesStr || ""}
              onChange={(e) => setFormData({ 
                ...formData, 
                purposesStr: e.target.value,
                purposes: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
              })}
              data-testid="input-purposes"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storagePeriod">Срок хранения данных</Label>
            <Input
              id="storagePeriod"
              required
              placeholder="3 года с момента получения"
              value={formData.storagePeriod || ""}
              onChange={(e) => setFormData({ ...formData, storagePeriod: e.target.value })}
              data-testid="input-storage-period"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сгенерировать политику
          </Button>
        </form>
      );

    case "consent-generator":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mode">Тип согласия</Label>
            <Select
              value={formData.mode || "website_checkbox"}
              onValueChange={(value) => setFormData({ ...formData, mode: value })}
            >
              <SelectTrigger data-testid="select-mode">
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="website_checkbox">Чекбокс на сайте</SelectItem>
                <SelectItem value="written">Письменное согласие</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="operatorName">Наименование оператора</Label>
            <Input
              id="operatorName"
              required
              placeholder='ООО "Ромашка"'
              value={formData.operatorName || ""}
              onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
              data-testid="input-operator-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operatorAddress">Адрес оператора</Label>
            <Input
              id="operatorAddress"
              required
              placeholder="г. Москва, ул. Примерная, д. 1"
              value={formData.operatorAddress || ""}
              onChange={(e) => setFormData({ ...formData, operatorAddress: e.target.value })}
              data-testid="input-operator-address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purposes">Цели обработки (через запятую)</Label>
            <Textarea
              id="purposes"
              required
              placeholder="Регистрация, Обратная связь"
              value={formData.purposesStr || ""}
              onChange={(e) => setFormData({ 
                ...formData, 
                purposesStr: e.target.value,
                purposes: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
              })}
              data-testid="input-purposes"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdnCategories">Категории ПДн (через запятую)</Label>
            <Input
              id="pdnCategories"
              required
              placeholder="ФИО, email, телефон"
              value={formData.pdnCategoriesStr || ""}
              onChange={(e) => setFormData({ 
                ...formData, 
                pdnCategoriesStr: e.target.value,
                pdnCategories: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
              })}
              data-testid="input-pdn-categories"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="processingActions">Действия с ПДн (через запятую)</Label>
            <Input
              id="processingActions"
              required
              placeholder="сбор, хранение, обработка, передача"
              value={formData.processingActionsStr || ""}
              onChange={(e) => setFormData({ 
                ...formData, 
                processingActionsStr: e.target.value,
                processingActions: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
              })}
              data-testid="input-processing-actions"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storagePeriod">Срок хранения</Label>
            <Input
              id="storagePeriod"
              required
              placeholder="3 года"
              value={formData.storagePeriod || ""}
              onChange={(e) => setFormData({ ...formData, storagePeriod: e.target.value })}
              data-testid="input-storage-period"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdrawalProcedure">Порядок отзыва согласия</Label>
            <Textarea
              id="withdrawalProcedure"
              required
              placeholder="Направить письменное заявление на адрес оператора или email privacy@company.ru"
              value={formData.withdrawalProcedure || ""}
              onChange={(e) => setFormData({ ...formData, withdrawalProcedure: e.target.value })}
              data-testid="input-withdrawal-procedure"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сгенерировать согласие
          </Button>
        </form>
      );

    case "cookie-banner":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="siteName">Название сайта</Label>
            <Input
              id="siteName"
              required
              placeholder="Мой сайт"
              value={formData.siteName || ""}
              onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
              data-testid="input-site-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="privacyPolicyUrl">Ссылка на политику конфиденциальности</Label>
            <Input
              id="privacyPolicyUrl"
              required
              placeholder="https://example.ru/privacy"
              value={formData.privacyPolicyUrl || ""}
              onChange={(e) => setFormData({ ...formData, privacyPolicyUrl: e.target.value })}
              data-testid="input-privacy-policy-url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">Расположение баннера</Label>
            <Select
              value={formData.position || "bottom"}
              onValueChange={(value) => setFormData({ ...formData, position: value })}
            >
              <SelectTrigger data-testid="select-position">
                <SelectValue placeholder="Выберите расположение" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom">Внизу страницы</SelectItem>
                <SelectItem value="top">Вверху страницы</SelectItem>
                <SelectItem value="center">По центру (модальное)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme">Тема</Label>
            <Select
              value={formData.theme || "auto"}
              onValueChange={(value) => setFormData({ ...formData, theme: value })}
            >
              <SelectTrigger data-testid="select-theme">
                <SelectValue placeholder="Выберите тему" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Автоматическая</SelectItem>
                <SelectItem value="light">Светлая</SelectItem>
                <SelectItem value="dark">Темная</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сгенерировать код
          </Button>
        </form>
      );

    case "seo-audit":
    case "cms-detector":
    case "ssl-checker":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL сайта</Label>
            <Input
              id="url"
              required
              placeholder="https://example.ru"
              value={formData.url || ""}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              data-testid="input-url"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Проверить
          </Button>
        </form>
      );

    case "whois-lookup":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Домен</Label>
            <Input
              id="domain"
              required
              placeholder="example.ru"
              value={formData.domain || ""}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              data-testid="input-domain"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Получить информацию
          </Button>
        </form>
      );

    case "rkn-check":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inn">ИНН организации</Label>
            <Input
              id="inn"
              required
              placeholder="1234567890"
              value={formData.inn || ""}
              onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
              data-testid="input-inn"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Проверить в реестре
          </Button>
        </form>
      );

    case "font-localizer":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL сайта для анализа</Label>
            <Input
              id="url"
              required
              placeholder="https://example.ru"
              value={formData.url || ""}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              data-testid="input-url"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Анализировать шрифты
          </Button>
        </form>
      );

    case "hosting-recommendations":
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Получите список российских хостинг-провайдеров с сертификацией 152-ФЗ.
          </p>
          <Button className="w-full" disabled={isLoading} onClick={() => onSubmit({})} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Показать хостинги
          </Button>
        </div>
      );

    case "user-agreement-generator":
      return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="siteUrl">URL сайта *</Label>
              <Input
                id="siteUrl"
                required
                placeholder="https://example.ru"
                value={formData.siteUrl || ""}
                onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
                data-testid="input-site-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteType">Тип сайта *</Label>
              <Select
                value={formData.siteType || ""}
                onValueChange={(v) => setFormData({ ...formData, siteType: v })}
              >
                <SelectTrigger data-testid="select-site-type">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="content">Контентный сайт</SelectItem>
                  <SelectItem value="services">Сайт услуг</SelectItem>
                  <SelectItem value="saas">SaaS-сервис</SelectItem>
                  <SelectItem value="ecommerce">Интернет-магазин</SelectItem>
                  <SelectItem value="marketplace">Маркетплейс</SelectItem>
                  <SelectItem value="ugc">UGC-платформа</SelectItem>
                  <SelectItem value="onlineSchool">Онлайн-школа</SelectItem>
                  <SelectItem value="servicesAggregator">Агрегатор услуг</SelectItem>
                  <SelectItem value="classifieds">Доска объявлений</SelectItem>
                  <SelectItem value="crmSaas">CRM/SaaS система</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="operatorType">Тип оператора *</Label>
              <Select
                value={formData.operatorType || ""}
                onValueChange={(v) => setFormData({ ...formData, operatorType: v })}
              >
                <SelectTrigger data-testid="select-operator-type">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ooo">ООО</SelectItem>
                  <SelectItem value="ip">ИП</SelectItem>
                  <SelectItem value="selfEmployed">Самозанятый</SelectItem>
                  <SelectItem value="individual">Физическое лицо</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jurisdictionCity">Город юрисдикции *</Label>
              <Input
                id="jurisdictionCity"
                required
                placeholder="Москва"
                value={formData.jurisdictionCity || ""}
                onChange={(e) => setFormData({ ...formData, jurisdictionCity: e.target.value })}
                data-testid="input-jurisdiction-city"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operatorNameFull">Полное наименование оператора *</Label>
            <Input
              id="operatorNameFull"
              required
              placeholder='ООО "Ромашка" или ИП Иванов Иван Иванович'
              value={formData.operatorNameFull || ""}
              onChange={(e) => setFormData({ ...formData, operatorNameFull: e.target.value })}
              data-testid="input-operator-name-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Email для связи *</Label>
              <Input
                id="supportEmail"
                type="email"
                required
                placeholder="info@company.ru"
                value={formData.supportEmail || ""}
                onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                data-testid="input-support-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportPhone">Телефон (опционально)</Label>
              <Input
                id="supportPhone"
                placeholder="+7 999 123-45-67"
                value={formData.supportPhone || ""}
                onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                data-testid="input-support-phone"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="operatorInn">ИНН (опционально)</Label>
              <Input
                id="operatorInn"
                placeholder="1234567890"
                value={formData.operatorInn || ""}
                onChange={(e) => setFormData({ ...formData, operatorInn: e.target.value })}
                data-testid="input-operator-inn"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operatorOgrnOrOgrnip">ОГРН/ОГРНИП (опционально)</Label>
              <Input
                id="operatorOgrnOrOgrnip"
                placeholder="1234567890123"
                value={formData.operatorOgrnOrOgrnip || ""}
                onChange={(e) => setFormData({ ...formData, operatorOgrnOrOgrnip: e.target.value })}
                data-testid="input-operator-ogrn"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operatorAddress">Адрес (опционально)</Label>
            <Input
              id="operatorAddress"
              placeholder="г. Москва, ул. Примерная, д. 1"
              value={formData.operatorAddress || ""}
              onChange={(e) => setFormData({ ...formData, operatorAddress: e.target.value })}
              data-testid="input-operator-address"
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium mb-3">Функции сайта</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasRegistration || false}
                  onChange={(e) => setFormData({ ...formData, hasRegistration: e.target.checked })}
                  className="rounded"
                  data-testid="checkbox-has-registration"
                />
                <span className="text-sm">Регистрация пользователей</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasPayments || false}
                  onChange={(e) => setFormData({ ...formData, hasPayments: e.target.checked })}
                  className="rounded"
                  data-testid="checkbox-has-payments"
                />
                <span className="text-sm">Платные услуги/товары</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.ugcAllowed || false}
                  onChange={(e) => setFormData({ ...formData, ugcAllowed: e.target.checked })}
                  className="rounded"
                  data-testid="checkbox-ugc-allowed"
                />
                <span className="text-sm">Пользовательский контент</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.analyticsUsed || false}
                  onChange={(e) => setFormData({ ...formData, analyticsUsed: e.target.checked })}
                  className="rounded"
                  data-testid="checkbox-analytics-used"
                />
                <span className="text-sm">Аналитика/cookies</span>
              </label>
            </div>
          </div>

          {formData.hasPayments && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium">Настройки оплаты</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Модель оплаты</Label>
                  <Select
                    value={formData.billingModel || ""}
                    onValueChange={(v) => setFormData({ ...formData, billingModel: v })}
                  >
                    <SelectTrigger data-testid="select-billing-model">
                      <SelectValue placeholder="Выберите модель" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oneTime">Разовая оплата</SelectItem>
                      <SelectItem value="subscription">Подписка</SelectItem>
                      <SelectItem value="payg">Pay-as-you-go</SelectItem>
                      <SelectItem value="mixed">Смешанная</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Тип доставки</Label>
                  <Select
                    value={formData.deliveryType || "none"}
                    onValueChange={(v) => setFormData({ ...formData, deliveryType: v })}
                  >
                    <SelectTrigger data-testid="select-delivery-type">
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Нет доставки</SelectItem>
                      <SelectItem value="digital">Цифровой контент</SelectItem>
                      <SelectItem value="physical">Физическая доставка</SelectItem>
                      <SelectItem value="mixed">Смешанная</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Политика возвратов</Label>
                <Select
                  value={formData.refundPolicy || "standard"}
                  onValueChange={(v) => setFormData({ ...formData, refundPolicy: v })}
                >
                  <SelectTrigger data-testid="select-refund-policy">
                    <SelectValue placeholder="Выберите политику" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Стандартная (по закону)</SelectItem>
                    <SelectItem value="custom">Кастомная</SelectItem>
                    <SelectItem value="none">Без возвратов</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {formData.ugcAllowed && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium">Настройки модерации</p>
              <div className="space-y-2">
                <Label>Режим модерации</Label>
                <Select
                  value={formData.moderationMode || "post"}
                  onValueChange={(v) => setFormData({ ...formData, moderationMode: v })}
                >
                  <SelectTrigger data-testid="select-moderation-mode">
                    <SelectValue placeholder="Выберите режим" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre">Премодерация</SelectItem>
                    <SelectItem value="post">Постмодерация</SelectItem>
                    <SelectItem value="mixed">Смешанная</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Возрастное ограничение</Label>
            <Select
              value={formData.ageRestriction || "none"}
              onValueChange={(v) => setFormData({ ...formData, ageRestriction: v })}
            >
              <SelectTrigger data-testid="select-age-restriction">
                <SelectValue placeholder="Выберите" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без ограничений</SelectItem>
                <SelectItem value="18plus">18+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || !formData.siteType || !formData.operatorType} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сгенерировать соглашение
          </Button>
        </form>
      );

    default:
      return (
        <div className="text-center text-muted-foreground py-4">
          Форма для этого инструмента в разработке
        </div>
      );
  }
}

function ToolResultDisplay({
  tool,
  result,
  onCopy,
}: {
  tool: Tool;
  result: ToolResult;
  onCopy: (text: string) => void;
}) {
  if (!result.success) {
    return (
      <div className="p-4 rounded-md bg-destructive/10 text-destructive">
        <p>Ошибка: {result.error || "Неизвестная ошибка"}</p>
      </div>
    );
  }

  switch (tool.slug) {
    case "privacy-generator":
      const policyText = result.policy || "";
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> Политика готова
            </Badge>
            {result.lawBasis && (
              <Badge variant="outline" className="text-xs">{result.lawBasis}</Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => onCopy(policyText)} data-testid="button-copy-result">
              <Copy className="h-4 w-4 mr-2" />
              Копировать
            </Button>
          </div>
          <pre className="text-sm whitespace-pre-wrap max-h-80 overflow-y-auto rounded-md border p-4 bg-muted/30">
            {policyText}
          </pre>
        </div>
      );

    case "consent-generator":
      const consentContent = result.html || result.text || "";
      const hasJs = !!result.js;
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> Согласие готово
            </Badge>
            <Button variant="outline" size="sm" onClick={() => onCopy(consentContent)} data-testid="button-copy-result">
              <Copy className="h-4 w-4 mr-2" />
              Копировать HTML
            </Button>
          </div>
          {result.validation && !result.validation.isValid && (
            <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-sm">
              <p className="font-medium text-yellow-700 dark:text-yellow-400">Предупреждения:</p>
              <ul className="mt-1 text-xs space-y-1">
                {result.validation.errors?.map((e: string, i: number) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto rounded-md border p-4 bg-muted/30">
            {consentContent}
          </pre>
          {hasJs && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">JavaScript код:</p>
              <Button variant="outline" size="sm" onClick={() => onCopy(result.js)} data-testid="button-copy-js">
                <Copy className="h-4 w-4 mr-2" />
                Копировать JS
              </Button>
            </div>
          )}
        </div>
      );

    case "cookie-banner":
      const fullCode = [result.html, result.css ? `<style>\n${result.css}\n</style>` : "", result.js ? `<script>\n${result.js}\n</script>` : ""].filter(Boolean).join("\n\n");
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> Код готов
            </Badge>
            <Button variant="outline" size="sm" onClick={() => onCopy(fullCode)} data-testid="button-copy-result">
              <Copy className="h-4 w-4 mr-2" />
              Копировать все
            </Button>
          </div>
          <pre className="text-xs bg-muted/50 p-4 rounded-md overflow-x-auto max-h-80 whitespace-pre-wrap">
            {fullCode}
          </pre>
        </div>
      );

    case "ssl-checker":
      const ssl = result.ssl;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {ssl?.valid ? (
              <Badge className="gap-1 bg-green-600">
                <Check className="h-3 w-3" /> SSL действителен
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Проблема с SSL
              </Badge>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Издатель:</span>
              <span>{ssl?.issuer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Срок действия:</span>
              <span>{ssl?.daysRemaining} дней</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Протокол:</span>
              <span>{ssl?.protocol}</span>
            </div>
          </div>
        </div>
      );

    case "whois-lookup":
      return (
        <div className="space-y-4">
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" /> Данные получены
          </Badge>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Регистратор:</span>
              <span className="text-right">{result.whois?.registrar}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Владелец:</span>
              <span className="text-right">{result.whois?.registrant}</span>
            </div>
            {result.dns?.ns && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">NS:</span>
                <span className="text-right">{result.dns.ns.join(", ")}</span>
              </div>
            )}
          </div>
          {result.evidence && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">Детали:</p>
              <ul className="text-xs space-y-1">
                {result.evidence.slice(0, 6).map((e: string, i: number) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case "hosting-recommendations":
      const hostings = result.hostings || [];
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{result.note}</p>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {hostings.map((h: any, i: number) => (
              <div key={i} className="p-3 rounded-md border bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{h.types?.join(", ")}</p>
                  </div>
                  <a href={h.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {h.compliance?.map((c: string) => (
                    <Badge key={c} variant="outline" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{h.minPrice}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "seo-audit":
      return (
        <div className="space-y-4">
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" /> Анализ завершен
          </Badge>
          <div className="space-y-2 text-sm">
            {result.title && (
              <div>
                <span className="text-muted-foreground">Title:</span>
                <p className="font-mono text-xs">{result.title}</p>
              </div>
            )}
            {result.description && (
              <div>
                <span className="text-muted-foreground">Description:</span>
                <p className="font-mono text-xs">{result.description}</p>
              </div>
            )}
            {result.issues && result.issues.length > 0 && (
              <div>
                <span className="text-muted-foreground">Проблемы:</span>
                <ul className="mt-1 space-y-1 text-xs">
                  {result.issues.map((issue: string, i: number) => (
                    <li key={i} className="flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      );

    case "cms-detector":
      return (
        <div className="space-y-4">
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" /> Определено
          </Badge>
          <div className="text-center py-4">
            <p className="text-2xl font-bold">{result.cms || "Неизвестно"}</p>
            {result.confidence && (
              <p className="text-sm text-muted-foreground">Уверенность: {result.confidence}%</p>
            )}
          </div>
          {result.evidence && (
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">Признаки:</p>
              <ul className="list-disc list-inside">
                {result.evidence.slice(0, 5).map((e: string, i: number) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case "rkn-check":
      return (
        <div className="space-y-4">
          {result.found ? (
            <Badge className="gap-1 bg-green-600">
              <Check className="h-3 w-3" /> Найден в реестре ПДн
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Не найден в реестре
            </Badge>
          )}
          <p className="text-sm text-muted-foreground">{result.note}</p>
          {result.registrationNumber && (
            <p className="text-sm">Номер: {result.registrationNumber}</p>
          )}
        </div>
      );

    case "font-localizer":
      const externalFonts = result.externalFonts || [];
      return (
        <div className="space-y-4">
          <Badge variant={externalFonts.length > 0 ? "destructive" : "secondary"} className="gap-1">
            {externalFonts.length > 0 ? (
              <>
                <AlertTriangle className="h-3 w-3" /> Найдены внешние шрифты
              </>
            ) : (
              <>
                <Check className="h-3 w-3" /> Внешние шрифты не найдены
              </>
            )}
          </Badge>
          {externalFonts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Рекомендации по замене:</p>
              {externalFonts.map((font: any, i: number) => (
                <div key={i} className="p-2 rounded border bg-muted/30 text-sm">
                  <p className="font-medium">{font.name || font.url}</p>
                  {font.alternative && (
                    <p className="text-xs text-muted-foreground">
                      Замена: {font.alternative}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {result.recommendation && (
            <p className="text-sm text-muted-foreground">{result.recommendation}</p>
          )}
        </div>
      );

    case "user-agreement-generator":
      const agreementHtml = result.format?.html || "";
      const agreementText = result.format?.text || "";
      const blocks = result.format?.blocks || [];
      const evidence = result.evidence || [];
      const limitations = result.limitations || [];
      
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge className="gap-1 bg-green-600">
              <Check className="h-3 w-3" /> Соглашение готово
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onCopy(agreementText)} data-testid="button-copy-text">
                <Copy className="h-4 w-4 mr-2" />
                Текст
              </Button>
              <Button variant="outline" size="sm" onClick={() => onCopy(agreementHtml)} data-testid="button-copy-html">
                <Copy className="h-4 w-4 mr-2" />
                HTML
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const blob = new Blob([agreementHtml], { type: "text/html;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "user-agreement.html";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                data-testid="button-download-html"
              >
                <Download className="h-4 w-4 mr-2" />
                Скачать
              </Button>
            </div>
          </div>

          {/* Оглавление */}
          <div className="border rounded-md p-3 bg-muted/30">
            <p className="text-sm font-medium mb-2">Содержание документа:</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {blocks.map((block: any) => (
                <span key={block.id} className="text-muted-foreground">{block.title}</span>
              ))}
            </div>
          </div>

          {/* Превью */}
          <div className="border rounded-md max-h-60 overflow-y-auto">
            <div 
              className="p-4 text-sm prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: agreementHtml }}
            />
          </div>

          {/* Что включено */}
          {evidence.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Включённые разделы:</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {evidence.slice(0, 8).map((e: string, i: number) => (
                  <li key={i} className="flex items-start gap-1">
                    <Check className="h-3 w-3 mt-0.5 text-green-600 shrink-0" />
                    {e}
                  </li>
                ))}
                {evidence.length > 8 && (
                  <li className="text-muted-foreground">...и ещё {evidence.length - 8} пунктов</li>
                )}
              </ul>
            </div>
          )}

          {/* Ограничения */}
          {limitations.length > 0 && (
            <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                Рекомендации для юриста:
              </p>
              <ul className="text-xs space-y-1">
                {limitations.map((l: string, i: number) => (
                  <li key={i} className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 text-yellow-600 shrink-0" />
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    default:
      return (
        <div className="space-y-4">
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" /> Результат
          </Badge>
          <pre className="text-xs bg-muted/50 p-4 rounded-md overflow-x-auto max-h-80">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      );
  }
}
