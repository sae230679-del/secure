import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BookOpen, ChevronRight, ArrowLeft, FileText, 
  Cookie, Shield, ClipboardCheck, Database, Users, 
  Clock, Lock, Newspaper, FolderOpen
} from "lucide-react";
import type { GuideSection, GuideTopic } from "@shared/schema";

type TopicWithCount = GuideTopic & { articlesCount: number };

type SectionData = {
  section: GuideSection;
  topics: TopicWithCount[];
};

const iconMap: Record<string, typeof FileText> = {
  FileText, Cookie, Shield, ClipboardCheck, Database, Users, Clock, Lock, Newspaper, FolderOpen, BookOpen
};

function getIcon(iconName: string | null) {
  if (!iconName) return FolderOpen;
  return iconMap[iconName] || FolderOpen;
}

export default function GuideSectionPage() {
  const params = useParams<{ sectionSlug: string }>();
  const sectionSlug = params.sectionSlug;

  const { data, isLoading, error } = useQuery<SectionData>({
    queryKey: ["/api/guide/sections", sectionSlug],
    enabled: !!sectionSlug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-full mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Link href="/guide" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm text-muted-foreground">Назад к справочнику</span>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <Card className="text-center py-12">
            <CardContent>
              <h2 className="text-xl font-bold mb-2">Раздел не найден</h2>
              <p className="text-muted-foreground mb-4">Возможно, раздел был удалён или скрыт</p>
              <Link href="/guide">
                <Button>Вернуться к справочнику</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { section, topics } = data;
  const Icon = getIcon(section.icon);

  return (
    <>
      <Helmet>
        <title>{section.title} - Справочник - SecureLex.ru</title>
        <meta name="description" content={section.description || `Раздел "${section.title}" справочника по законодательству РФ о персональных данных.`} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <Link href="/guide" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm text-muted-foreground">Справочник</span>
            </Link>
            <Link href="/tools">
              <Button variant="outline" size="sm" data-testid="button-tools">
                Инструменты
              </Button>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="flex items-start gap-4 mb-8">
            <div className="p-3 bg-primary/10 rounded-md">
              <Icon className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2" data-testid="text-section-title">{section.title}</h1>
              {section.description && (
                <p className="text-muted-foreground">{section.description}</p>
              )}
            </div>
          </div>

          {topics.length > 0 ? (
            <div className="space-y-4">
              {topics.map(topic => (
                <Link key={topic.id} href={`/guide/topic/${topic.slug}`}>
                  <Card className="hover-elevate cursor-pointer transition-all" data-testid={`card-topic-${topic.slug}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{topic.title}</CardTitle>
                            <Badge variant="outline">
                              Статей: {topic.articlesCount}
                            </Badge>
                          </div>
                          {topic.description && (
                            <CardDescription className="line-clamp-2">{topic.description}</CardDescription>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent className="flex flex-col items-center gap-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="font-medium mb-1">Тем пока нет</h3>
                  <p className="text-sm text-muted-foreground">
                    В этом разделе ещё нет тем
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        <footer className="border-t py-8 mt-12">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>SecureLex.ru - Аудит соответствия сайтов законодательству РФ</p>
          </div>
        </footer>
      </div>
    </>
  );
}
