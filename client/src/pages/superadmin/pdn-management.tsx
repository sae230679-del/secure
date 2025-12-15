import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  Loader2,
  Search,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type PdnConsentEvent = {
  id: number;
  userId: number;
  eventType: "GIVEN" | "WITHDRAWN";
  documentVersion: string;
  eventAt: string;
  source: string;
};

type PdnConsentWithUser = {
  id: number;
  userId: number;
  eventType: "GIVEN" | "WITHDRAWN";
  documentVersion: string;
  eventAt: string;
  source: string;
  userEmail: string;
};

type PdnDestructionTask = {
  id: number;
  userId: number;
  status: "SCHEDULED" | "DONE" | "LEGAL_HOLD";
  scheduledAt: string;
  doneAt: string | null;
  legalHoldReason: string | null;
  createdAt: string;
};

export default function PdnManagementPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [legalHoldDialogOpen, setLegalHoldDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [legalHoldReason, setLegalHoldReason] = useState("");

  const { data: consents, isLoading: consentsLoading, refetch: refetchConsents } = useQuery<PdnConsentWithUser[]>({
    queryKey: ["/api/admin/pdn/consents"],
  });

  const { data: withdrawals, isLoading: withdrawalsLoading, refetch: refetchWithdrawals } = useQuery<PdnConsentEvent[]>({
    queryKey: ["/api/admin/pdn/withdrawals"],
  });

  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<PdnDestructionTask[]>({
    queryKey: ["/api/admin/pdn/destruction-tasks"],
  });

  const legalHoldMutation = useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: number; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/pdn/destruction-tasks/${taskId}/legal-hold`, { reason });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Legal hold установлен" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pdn/destruction-tasks"] });
      setLegalHoldDialogOpen(false);
      setLegalHoldReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await apiRequest("POST", `/api/admin/pdn/destruction-tasks/${taskId}/run-now`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Удаление выполнено", description: `Акт ID: ${data.actId}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pdn/destruction-tasks"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const releaseHoldMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await apiRequest("POST", `/api/admin/pdn/destruction-tasks/${taskId}/release-hold`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Legal hold снят" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pdn/destruction-tasks"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd.MM.yyyy HH:mm", { locale: ru });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Запланировано</Badge>;
      case "DONE":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" />Выполнено</Badge>;
      case "LEGAL_HOLD":
        return <Badge variant="secondary" className="gap-1"><Pause className="h-3 w-3" />Legal Hold</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTasks = tasks?.filter(task => 
    task.userId.toString().includes(searchQuery) ||
    task.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-full">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Управление ПДн</h1>
          <p className="text-muted-foreground">
            Мониторинг согласий и задач уничтожения персональных данных
          </p>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="consents" className="gap-2" data-testid="tab-consents">
            <CheckCircle2 className="h-4 w-4" />
            Согласия
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2" data-testid="tab-tasks">
            <Trash2 className="h-4 w-4" />
            Задачи уничтожения
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-2" data-testid="tab-withdrawals">
            <AlertTriangle className="h-4 w-4" />
            Отзывы согласий
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consents" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Все согласия на обработку ПДн</CardTitle>
                  <CardDescription>
                    История согласий пользователей с версией документа
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchConsents()} data-testid="button-refresh-consents">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Обновить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {consentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !consents || consents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет записей о согласиях
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Пользователь</TableHead>
                      <TableHead>Тип события</TableHead>
                      <TableHead>Версия документа</TableHead>
                      <TableHead>Источник</TableHead>
                      <TableHead>Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consents.map((consent) => (
                      <TableRow key={consent.id} data-testid={`row-consent-${consent.id}`}>
                        <TableCell>{consent.id}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            {consent.userEmail === "deleted@anonymized.local" ? (
                              <span className="text-muted-foreground italic">Анонимизирован</span>
                            ) : (
                              <span className="font-medium">{consent.userEmail || "Неизвестно"}</span>
                            )}
                            <span className="text-xs text-muted-foreground">ID: {consent.userId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {consent.eventType === "GIVEN" ? (
                            <Badge variant="default" className="gap-1 bg-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Дано
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Отозвано
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{consent.documentVersion}</Badge>
                        </TableCell>
                        <TableCell>{consent.source}</TableCell>
                        <TableCell>{formatDate(consent.eventAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Задачи уничтожения данных</CardTitle>
                  <CardDescription>
                    Запланированные и выполненные задачи удаления ПДн
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchTasks()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Обновить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по ID пользователя..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-tasks"
                  />
                </div>
              </div>

              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTasks && filteredTasks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Запланировано</TableHead>
                      <TableHead>Выполнено</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-mono">{task.id}</TableCell>
                        <TableCell>{task.userId}</TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>{formatDate(task.scheduledAt)}</TableCell>
                        <TableCell>{formatDate(task.doneAt)}</TableCell>
                        <TableCell>
                          {task.status === "SCHEDULED" && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTaskId(task.id);
                                  setLegalHoldDialogOpen(true);
                                }}
                                data-testid={`button-legal-hold-${task.id}`}
                              >
                                <Pause className="h-3 w-3 mr-1" />
                                Legal Hold
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => runNowMutation.mutate(task.id)}
                                disabled={runNowMutation.isPending}
                                data-testid={`button-run-now-${task.id}`}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Выполнить
                              </Button>
                            </div>
                          )}
                          {task.status === "LEGAL_HOLD" && (
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => releaseHoldMutation.mutate(task.id)}
                                disabled={releaseHoldMutation.isPending}
                                data-testid={`button-release-hold-${task.id}`}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Снять hold
                              </Button>
                              {task.legalHoldReason && (
                                <span className="text-xs text-muted-foreground">
                                  {task.legalHoldReason}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Нет задач уничтожения
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>История отзывов согласий</CardTitle>
                  <CardDescription>
                    Журнал событий отзыва согласия на обработку ПДн
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchWithdrawals()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Обновить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {withdrawalsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : withdrawals && withdrawals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Версия документа</TableHead>
                      <TableHead>Источник</TableHead>
                      <TableHead>Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono">{event.id}</TableCell>
                        <TableCell>{event.userId}</TableCell>
                        <TableCell>{event.documentVersion}</TableCell>
                        <TableCell>{event.source}</TableCell>
                        <TableCell>{formatDate(event.eventAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Нет отзывов согласий
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={legalHoldDialogOpen} onOpenChange={setLegalHoldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Установить Legal Hold</DialogTitle>
            <DialogDescription>
              Приостановить удаление данных по юридическим основаниям
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Основание</label>
              <Input
                placeholder="Укажите причину приостановки..."
                value={legalHoldReason}
                onChange={(e) => setLegalHoldReason(e.target.value)}
                data-testid="input-legal-hold-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLegalHoldDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => selectedTaskId && legalHoldMutation.mutate({ taskId: selectedTaskId, reason: legalHoldReason })}
              disabled={!legalHoldReason.trim() || legalHoldMutation.isPending}
              data-testid="button-confirm-legal-hold"
            >
              {legalHoldMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Установить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
