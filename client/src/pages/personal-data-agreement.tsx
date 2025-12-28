import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Shield, FileText, Calendar, Mail } from "lucide-react";

const DOCUMENT_VERSION = "1.0";
const DOCUMENT_DATE = "15.12.2024";
const PDN_EMAIL = "privacy@securelex.ru";

export default function PersonalDataAgreementPage() {
  return (
    <>
      <Helmet>
        <title>Согласие на обработку ПДн | SecureLex.ru</title>
        <meta name="description" content="Согласие на обработку персональных данных SecureLex.ru в соответствии с 152-ФЗ" />
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
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 0db03b02757ef90e2822494bbfe34499ad040562
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 rounded-full w-fit">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Согласие на обработку персональных данных</h1>
              <p className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Версия {DOCUMENT_VERSION}
                </span>
                <span className="text-muted-foreground/50">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {DOCUMENT_DATE}
                </span>
<<<<<<< HEAD
=======
=======
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Согласие на обработку персональных данных</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <FileText className="h-4 w-4" />
                Версия {DOCUMENT_VERSION}
                <span className="text-muted-foreground/50">|</span>
                <Calendar className="h-4 w-4" />
                {DOCUMENT_DATE}
>>>>>>> 091c5d9 (Add a new personal data agreement page and update footer links)
>>>>>>> 0db03b02757ef90e2822494bbfe34499ad040562
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Согласие субъекта персональных данных</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Настоящим я, субъект персональных данных (далее - Пользователь), 
                свободно, своей волей и в своем интересе даю согласие владельцу сервиса 
                SecureLex.ru (далее - Оператор) на обработку моих персональных данных 
                на следующих условиях:
              </p>
              
              <h2>1. Оператор персональных данных</h2>
              <p>
                Оператором персональных данных является владелец сервиса SecureLex.ru.
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Ответственный за обработку ПДн: <a href={`mailto:${PDN_EMAIL}`} className="text-primary hover:underline">{PDN_EMAIL}</a>
              </p>
              
              <h2>2. Перечень персональных данных</h2>
              <p>Согласие дается на обработку следующих персональных данных:</p>
              <ul>
                <li>Фамилия, имя, отчество</li>
                <li>Адрес электронной почты (email)</li>
                <li>Номер телефона (при предоставлении)</li>
                <li>Наименование организации и ИНН (при предоставлении)</li>
                <li>IP-адрес, данные cookies, сведения о браузере</li>
                <li>Иные данные, предоставляемые Пользователем при использовании Сервиса</li>
              </ul>
              
              <h2>3. Цели обработки</h2>
              <p>Персональные данные обрабатываются в целях:</p>
              <ul>
                <li>Регистрации и идентификации Пользователя в Сервисе</li>
                <li>Предоставления услуг по проверке сайтов на соответствие законодательству РФ</li>
                <li>Обработки заказов и платежей</li>
                <li>Направления уведомлений о статусе проверок и результатах аудита</li>
                <li>Связи с Пользователем по вопросам оказания услуг</li>
                <li>Улучшения качества Сервиса и разработки новых функций</li>
              </ul>
              
              <h2>4. Действия с персональными данными</h2>
              <p>
                Согласие дается на совершение следующих действий: сбор, запись, 
                систематизация, накопление, хранение, уточнение (обновление, изменение), 
                извлечение, использование, передача (предоставление, доступ), 
                обезличивание, блокирование, удаление, уничтожение персональных данных.
              </p>
              
              <h2>5. Способы обработки</h2>
              <p>
                Обработка персональных данных осуществляется с использованием средств 
                автоматизации и/или без использования таких средств, включая сбор, 
                запись, систематизацию, накопление, хранение, уточнение, извлечение, 
                использование, передачу, обезличивание, блокирование, удаление, уничтожение.
              </p>
              
              <h2>6. Передача третьим лицам</h2>
              <p>
                Согласие дается на передачу персональных данных следующим третьим лицам:
              </p>
              <ul>
                <li>Платежным провайдерам (ЮKassa, Robokassa) для обработки платежей</li>
                <li>Государственным органам РФ в случаях, предусмотренных законодательством</li>
              </ul>
              <p>
                Трансграничная передача персональных данных не осуществляется.
              </p>
              
              <h2>7. Срок действия согласия</h2>
              <p>
                Настоящее согласие действует до момента его отзыва Пользователем 
                или до достижения целей обработки персональных данных.
              </p>
              
              <h2>8. Отзыв согласия</h2>
              <p>
                Пользователь вправе отозвать настоящее согласие в любое время 
                путем направления письменного уведомления на адрес электронной почты 
                <a href={`mailto:${PDN_EMAIL}`} className="text-primary hover:underline ml-1">{PDN_EMAIL}</a> 
                или через раздел "Персональные данные" в личном кабинете.
              </p>
              <p>
                В случае отзыва согласия Оператор прекращает обработку персональных 
                данных и уничтожает их в течение 30 (тридцати) дней с даты получения 
                отзыва, за исключением случаев, когда обработка необходима для 
                исполнения требований законодательства РФ.
              </p>
              
              <h2>9. Права субъекта персональных данных</h2>
              <p>Пользователь имеет право:</p>
              <ul>
                <li>Получить информацию, касающуюся обработки его персональных данных</li>
                <li>Требовать уточнения, блокирования или уничтожения персональных данных</li>
                <li>Отозвать согласие на обработку персональных данных</li>
                <li>Обжаловать действия Оператора в уполномоченный орган (Роскомнадзор)</li>
              </ul>
              
              <h2>10. Правовое основание</h2>
              <p>
                Настоящее согласие дается в соответствии со статьей 9 Федерального закона 
                от 27.07.2006 N 152-ФЗ "О персональных данных" и является письменным 
                согласием субъекта персональных данных на обработку его персональных данных.
              </p>
            </CardContent>
          </Card>
          
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/privacy-policy">
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Политика конфиденциальности
              </Button>
            </Link>
            <Link href="/offer">
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Договор-оферта
              </Button>
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
