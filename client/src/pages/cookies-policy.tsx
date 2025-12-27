import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CookiesPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" className="mb-6" data-testid="link-back-home">
            <ArrowLeft className="h-4 w-4 mr-2" />
            На главную
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl" data-testid="text-page-title">
              Политика использования cookies
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p className="text-muted-foreground mb-6">
              Дата последнего обновления: 14 декабря 2024 г.
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Что такое cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies (куки) — это небольшие текстовые файлы, которые сохраняются 
                на вашем устройстве при посещении веб-сайта. Они помогают сайту 
                запоминать информацию о вашем визите, например, ваши настройки, 
                что делает следующее посещение более удобным.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Типы используемых cookies</h2>
              
              <h3 className="text-lg font-medium mt-6 mb-3">2.1. Строго необходимые cookies</h3>
              <p className="text-muted-foreground leading-relaxed">
                Эти cookies необходимы для работы сайта и не могут быть отключены. 
                Они устанавливаются в ответ на ваши действия, такие как настройка 
                параметров конфиденциальности, вход в систему или заполнение форм.
              </p>

              <h3 className="text-lg font-medium mt-6 mb-3">2.2. Аналитические cookies</h3>
              <p className="text-muted-foreground leading-relaxed">
                Эти cookies позволяют нам подсчитывать количество посетителей и 
                источники трафика, чтобы оценивать и улучшать работу сайта. 
                Мы используем Яндекс.Метрику для аналитики.
              </p>

              <h3 className="text-lg font-medium mt-6 mb-3">2.3. Функциональные cookies</h3>
              <p className="text-muted-foreground leading-relaxed">
                Эти cookies позволяют сайту запоминать ваш выбор (например, 
                предпочитаемый язык или тему оформления) и предоставлять 
                улучшенные персональные функции.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. Список используемых cookies</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Название</th>
                      <th className="text-left py-3 px-4">Назначение</th>
                      <th className="text-left py-3 px-4">Срок хранения</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-3 px-4">session_id</td>
                      <td className="py-3 px-4">Идентификатор сессии пользователя</td>
                      <td className="py-3 px-4">До закрытия браузера</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">theme</td>
                      <td className="py-3 px-4">Выбранная тема оформления</td>
                      <td className="py-3 px-4">1 год</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">cookie_consent</td>
                      <td className="py-3 px-4">Согласие на использование cookies</td>
                      <td className="py-3 px-4">1 год</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">_ym_uid</td>
                      <td className="py-3 px-4">Идентификатор Яндекс.Метрики</td>
                      <td className="py-3 px-4">1 год</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">_ym_d</td>
                      <td className="py-3 px-4">Дата первого посещения (Яндекс.Метрика)</td>
                      <td className="py-3 px-4">1 год</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Управление cookies</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Вы можете управлять cookies через настройки вашего браузера. 
                Большинство браузеров позволяют:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Просматривать сохраненные cookies</li>
                <li>Удалять отдельные или все cookies</li>
                <li>Блокировать cookies от определенных сайтов</li>
                <li>Блокировать все cookies</li>
                <li>Удалять все cookies при закрытии браузера</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Обратите внимание, что отключение cookies может повлиять на 
                функциональность сайта.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Сторонние cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                Мы используем сервисы третьих сторон (Яндекс.Метрика), которые 
                могут устанавливать свои cookies. Эти сервисы имеют собственные 
                политики конфиденциальности, с которыми рекомендуем ознакомиться.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Изменения политики</h2>
              <p className="text-muted-foreground leading-relaxed">
                Мы можем обновлять данную Политику. Актуальная версия всегда 
                доступна на этой странице. Рекомендуем периодически проверять 
                страницу на наличие обновлений.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Контакты</h2>
              <p className="text-muted-foreground leading-relaxed">
                Если у вас есть вопросы относительно использования cookies, 
                свяжитесь с нами через контактную форму на сайте.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
