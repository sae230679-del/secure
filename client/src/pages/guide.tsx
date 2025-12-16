import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ChevronRight, ArrowLeft, Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { GuideArticle } from "@shared/schema";

export default function GuidePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: articles, isLoading } = useQuery<GuideArticle[]>({
    queryKey: ["/api/guide/articles"],
  });

  const filteredArticles = articles?.filter(article => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(query) ||
      article.summary?.toLowerCase().includes(query) ||
      (article.lawTags as string[])?.some(tag => tag.toLowerCase().includes(query)) ||
      (article.topicTags as string[])?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const lawTags = Array.from(new Set(articles?.flatMap(a => (a.lawTags as string[]) || []) || []));
  const topicTags = Array.from(new Set(articles?.flatMap(a => (a.topicTags as string[]) || []) || []));

  return (
    <>
      <Helmet>
        <title>Справочник - SecureLex.ru</title>
        <meta name="description" content="Справочник по законодательству РФ о персональных данных. Статьи о 152-ФЗ, 149-ФЗ, требованиях Роскомнадзора." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm text-muted-foreground">На главную</span>
            </Link>
            <Link href="/tools">
              <Button variant="outline" size="sm" data-testid="button-tools">
                Инструменты
              </Button>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold" data-testid="text-guide-title">Справочник</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Статьи и материалы о законодательстве РФ в области персональных данных, требованиях к сайтам и практические рекомендации.
            </p>
          </div>

          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по статьям..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>

          {lawTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {lawTags.map(tag => (
                <Badge 
                  key={tag} 
                  variant="outline" 
                  className="cursor-pointer"
                  onClick={() => setSearchQuery(tag)}
                  data-testid={`badge-law-${tag}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : filteredArticles && filteredArticles.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredArticles.map(article => (
                <Link key={article.id} href={`/guide/${article.slug}`}>
                  <Card className="h-full hover-elevate cursor-pointer transition-all" data-testid={`card-article-${article.id}`}>
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
                      <div className="flex flex-wrap gap-1">
                        {((article.lawTags as string[]) || []).slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                        {((article.topicTags as string[]) || []).slice(0, 2).map(tag => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
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
                  <h3 className="font-medium mb-1">Статьи не найдены</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "Попробуйте изменить поисковый запрос" : "Справочник пока пуст"}
                  </p>
                </div>
                {searchQuery && (
                  <Button variant="outline" onClick={() => setSearchQuery("")}>
                    Сбросить поиск
                  </Button>
                )}
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
