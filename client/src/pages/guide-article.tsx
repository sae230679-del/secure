import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, ExternalLink, FileText, Scale, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import type { GuideArticle as GuideArticleType } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

function markdownToHtml(md: string | null | undefined): string {
  if (!md) return "";
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-1 my-4">$&</ul>')
    .replace(/\n\n/g, '</p><p class="my-4">')
    .replace(/^(?!<[hul])(.+)$/gm, '<p class="my-4">$1</p>');
}

export default function GuideArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [mode, setMode] = useState<"base" | "regs">("base");
  const [visitorId] = useState(() => localStorage.getItem("visitorId") || Math.random().toString(36).slice(2));

  const { data: article, isLoading, error } = useQuery<GuideArticleType>({
    queryKey: ["/api/guide/articles", slug],
    enabled: !!slug,
  });

  useEffect(() => {
    localStorage.setItem("visitorId", visitorId);
  }, [visitorId]);

  useEffect(() => {
    if (article && slug) {
      apiRequest("POST", "/api/guide/event", {
        visitorId,
        slug,
        mode,
        eventType: "page_view",
        eventValue: {},
      }).catch(() => {});
    }
  }, [article, slug, visitorId]);

  useEffect(() => {
    if (!article) return;
    
    const handleScroll = () => {
      const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      const thresholds = [25, 50, 75, 90];
      for (const t of thresholds) {
        if (scrollPercent >= t && !sessionStorage.getItem(`scroll_${slug}_${t}`)) {
          sessionStorage.setItem(`scroll_${slug}_${t}`, "1");
          apiRequest("POST", "/api/guide/event", {
            visitorId,
            slug,
            mode,
            eventType: `scroll_${t}` as any,
            eventValue: { percent: t },
          }).catch(() => {});
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [article, slug, mode, visitorId]);

  const handleModeSwitch = (newMode: "base" | "regs") => {
    setMode(newMode);
    apiRequest("POST", "/api/guide/event", {
      visitorId,
      slug,
      mode: newMode,
      eventType: "mode_switch",
      eventValue: { from: mode, to: newMode },
    }).catch(() => {});
  };

  const handleCtaClick = (ctaType: string) => {
    apiRequest("POST", "/api/guide/event", {
      visitorId,
      slug,
      mode,
      eventType: "cta_click",
      eventValue: { ctaType },
    }).catch(() => {});
  };

  const handleSourceClick = (sourceUrl: string) => {
    apiRequest("POST", "/api/guide/event", {
      visitorId,
      slug,
      mode,
      eventType: "source_click",
      eventValue: { sourceUrl },
    }).catch(() => {});
  };

  const sources = (article?.sources as {title: string; url: string}[]) || [];
  const relatedTools = (article?.relatedTools as number[]) || [];
  const relatedServices = (article?.relatedServices as string[]) || [];
  const seo = (article?.seo as {title?: string; description?: string; keywords?: string[]}) || {};

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Статья не найдена</h1>
            <p className="text-muted-foreground mb-4">Запрошенная статья не существует или была удалена.</p>
            <Link href="/guide">
              <Button>Вернуться к справочнику</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{seo.title || article?.title || "Загрузка..."} - SecureLex.ru</title>
        {seo.description && <meta name="description" content={seo.description} />}
        {seo.keywords && <meta name="keywords" content={seo.keywords.join(", ")} />}
        {article && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: article.title,
              description: article.summary,
              datePublished: article.publishedAt,
              dateModified: article.updatedAt,
              publisher: {
                "@type": "Organization",
                name: "SecureLex.ru",
                url: "https://securelex.ru"
              }
            })}
          </script>
        )}
      </Helmet>

      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-50">
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

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : article ? (
            <article>
              <header className="mb-8">
                <div className="flex flex-wrap gap-2 mb-4">
                  {((article.lawTags as string[]) || []).map(tag => (
                    <Badge key={tag} variant="default" data-testid={`badge-law-${tag}`}>
                      <Scale className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                  {((article.topicTags as string[]) || []).map(tag => (
                    <Badge key={tag} variant="secondary" data-testid={`badge-topic-${tag}`}>
                      {tag}
                    </Badge>
                  ))}
                </div>
                <h1 className="text-3xl font-bold mb-4" data-testid="text-article-title">{article.title}</h1>
                {article.summary && (
                  <p className="text-lg text-muted-foreground">{article.summary}</p>
                )}
              </header>

              {article.bodyRegsMd ? (
                <Tabs value={mode} onValueChange={(v) => handleModeSwitch(v as "base" | "regs")} className="mb-8">
                  <TabsList className="mb-4">
                    <TabsTrigger value="base" data-testid="tab-base">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Простым языком
                    </TabsTrigger>
                    <TabsTrigger value="regs" data-testid="tab-regs">
                      <Scale className="h-4 w-4 mr-2" />
                      Нормативная база
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="base">
                    <div 
                      className="prose prose-slate dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(article.bodyBaseMd) }}
                    />
                  </TabsContent>
                  <TabsContent value="regs">
                    <div 
                      className="prose prose-slate dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(article.bodyRegsMd) }}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <div 
                  className="prose prose-slate dark:prose-invert max-w-none mb-8"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(article.bodyBaseMd) }}
                />
              )}

              {sources.length > 0 && (
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ExternalLink className="h-5 w-5" />
                      Источники
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {sources.map((source, idx) => (
                        <li key={idx}>
                          <a 
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                            onClick={() => handleSourceClick(source.url)}
                            data-testid={`link-source-${idx}`}
                          >
                            {source.title}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {(relatedTools.length > 0 || relatedServices.length > 0) && (
                <Card className="mb-8 bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Полезные инструменты
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3">
                    {relatedServices.includes("express") && (
                      <Link href="/#express-audit">
                        <Button onClick={() => handleCtaClick("express")} data-testid="button-cta-express">
                          Экспресс-аудит
                        </Button>
                      </Link>
                    )}
                    {relatedServices.includes("tools") && (
                      <Link href="/tools">
                        <Button variant="outline" onClick={() => handleCtaClick("tools")} data-testid="button-cta-tools">
                          Инструменты
                        </Button>
                      </Link>
                    )}
                    {relatedServices.includes("full") && (
                      <Link href="/full-audit">
                        <Button variant="outline" onClick={() => handleCtaClick("full")} data-testid="button-cta-full">
                          Полный аудит
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}
            </article>
          ) : null}
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
