import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { ExpressCheck } from "@/components/express-check";
import { Footer } from "@/components/footer";
import { PromoPopup, PromoBanner } from "@/components/promo-popup";
import { EXPRESS_PACKAGE, formatPrice } from "@/lib/packages-data";
import { useAuth } from "@/lib/auth-context";
import {
  Shield,
  CheckCircle2,
  FileText,
  Clock,
  Users,
  Lock,
  Globe,
  ArrowRight,
  Star,
  Zap,
  FileCode,
  BookOpen,
  ChevronRight,
  Cookie,
  ClipboardCheck,
  Database,
  Newspaper,
  FolderOpen,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { GuideSection } from "@shared/schema";

type SectionWithCounts = GuideSection & { topicsCount: number; articlesCount: number };

type GuideHomeData = {
  sections: SectionWithCounts[];
  totals: { topics: number; articles: number };
};

const iconMap: Record<string, typeof FileText> = {
  FileText, Cookie, Shield, ClipboardCheck, Database, Users, Clock, Lock, Newspaper, FolderOpen, BookOpen
};

function getIcon(iconName: string | null) {
  if (!iconName) return FolderOpen;
  return iconMap[iconName] || FolderOpen;
}

type PublicSettings = {
  siteName: string;
  requisites: {
    legalType: "self_employed" | "ip" | "ooo";
    companyName: string;
    inn: string;
    kpp?: string;
    ogrn?: string;
    ogrnip?: string;
    bankAccount: string;
    bankName: string;
    bik: string;
    corrAccount: string;
    legalAddress: string;
  } | null;
  contacts: {
    email: string;
    phone: string;
    telegram: string;
    whatsapp: string;
    vk: string;
    maxMessenger: string;
  } | null;
};

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  
  const { data: publicSettings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
  });

  const { data: guideData, isLoading: guideLoading } = useQuery<GuideHomeData>({
    queryKey: ["/api/guide/home"],
  });

  const contacts = publicSettings?.contacts;
  const requisites = publicSettings?.requisites;

  const getLegalTypeName = (type: string) => {
    switch (type) {
      case "self_employed": return "Самозанятый";
      case "ip": return "ИП";
      case "ooo": return "ООО";
      default: return "";
    }
  };

  const features = [
    {
      icon: Shield,
      title: "ФЗ-149 ФЗ-152 Проверка",
      description: "Полная проверка на соответствие закону о персональных данных",
    },
    {
      icon: Globe,
      title: "Российское законодательство",
      description: "Полное соответствие требованиям законодательства РФ",
    },
    {
      icon: FileText,
      title: "Детальные отчеты",
      description: "Подробные рекомендации по исправлению нарушений",
    },
    {
      icon: Clock,
      title: "Быстрая проверка",
      description: "Результаты за 15-60 минут в зависимости от типа сайта",
    },
    {
      icon: Lock,
      title: "SSL/HTTPS анализ",
      description: "Проверка безопасности соединения и сертификатов",
    },
    {
      icon: Users,
      title: "Экспертная поддержка",
      description: "Консультации юристов по вопросам compliance",
    },
  ];

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

      <PromoBanner />

      <section className="py-8 sm:py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
            <div className="space-y-6">
              <Badge variant="secondary" className="gap-1">
                <Zap className="h-3 w-3" />
                Автоматическая проверка
              </Badge>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                Проверьте ваш сайт на{" "}
                <span className="text-primary">соответствие законам</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                SecureLex.ru автоматически проверяет сайты на соответствие ФЗ-149, 
                ФЗ-152 и другим требованиям законодательства РФ. Получите детальный отчет за 15-60 минут.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" variant="outline" asChild>
                  <Link href="/criteria">Критерии проверки</Link>
                </Button>
                <Button size="lg" asChild>
                  <Link href="#check">
                    Проверить сайт
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="pt-2">
                <Link href="/tools" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors text-sm" data-testid="link-tools">
                  <FileCode className="h-4 w-4 mr-1" />
                  Бесплатные инструменты и генераторы
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </div>
              <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>1000+ проверок</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span>4.9 рейтинг</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>от 15 минут</span>
                </div>
              </div>
            </div>

            <ExpressCheck />
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Почему SecureLex.ru?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Мы предлагаем полную автоматизированную проверку вашего сайта на соответствие 
              российскому и международному законодательству
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="hover-elevate">
                <CardContent className="pt-6">
                  <feature.icon className="h-10 w-10 text-primary mb-4" />
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button variant="outline" asChild data-testid="button-criteria-features">
              <Link href="/criteria">
                Критерии проверки
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 max-w-4xl mx-auto">
              Закажите аудит сайта на соответствие ФЗ-152, ФЗ-149 — выявление нарушений, подготовка документов
            </h2>
            <p className="text-lg text-muted-foreground mb-2">
              (политика, согласия, инструкции, cookies-баннер)
            </p>
            <p className="text-lg font-semibold">
              Защита от штрафов и блокировки!
            </p>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-12 sm:py-16 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Три сервиса на выбор</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Быстрая проверка, полный аудит с документами или набор инструментов
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-12 items-stretch">
            <div className="relative flex flex-col">
              <Badge variant="secondary" className="gap-2 text-sm py-1.5 px-3 shadow-lg absolute -top-4 left-1/2 -translate-x-1/2 lg:left-4 lg:translate-x-0 z-10">
                <Zap className="h-4 w-4" />
                <span className="lg:hidden">Сервис 1: Быстрая проверка</span>
                <span className="hidden lg:inline">Сервис 1</span>
              </Badge>
              <Card className="border-2 border-primary/20 flex-1 flex flex-col pt-6">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl sm:text-2xl">Экспресс-проверка</CardTitle>
                  <CardDescription className="text-sm">Быстро узнайте состояние вашего сайта за 2 минуты</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col space-y-4">
                  <div className="space-y-3 flex-1">
                    <div className="p-3 sm:p-4 rounded-md bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center justify-between gap-2 sm:gap-4 mb-2">
                        <span className="font-semibold text-sm sm:text-base text-green-700 dark:text-green-400">Краткий отчёт</span>
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-xs">Бесплатно</Badge>
                      </div>
                      <ul className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                          9 критериев проверки
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                          Score 0-100, расчёт штрафов
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                          Результат за 30 секунд
                        </li>
                      </ul>
                    </div>
                    <div className="p-3 sm:p-4 rounded-md bg-muted">
                      <div className="flex items-center justify-between gap-2 sm:gap-4 mb-2">
                        <span className="font-semibold text-sm sm:text-base">Полный PDF отчёт</span>
                        <span className="text-xl sm:text-2xl font-bold">{formatPrice(EXPRESS_PACKAGE.price)}</span>
                      </div>
                      <ul className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                        {EXPRESS_PACKAGE.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-auto space-y-4">
                    <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 text-center font-medium">
                        Без готовых документов. Только анализ нарушений.
                      </p>
                    </div>
                    <Button className="w-full" size="lg" asChild>
                      <a href="#check">
                        Проверить бесплатно
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="relative flex flex-col">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 lg:left-4 lg:translate-x-0 z-10 flex items-center gap-2">
                <Badge className="gap-2 text-sm py-1.5 px-3 shadow-lg">
                  <Star className="h-4 w-4" />
                  <span className="lg:hidden">Сервис 2: Полный аудит</span>
                  <span className="hidden lg:inline">Сервис 2</span>
                </Badge>
                <span className="px-2 py-1 text-xs font-bold rounded-full text-white animate-traffic-light shadow-lg">
                  ТОП
                </span>
              </div>
              <Card className="border-2 border-primary flex-1 flex flex-col pt-6">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl sm:text-2xl">Полный аудит + документы</CardTitle>
                  <CardDescription className="text-sm">Приведите сайт в соответствие закону с готовыми документами</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col space-y-4">
                  <div className="space-y-3 flex-1">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 shrink-0" />
                        <span>53 критерия</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 shrink-0" />
                        <span>10-15 документов</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 shrink-0" />
                        <span>Политика ПДн</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 shrink-0" />
                        <span>Cookie-баннер</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 shrink-0" />
                        <span>Согласия на ОПД</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 shrink-0" />
                        <span>Консультация</span>
                      </div>
                    </div>
                    <div className="p-3 sm:p-4 rounded-md bg-primary/5 border border-primary/20">
                      <div className="text-center">
                        <span className="text-xs sm:text-sm text-muted-foreground block mb-1">Цена зависит от типа сайта</span>
                        <div className="text-xl sm:text-2xl font-bold">от {formatPrice(3900)} до {formatPrice(39900)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto space-y-4">
                    <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                      <p className="text-xs sm:text-sm text-green-700 dark:text-green-400 text-center font-medium">
                        Готовые документы для внедрения на сайт!
                      </p>
                    </div>
                    <Button className="w-full" size="lg" variant="default" asChild>
                      <Link href="/full-audit">
                        Выбрать тип сайта
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="relative flex flex-col">
              <Badge variant="secondary" className="gap-2 text-sm py-1.5 px-3 shadow-lg absolute -top-4 left-1/2 -translate-x-1/2 lg:left-4 lg:translate-x-0 z-10">
                <FileCode className="h-4 w-4" />
                <span className="lg:hidden">Сервис 3: Инструменты</span>
                <span className="hidden lg:inline">Сервис 3</span>
              </Badge>
              <Card className="border-2 border-primary/20 flex-1 flex flex-col pt-6">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl sm:text-2xl">Инструментарий</CardTitle>
                  <CardDescription className="text-sm">Генераторы документов и проверки для вашего сайта</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col space-y-4">
                  <div className="space-y-3 flex-1">
                    <div className="p-3 sm:p-4 rounded-md bg-muted">
                      <div className="flex items-center justify-between gap-2 sm:gap-4 mb-2">
                        <span className="font-semibold text-sm sm:text-base">Цена за инструмент</span>
                        <span className="text-xl sm:text-2xl font-bold">10 ₽</span>
                      </div>
                      <ul className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                          Генератор политики ПДн
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                          Генератор согласий
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                          Cookie-баннер
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                          SEO-аудит, SSL-чекер
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                          WHOIS, CMS-детектор
                        </li>
                      </ul>
                    </div>
                    <div className="p-3 sm:p-4 rounded-md bg-green-500/10 border border-green-500/20">
                      <div className="text-center">
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-xs">Рекомендации по хостингу — бесплатно</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto space-y-4">
                    <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-400 text-center font-medium">
                        10+ инструментов для самостоятельной работы
                      </p>
                    </div>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="lg" asChild>
                      <Link href="/tools">
                        Открыть инструменты
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
              <h2 className="text-3xl font-bold" data-testid="text-guide-section-title">Справочник</h2>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Статьи и материалы о законодательстве РФ в области персональных данных, требованиях к сайтам и практические рекомендации.
            </p>
            {guideData && (
              <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
                <span>Всего тем: {guideData.totals.topics}</span>
                <span>Статей: {guideData.totals.articles}</span>
              </div>
            )}
          </div>

          {guideLoading ? (
            <>
              {/* Desktop/Tablet skeleton */}
              <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-8 w-8 rounded mb-2" />
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full mt-2" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {/* Mobile skeleton */}
              <div className="sm:hidden space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="p-4 border rounded-md">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : guideData && guideData.sections.length > 0 ? (
            <>
              {/* Desktop/Tablet: Grid layout */}
              <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {guideData.sections.map(section => {
                  const Icon = getIcon(section.icon);
                  return (
                    <Link key={section.id} href={`/guide/section/${section.slug}`}>
                      <Card className="h-full hover-elevate cursor-pointer transition-all" data-testid={`card-section-${section.slug}`}>
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-md">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-lg line-clamp-2">{section.title}</CardTitle>
                                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                              </div>
                              {section.description && (
                                <CardDescription className="line-clamp-2 mt-1">{section.description}</CardDescription>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">
                              Тем: {section.topicsCount}
                            </Badge>
                            <Badge variant="outline">
                              Статей: {section.articlesCount}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              {/* Mobile: Accordion layout */}
              <div className="sm:hidden">
                <Accordion type="single" collapsible className="space-y-2">
                  {guideData.sections.map(section => {
                    const Icon = getIcon(section.icon);
                    return (
                      <AccordionItem 
                        key={section.id} 
                        value={`section-${section.id}`}
                        className="border rounded-md px-4 bg-card"
                        data-testid={`accordion-section-${section.slug}`}
                      >
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-primary/10 rounded-md flex-shrink-0">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-base">{section.title}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {section.topicsCount} тем
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {section.articlesCount} статей
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          {section.description && (
                            <p className="text-sm text-muted-foreground mb-4 pl-14">
                              {section.description}
                            </p>
                          )}
                          <div className="pl-14">
                            <Button variant="default" size="sm" asChild>
                              <Link href={`/guide/section/${section.slug}`}>
                                Открыть раздел
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </>
          ) : (
            <Card className="text-center py-12">
              <CardContent className="flex flex-col items-center gap-4">
                <BookOpen className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="font-medium mb-1">Справочник пуст</h3>
                  <p className="text-sm text-muted-foreground">
                    Разделы справочника пока не настроены
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-center mt-8">
            <Button variant="outline" asChild>
              <Link href="/guide">
                Открыть справочник
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
      <PromoPopup />
    </div>
  );
}
