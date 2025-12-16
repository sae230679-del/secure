import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Edit, Trash2, Eye, EyeOff, FileText, FolderOpen, BookOpen, GripVertical, Settings, RotateCcw, Save } from "lucide-react";
import type { GuideArticle, GuideSection, GuideTopic } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type TopicWithCount = GuideTopic & { articlesCount: number };

export default function GuideManagementPage() {
  const [activeTab, setActiveTab] = useState("articles");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Справочник</h1>
        <p className="text-muted-foreground">Управление статьями, темами и разделами</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="articles" data-testid="tab-articles">
            <FileText className="h-4 w-4 mr-2" />
            Статьи
          </TabsTrigger>
          <TabsTrigger value="topics" data-testid="tab-topics">
            <BookOpen className="h-4 w-4 mr-2" />
            Темы
          </TabsTrigger>
          <TabsTrigger value="sections" data-testid="tab-sections">
            <Settings className="h-4 w-4 mr-2" />
            Разделы
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles">
          <ArticlesTab />
        </TabsContent>

        <TabsContent value="topics">
          <TopicsTab />
        </TabsContent>

        <TabsContent value="sections">
          <SectionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ArticlesTab() {
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
    topicId: "",
  });

  const { data: articles, isLoading } = useQuery<GuideArticle[]>({
    queryKey: ["/api/admin/guide/articles", statusFilter !== "all" ? statusFilter : undefined],
  });

  const { data: topics } = useQuery<TopicWithCount[]>({
    queryKey: ["/api/admin/guide/topics"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/topics"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/topics"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/topics"] });
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
      topicId: "",
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
      topicId: article.topicId?.toString() || "",
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
      topicId: formData.topicId ? parseInt(formData.topicId) : null,
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
    <div className="space-y-6 mt-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {stats && (
          <div className="flex gap-4">
            <Badge variant="outline">Просмотров: {stats.pageViews}</Badge>
            <Badge variant="outline">Дочитываний: {stats.readEnd}</Badge>
            <Badge variant="outline">CTA кликов: {stats.ctaClicks}</Badge>
          </div>
        )}
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
            <ArticleForm formData={formData} setFormData={setFormData} topics={topics || []} />
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
                  <TableHead>Тема</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Теги</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.map(article => (
                  <TableRow key={article.id} data-testid={`row-article-${article.id}`}>
                    <TableCell className="font-medium max-w-xs truncate">{article.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {article.topicId ? topics?.find(t => t.id === article.topicId)?.title || "-" : "-"}
                    </TableCell>
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
                              <DialogTitle>Редактирование статьи</DialogTitle>
                            </DialogHeader>
                            <ArticleForm formData={formData} setFormData={setFormData} topics={topics || []} />
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

function TopicsTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<GuideTopic | null>(null);
  const [formData, setFormData] = useState({
    slug: "",
    title: "",
    description: "",
    sectionId: "",
  });

  const { data: topics, isLoading } = useQuery<TopicWithCount[]>({
    queryKey: ["/api/admin/guide/topics"],
  });

  const { data: sections } = useQuery<GuideSection[]>({
    queryKey: ["/api/admin/guide/sections"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/guide/topics", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guide/home"] });
      toast({ title: "Тема создана" });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/admin/guide/topics/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guide/home"] });
      toast({ title: "Тема обновлена" });
      setEditingTopic(null);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/guide/topics/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guide/home"] });
      toast({ title: "Тема удалена" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ slug: "", title: "", description: "", sectionId: "" });
  };

  const openEditDialog = (topic: GuideTopic) => {
    setEditingTopic(topic);
    setFormData({
      slug: topic.slug,
      title: topic.title,
      description: topic.description || "",
      sectionId: topic.sectionId?.toString() || "",
    });
  };

  const handleSubmit = () => {
    const data = {
      slug: formData.slug.trim(),
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      sectionId: formData.sectionId ? parseInt(formData.sectionId) : null,
    };

    if (editingTopic) {
      updateMutation.mutate({ id: editingTopic.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const groupedTopics = sections?.map(section => ({
    section,
    topics: (topics || []).filter(t => t.sectionId === section.id),
  })) || [];

  const orphanTopics = (topics || []).filter(t => !t.sectionId);

  return (
    <div className="space-y-6 mt-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-muted-foreground">
            Всего тем: {topics?.length || 0}
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-topic">
              <Plus className="h-4 w-4 mr-2" />
              Создать тему
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая тема</DialogTitle>
            </DialogHeader>
            <TopicForm formData={formData} setFormData={setFormData} sections={sections || []} />
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

      {isLoading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : (
        <div className="space-y-4">
          {groupedTopics.map(({ section, topics: sectionTopics }) => (
            <Card key={section.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <Badge variant="outline">Тем: {sectionTopics.length}</Badge>
                </div>
              </CardHeader>
              {sectionTopics.length > 0 && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Название</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Статей</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sectionTopics.map(topic => (
                        <TableRow key={topic.id} data-testid={`row-topic-${topic.id}`}>
                          <TableCell className="font-medium">{topic.title}</TableCell>
                          <TableCell className="text-muted-foreground">{topic.slug}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{topic.articlesCount}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    onClick={() => openEditDialog(topic)}
                                    data-testid={`button-edit-topic-${topic.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Редактирование темы</DialogTitle>
                                  </DialogHeader>
                                  <TopicForm formData={formData} setFormData={setFormData} sections={sections || []} />
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
                                  if (topic.articlesCount > 0) {
                                    toast({ 
                                      title: "Невозможно удалить", 
                                      description: "В теме есть статьи", 
                                      variant: "destructive" 
                                    });
                                    return;
                                  }
                                  if (confirm("Удалить тему?")) {
                                    deleteMutation.mutate(topic.id);
                                  }
                                }}
                                data-testid={`button-delete-topic-${topic.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          ))}

          {orphanTopics.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Без раздела</CardTitle>
                  <Badge variant="outline">Тем: {orphanTopics.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Статей</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orphanTopics.map(topic => (
                      <TableRow key={topic.id} data-testid={`row-topic-${topic.id}`}>
                        <TableCell className="font-medium">{topic.title}</TableCell>
                        <TableCell className="text-muted-foreground">{topic.slug}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{topic.articlesCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => openEditDialog(topic)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Редактирование темы</DialogTitle>
                                </DialogHeader>
                                <TopicForm formData={formData} setFormData={setFormData} sections={sections || []} />
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
                                if (topic.articlesCount > 0) {
                                  toast({ 
                                    title: "Невозможно удалить", 
                                    description: "В теме есть статьи", 
                                    variant: "destructive" 
                                  });
                                  return;
                                }
                                if (confirm("Удалить тему?")) {
                                  deleteMutation.mutate(topic.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {topics?.length === 0 && (
            <Card className="text-center py-8">
              <CardContent>
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Темы не созданы</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

type SectionWithCounts = GuideSection & { topicsCount: number; articlesCount: number };

function SectionsTab() {
  const { toast } = useToast();
  const [editingSection, setEditingSection] = useState<GuideSection | null>(null);
  const [localSections, setLocalSections] = useState<SectionWithCounts[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [serverVersion, setServerVersion] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: sections, isLoading, dataUpdatedAt } = useQuery<SectionWithCounts[]>({
    queryKey: ["/api/admin/guide/sections"],
  });

  useEffect(() => {
    if (sections && sections.length > 0 && dataUpdatedAt !== serverVersion) {
      const sorted = sections.slice().sort((a, b) => a.sortOrder - b.sortOrder);
      setLocalSections(sorted);
      setServerVersion(dataUpdatedAt);
      setHasChanges(false);
    }
  }, [sections, dataUpdatedAt, serverVersion]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/admin/guide/sections/${id}`, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guide/home"] });
      toast({ title: "Раздел обновлён" });
      setEditingSection(null);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: Array<{ id: number; sortOrder: number }>) => {
      return apiRequest("PUT", "/api/admin/guide/sections/reorder", { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guide/sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guide/home"] });
      toast({ title: "Порядок разделов сохранён" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const toggleVisibility = (section: GuideSection) => {
    updateMutation.mutate({ 
      id: section.id, 
      data: { isVisible: !section.isVisible } 
    });
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    setLocalSections(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id);
      const newIndex = prev.findIndex(s => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        return arrayMove(prev, oldIndex, newIndex);
      }
      return prev;
    });
    setHasChanges(true);
  }, []);

  const saveOrder = () => {
    const items = localSections.map((section, index) => ({
      id: section.id,
      sortOrder: (index + 1) * 10,
    }));
    reorderMutation.mutate(items);
  };

  const resetOrder = () => {
    if (sections) {
      setLocalSections(sections.slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setServerVersion(dataUpdatedAt);
    }
    setHasChanges(false);
    toast({ title: "Изменения отменены" });
  };

  return (
    <div className="space-y-6 mt-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-muted-foreground">
          Перетащите разделы для изменения порядка. Изменения применяются после сохранения.
        </p>
        <div className="flex gap-2">
          {hasChanges && (
            <>
              <Button 
                variant="outline" 
                onClick={resetOrder}
                data-testid="button-reset-order"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Отменить
              </Button>
              <Button 
                onClick={saveOrder}
                disabled={reorderMutation.isPending}
                data-testid="button-save-order"
              >
                <Save className="h-4 w-4 mr-2" />
                Сохранить порядок
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localSections.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {localSections.map(section => (
                <SortableSectionCard
                  key={section.id}
                  section={section}
                  onToggleVisibility={() => toggleVisibility(section)}
                  onEdit={() => setEditingSection(section)}
                  editingSection={editingSection}
                  updateMutation={updateMutation}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={!!editingSection} onOpenChange={(open) => !open && setEditingSection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактирование раздела</DialogTitle>
          </DialogHeader>
          {editingSection && (
            <SectionEditForm 
              section={editingSection} 
              onSave={(data) => {
                updateMutation.mutate({ id: editingSection.id, data });
              }}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableSectionCard({
  section,
  onToggleVisibility,
  onEdit,
}: {
  section: SectionWithCounts;
  onToggleVisibility: () => void;
  onEdit: () => void;
  editingSection: GuideSection | null;
  updateMutation: any;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style}
      data-testid={`card-section-${section.slug}`}
      className={isDragging ? "ring-2 ring-primary" : ""}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div 
              {...attributes} 
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium">{section.title}</h3>
                <Badge variant="outline">{section.slug}</Badge>
                <Badge variant="secondary">Тем: {section.topicsCount}</Badge>
                <Badge variant="secondary">Статей: {section.articlesCount}</Badge>
                {!section.isVisible && (
                  <Badge variant="destructive">Скрыт</Badge>
                )}
              </div>
              {section.description && (
                <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={section.isVisible} 
              onCheckedChange={onToggleVisibility}
              data-testid={`switch-visibility-${section.slug}`}
            />
            <Button 
              size="icon" 
              variant="ghost"
              onClick={onEdit}
              data-testid={`button-edit-section-${section.slug}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionEditForm({ 
  section, 
  onSave,
  isPending 
}: { 
  section: GuideSection;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    title: section.title,
    description: section.description || "",
    icon: section.icon || "",
    sortOrder: section.sortOrder.toString(),
  });

  const handleSubmit = () => {
    onSave({
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      icon: formData.icon.trim() || null,
      sortOrder: parseInt(formData.sortOrder) || 0,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Заголовок</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          data-testid="input-section-title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          data-testid="input-section-description"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="icon">Иконка (Lucide)</Label>
          <Input
            id="icon"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            placeholder="FileText, Cookie, Shield..."
            data-testid="input-section-icon"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Порядок сортировки</Label>
          <Input
            id="sortOrder"
            type="number"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
            data-testid="input-section-sort"
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Отмена</Button>
        </DialogClose>
        <Button onClick={handleSubmit} disabled={isPending}>
          Сохранить
        </Button>
      </DialogFooter>
    </div>
  );
}

function ArticleForm({ 
  formData, 
  setFormData,
  topics
}: { 
  formData: any; 
  setFormData: (data: any) => void;
  topics: TopicWithCount[];
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
        <Label htmlFor="topicId">Тема</Label>
        <Select 
          value={formData.topicId} 
          onValueChange={(value) => setFormData({ ...formData, topicId: value })}
        >
          <SelectTrigger data-testid="select-topic">
            <SelectValue placeholder="Выберите тему" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Без темы</SelectItem>
            {topics.map(topic => (
              <SelectItem key={topic.id} value={topic.id.toString()}>
                {topic.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

function TopicForm({ 
  formData, 
  setFormData,
  sections
}: { 
  formData: any; 
  setFormData: (data: any) => void;
  sections: GuideSection[];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sectionId">Раздел</Label>
        <Select 
          value={formData.sectionId} 
          onValueChange={(value) => setFormData({ ...formData, sectionId: value })}
        >
          <SelectTrigger data-testid="select-section">
            <SelectValue placeholder="Выберите раздел" />
          </SelectTrigger>
          <SelectContent>
            {sections.map(section => (
              <SelectItem key={section.id} value={section.id.toString()}>
                {section.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (URL)</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="example-topic"
            data-testid="input-topic-slug"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Название</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Название темы"
            data-testid="input-topic-title"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Описание темы"
          rows={3}
          data-testid="input-topic-description"
        />
      </div>
    </div>
  );
}
