import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Eye, EyeOff, FileText, BarChart3 } from "lucide-react";
import type { GuideArticle } from "@shared/schema";

export default function GuideManagementPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<GuideArticle | null>(null);
  const [formData, setFormData] = useState({
    slug: "",
    title: "",
    summary: "",
    bodyBaseMd: "",
    bodyRegsMd: "",
    lawTags: "",
    topicTags: "",
    relatedServices: "",
  });

  const { data: articles, isLoading } = useQuery<GuideArticle[]>({
    queryKey: ["/api/admin/guide/articles", statusFilter !== "all" ? statusFilter : undefined],
  });

  const { data: stats } = useQuery<{ pageViews: number; readEnd: number; ctaClicks: number }>({
    queryKey: ["/api/admin/guide/stats"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/guide/articles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/articles"] });
      toast({ title: "Статья создана" });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/admin/guide/articles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/articles"] });
      toast({ title: "Статья обновлена" });
      setEditingArticle(null);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/admin/guide/articles/${id}/publish`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/articles"] });
      toast({ title: "Статья опубликована" });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/admin/guide/articles/${id}/unpublish`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/articles"] });
      toast({ title: "Статья снята с публикации" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/guide/articles/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/articles"] });
      toast({ title: "Статья удалена" });
    },
  });

  const resetForm = () => {
    setFormData({
      slug: "",
      title: "",
      summary: "",
      bodyBaseMd: "",
      bodyRegsMd: "",
      lawTags: "",
      topicTags: "",
      relatedServices: "",
    });
  };

  const openEditDialog = (article: GuideArticle) => {
    setEditingArticle(article);
    setFormData({
      slug: article.slug,
      title: article.title,
      summary: article.summary || "",
      bodyBaseMd: article.bodyBaseMd || "",
      bodyRegsMd: article.bodyRegsMd || "",
      lawTags: ((article.lawTags as string[]) || []).join(", "),
      topicTags: ((article.topicTags as string[]) || []).join(", "),
      relatedServices: ((article.relatedServices as string[]) || []).join(", "),
    });
  };

  const handleSubmit = () => {
    const data = {
      slug: formData.slug.trim(),
      title: formData.title.trim(),
      summary: formData.summary.trim() || null,
      bodyBaseMd: formData.bodyBaseMd || null,
      bodyRegsMd: formData.bodyRegsMd || null,
      lawTags: formData.lawTags.split(",").map(s => s.trim()).filter(Boolean),
      topicTags: formData.topicTags.split(",").map(s => s.trim()).filter(Boolean),
      relatedServices: formData.relatedServices.split(",").map(s => s.trim()).filter(Boolean),
    };

    if (editingArticle) {
      updateMutation.mutate({ id: editingArticle.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredArticles = statusFilter === "all" 
    ? articles 
    : articles?.filter(a => a.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Справочник</h1>
          <p className="text-muted-foreground">Управление статьями справочника</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-article">
              <Plus className="h-4 w-4 mr-2" />
              Создать статью
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Новая статья</DialogTitle>
            </DialogHeader>
            <ArticleForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Отмена</Button>
              </DialogClose>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Просмотры</CardDescription>
              <CardTitle className="text-2xl">{stats.pageViews}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Дочитываний</CardDescription>
              <CardTitle className="text-2xl">{stats.readEnd}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Клики CTA</CardDescription>
              <CardTitle className="text-2xl">{stats.ctaClicks}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Статьи</CardTitle>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="draft">Черновики</SelectItem>
              <SelectItem value="published">Опубликованные</SelectItem>
              <SelectItem value="archived">Архив</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Загрузка...</p>
          ) : filteredArticles && filteredArticles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Заголовок</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Теги</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.map(article => (
                  <TableRow key={article.id} data-testid={`row-article-${article.id}`}>
                    <TableCell className="font-medium max-w-xs truncate">{article.title}</TableCell>
                    <TableCell className="text-muted-foreground">{article.slug}</TableCell>
                    <TableCell>
                      <Badge variant={article.status === "published" ? "default" : "secondary"}>
                        {article.status === "published" ? "Опубликовано" : 
                         article.status === "draft" ? "Черновик" : "Архив"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {((article.lawTags as string[]) || []).slice(0, 2).map(tag => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {article.status === "published" ? (
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => unpublishMutation.mutate(article.id)}
                            data-testid={`button-unpublish-${article.id}`}
                          >
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => publishMutation.mutate(article.id)}
                            data-testid={`button-publish-${article.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => openEditDialog(article)}
                              data-testid={`button-edit-${article.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Редактировать статью</DialogTitle>
                            </DialogHeader>
                            <ArticleForm formData={formData} setFormData={setFormData} />
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Отмена</Button>
                              </DialogClose>
                              <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
                                Сохранить
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Удалить статью?")) {
                              deleteMutation.mutate(article.id);
                            }
                          }}
                          data-testid={`button-delete-${article.id}`}
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
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Статьи не найдены</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ArticleForm({ 
  formData, 
  setFormData 
}: { 
  formData: any; 
  setFormData: (data: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (URL)</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="example-article"
            data-testid="input-slug"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Заголовок</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Название статьи"
            data-testid="input-title"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="summary">Краткое описание</Label>
        <Textarea
          id="summary"
          value={formData.summary}
          onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
          placeholder="Краткое описание для карточки"
          rows={2}
          data-testid="input-summary"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bodyBaseMd">Основной контент (Markdown)</Label>
        <Textarea
          id="bodyBaseMd"
          value={formData.bodyBaseMd}
          onChange={(e) => setFormData({ ...formData, bodyBaseMd: e.target.value })}
          placeholder="# Заголовок\n\nТекст статьи..."
          rows={8}
          className="font-mono text-sm"
          data-testid="input-body-base"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bodyRegsMd">Нормативная версия (Markdown, опционально)</Label>
        <Textarea
          id="bodyRegsMd"
          value={formData.bodyRegsMd}
          onChange={(e) => setFormData({ ...formData, bodyRegsMd: e.target.value })}
          placeholder="Текст со ссылками на законы..."
          rows={6}
          className="font-mono text-sm"
          data-testid="input-body-regs"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lawTags">Теги законов (через запятую)</Label>
          <Input
            id="lawTags"
            value={formData.lawTags}
            onChange={(e) => setFormData({ ...formData, lawTags: e.target.value })}
            placeholder="152-ФЗ, 149-ФЗ"
            data-testid="input-law-tags"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="topicTags">Теги тем (через запятую)</Label>
          <Input
            id="topicTags"
            value={formData.topicTags}
            onChange={(e) => setFormData({ ...formData, topicTags: e.target.value })}
            placeholder="cookies, согласие"
            data-testid="input-topic-tags"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="relatedServices">Связанные сервисы (express, tools, full)</Label>
        <Input
          id="relatedServices"
          value={formData.relatedServices}
          onChange={(e) => setFormData({ ...formData, relatedServices: e.target.value })}
          placeholder="express, tools"
          data-testid="input-related-services"
        />
      </div>
    </div>
  );
}
