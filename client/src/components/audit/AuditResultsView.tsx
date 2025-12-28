import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Server,
  Globe,
  FileText,
  CreditCard,
  Loader2,
  Shield,
  Info,
  MapPin,
  RefreshCw,
  ChevronRight,
  Scale,
} from "lucide-react";
import type { BriefResults, HostingInfo, BriefHighlight } from "@shared/schema";

interface SiteTypeInfo {
  type: string;
  name: string;
  description: string;
  baseAuditPrice: number;
  confidence: "high" | "medium" | "low";
  signals: string[];
}

interface AuditResultsViewProps {
  results: BriefResults;
  isExpress?: boolean;
  onPurchaseFullReport?: () => void;
  onReset?: () => void;
  isPurchasing?: boolean;
  siteType?: SiteTypeInfo | null;
  fullReportPrice?: number;
}

function getStatusIcon(status: string, className = "w-4 h-4") {
  switch (status) {
    case "ok":
    case "passed":
      return <CheckCircle2 className={`${className} text-emerald-500`} />;
    case "warn":
    case "warning":
      return <AlertTriangle className={`${className} text-amber-500`} />;
    case "fail":
    case "failed":
      return <XCircle className={`${className} text-rose-500`} />;
    default:
      return <HelpCircle className={`${className} text-muted-foreground`} />;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "high":
      return <Badge variant="destructive">Критично</Badge>;
    case "medium":
      return <Badge className="bg-amber-500 text-white">Внимание</Badge>;
    case "low":
      return <Badge className="bg-emerald-500 text-white">Отлично</Badge>;
    default:
      return <Badge variant="secondary">Неизвестно</Badge>;
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "high":
      return "text-rose-500";
    case "medium":
      return "text-amber-500";
    case "low":
      return "text-emerald-500";
    default:
      return "text-muted-foreground";
  }
}

function getHostingStatusDisplay(status: string) {
  switch (status) {
    case "ru":
    case "russian":
      return { 
        icon: <MapPin className="w-5 h-5 text-emerald-500" />, 
        label: "Россия", 
        color: "text-emerald-600",
        bgColor: "bg-emerald-500/10",
        isCritical: false
      };
    case "foreign":
      return { 
        icon: <XCircle className="w-5 h-5 text-rose-500" />, 
        label: "Зарубежный", 
        color: "text-rose-600",
        bgColor: "bg-rose-500/10",
        isCritical: true
      };
    default:
      return { 
        icon: <HelpCircle className="w-5 h-5 text-muted-foreground" />, 
        label: "Не определено", 
        color: "text-muted-foreground",
        bgColor: "bg-muted/30",
        isCritical: false
      };
  }
}

function ScoreCircle({ percent, severity }: { percent: number; severity: string }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = (percent / 100) * circumference;
  const colorClass = getSeverityColor(severity);

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={colorClass}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${colorClass}`}>{percent}</span>
        <span className="text-xs text-muted-foreground">баллов</span>
      </div>
    </div>
  );
}

function StatsSummary({ totals }: { totals: { checks: number; ok: number; warn: number; fail: number; na: number } }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex items-center justify-center gap-1.5 p-2 rounded-md bg-emerald-500/10">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <span className="font-semibold text-emerald-600">{totals.ok}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">OK</span>
      </div>
      <div className="flex items-center justify-center gap-1.5 p-2 rounded-md bg-amber-500/10">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className="font-semibold text-amber-600">{totals.warn}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">Внимание</span>
      </div>
      <div className="flex items-center justify-center gap-1.5 p-2 rounded-md bg-rose-500/10">
        <XCircle className="w-4 h-4 text-rose-500" />
        <span className="font-semibold text-rose-600">{totals.fail}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">Ошибки</span>
      </div>
    </div>
  );
}

function HostingInfoBlock({ hosting }: { hosting: HostingInfo }) {
  const statusDisplay = getHostingStatusDisplay(hosting.status);
  const needsVerification = hosting.confidence < 0.8;

  return (
    <div className={`rounded-lg p-4 ${statusDisplay.bgColor} border ${statusDisplay.isCritical ? 'border-rose-500' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          {statusDisplay.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold ${statusDisplay.color}`}>
              Хостинг: {statusDisplay.label}
            </span>
            {statusDisplay.isCritical && (
              <Badge variant="destructive" className="text-xs">
                Критично
              </Badge>
            )}
            {needsVerification && (
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    Уровень уверенности: {Math.round(hosting.confidence * 100)}%.
                    Рекомендуется дополнительная проверка.
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {statusDisplay.isCritical && (
            <p className="text-xs text-rose-600 mt-1">
              Нарушение ст. 18 ч. 5 ФЗ-152: ПДн граждан РФ должны храниться на территории РФ
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-1">
            {hosting.providerGuess && (
              <span>
                <Server className="w-3 h-3 inline mr-1" />
                {hosting.providerGuess}
              </span>
            )}
            {hosting.ips && hosting.ips.length > 0 && (
              <span className="font-mono">
                {hosting.ips.slice(0, 2).join(", ")}
                {hosting.ips.length > 2 && ` +${hosting.ips.length - 2}`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightsTable({ highlights }: { highlights: BriefHighlight[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Ключевые проверки ({highlights.length})
      </h3>
      <Accordion type="multiple" className="space-y-1">
        {highlights.map((item, index) => (
          <AccordionItem
            key={item.id || index}
            value={item.id || String(index)}
            className="border rounded-md px-3 bg-card"
          >
            <AccordionTrigger className="py-2 hover:no-underline gap-3">
              <div className="flex items-center gap-3 flex-1 text-left">
                {getStatusIcon(item.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.summary}
                  </p>
                </div>
                {item.severity === "critical" && (
                  <Badge variant="destructive" className="text-xs shrink-0">
                    Критично
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-3">
              <div className="space-y-2 text-sm">
                {item.howToFixShort && (
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Рекомендация:
                    </p>
                    <p className="text-sm">{item.howToFixShort}</p>
                  </div>
                )}
                {item.law && item.law.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.law.map((l, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {l.act} {l.ref}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function CtaBlock({
  cta,
  onPurchaseFullReport,
  isPurchasing,
}: {
  cta: { fullReportPriceRub: number; fullReportIncludes: string[] };
  onPurchaseFullReport?: () => void;
  isPurchasing?: boolean;
}) {
  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Это краткий отчёт. Полная карта рисков и план исправлений доступны в
          полном отчёте.
        </p>
      </div>

      <div className="grid gap-3">

        <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-semibold">Полный отчёт</span>
            </div>
            <span className="text-xl font-bold text-primary">
              {cta.fullReportPriceRub} ₽
            </span>
          </div>

          <ul className="text-xs text-muted-foreground space-y-1.5">
            {cta.fullReportIncludes.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {onPurchaseFullReport && (
            <Button
              className="w-full"
              onClick={onPurchaseFullReport}
              disabled={isPurchasing}
              data-testid="button-purchase-full-report"
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Купить за {cta.fullReportPriceRub} ₽
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuditResultsView({
  results,
  isExpress = true,
  onPurchaseFullReport,
  onReset,
  isPurchasing,
  siteType,
  fullReportPrice = 900,
}: AuditResultsViewProps) {
  return (
    <div className="space-y-5" data-testid="express-results-view">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">
            {isExpress ? "Результаты экспресс-аудита" : "Результаты аудита"}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-audited-domain">
          {results.site.domain}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <ScoreCircle
          percent={results.score.percent}
          severity={results.score.severity}
        />
        {getSeverityBadge(results.score.severity)}
      </div>

      <StatsSummary totals={results.score.totals} />

      <HostingInfoBlock hosting={results.hosting} />

      {siteType && (
        <div className="rounded-lg p-4 bg-muted/30 border">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Тип сайта</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-sm font-medium">{siteType.name}</span>
              <p className="text-xs text-muted-foreground">{siteType.description}</p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {siteType.confidence === "high" ? "Уверенно" : 
               siteType.confidence === "medium" ? "Вероятно" : "Приблизительно"}
            </Badge>
          </div>
        </div>
      )}

      <HighlightsTable highlights={results.highlights} />

      {isExpress && results.cta && (
        <CtaBlock
          cta={results.cta}
          onPurchaseFullReport={onPurchaseFullReport}
          isPurchasing={isPurchasing}
        />
      )}

      {onReset && (
        <div className="pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="w-full text-muted-foreground"
            data-testid="button-new-check"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Проверить другой сайт
          </Button>
        </div>
      )}
    </div>
  );
}

export default AuditResultsView;
