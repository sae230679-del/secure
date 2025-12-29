import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Percent, Calendar, ArrowRight, Tag, Clock, CheckCircle } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function PromotionsPage() {
  return (
    <>
      <Helmet>
        <title>Акции и скидки | SecureLex.ru</title>
        <meta name="description" content="Актуальные акции и скидки на проверку сайтов на соответствие ФЗ-152 и ФЗ-149. Промокоды и специальные предложения." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Gift className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Акции и специальные предложения</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Воспользуйтесь нашими актуальными предложениями для проверки вашего сайта на соответствие законодательству РФ
            </p>
          </div>

          <div className="space-y-6">
            <Card className="overflow-hidden border-2 border-primary/20">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <Percent className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="default" className="bg-primary">
                        <Tag className="h-3 w-3 mr-1" />
                        ZIMA25
                      </Badge>
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        Ограничено
                      </Badge>
                    </div>
                    <h2 className="text-xl font-bold mb-2">
                      Скидка 25% на все виды проверок и полный аудит
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      Введите промокод <span className="font-mono font-bold text-foreground">ZIMA25</span> при 
                      оформлении любой услуги и получите скидку 25% на экспресс-проверку, полный аудит и 
                      детализированный отчёт.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Экспресс-проверка
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Полный аудит
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Детализированный отчёт
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Link href="/">
                      <Button size="lg" data-testid="button-use-promo-zima25">
                        Использовать
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-2 border-accent/30">
              <div className="bg-gradient-to-r from-accent/10 to-accent/5 p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                      <Calendar className="h-8 w-8 text-accent-foreground" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="secondary">
                        <Calendar className="h-3 w-3 mr-1" />
                        До 31 января 2026
                      </Badge>
                      <Badge variant="outline" className="border-orange-500 text-orange-600">
                        <Clock className="h-3 w-3 mr-1" />
                        Осталось мало времени
                      </Badge>
                    </div>
                    <h2 className="text-xl font-bold mb-2">
                      Зафиксируй цены 2025 года до 31 января 2026 года!
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      Успейте заказать аудит или проверку сайта по ценам 2025 года. После 31 января 2026 года 
                      цены на все услуги будут повышены. Оставьте заявку сейчас и сохраните выгодные условия!
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Фиксация текущих цен
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Приоритетная обработка
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Гарантия условий
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Link href="/promotion/price-lock">
                      <Button size="lg" variant="outline" data-testid="button-price-lock-promo">
                        Участвовать
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground">
              Акции действуют на все виды услуг и могут быть изменены без предварительного уведомления.
              Подробности уточняйте у менеджера.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
