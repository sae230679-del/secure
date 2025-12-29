import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import type { AuditWithDetails } from "@shared/schema";
import {
  FileSearch,
  Globe,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  CreditCard,
  Loader2,
  ArrowRight,
  Shield,
  ExternalLink,
  Package,
} from "lucide-react";

export default function DashboardAuditsPage() {
  const [urlInput, setUrlInput] = useState("");
  const [consents, setConsents] = useState({
    privacy: false,
    pdn: false,
    offer: false,
  });

  const { data: audits, isLoading } = useQuery<AuditWithDetails[]>({
    queryKey: ["/api/audits"],
  });

  const handleSubmitAuditRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    if (!consents.privacy || !consents.pdn || !consents.offer) return;
    window.location.href = `/order-report?type=full&url=${encodeURIComponent(urlInput)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Готов
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Обработка
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Ошибка
          </Badge>
        );
      case "pending_payment":
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
            <CreditCard className="h-3 w-3" />
            Ожидает оплаты
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Ожидание
          </Badge>
        );
    }
  };

  const allConsentsAccepted = consents.privacy && consents.pdn && consents.offer;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-primary" />
            Полные аудиты
          </h1>
          <p className="text-muted-foreground mt-1">
            Комплексная проверка сайта с пакетом документов
          </p>
        </div>
        <Button asChild data-testid="button-view-packages">
          <Link href="/full-audit">
            Пакеты аудита
            <Package className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Заказать полный аудит
            </CardTitle>
            <CardDescription>
              Комплексная проверка сайта на соответствие ФЗ-152 и ФЗ-149 с пакетом документов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitAuditRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">URL сайта для аудита</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="url"
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com"
                    className="pl-10"
                    required
                    data-testid="input-audit-url"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="privacy"
                    checked={consents.privacy}
                    onCheckedChange={(checked) => setConsents({ ...consents, privacy: !!checked })}
                    data-testid="checkbox-audit-privacy"
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
                    data-testid="checkbox-audit-pdn"
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
                    data-testid="checkbox-audit-offer"
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
                disabled={!allConsentsAccepted}
                data-testid="button-order-audit"
              >
                Оформить заказ
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                После отправки формы мы свяжемся с вами для уточнения деталей
              </p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Мои аудиты</CardTitle>
              <CardDescription>Ваши заказанные аудиты</CardDescription>
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
            ) : audits && audits.length > 0 ? (
              <div className="space-y-3">
                {audits.map((audit) => (
                  <Link
                    key={audit.id}
                    href={`/dashboard/audits/${audit.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer group"
                    data-testid={`link-audit-${audit.id}`}
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {audit.websiteUrlNormalized.replace(/^https?:\/\//, "")}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{audit.package?.name || "Аудит"}</span>
                        {audit.createdAt && (
                          <>
                            <span>-</span>
                            <span>{new Date(audit.createdAt).toLocaleDateString("ru-RU")}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(audit.status)}
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <FileSearch className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-muted-foreground">У вас пока нет аудитов</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Закажите полный аудит сайта
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
