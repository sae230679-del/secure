import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type SeoPage = {
  id: number;
  slug: string;
  h1: string;
  title: string;
  description: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function SeoManagementPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<SeoPage | null>(null);
  
  const [formData, setFormData] = useState({
    slug: "",
    h1: "",
    title: "",
    description: "",
    content: "",
    isActive: true,
  });

  const { data: pages, isLoading, refetch } = useQuery<SeoPage[]>({
    queryKey: ["/api/admin/seo-pages"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin/seo-pages", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Страница создана" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/seo-pages"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const response = await apiRequest("PUT", `/api/admin/seo-pages/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Страница обновлена" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/seo-pages"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/seo-pages/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Страница деактивирована" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/seo-pages"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      slug: "",
      h1: "",
      title: "",
      description: "",
      content: "",
      isActive: true,
    });
    setEditingPage(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (page: SeoPage) => {
    setEditingPage(page);
    setFormData({
      slug: page.slug,
      h1: page.h1,
      title: page.title,
      description: page.description,
      content: page.content,
      isActive: page.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingPage) {
      updateMutation.mutate({ id: editingPage.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd.MM.yyyy HH:mm", { locale: ru });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-full">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">SEO-страницы</h1>
          <p className="text-muted-foreground">
            Управление контентными страницами для поисковой оптимизации
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Список страниц</CardTitle>
              <CardDescription>
                Создавайте и редактируйте SEO-страницы
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Обновить
              </Button>
              <Button size="sm" onClick={openCreateDialog} data-testid="button-create-page">
                <Plus className="h-4 w-4 mr-2" />
                Создать страницу
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pages && pages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Заголовок</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Обновлено</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-mono text-sm">/{page.slug}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{page.h1}</TableCell>
                    <TableCell>
                      {page.isActive ? (
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <Eye className="h-3 w-3" />
                          Активна
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <EyeOff className="h-3 w-3" />
                          Скрыта
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(page.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/seo/${page.slug}`, "_blank")}
                          data-testid={`button-view-${page.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(page)}
                          data-testid={`button-edit-${page.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(page.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${page.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Нет SEO-страниц. Создайте первую страницу.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPage ? "Редактировать страницу" : "Создать страницу"}
            </DialogTitle>
            <DialogDescription>
              Заполните метаданные и контент страницы
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input
                  placeholder="proverka-saita"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                  data-testid="input-slug"
                />
              </div>
              <div className="space-y-2">
                <Label>H1 заголовок</Label>
                <Input
                  placeholder="Проверка сайта на соответствие"
                  value={formData.h1}
                  onChange={(e) => setFormData({ ...formData, h1: e.target.value })}
                  data-testid="input-h1"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Title (для поисковиков)</Label>
              <Input
                placeholder="Проверка сайта на соответствие 152-ФЗ | SecureLex"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-title"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Meta Description</Label>
              <Textarea
                placeholder="Описание страницы для поисковых систем..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                data-testid="input-description"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Контент (Markdown)</Label>
              <Textarea
                placeholder="# Заголовок&#10;&#10;Текст страницы..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={10}
                className="font-mono text-sm"
                data-testid="input-content"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-active"
              />
              <Label>Страница активна</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.slug || !formData.h1 || !formData.title || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-page"
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingPage ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
