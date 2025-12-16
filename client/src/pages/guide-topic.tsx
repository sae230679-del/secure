import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ArrowLeft, FileText, Calendar } from "lucide-react";
import type { GuideTopic, GuideArticle } from "@shared/schema";

type TopicData = {
  topic: GuideTopic;
  section: { slug: string; title: string } | null;
  articles: GuideArticle[];
};

function formatDate(date: string | Date | null) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

export default function GuideTopicPage() {
  const params = useParams<{ topicSlug: string }>();
  const topicSlug = params.topicSlug;

  const { data, isLoading, error } = useQuery<TopicData>({
    queryKey: ["/api/guide/topics", topicSlug],
    enabled: !!topicSlug,
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
              <h2 className="text-xl font-bold mb-2">Тема не найдена</h2>
              <p className="text-muted-foreground mb-4">Возможно, тема была удалена или скрыта</p>
              <Link href="/guide">
                <Button>Вернуться к справочнику</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { topic, section, articles } = data;

  return (
    <>
      <Helmet>
        <title>{topic.title} - Справочник - SecureLex.ru</title>
        <meta name="description" content={topic.description || `Тема "${topic.title}" справочника по законодательству РФ о персональных данных.`} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Link href="/guide" className="text-muted-foreground hover:text-foreground">
                Справочник
              </Link>
              {section && (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Link href={`/guide/section/${section.slug}`} className="text-muted-foreground hover:text-foreground">
                    {section.title}
                  </Link>
                </>
              )}
            </div>
            <Link href="/tools">
              <Button variant="outline" size="sm" data-testid="button-tools">
                Инструменты
              </Button>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2" data-testid="text-topic-title">{topic.title}</h1>
            {topic.description && (
              <p className="text-muted-foreground">{topic.description}</p>
            )}
          </div>

          {articles.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {articles.map(article => (
                <Link key={article.id} href={`/guide/${article.slug}`}>
                  <Card className="h-full hover-elevate cursor-pointer transition-all" data-testid={`card-article-${article.slug}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                      {article.summary && (
                        <CardDescription className="line-clamp-2">{article.summary}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-center gap-2">
                        {((article.lawTags as string[]) || []).slice(0, 2).map(tag => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                        {article.updatedAt && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                            <Calendar className="h-3 w-3" />
                            {formatDate(article.updatedAt)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent className="flex flex-col items-center gap-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="font-medium mb-1">Статей пока нет</h3>
                  <p className="text-sm text-muted-foreground">
                    В этой теме ещё нет статей
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
