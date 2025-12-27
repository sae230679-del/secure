import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserAgreementPage() {
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
              Пользовательское соглашение
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p className="text-muted-foreground mb-6">
              Дата последнего обновления: 14 декабря 2024 г.
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Общие положения</h2>
              <p className="text-muted-foreground leading-relaxed">
                Настоящее Пользовательское соглашение (далее — Соглашение) регулирует 
                отношения между владельцем сервиса SecureLex.ru (далее — Администрация) 
                и пользователем сети Интернет (далее — Пользователь), возникающие 
                при использовании сервиса.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Предмет соглашения</h2>
              <p className="text-muted-foreground leading-relaxed">
                Администрация предоставляет Пользователю доступ к сервису проверки 
                веб-сайтов на соответствие требованиям законодательства РФ о защите 
                персональных данных (ФЗ-152, ФЗ-149) и других нормативных актов.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. Регистрация и учетная запись</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Для использования платных услуг требуется регистрация</li>
                <li>Пользователь обязуется предоставить достоверную информацию</li>
                <li>Пользователь несет ответственность за сохранность пароля</li>
                <li>Запрещена передача учетных данных третьим лицам</li>
                <li>Администрация вправе заблокировать учетную запись при нарушении правил</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Услуги сервиса</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Сервис предоставляет следующие услуги:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Бесплатная экспресс-проверка сайта (базовый набор критериев)</li>
                <li>Платные пакеты аудита с расширенным набором критериев</li>
                <li>Формирование отчетов по результатам аудита</li>
                <li>Рекомендации по устранению выявленных нарушений</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Оплата услуг</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Стоимость услуг указана на сайте в рублях РФ</li>
                <li>Оплата производится через платежную систему Yookassa</li>
                <li>После оплаты услуга считается оказанной после завершения аудита</li>
                <li>Возврат средств возможен до начала выполнения аудита</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Права и обязанности сторон</h2>
              
              <h3 className="text-lg font-medium mt-6 mb-3">6.1. Пользователь имеет право:</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Использовать сервис в соответствии с условиями Соглашения</li>
                <li>Получать техническую поддержку</li>
                <li>Получать информацию о своих заказах и платежах</li>
                <li>Удалить учетную запись в любой момент</li>
              </ul>

              <h3 className="text-lg font-medium mt-6 mb-3">6.2. Пользователь обязуется:</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Соблюдать условия настоящего Соглашения</li>
                <li>Не использовать сервис для незаконных целей</li>
                <li>Не предпринимать попыток получить несанкционированный доступ</li>
                <li>Проверять только сайты, на которые имеет права</li>
              </ul>

              <h3 className="text-lg font-medium mt-6 mb-3">6.3. Администрация обязуется:</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Обеспечить работоспособность сервиса</li>
                <li>Защищать персональные данные пользователей</li>
                <li>Предоставлять услуги надлежащего качества</li>
                <li>Своевременно информировать о изменениях в работе сервиса</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Ограничение ответственности</h2>
              <p className="text-muted-foreground leading-relaxed">
                Результаты аудита носят рекомендательный характер и не являются 
                официальным юридическим заключением. Администрация не несет 
                ответственности за последствия использования или неиспользования 
                рекомендаций сервиса.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">8. Интеллектуальная собственность</h2>
              <p className="text-muted-foreground leading-relaxed">
                Все материалы сервиса (тексты, графика, логотипы, программное обеспечение) 
                являются интеллектуальной собственностью Администрации и защищены 
                законодательством РФ об авторских правах.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">9. Изменение условий</h2>
              <p className="text-muted-foreground leading-relaxed">
                Администрация вправе изменять условия Соглашения без предварительного 
                уведомления. Актуальная версия всегда доступна на данной странице. 
                Продолжение использования сервиса после изменений означает согласие 
                с новой редакцией.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">10. Применимое право</h2>
              <p className="text-muted-foreground leading-relaxed">
                Настоящее Соглашение регулируется законодательством Российской Федерации. 
                Споры разрешаются путем переговоров, а при недостижении согласия — 
                в суде по месту нахождения Администрации.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">11. Контактная информация</h2>
              <p className="text-muted-foreground leading-relaxed">
                По всем вопросам, связанным с работой сервиса, обращайтесь через 
                контактную форму на сайте или по электронной почте, указанной 
                в разделе контактов.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
