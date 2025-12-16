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
  key: string;
  name: string;
  description: string;
  price: number;
  isFree: boolean;
  enabled: boolean;
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
};

export default function ToolsPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolResult, setToolResult] = useState<ToolResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: toolsData, isLoading } = useQuery<{ success: boolean; tools: Tool[] }>({
    queryKey: ["/api/tools"],
  });

  const tools = toolsData?.tools || [];

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
              const Icon = toolIcons[tool.key] || Shield;
              return (
                <Card key={tool.key} className="flex flex-col" data-testid={`card-tool-${tool.key}`}>
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
                      data-testid={`button-use-tool-${tool.key}`}
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
                      const Icon = toolIcons[selectedTool.key] || Shield;
                      return <Icon className="h-5 w-5 text-primary" />;
                    })()}
                    {selectedTool.name}
                  </DialogTitle>
                  <DialogDescription>{selectedTool.description}</DialogDescription>
                </DialogHeader>
                
                <ToolForm
                  tool={selectedTool}
                  onSubmit={(params) => executeMutation.mutate({ toolKey: selectedTool.key, params })}
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

  switch (tool.key) {
    case "privacy-generator":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Название компании / ФИО</Label>
            <Input
              id="companyName"
              required
              placeholder="ООО Ромашка"
              value={formData.companyName || ""}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              data-testid="input-company-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inn">ИНН</Label>
            <Input
              id="inn"
              required
              placeholder="1234567890"
              value={formData.inn || ""}
              onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
              data-testid="input-inn"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email для обращений</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="privacy@company.ru"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              data-testid="input-email"
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
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сгенерировать
          </Button>
        </form>
      );

    case "consent-generator":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Название компании</Label>
            <Input
              id="companyName"
              required
              placeholder="ООО Ромашка"
              value={formData.companyName || ""}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              data-testid="input-company-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="processingPurpose">Цель обработки данных</Label>
            <Textarea
              id="processingPurpose"
              placeholder="Для регистрации на сайте и связи с пользователем"
              value={formData.processingPurpose || ""}
              onChange={(e) => setFormData({ ...formData, processingPurpose: e.target.value })}
              data-testid="input-processing-purpose"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dataCategories">Категории данных</Label>
            <Input
              id="dataCategories"
              placeholder="ФИО, email, телефон"
              value={formData.dataCategories || ""}
              onChange={(e) => setFormData({ ...formData, dataCategories: e.target.value })}
              data-testid="input-data-categories"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-tool">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сгенерировать
          </Button>
        </form>
      );

    case "cookie-banner":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="style">Стиль баннера</Label>
            <Select
              value={formData.style || "bottom-bar"}
              onValueChange={(value) => setFormData({ ...formData, style: value })}
            >
              <SelectTrigger data-testid="select-style">
                <SelectValue placeholder="Выберите стиль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-bar">Нижняя панель</SelectItem>
                <SelectItem value="modal">Модальное окно</SelectItem>
                <SelectItem value="corner">Угловой блок</SelectItem>
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

  switch (tool.key) {
    case "privacy-generator":
    case "consent-generator":
      const htmlContent = result.html || result.policy || "";
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> Готово
            </Badge>
            <Button variant="outline" size="sm" onClick={() => onCopy(htmlContent)} data-testid="button-copy-result">
              <Copy className="h-4 w-4 mr-2" />
              Копировать
            </Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-h-80 overflow-y-auto rounded-md border p-4 bg-muted/30">
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>
        </div>
      );

    case "cookie-banner":
      const bannerCode = result.code || result.html || "";
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> Код готов
            </Badge>
            <Button variant="outline" size="sm" onClick={() => onCopy(bannerCode)} data-testid="button-copy-result">
              <Copy className="h-4 w-4 mr-2" />
              Копировать
            </Button>
          </div>
          <pre className="text-xs bg-muted/50 p-4 rounded-md overflow-x-auto max-h-80">
            {bannerCode}
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
