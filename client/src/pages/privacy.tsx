import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Shield, FileText, Calendar } from "lucide-react";

const DOCUMENT_VERSION = "1.0";
const DOCUMENT_DATE = "15.12.2024";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Helmet>
        <title>Политика конфиденциальности | SecureLex.ru</title>
        <meta name="description" content="Политика обработки персональных данных SecureLex.ru в соответствии с 152-ФЗ" />
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 rounded-full w-fit">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Политика конфиденциальности</h1>
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
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Политика обработки персональных данных</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <h2>1. Общие положения</h2>
              <p>
                Настоящая Политика обработки персональных данных (далее - Политика) 
                разработана в соответствии с Федеральным законом от 27.07.2006 N 152-ФЗ 
                "О персональных данных" и определяет порядок обработки персональных данных 
                пользователей сервиса SecureLex.ru (далее - Сервис).
              </p>
              
              <h2>2. Оператор персональных данных</h2>
              <p>
                Оператором персональных данных является владелец Сервиса SecureLex.ru.
                Контактный email для вопросов по обработке ПДн: privacy@securelex.ru
              </p>
              
              <h2>3. Цели обработки персональных данных</h2>
              <p>Персональные данные обрабатываются для:</p>
              <ul>
                <li>Предоставления услуг по проверке сайтов на соответствие законодательству</li>
                <li>Идентификации пользователя в личном кабинете</li>
                <li>Обработки платежей и выставления счетов</li>
                <li>Направления уведомлений о статусе проверок</li>
                <li>Улучшения качества сервиса</li>
              </ul>
              
              <h2>4. Перечень обрабатываемых данных</h2>
              <p>Мы обрабатываем следующие категории персональных данных:</p>
              <ul>
                <li>Контактные данные: email, телефон (опционально)</li>
                <li>Учетные данные: логин, хэш пароля</li>
                <li>Платежные данные: история транзакций</li>
                <li>Технические данные: IP-адрес, cookies, user-agent</li>
              </ul>
              
              <h2>5. Правовые основания обработки</h2>
              <p>Обработка персональных данных осуществляется на основании:</p>
              <ul>
                <li>Согласия субъекта персональных данных (ст. 6 ч.1 п.1 152-ФЗ)</li>
                <li>Исполнения договора (ст. 6 ч.1 п.5 152-ФЗ)</li>
                <li>Законных интересов оператора (ст. 6 ч.1 п.7 152-ФЗ)</li>
              </ul>
              
              <h2>6. Права субъекта персональных данных</h2>
              <p>Вы имеете право:</p>
              <ul>
                <li>Получить информацию об обработке ваших ПДн</li>
                <li>Требовать уточнения или удаления ваших ПДн</li>
                <li>Отозвать согласие на обработку ПДн</li>
                <li>Обжаловать действия оператора в Роскомнадзор</li>
              </ul>
              <p>
                Для реализации своих прав воспользуйтесь разделом 
                <Link href="/dashboard/personal-data" className="text-primary hover:underline ml-1">
                  "Персональные данные"
                </Link> в личном кабинете.
              </p>
              
              <h2>7. Сроки хранения данных</h2>
              <p>
                Персональные данные хранятся до момента отзыва согласия или достижения целей обработки.
                После отзыва согласия данные уничтожаются в течение 30 дней в соответствии со ст. 21 ч. 5 152-ФЗ.
              </p>
              
              <h2>8. Меры защиты данных</h2>
              <p>Для защиты персональных данных применяются:</p>
              <ul>
                <li>Шифрование данных при передаче (TLS/HTTPS)</li>
                <li>Хэширование паролей (bcrypt)</li>
                <li>Ограничение доступа к данным</li>
                <li>Регулярное резервное копирование</li>
                <li>Мониторинг безопасности</li>
              </ul>
              
              <h2>9. Передача данных третьим лицам</h2>
              <p>
                Персональные данные могут передаваться платежным провайдерам (ЮKassa, Robokassa) 
                исключительно для обработки платежей. Трансграничная передача данных не осуществляется.
              </p>
              
              <h2>10. Файлы cookie</h2>
              <p>
                Сервис использует cookie для обеспечения работы сайта и аналитики. 
                Вы можете управлять настройками cookie через баннер при первом посещении сайта.
              </p>
              
              <h2>11. Изменения политики</h2>
              <p>
                Оператор вправе вносить изменения в настоящую Политику. 
                Актуальная версия всегда доступна на данной странице.
              </p>
            </CardContent>
          </Card>
          
          <div className="mt-6 text-center">
            <Link href="/offer">
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Договор оферты
              </Button>
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
