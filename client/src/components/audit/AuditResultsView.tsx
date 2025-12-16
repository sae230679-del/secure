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
  Download,
  CreditCard,
  Loader2,
  Shield,
  Info,
} from "lucide-react";
import type { BriefResults, HostingInfo, BriefHighlight } from "@shared/schema";

interface AuditResultsViewProps {
  results: BriefResults;
  isExpress?: boolean;
  onDownloadPdf?: () => void;
  onPurchaseFullReport?: () => void;
  isDownloading?: boolean;
  isPurchasing?: boolean;
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
      return { icon: "🇷🇺", label: "Россия", color: "text-emerald-600" };
    case "foreign":
      return { icon: "🌍", label: "Зарубежный", color: "text-amber-600" };
    default:
      return { icon: "❓", label: "Не определено", color: "text-muted-foreground" };
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

function HostingInfoBlock({ hosting }: { hosting: HostingInfo }) {
  const statusDisplay = getHostingStatusDisplay(hosting.status);
  const needsVerification = hosting.confidence < 0.8;

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Server className="w-4 h-4" />
          Размещение сервера
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{statusDisplay.icon}</span>
          <span className={`font-medium ${statusDisplay.color}`}>
            {statusDisplay.label}
          </span>
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
        {hosting.providerGuess && (
          <p className="text-sm text-muted-foreground">
            Провайдер: <span className="font-medium">{hosting.providerGuess}</span>
          </p>
        )}
        {hosting.ips && hosting.ips.length > 0 && (
          <p className="text-xs text-muted-foreground font-mono">
            IP: {hosting.ips.slice(0, 2).join(", ")}
            {hosting.ips.length > 2 && ` +${hosting.ips.length - 2}`}
          </p>
        )}
      </CardContent>
    </Card>
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
  onDownloadPdf,
  onPurchaseFullReport,
  isDownloading,
  isPurchasing,
}: {
  cta: { fullReportPriceRub: number; fullReportIncludes: string[] };
  onDownloadPdf?: () => void;
  onPurchaseFullReport?: () => void;
  isDownloading?: boolean;
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
        {onDownloadPdf && (
          <Button
            variant="outline"
            onClick={onDownloadPdf}
            disabled={isDownloading}
            className="w-full"
            data-testid="button-download-brief-pdf"
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Скачать краткий PDF
          </Button>
        )}

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
  onDownloadPdf,
  onPurchaseFullReport,
  isDownloading,
  isPurchasing,
}: AuditResultsViewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-1">
          {isExpress ? "Результаты экспресс-аудита" : "Результаты аудита"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {results.site.domain}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <ScoreCircle
          percent={results.score.percent}
          severity={results.score.severity}
        />
        <div className="flex items-center gap-2">
          {getSeverityBadge(results.score.severity)}
          <span className="text-sm text-muted-foreground">
            {results.score.totals.ok} пройдено, {results.score.totals.warn}{" "}
            предупреждений, {results.score.totals.fail} нарушений
          </span>
        </div>
      </div>

      <HostingInfoBlock hosting={results.hosting} />

      <HighlightsTable highlights={results.highlights} />

      {isExpress && results.cta && (
        <CtaBlock
          cta={results.cta}
          onDownloadPdf={onDownloadPdf}
          onPurchaseFullReport={onPurchaseFullReport}
          isDownloading={isDownloading}
          isPurchasing={isPurchasing}
        />
      )}
    </div>
  );
}

export default AuditResultsView;
