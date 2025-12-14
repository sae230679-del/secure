import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Palette, Check, Plus, Edit, Moon, Sun, PanelLeft, LayoutTemplate } from "lucide-react";
import type { ThemeColors, ThemePreset } from "@shared/schema";

type DesignTheme = {
  id: number;
  name: string;
  key: string;
  description: string | null;
  preset: ThemePreset;
  isActive: boolean;
  createdAt: string;
};

const defaultColors: ThemeColors = {
  primary: "217 91% 32%",
  primaryForeground: "210 20% 98%",
  secondary: "210 18% 86%",
  secondaryForeground: "210 15% 16%",
  background: "210 20% 98%",
  foreground: "210 15% 12%",
  card: "210 18% 96%",
  cardForeground: "210 15% 12%",
  muted: "210 16% 90%",
  mutedForeground: "210 12% 28%",
  accent: "210 16% 92%",
  accentForeground: "210 15% 16%",
  destructive: "0 84% 32%",
  destructiveForeground: "0 20% 98%",
  border: "210 15% 90%",
  sidebar: "210 18% 94%",
  sidebarForeground: "210 15% 14%",
  sidebarPrimary: "217 91% 48%",
  sidebarAccent: "210 18% 88%",
};

const defaultDarkColors: ThemeColors = {
  primary: "217 91% 48%",
  primaryForeground: "210 20% 98%",
  secondary: "210 16% 20%",
  secondaryForeground: "210 15% 86%",
  background: "210 18% 8%",
  foreground: "210 15% 92%",
  card: "210 16% 10%",
  cardForeground: "210 15% 92%",
  muted: "210 14% 16%",
  mutedForeground: "210 10% 68%",
  accent: "210 14% 18%",
  accentForeground: "210 15% 86%",
  destructive: "0 84% 40%",
  destructiveForeground: "0 20% 98%",
  border: "210 12% 18%",
  sidebar: "210 16% 12%",
  sidebarForeground: "210 15% 88%",
  sidebarPrimary: "217 91% 48%",
  sidebarAccent: "210 16% 18%",
};

const defaultPreset: ThemePreset = {
  layout: {
    type: "sidebar",
    sidebarWidth: "18rem",
    borderRadius: "0.5rem",
  },
  colors: defaultColors,
  darkColors: defaultDarkColors,
};

export default function SuperAdminThemesPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<DesignTheme | null>(null);
  const [newTheme, setNewTheme] = useState({
    name: "",
    key: "",
    description: "",
    preset: { ...defaultPreset },
  });

  const { data: themes, isLoading } = useQuery<DesignTheme[]>({
    queryKey: ["/api/superadmin/themes"],
  });

  const createThemeMutation = useMutation({
    mutationFn: async (data: { name: string; key: string; description: string; preset: ThemePreset }) => {
      const response = await apiRequest("POST", "/api/superadmin/themes", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/themes"] });
      setIsCreateOpen(false);
      setNewTheme({ name: "", key: "", description: "", preset: { ...defaultPreset } });
      toast({
        title: "Тема создана",
        description: "Новая тема успешно добавлена.",
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

  const updateThemeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name?: string; description?: string; preset?: ThemePreset } }) => {
      const response = await apiRequest("PATCH", `/api/superadmin/themes/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/themes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/theme/active"] });
      setEditingTheme(null);
      toast({
        title: "Тема обновлена",
        description: "Изменения успешно сохранены.",
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

  const activateThemeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/superadmin/themes/${id}/activate`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/themes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/theme/active"] });
      toast({
        title: "Тема активирована",
        description: "Новая тема применена на сайте. Обновите страницу для применения.",
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

  const handleCreate = () => {
    if (!newTheme.name || !newTheme.key) {
      toast({
        title: "Ошибка",
        description: "Заполните название и ключ темы",
        variant: "destructive",
      });
      return;
    }
    createThemeMutation.mutate(newTheme);
  };

  const handleUpdate = () => {
    if (!editingTheme) return;
    updateThemeMutation.mutate({
      id: editingTheme.id,
      data: { 
        name: editingTheme.name, 
        description: editingTheme.description || undefined,
        preset: editingTheme.preset 
      },
    });
  };

  const updateNewThemeColor = (mode: "light" | "dark", colorKey: keyof ThemeColors, value: string) => {
    setNewTheme(prev => ({
      ...prev,
      preset: {
        ...prev.preset,
        [mode === "light" ? "colors" : "darkColors"]: {
          ...(mode === "light" ? prev.preset.colors : prev.preset.darkColors || defaultDarkColors),
          [colorKey]: value,
        },
      },
    }));
  };

  const updateEditingThemeColor = (mode: "light" | "dark", colorKey: keyof ThemeColors, value: string) => {
    if (!editingTheme) return;
    setEditingTheme({
      ...editingTheme,
      preset: {
        ...editingTheme.preset,
        [mode === "light" ? "colors" : "darkColors"]: {
          ...(mode === "light" ? editingTheme.preset.colors : editingTheme.preset.darkColors || defaultDarkColors),
          [colorKey]: value,
        },
      },
    });
  };

  const ColorEditor = ({ 
    colors, 
    onColorChange,
    label 
  }: { 
    colors: ThemeColors; 
    onColorChange: (key: keyof ThemeColors, value: string) => void;
    label: string;
  }) => {
    const colorFields: { key: keyof ThemeColors; label: string }[] = [
      { key: "primary", label: "Основной" },
      { key: "primaryForeground", label: "Текст на основном" },
      { key: "secondary", label: "Вторичный" },
      { key: "secondaryForeground", label: "Текст на вторичном" },
      { key: "background", label: "Фон" },
      { key: "foreground", label: "Текст" },
      { key: "card", label: "Карточка" },
      { key: "cardForeground", label: "Текст карточки" },
      { key: "muted", label: "Приглушённый фон" },
      { key: "mutedForeground", label: "Приглушённый текст" },
      { key: "accent", label: "Акцент" },
      { key: "accentForeground", label: "Текст на акценте" },
      { key: "destructive", label: "Ошибка/опасность" },
      { key: "destructiveForeground", label: "Текст ошибки" },
      { key: "border", label: "Граница" },
      { key: "sidebar", label: "Сайдбар фон" },
      { key: "sidebarForeground", label: "Сайдбар текст" },
      { key: "sidebarPrimary", label: "Сайдбар акцент" },
      { key: "sidebarAccent", label: "Сайдбар выделение" },
    ];

    return (
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          {label === "Светлая тема" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {label}
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {colorFields.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                value={colors[key] || ""}
                onChange={(e) => onColorChange(key, e.target.value)}
                placeholder="220 90% 50%"
                className="font-mono text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getLayoutIcon = (type: string) => {
    return type === "sidebar" ? <PanelLeft className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Темы дизайна</h1>
          <p className="text-muted-foreground mt-1">
            Управление цветовыми схемами и настройками макета
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-theme">
              <Plus className="h-4 w-4 mr-2" />
              Создать тему
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Создать новую тему</DialogTitle>
              <DialogDescription>
                Настройте название, ключ и цветовую схему для новой темы
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-name">Название темы</Label>
                  <Input
                    id="new-name"
                    value={newTheme.name}
                    onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
                    placeholder="Моя новая тема"
                    data-testid="input-new-theme-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-key">Ключ (латиница)</Label>
                  <Input
                    id="new-key"
                    value={newTheme.key}
                    onChange={(e) => setNewTheme({ ...newTheme, key: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                    placeholder="my-new-theme"
                    data-testid="input-new-theme-key"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-desc">Описание</Label>
                <Textarea
                  id="new-desc"
                  value={newTheme.description}
                  onChange={(e) => setNewTheme({ ...newTheme, description: e.target.value })}
                  placeholder="Краткое описание темы"
                  rows={2}
                />
              </div>
              <Tabs defaultValue="light" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="light">Светлая тема</TabsTrigger>
                  <TabsTrigger value="dark">Тёмная тема</TabsTrigger>
                </TabsList>
                <TabsContent value="light" className="pt-4">
                  <ColorEditor
                    colors={newTheme.preset.colors}
                    onColorChange={(key, value) => updateNewThemeColor("light", key, value)}
                    label="Светлая тема"
                  />
                </TabsContent>
                <TabsContent value="dark" className="pt-4">
                  <ColorEditor
                    colors={newTheme.preset.darkColors || defaultDarkColors}
                    onColorChange={(key, value) => updateNewThemeColor("dark", key, value)}
                    label="Тёмная тема"
                  />
                </TabsContent>
              </Tabs>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={createThemeMutation.isPending}>
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes?.map((theme) => (
            <Card key={theme.id} className={theme.isActive ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    {theme.name}
                  </CardTitle>
                  {theme.isActive && (
                    <Badge className="bg-green-500/10 text-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      Активна
                    </Badge>
                  )}
                </div>
                <CardDescription className="flex items-center gap-2">
                  {getLayoutIcon(theme.preset?.layout?.type || "sidebar")}
                  {theme.preset?.layout?.type === "sidebar" ? "Боковая панель" : "Верхняя навигация"}
                  <span className="text-muted-foreground">|</span>
                  <code className="text-xs">{theme.key}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {theme.description && (
                  <p className="text-sm text-muted-foreground">{theme.description}</p>
                )}
                <div className="flex gap-1">
                  {Object.entries(theme.preset?.colors || {}).slice(0, 5).map(([key, value]) => (
                    <div
                      key={key}
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: `hsl(${value})` }}
                      title={key}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setEditingTheme({ ...theme })}
                        data-testid={`button-edit-theme-${theme.id}`}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Редактировать
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Редактировать тему</DialogTitle>
                        <DialogDescription>
                          Измените настройки и цветовую схему темы
                        </DialogDescription>
                      </DialogHeader>
                      {editingTheme && (
                        <div className="space-y-6 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit-name">Название темы</Label>
                              <Input
                                id="edit-name"
                                value={editingTheme.name}
                                onChange={(e) =>
                                  setEditingTheme({ ...editingTheme, name: e.target.value })
                                }
                                data-testid="input-edit-theme-name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Ключ</Label>
                              <Input value={editingTheme.key} disabled className="bg-muted" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-desc">Описание</Label>
                            <Textarea
                              id="edit-desc"
                              value={editingTheme.description || ""}
                              onChange={(e) =>
                                setEditingTheme({ ...editingTheme, description: e.target.value })
                              }
                              rows={2}
                            />
                          </div>
                          <Tabs defaultValue="light" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="light">Светлая тема</TabsTrigger>
                              <TabsTrigger value="dark">Тёмная тема</TabsTrigger>
                            </TabsList>
                            <TabsContent value="light" className="pt-4">
                              <ColorEditor
                                colors={editingTheme.preset?.colors || defaultColors}
                                onColorChange={(key, value) => updateEditingThemeColor("light", key, value)}
                                label="Светлая тема"
                              />
                            </TabsContent>
                            <TabsContent value="dark" className="pt-4">
                              <ColorEditor
                                colors={editingTheme.preset?.darkColors || defaultDarkColors}
                                onColorChange={(key, value) => updateEditingThemeColor("dark", key, value)}
                                label="Тёмная тема"
                              />
                            </TabsContent>
                          </Tabs>
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTheme(null)}>
                          Отмена
                        </Button>
                        <Button onClick={handleUpdate} disabled={updateThemeMutation.isPending}>
                          Сохранить
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {!theme.isActive && (
                    <Button
                      size="sm"
                      onClick={() => activateThemeMutation.mutate(theme.id)}
                      disabled={activateThemeMutation.isPending}
                      data-testid={`button-activate-theme-${theme.id}`}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Применить
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
