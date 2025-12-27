import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, FileText, RefreshCw, Trash2, Plus, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface TechnicalSpec {
  id: number;
  sectionKey: string;
  sectionTitle: string;
  content: string;
  sortOrder: number;
  updatedAt: string;
  updatedById: number | null;
}

const DEFAULT_SECTIONS = [
  { key: "overview", title: "1. Общие сведения", sortOrder: 1 },
  { key: "structure", title: "2. Структура сайта", sortOrder: 2 },
  { key: "design", title: "3. Дизайн и UX", sortOrder: 3 },
  { key: "functionality", title: "4. Функционал", sortOrder: 4 },
  { key: "technical", title: "5. Технические требования", sortOrder: 5 },
  { key: "content", title: "6. Контент", sortOrder: 6 },
  { key: "admin", title: "7. Админ-панель", sortOrder: 7 },
  { key: "testing", title: "8. Тестирование и поддержка", sortOrder: 8 },
  { key: "notes", title: "9. Примечания и история изменений", sortOrder: 9 },
];

export default function TechnicalSpecsPage() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("overview");
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: specs, isLoading } = useQuery<TechnicalSpec[]>({
    queryKey: ["/api/admin/technical-specs"],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, title, content, sortOrder }: { key: string; title: string; content: string; sortOrder: number }) => {
      const response = await apiRequest("PUT", `/api/admin/technical-specs/${key}`, {
        sectionTitle: title,
        content,
        sortOrder,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/technical-specs"] });
      toast({ title: "Раздел сохранён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const currentSpec = specs?.find(s => s.sectionKey === activeSection);
  const currentDefaultSection = DEFAULT_SECTIONS.find(s => s.key === activeSection);

  useEffect(() => {
    if (currentSpec) {
      setEditContent(currentSpec.content);
    } else {
      setEditContent("");
    }
  }, [currentSpec, activeSection]);

  const handleSave = () => {
    if (!currentDefaultSection) return;
    saveMutation.mutate({
      key: activeSection,
      title: currentDefaultSection.title,
      content: editContent,
      sortOrder: currentDefaultSection.sortOrder,
    });
  };

  const getSpecByKey = (key: string) => specs?.find(s => s.sectionKey === key);

  if (isLoading) {
    return (
      <div className="container py-6 space-y-6">
        <Skeleton className="h-10 w-96" />
        <div className="grid md:grid-cols-4 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 md:col-span-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-specs-title">
          Техническое задание для ИИ-агента
        </h1>
        <p className="text-muted-foreground">
          Полное описание сайта, функционала и требований
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Разделы ТЗ</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {DEFAULT_SECTIONS.map((section) => {
                const spec = getSpecByKey(section.key);
                const isActive = activeSection === section.key;
                return (
                  <button
                    key={section.key}
                    onClick={() => setActiveSection(section.key)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                    data-testid={`button-section-${section.key}`}
                  >
                    <span className="truncate">{section.title}</span>
                    {spec && (
                      <CheckCircle className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary-foreground" : "text-green-500"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>{currentDefaultSection?.title}</CardTitle>
                {currentSpec && (
                  <CardDescription>
                    Обновлено: {format(new Date(currentSpec.updatedAt), "d MMMM yyyy, HH:mm", { locale: ru })}
                  </CardDescription>
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                data-testid="button-save-spec"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder={`Введите содержание раздела "${currentDefaultSection?.title}"...
              
Используйте Markdown для форматирования:
# Заголовок
## Подзаголовок
- Список
1. Нумерованный список
**жирный** и *курсив*`}
              className="min-h-[500px] font-mono text-sm"
              data-testid="textarea-spec-content"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Быстрый просмотр всех разделов</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {DEFAULT_SECTIONS.map((section) => {
              const spec = getSpecByKey(section.key);
              return (
                <AccordionItem key={section.key} value={section.key}>
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2">
                      {section.title}
                      {spec ? (
                        <Badge variant="secondary" className="text-xs">Заполнено</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Пусто</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {spec ? (
                      <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted p-4 rounded-md">
                        {spec.content}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Раздел ещё не заполнен
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
