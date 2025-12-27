import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Gift, Eye } from "lucide-react";
import type { Promotion } from "@shared/schema";

type PromotionForm = {
  title: string;
  description: string;
  discountText: string;
  bannerImageUrl: string;
  ctaText: string;
  ctaLink: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  showOnLanding: boolean;
  showPopup: boolean;
  showCountdown: boolean;
  priority: number;
};

const defaultForm: PromotionForm = {
  title: "",
  description: "",
  discountText: "",
  bannerImageUrl: "",
  ctaText: "Подробнее",
  ctaLink: "",
  startDate: "",
  endDate: "",
  isActive: true,
  showOnLanding: false,
  showPopup: false,
  showCountdown: false,
  priority: 0,
};

export default function AdminPromotionsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PromotionForm>(defaultForm);

  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ["/api/admin/promotions"],
  });

  const createMutation = useMutation({
    mutationFn: (data: PromotionForm) =>
      apiRequest("POST", "/api/admin/promotions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/active"] });
      toast({ title: "Акция создана" });
      closeDialog();
    },
    onError: () => toast({ title: "Ошибка создания акции", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/admin/promotions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/active"] });
      toast({ title: "Акция обновлена" });
      closeDialog();
    },
    onError: () => toast({ title: "Ошибка обновления", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/promotions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/active"] });
      toast({ title: "Акция удалена" });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const openEdit = (promo: Promotion) => {
    setEditingId(promo.id);
    setForm({
      title: promo.title,
      description: promo.description || "",
      discountText: promo.discountText || "",
      bannerImageUrl: promo.bannerImageUrl || "",
      ctaText: promo.ctaText || "Подробнее",
      ctaLink: promo.ctaLink || "",
      startDate: promo.startDate ? new Date(promo.startDate).toISOString().slice(0, 16) : "",
      endDate: promo.endDate ? new Date(promo.endDate).toISOString().slice(0, 16) : "",
      isActive: promo.isActive,
      showOnLanding: promo.showOnLanding,
      showPopup: promo.showPopup,
      showCountdown: promo.showCountdown,
      priority: promo.priority,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      ...form,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(form);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="h-6 w-6" />
            Управление акциями
          </h1>
          <p className="text-muted-foreground">Создание и редактирование промо-акций</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setForm(defaultForm); }} data-testid="button-add-promo">
              <Plus className="h-4 w-4 mr-2" />
              Добавить акцию
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Редактировать акцию" : "Новая акция"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="title">Заголовок *</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    data-testid="input-promo-title"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    data-testid="input-promo-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="discountText">Текст скидки</Label>
                    <Input
                      id="discountText"
                      placeholder="-20%"
                      value={form.discountText}
                      onChange={(e) => setForm({ ...form, discountText: e.target.value })}
                      data-testid="input-promo-discount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Приоритет</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                      data-testid="input-promo-priority"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="bannerImageUrl">URL баннера</Label>
                  <Input
                    id="bannerImageUrl"
                    value={form.bannerImageUrl}
                    onChange={(e) => setForm({ ...form, bannerImageUrl: e.target.value })}
                    placeholder="https://..."
                    data-testid="input-promo-banner"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ctaText">Текст кнопки</Label>
                    <Input
                      id="ctaText"
                      value={form.ctaText}
                      onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                      data-testid="input-promo-cta-text"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ctaLink">Ссылка кнопки</Label>
                    <Input
                      id="ctaLink"
                      value={form.ctaLink}
                      onChange={(e) => setForm({ ...form, ctaLink: e.target.value })}
                      placeholder="/packages"
                      data-testid="input-promo-cta-link"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Дата начала</Label>
                    <Input
                      id="startDate"
                      type="datetime-local"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      data-testid="input-promo-start"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">Дата окончания</Label>
                    <Input
                      id="endDate"
                      type="datetime-local"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      data-testid="input-promo-end"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isActive"
                      checked={form.isActive}
                      onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                      data-testid="switch-promo-active"
                    />
                    <Label htmlFor="isActive">Активна</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="showOnLanding"
                      checked={form.showOnLanding}
                      onCheckedChange={(checked) => setForm({ ...form, showOnLanding: checked })}
                      data-testid="switch-promo-landing"
                    />
                    <Label htmlFor="showOnLanding">На лендинге</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="showPopup"
                      checked={form.showPopup}
                      onCheckedChange={(checked) => setForm({ ...form, showPopup: checked })}
                      data-testid="switch-promo-popup"
                    />
                    <Label htmlFor="showPopup">Всплывающее окно</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="showCountdown"
                      checked={form.showCountdown}
                      onCheckedChange={(checked) => setForm({ ...form, showCountdown: checked })}
                      data-testid="switch-promo-countdown"
                    />
                    <Label htmlFor="showCountdown">Таймер</Label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Отмена
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-promo">
                  {editingId ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Акция</TableHead>
                <TableHead>Скидка</TableHead>
                <TableHead>Период</TableHead>
                <TableHead>Отображение</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : promotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Нет акций. Создайте первую акцию.
                  </TableCell>
                </TableRow>
              ) : (
                promotions.map((promo) => (
                  <TableRow key={promo.id} data-testid={`row-promo-${promo.id}`}>
                    <TableCell>
                      <div className="font-medium">{promo.title}</div>
                      {promo.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {promo.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {promo.discountText ? (
                        <Badge variant="secondary">{promo.discountText}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{formatDate(promo.startDate)}</div>
                      <div>{formatDate(promo.endDate)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {promo.showOnLanding && <Badge variant="outline">Лендинг</Badge>}
                        {promo.showPopup && <Badge variant="outline">Popup</Badge>}
                        {promo.showCountdown && <Badge variant="outline">Таймер</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={promo.isActive ? "default" : "secondary"}>
                        {promo.isActive ? "Активна" : "Неактивна"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(promo)}
                          data-testid={`button-edit-promo-${promo.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Удалить акцию?")) {
                              deleteMutation.mutate(promo.id);
                            }
                          }}
                          data-testid={`button-delete-promo-${promo.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
