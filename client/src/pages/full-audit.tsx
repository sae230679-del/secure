import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { Footer } from "@/components/footer";
import { FULL_AUDIT_PACKAGES, formatPrice } from "@/lib/packages-data";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Star,
  ChevronDown,
  ChevronUp,
  FileCode,
  Building2,
  ShoppingCart,
  Cloud,
  UsersRound,
  Store,
  Newspaper,
  Stethoscope,
  Baby,
  Users,
  Loader2,
  Globe,
  Sparkles,
} from "lucide-react";

type SiteTypeResult = {
  type: string;
  typeName: string;
  confidence: number;
  recommendedPackagePrice: number;
  signals: string[];
};

export default function FullAuditPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showAllPackages, setShowAllPackages] = useState(false);
  const [detectUrl, setDetectUrl] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedResult, setDetectedResult] = useState<SiteTypeResult | null>(null);

  const handleDetectSiteType = async () => {
    if (!detectUrl.trim()) {
      toast({
        title: "Введите URL",
        description: "Укажите адрес сайта для автоопределения типа",
        variant: "destructive",
      });
      return;
    }

    setIsDetecting(true);
    setDetectedResult(null);
    try {
      const response = await fetch("/api/public/detect-site-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: detectUrl }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Ошибка определения типа");
      }
      
      const result = await response.json();
      setDetectedResult(result);
      toast({
        title: "Тип сайта определён",
        description: `${result.typeName} (${Math.round(result.confidence * 100)}% уверенность)`,
      });
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось определить тип сайта",
        variant: "destructive",
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const siteTypeInfo: Record<string, { icon: typeof FileCode; subtitle: string }> = {
    landing: { icon: FileCode, subtitle: "до 3 страниц" },
    biometry: { icon: Users, subtitle: "фото сотрудников" },
    corporate: { icon: Building2, subtitle: "6-50 страниц" },
    ecommerce: { icon: ShoppingCart, subtitle: "с оплатой" },
    saas: { icon: Cloud, subtitle: "онлайн-сервисы" },
    portal: { icon: UsersRound, subtitle: "с регистрацией" },
    marketplace: { icon: Store, subtitle: "с продавцами" },
    media: { icon: Newspaper, subtitle: "контент/блог" },
    medical: { icon: Stethoscope, subtitle: "клиники" },
    children: { icon: Baby, subtitle: "для детей" },
    forum: { icon: UsersRound, subtitle: "форум/соцсеть" },
    premium: { icon: Star, subtitle: ">50 страниц" },
  };

  const packagesToShow = showAllPackages 
    ? Object.entries(FULL_AUDIT_PACKAGES) 
    : Object.entries(FULL_AUDIT_PACKAGES).slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between gap-4 h-16">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="h-8 w-8 animate-traffic-light-text" />
              <span className="text-xl font-bold">SecureLex.ru</span>
            </Link>

            <div className="flex items-center gap-1 sm:gap-2">
              <ColorModeToggle />
              {isAuthenticated ? (
                <Button size="sm" asChild data-testid="link-dashboard" className="sm:size-default">
                  <Link href="/dashboard">
                    <span className="hidden sm:inline">Личный кабинет</span>
                    <span className="sm:hidden">Кабинет</span>
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild data-testid="link-login" className="hidden sm:inline-flex">
                    <Link href="/auth">Войти</Link>
                  </Button>
                  <Button size="sm" asChild data-testid="link-register">
                    <Link href="/auth">Начать</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
          <div className="mb-6">
            <Button variant="ghost" size="sm" asChild data-testid="link-back">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                На главную
              </Link>
            </Button>
          </div>

          <div className="text-center mb-8 sm:mb-12">
            <Badge className="gap-2 mb-4">
              <Star className="h-4 w-4" />
              Сервис 3: Полный аудит
            </Badge>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
              Полный аудит по типу сайта
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Выберите тип вашего сайта для точной проверки. 
              Каждый пакет включает детальный аудит и готовые документы для внедрения.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span>53+ критериев проверки</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span>10-15 готовых документов</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span>Политика обработки ПДн</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span>Консультация юриста</span>
            </div>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Автоопределение типа сайта
              </CardTitle>
              <CardDescription>
                Укажите URL вашего сайта, и мы автоматически определим его тип и подберём оптимальный пакет
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="example.com"
                    value={detectUrl}
                    onChange={(e) => setDetectUrl(e.target.value)}
                    className="pl-10"
                    data-testid="input-detect-url"
                  />
                </div>
                <Button 
                  onClick={handleDetectSiteType} 
                  disabled={isDetecting}
                  data-testid="button-detect-site-type"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Анализ...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Определить тип
                    </>
                  )}
                </Button>
              </div>
              
              {detectedResult && (
                <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-primary/10">
                          {detectedResult.typeName}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({Math.round(detectedResult.confidence * 100)}% уверенность)
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Рекомендуемый пакет: <span className="font-semibold text-foreground">{formatPrice(detectedResult.recommendedPackagePrice)}</span>
                      </p>
                    </div>
                    <Button asChild data-testid="button-order-detected-type">
                      <Link href={isAuthenticated ? `/dashboard?siteType=${detectedResult.type}` : `/auth?redirect=/dashboard?siteType=${detectedResult.type}`}>
                        Заказать аудит
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                  {detectedResult.signals.length > 0 && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      <span className="font-medium">Обнаружены признаки:</span> {detectedResult.signals.slice(0, 3).join(", ")}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {packagesToShow.map(([key, pkg]) => {
              const info = siteTypeInfo[key] || { icon: FileCode, subtitle: "" };
              const IconComponent = info.icon;
              
              return (
                <Card key={key} className="transition-all duration-200 hover:ring-2 hover:ring-primary group">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5 text-primary flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">{pkg.name}</div>
                        <div className="text-xs text-muted-foreground">{info.subtitle}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xl font-bold">{formatPrice(pkg.price)}</span>
                      <span className="text-xs text-muted-foreground">{pkg.criteriaCount} критериев</span>
                    </div>
                    <Button className="w-full" size="sm" variant="outline" asChild data-testid={`button-select-${key}`}>
                      <Link href={isAuthenticated ? "/dashboard" : "/auth"}>
                        Выбрать
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-6">
            <Button 
              variant="ghost" 
              onClick={() => setShowAllPackages(!showAllPackages)}
              data-testid="button-toggle-packages"
            >
              {showAllPackages ? "Скрыть" : "Смотреть все типы сайтов"}
              {showAllPackages ? (
                <ChevronUp className="ml-1 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="mt-12 p-6 rounded-lg bg-muted/50 text-center">
            <h3 className="text-lg font-semibold mb-2">Не нашли подходящий тип сайта?</h3>
            <p className="text-muted-foreground mb-4">
              Свяжитесь с нами для индивидуального расчёта стоимости аудита
            </p>
            <Button variant="outline" asChild>
              <Link href="/contacts">
                Связаться с нами
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
