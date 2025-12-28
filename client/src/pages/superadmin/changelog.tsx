import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Bug, Sparkles, Wrench } from "lucide-react";

const changelogEntries = [
  {
    version: "1.0.0",
    date: "2024-12-28",
    type: "release" as const,
    changes: [
      { type: "feature", text: "Первый публичный релиз платформы" },
      { type: "feature", text: "Система аутентификации и авторизации" },
      { type: "feature", text: "Управление сервисами и инструментами" },
      { type: "feature", text: "Панель суперадминистратора" },
    ]
  }
];

const typeConfig = {
  feature: { icon: Sparkles, label: "Новое", variant: "default" as const },
  fix: { icon: Bug, label: "Исправление", variant: "secondary" as const },
  improvement: { icon: Wrench, label: "Улучшение", variant: "outline" as const },
};

export default function ChangelogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">История изменений</h1>
        <p className="text-muted-foreground">Все обновления и изменения платформы</p>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-6 pr-4">
          {changelogEntries.map((entry, index) => (
            <Card key={index} data-testid={`card-changelog-${index}`}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Версия {entry.version}
                  </CardTitle>
                  <Badge variant="outline">{entry.date}</Badge>
                </div>
                <CardDescription>
                  {entry.type === "release" ? "Основной релиз" : "Обновление"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {entry.changes.map((change, changeIndex) => {
                    const config = typeConfig[change.type as keyof typeof typeConfig];
                    const Icon = config.icon;
                    return (
                      <li key={changeIndex} className="flex items-start gap-2">
                        <Badge variant={config.variant} className="shrink-0">
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        <span className="text-sm">{change.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
