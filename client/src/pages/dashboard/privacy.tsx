import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type PdnStatus = {
  lastGivenAt: string | null;
  lastWithdrawnAt: string | null;
  scheduledDestructionAt: string | null;
  destructionStatus: "NONE" | "SCHEDULED" | "DONE" | "LEGAL_HOLD";
  documentVersion: string;
};

export default function PrivacyPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const { data: pdnStatus, isLoading } = useQuery<PdnStatus>({
    queryKey: ["/api/me/pdn-status"],
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/me/withdraw-pdn-consent", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Согласие отозвано",
        description: `Ваши данные будут удалены ${format(new Date(data.scheduledDestructionAt), "dd MMMM yyyy", { locale: ru })}`,
      });
      setConfirmDialogOpen(false);
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отозвать согласие",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd MMMM yyyy, HH:mm", { locale: ru });
  };

  const getStatusBadge = () => {
    if (!pdnStatus) return null;
    
    switch (pdnStatus.destructionStatus) {
      case "SCHEDULED":
        return (
          <Badge variant="destructive" className="gap-1">
            <Clock className="h-3 w-3" />
            Удаление запланировано
          </Badge>
        );
      case "DONE":
        return (
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Данные удалены
          </Badge>
        );
      case "LEGAL_HOLD":
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Удаление приостановлено
          </Badge>
        );
      default:
        if (pdnStatus.lastGivenAt) {
          return (
            <Badge variant="default" className="gap-1 bg-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Согласие действует
            </Badge>
          );
        }
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/10 rounded-full">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Управление персональными данными</h1>
          <p className="text-muted-foreground">
            Согласно 152-ФЗ вы имеете право на управление своими персональными данными
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg">Статус согласия на обработку ПДн</CardTitle>
            {getStatusBadge()}
          </div>
          <CardDescription>
            Версия документа: {pdnStatus?.documentVersion || "1.0"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4 p-3 bg-muted/50 rounded-md">
              <span className="text-muted-foreground">Согласие дано</span>
              <span className="font-medium">{formatDate(pdnStatus?.lastGivenAt || null)}</span>
            </div>
            
            {pdnStatus?.lastWithdrawnAt && (
              <div className="flex justify-between gap-4 p-3 bg-muted/50 rounded-md">
                <span className="text-muted-foreground">Согласие отозвано</span>
                <span className="font-medium">{formatDate(pdnStatus.lastWithdrawnAt)}</span>
              </div>
            )}
            
            {pdnStatus?.scheduledDestructionAt && (
              <div className="flex justify-between gap-4 p-3 bg-destructive/10 rounded-md">
                <span className="text-destructive">Дата удаления данных</span>
                <span className="font-medium text-destructive">
                  {formatDate(pdnStatus.scheduledDestructionAt)}
                </span>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href="/personal-data-consent" target="_blank">
                <FileText className="h-4 w-4 mr-2" />
                Политика обработки ПДн
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {pdnStatus?.destructionStatus === "NONE" && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Отзыв согласия и удаление данных
            </CardTitle>
            <CardDescription>
              Вы можете отозвать согласие на обработку персональных данных
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Внимание</AlertTitle>
              <AlertDescription>
                После отзыва согласия ваши персональные данные будут удалены в течение 30 дней 
                согласно ст.21 п.5 Федерального закона 152-ФЗ. Это действие необратимо.
                Вы потеряете доступ к аккаунту и всем связанным данным.
              </AlertDescription>
            </Alert>

            <Button 
              variant="destructive" 
              onClick={() => setConfirmDialogOpen(true)}
              data-testid="button-withdraw-consent"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Отозвать согласие и удалить данные
            </Button>
          </CardContent>
        </Card>
      )}

      {pdnStatus?.destructionStatus === "SCHEDULED" && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Удаление запланировано</AlertTitle>
          <AlertDescription>
            Ваши персональные данные будут безвозвратно удалены{" "}
            {formatDate(pdnStatus.scheduledDestructionAt)}.
            Если вы передумали, обратитесь в службу поддержки.
          </AlertDescription>
        </Alert>
      )}

      {pdnStatus?.destructionStatus === "LEGAL_HOLD" && (
        <Alert variant="default">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Удаление приостановлено</AlertTitle>
          <AlertDescription>
            Удаление ваших данных временно приостановлено по требованию законодательства.
            Для получения информации обратитесь в службу поддержки.
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Подтверждение отзыва согласия
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                Вы собираетесь отозвать согласие на обработку персональных данных.
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Ваш аккаунт будет деактивирован</li>
                <li>Данные будут удалены через 30 дней</li>
                <li>Это действие <strong>необратимо</strong></li>
              </ul>
              <p className="font-medium">
                Вы уверены, что хотите продолжить?
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={withdrawMutation.isPending}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending}
              data-testid="button-confirm-withdraw"
            >
              {withdrawMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Обработка...
                </>
              ) : (
                "Да, отозвать согласие"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
