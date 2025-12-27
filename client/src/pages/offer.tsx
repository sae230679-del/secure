import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, FileText, Calendar } from "lucide-react";

const DOCUMENT_VERSION = "1.0";
const DOCUMENT_DATE = "15.12.2024";

export default function OfferPage() {
  return (
    <>
      <Helmet>
        <title>Договор оферты | SecureLex.ru</title>
        <meta name="description" content="Публичная оферта на оказание услуг SecureLex.ru" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                На главную
              </Button>
            </Link>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Договор публичной оферты</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <FileText className="h-4 w-4" />
                Версия {DOCUMENT_VERSION}
                <span className="text-muted-foreground/50">|</span>
                <Calendar className="h-4 w-4" />
                {DOCUMENT_DATE}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Публичная оферта на оказание услуг</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <h2>1. Общие положения</h2>
              <p>
                Настоящий документ является официальным предложением (публичной офертой) 
                сервиса SecureLex.ru (далее - Исполнитель) заключить договор на оказание 
                услуг по проверке веб-сайтов на соответствие законодательству.
              </p>
              <p>
                Акцептом настоящей оферты является оплата услуг Заказчиком.
              </p>
              
              <h2>2. Предмет договора</h2>
              <p>
                Исполнитель обязуется оказать услуги по автоматизированной проверке 
                веб-сайта Заказчика на соответствие требованиям:
              </p>
              <ul>
                <li>Федерального закона от 27.07.2006 N 152-ФЗ "О персональных данных"</li>
                <li>Федерального закона от 27.07.2006 N 149-ФЗ "Об информации"</li>
                <li>Иных применимых нормативных актов Российской Федерации</li>
              </ul>
              
              <h2>3. Порядок оказания услуг</h2>
              <p>3.1. Заказчик выбирает пакет услуг из предложенных на сайте.</p>
              <p>3.2. Заказчик указывает URL сайта для проверки.</p>
              <p>3.3. Заказчик производит оплату выбранного пакета.</p>
              <p>3.4. Исполнитель проводит проверку в течение заявленного срока.</p>
              <p>3.5. Результаты проверки предоставляются в личном кабинете.</p>
              
              <h2>4. Стоимость и порядок оплаты</h2>
              <p>
                4.1. Стоимость услуг определяется выбранным пакетом и указана на сайте.
              </p>
              <p>
                4.2. Оплата производится банковской картой, через СБП или иными способами, 
                доступными на сайте.
              </p>
              <p>
                4.3. Услуга считается оказанной в момент предоставления отчета о проверке.
              </p>
              
              <h2>5. Права и обязанности сторон</h2>
              <h3>5.1. Исполнитель обязуется:</h3>
              <ul>
                <li>Провести проверку сайта в соответствии с выбранным пакетом</li>
                <li>Предоставить отчет о результатах проверки</li>
                <li>Обеспечить конфиденциальность данных Заказчика</li>
              </ul>
              
              <h3>5.2. Заказчик обязуется:</h3>
              <ul>
                <li>Предоставить корректный URL сайта для проверки</li>
                <li>Иметь права на управление указанным сайтом</li>
                <li>Своевременно оплатить услуги</li>
              </ul>
              
              <h2>6. Ограничение ответственности</h2>
              <p>
                6.1. Результаты проверки носят рекомендательный характер и не являются 
                юридическим заключением.
              </p>
              <p>
                6.2. Исполнитель не несет ответственности за действия контролирующих органов 
                в отношении сайта Заказчика.
              </p>
              <p>
                6.3. Максимальный размер ответственности Исполнителя ограничен стоимостью 
                оплаченных услуг.
              </p>
              
              <h2>7. Возврат средств</h2>
              <p>
                7.1. Возврат средств возможен до начала проверки.
              </p>
              <p>
                7.2. После предоставления отчета возврат средств не производится.
              </p>
              
              <h2>8. Персональные данные</h2>
              <p>
                Обработка персональных данных осуществляется в соответствии с 
                <Link href="/privacy" className="text-primary hover:underline mx-1">
                  Политикой конфиденциальности
                </Link>.
              </p>
              
              <h2>9. Срок действия и изменение условий</h2>
              <p>
                9.1. Оферта действует с момента публикации на сайте.
              </p>
              <p>
                9.2. Исполнитель вправе изменять условия оферты. Изменения вступают в силу 
                с момента публикации новой редакции.
              </p>
              
              <h2>10. Реквизиты</h2>
              <p>
                Контактный email: support@securelex.ru
              </p>
            </CardContent>
          </Card>
          
          <div className="mt-6 text-center">
            <Link href="/privacy">
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Политика конфиденциальности
              </Button>
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
