import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BookOpen, ChevronRight, ArrowLeft, Search, FileText, 
  Cookie, Shield, ClipboardCheck, Database, Users, 
  Clock, Lock, Newspaper, FolderOpen
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import type { GuideSection } from "@shared/schema";

type SectionWithCounts = GuideSection & { topicsCount: number; articlesCount: number };

type GuideHomeData = {
  sections: SectionWithCounts[];
  totals: { topics: number; articles: number };
};

type SearchResult = {
  q: string;
  sections: Array<{ slug: string; title: string }>;
  topics: Array<{ slug: string; title: string; sectionSlug: string }>;
  articles: Array<{ slug: string; title: string; summary: string | null; sectionSlug: string; topicSlug: string }>;
};

const iconMap: Record<string, typeof FileText> = {
  FileText, Cookie, Shield, ClipboardCheck, Database, Users, Clock, Lock, Newspaper, FolderOpen, BookOpen
};

function getIcon(iconName: string | null) {
  if (!iconName) return FolderOpen;
  return iconMap[iconName] || FolderOpen;
}

export default function GuidePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const { data: homeData, isLoading } = useQuery<GuideHomeData>({
    queryKey: ["/api/guide/home"],
  });

  const { data: searchResults, isFetching: isSearching } = useQuery<SearchResult>({
    queryKey: ["/api/guide/search", debouncedQuery],
    enabled: debouncedQuery.length >= 2,
  });

  const debounce = useCallback((fn: (v: string) => void, delay: number) => {
    let timer: NodeJS.Timeout;
    return (v: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(v), delay);
    };
  }, []);

  useEffect(() => {
    const debouncedSet = debounce(setDebouncedQuery, 300);
    debouncedSet(searchQuery);
  }, [searchQuery, debounce]);

  useEffect(() => {
    setShowResults(debouncedQuery.length >= 2);
  }, [debouncedQuery]);

  const hasResults = searchResults && (
    searchResults.sections.length > 0 || 
    searchResults.topics.length > 0 || 
    searchResults.articles.length > 0
  );

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

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold" data-testid="text-guide-title">Справочник</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Статьи и материалы о законодательстве РФ в области персональных данных, требованиях к сайтам и практические рекомендации.
            </p>
            {homeData && (
              <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
                <span>Всего тем: {homeData.totals.topics}</span>
                <span>Статей: {homeData.totals.articles}</span>
              </div>
            )}
          </div>

          <div className="mb-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по всему справочнику..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => debouncedQuery.length >= 2 && setShowResults(true)}
              className="pl-10"
              data-testid="input-search"
            />
            
            {showResults && (
              <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-96 overflow-auto">
                <CardContent className="p-4">
                  {isSearching ? (
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-3/4" />
                    </div>
                  ) : hasResults ? (
                    <div className="space-y-4">
                      {searchResults.sections.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Разделы</p>
                          {searchResults.sections.map(s => (
                            <Link 
                              key={s.slug} 
                              href={`/guide/section/${s.slug}`}
                              onClick={() => setShowResults(false)}
                            >
                              <div className="flex items-center gap-2 p-2 hover-elevate rounded-md cursor-pointer">
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                <span>{s.title}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      {searchResults.topics.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Темы</p>
                          {searchResults.topics.map(t => (
                            <Link 
                              key={t.slug} 
                              href={`/guide/topic/${t.slug}`}
                              onClick={() => setShowResults(false)}
                            >
                              <div className="flex items-center gap-2 p-2 hover-elevate rounded-md cursor-pointer">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span>{t.title}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      {searchResults.articles.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Статьи</p>
                          {searchResults.articles.map(a => (
                            <Link 
                              key={a.slug} 
                              href={`/guide/${a.slug}`}
                              onClick={() => setShowResults(false)}
                            >
                              <div className="p-2 hover-elevate rounded-md cursor-pointer">
                                <div className="font-medium">{a.title}</div>
                                {a.summary && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{a.summary}</p>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Ничего не найдено</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-8 w-8 rounded mb-2" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : homeData && homeData.sections.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {homeData.sections.map(section => {
                const Icon = getIcon(section.icon);
                return (
                  <Link key={section.id} href={`/guide/section/${section.slug}`}>
                    <Card className="h-full hover-elevate cursor-pointer transition-all" data-testid={`card-section-${section.slug}`}>
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-md">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-lg line-clamp-2">{section.title}</CardTitle>
                              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            </div>
                            {section.description && (
                              <CardDescription className="line-clamp-2 mt-1">{section.description}</CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            Тем: {section.topicsCount}
                          </Badge>
                          <Badge variant="outline">
                            Статей: {section.articlesCount}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent className="flex flex-col items-center gap-4">
                <BookOpen className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="font-medium mb-1">Справочник пуст</h3>
                  <p className="text-sm text-muted-foreground">
                    Разделы справочника пока не настроены
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Не нашли ответ? <Link href="/contacts" className="text-primary hover:underline">Напишите в поддержку</Link>
            </p>
          </div>
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
