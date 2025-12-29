import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  Activity,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  FileText,
  Search,
  Zap,
  ExternalLink,
} from "lucide-react";

interface ExpressCheck {
  id: number;
  token: string;
  websiteUrl: string;
  status: string;
  scorePercent: number | null;
  severity: string | null;
  passedCount: number | null;
  warningCount: number | null;
  failedCount: number | null;
  createdAt: string;
  fullReportPurchased: boolean;
}

export default function DashboardExpressChecksPage() {
  const [urlInput, setUrlInput] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [consents, setConsents] = useState({
    privacy: false,
    pdn: false,
    offer: false,
  });

  const { data: expressChecks, isLoading } = useQuery<ExpressCheck[]>({
    queryKey: ["/api/my-express-checks"],
  });

  const handleExpressCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    if (!consents.privacy || !consents.pdn || !consents.offer) return;

    setIsChecking(true);
    try {
      const response = await fetch("/api/public/express-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: urlInput }),
      });
      const data = await response.json();
      if (data.token) {
        window.location.href = `/express-result/${data.token}`;
      }
    } finally {
      setIsChecking(false);
    }
  };

  const getSeverityBadge = (severity: string | null, score: number | null) => {
    if (!severity || score === null) {
      return <Badge variant="secondary">Ожидание</Badge>;
    }
    if (severity === "low" || score >= 80) {
      return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Низкий риск</Badge>;
    }
    if (severity === "medium" || score >= 50) {
      return <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">Средний риск</Badge>;
    }
    return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">Высокий риск</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "processing":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const allConsentsAccepted = consents.privacy && consents.pdn && consents.offer;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Экспресс-проверки
          </h1>
          <p className="text-muted-foreground mt-1">
            Быстрая бесплатная проверка сайта на соответствие законодательству
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Новая экспресс-проверка
            </CardTitle>
            <CardDescription>
              Бесплатный анализ основных требований. После проверки можно заказать полный отчёт за 900 ₽
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleExpressCheck} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">URL сайта</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="url"
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="securelex.ru"
                    className="pl-10"
                    required
                    data-testid="input-express-url"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Можно вводить: example.com, www.example.com или https://example.com
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="privacy"
                    checked={consents.privacy}
                    onCheckedChange={(checked) => setConsents({ ...consents, privacy: !!checked })}
                    data-testid="checkbox-privacy"
                  />
                  <Label htmlFor="privacy" className="text-sm leading-tight cursor-pointer">
                    Я ознакомлен с{" "}
                    <Link href="/privacy-policy" className="text-primary underline">
                      политикой конфиденциальности
                    </Link>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="pdn"
                    checked={consents.pdn}
                    onCheckedChange={(checked) => setConsents({ ...consents, pdn: !!checked })}
                    data-testid="checkbox-pdn"
                  />
                  <Label htmlFor="pdn" className="text-sm leading-tight cursor-pointer">
                    Даю{" "}
                    <Link href="/personal-data-agreement" className="text-primary underline">
                      согласие на обработку персональных данных
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
                      договора оферты
                    </Link>
                  </Label>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isChecking || !allConsentsAccepted}
                data-testid="button-start-express-check"
              >
                {isChecking ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Проверяем...
                  </>
                ) : (
                  <>
                    Проверить бесплатно
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>История проверок</CardTitle>
              <CardDescription>Ваши экспресс-проверки</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : expressChecks && expressChecks.length > 0 ? (
              <div className="space-y-3">
                {expressChecks.map((check) => (
                  <Link
                    key={check.id}
                    href={`/express-result/${check.token}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer group"
                    data-testid={`link-express-check-${check.id}`}
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {getStatusIcon(check.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {check.websiteUrl.replace(/^https?:\/\//, "")}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(check.createdAt).toLocaleDateString("ru-RU")}</span>
                        {check.status === "completed" && check.scorePercent !== null && (
                          <>
                            <span className="text-green-600">OK: {check.passedCount}</span>
                            <span className="text-yellow-600">Внимание: {check.warningCount}</span>
                            <span className="text-red-600">Ошибки: {check.failedCount}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {check.fullReportPurchased && (
                        <Badge variant="secondary" className="gap-1">
                          <FileText className="h-3 w-3" />
                          Отчёт
                        </Badge>
                      )}
                      {getSeverityBadge(check.severity, check.scorePercent)}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-muted-foreground">У вас пока нет проверок</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Введите URL сайта для экспресс-проверки
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
