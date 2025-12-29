import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ExpressReportOrder, FullAuditOrder } from "@shared/schema";
import { useState } from "react";
import {
  FileText,
  Globe,
  CheckCircle2,
  Loader2,
  Clock,
  Trash2,
  Play,
  Mail,
  Phone,
  User,
  Building2,
  MessageCircle,
  ExternalLink,
} from "lucide-react";

export default function AdminOrdersPage() {
  const { toast } = useToast();
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);
  const [deleteOrderType, setDeleteOrderType] = useState<"express" | "full" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: expressOrders, isLoading: loadingExpress } = useQuery<ExpressReportOrder[]>({
    queryKey: ["/api/admin/orders/express-reports"],
  });

  const { data: fullAuditOrders, isLoading: loadingFullAudit } = useQuery<FullAuditOrder[]>({
    queryKey: ["/api/admin/orders/full-audits"],
  });

  const updateExpressStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/orders/express-reports/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders/express-reports"] });
      toast({
        title: "Статус обновлён",
        description: "Статус заявки успешно изменён.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFullAuditStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/orders/full-audits/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders/full-audits"] });
      toast({
        title: "Статус обновлён",
        description: "Статус заявки успешно изменён.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteExpressOrderMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/orders/express-reports/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders/express-reports"] });
      toast({
        title: "Заявка удалена",
        description: "Заявка успешно удалена из системы.",
      });
      setConfirmDelete(false);
      setDeleteOrderId(null);
      setDeleteOrderType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFullAuditOrderMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/orders/full-audits/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders/full-audits"] });
      toast({
        title: "Заявка удалена",
        description: "Заявка успешно удалена из системы.",
      });
      setConfirmDelete(false);
      setDeleteOrderId(null);
      setDeleteOrderType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (id: number, type: "express" | "full") => {
    setDeleteOrderId(id);
    setDeleteOrderType(type);
    setConfirmDelete(true);
  };

  const handleConfirmDelete = () => {
    if (deleteOrderId && deleteOrderType) {
      if (deleteOrderType === "express") {
        deleteExpressOrderMutation.mutate(deleteOrderId);
      } else {
        deleteFullAuditOrderMutation.mutate(deleteOrderId);
      }
    }
  };

  const getExpressStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Ожидает
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-600">
            <Loader2 className="h-3 w-3" />
            В работе
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Выполнена
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="gap-1">
            Отменена
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFullAuditStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Ожидает
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-600">
            <Loader2 className="h-3 w-3" />
            В работе
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Выполнена
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="gap-1">
            Отменена
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Заявки</h1>
        <p className="text-muted-foreground mt-1">
          Управление заявками на полные отчёты и аудиты
        </p>
      </div>

      <Tabs defaultValue="express" className="space-y-4">
        <TabsList>
          <TabsTrigger value="express" className="gap-2" data-testid="tab-express-orders">
            <FileText className="h-4 w-4" />
            Полный отчёт (900₽)
            {expressOrders && expressOrders.length > 0 && (
              <Badge variant="secondary" className="ml-1">{expressOrders.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="full-audit" className="gap-2" data-testid="tab-full-audit-orders">
            <Globe className="h-4 w-4" />
            Полный аудит
            {fullAuditOrders && fullAuditOrders.length > 0 && (
              <Badge variant="secondary" className="ml-1">{fullAuditOrders.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="express">
          <Card>
            <CardHeader>
              <CardTitle>Заявки на полный отчёт</CardTitle>
              <CardDescription>
                Заявки с экспресс-проверки на детальный отчёт за 900₽
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingExpress ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !expressOrders || expressOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Заявок пока нет</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead>Сайт</TableHead>
                      <TableHead>Контакты</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expressOrders.map((order) => (
                      <TableRow key={order.id} data-testid={`row-express-order-${order.id}`}>
                        <TableCell className="font-mono text-sm">#{order.id}</TableCell>
                        <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <a 
                              href={order.websiteUrl.startsWith('http') ? order.websiteUrl : `https://${order.websiteUrl}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              {order.websiteUrl}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {order.email}
                            </div>
                            {order.name && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <User className="h-3 w-3" />
                                {order.name}
                              </div>
                            )}
                            {order.phone && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {order.phone}
                              </div>
                            )}
                            {order.socialNetwork && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MessageCircle className="h-3 w-3" />
                                {order.socialNetwork}: {order.messengerContact || order.socialContact}
                              </div>
                            )}
                            {!order.isIndividual && order.inn && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                ИНН: {order.inn}
                              </div>
                            )}
                            {order.isIndividual && (
                              <div className="text-xs text-muted-foreground">Физ. лицо</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getExpressStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {order.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateExpressStatusMutation.mutate({ id: order.id, status: "processing" })}
                                disabled={updateExpressStatusMutation.isPending}
                                data-testid={`button-start-order-${order.id}`}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                В работу
                              </Button>
                            )}
                            {order.status === "processing" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateExpressStatusMutation.mutate({ id: order.id, status: "completed" })}
                                disabled={updateExpressStatusMutation.isPending}
                                data-testid={`button-complete-order-${order.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Готово
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteClick(order.id, "express")}
                              data-testid={`button-delete-order-${order.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="full-audit">
          <Card>
            <CardHeader>
              <CardTitle>Заявки на полный аудит сайта</CardTitle>
              <CardDescription>
                Заявки на комплексный аудит с пакетом документов
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingFullAudit ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !fullAuditOrders || fullAuditOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Заявок пока нет</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead>Сайт</TableHead>
                      <TableHead>Контакты</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fullAuditOrders.map((order) => (
                      <TableRow key={order.id} data-testid={`row-full-audit-order-${order.id}`}>
                        <TableCell className="font-mono text-sm">#{order.id}</TableCell>
                        <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <a 
                              href={order.websiteUrl.startsWith('http') ? order.websiteUrl : `https://${order.websiteUrl}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              {order.websiteUrl}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {order.email}
                            </div>
                            {order.name && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <User className="h-3 w-3" />
                                {order.name}
                              </div>
                            )}
                            {order.phone && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {order.phone}
                              </div>
                            )}
                            {order.socialNetwork && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MessageCircle className="h-3 w-3" />
                                {order.socialNetwork}: {order.messengerContact}
                              </div>
                            )}
                            {!order.isIndividual && order.inn && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                ИНН: {order.inn}
                              </div>
                            )}
                            {order.isIndividual && (
                              <div className="text-xs text-muted-foreground">Физ. лицо</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getFullAuditStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {order.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateFullAuditStatusMutation.mutate({ id: order.id, status: "in_progress" })}
                                disabled={updateFullAuditStatusMutation.isPending}
                                data-testid={`button-start-full-order-${order.id}`}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                В работу
                              </Button>
                            )}
                            {order.status === "in_progress" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateFullAuditStatusMutation.mutate({ id: order.id, status: "completed" })}
                                disabled={updateFullAuditStatusMutation.isPending}
                                data-testid={`button-complete-full-order-${order.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Готово
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteClick(order.id, "full")}
                              data-testid={`button-delete-full-order-${order.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заявку?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Заявка будет удалена из системы навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
