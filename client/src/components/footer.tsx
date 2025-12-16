import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Shield, Mail, Phone, MessageCircle } from "lucide-react";
import { SiTelegram, SiWhatsapp, SiVk } from "react-icons/si";

type PublicSettings = {
  siteName: string;
  requisites?: {
    legalType: string;
    companyName: string;
    inn: string;
    kpp?: string;
    ogrn?: string;
    ogrnip?: string;
  };
  contacts?: {
    email?: string;
    phone?: string;
    telegram?: string;
    whatsapp?: string;
    vk?: string;
    maxMessenger?: string;
  };
};

function YookassaLogo({ className }: { className?: string }) {
  return (
    <>
      <img 
        src="/yookassa-logo-black.svg" 
        alt="ЮKassa" 
        className={`h-5 dark:hidden ${className || ""}`}
      />
      <img 
        src="/yookassa-logo-white.svg" 
        alt="ЮKassa" 
        className={`h-5 hidden dark:block ${className || ""}`}
      />
    </>
  );
}

function SBPBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <polygon points="12,2 15,10 12,12" fill="#5C2D91"/>
        <polygon points="12,2 12,12 9,10" fill="#ED1C24"/>
        <polygon points="22,12 14,15 12,12" fill="#00A1E4"/>
        <polygon points="22,12 12,12 14,9" fill="#5C2D91"/>
        <polygon points="2,12 10,9 12,12" fill="#FDB913"/>
        <polygon points="2,12 12,12 10,15" fill="#ED1C24"/>
        <polygon points="12,22 9,14 12,12" fill="#009A44"/>
        <polygon points="12,22 12,12 15,14" fill="#00A1E4"/>
        <polygon points="9,10 10,9 12,12" fill="#FDB913"/>
        <polygon points="14,9 15,10 12,12" fill="#1E3A6D"/>
        <polygon points="15,14 14,15 12,12" fill="#009A44"/>
        <polygon points="10,15 9,14 12,12" fill="#1E3A6D"/>
      </svg>
      <span className="text-xs font-medium">сбп</span>
    </div>
  );
}

function SberPayBadge() {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
      <svg viewBox="0 0 16 16" className="h-4 w-4">
        <circle cx="8" cy="8" r="7" fill="#21A038"/>
        <circle cx="8" cy="8" r="4" fill="none" stroke="white" strokeWidth="1.5"/>
        <path d="M8 3C5.24 3 3 5.24 3 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span className="text-xs font-medium">SberPay</span>
    </div>
  );
}

function TPayBadge() {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
      <svg viewBox="0 0 16 16" className="h-4 w-4">
        <rect width="16" height="16" rx="3" fill="#FFDD2D"/>
        <text x="8" y="12" textAnchor="middle" fill="#1A1A1A" fontSize="10" fontWeight="bold">T</text>
      </svg>
      <span className="text-xs font-medium">T-Pay</span>
    </div>
  );
}

function MirPayBadge() {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
      <svg viewBox="0 0 16 16" className="h-4 w-4">
        <rect width="16" height="16" rx="3" fill="white" stroke="#E0E0E0" strokeWidth="0.5"/>
        <path d="M2 6H4L5 10L7 6H9V12H7V8L5 12H4L2 8V12H0V6H2Z" fill="#0F754E" transform="scale(0.7) translate(4, 3)"/>
        <path d="M2 4H14C14 4 16 5 16 6H0C0 5 2 4 2 4Z" fill="url(#mirGrad)" transform="scale(0.8) translate(2, 2)"/>
        <defs>
          <linearGradient id="mirGrad" x1="0" y1="5" x2="16" y2="5">
            <stop stopColor="#00AEEF"/>
            <stop offset="0.5" stopColor="#006DB8"/>
            <stop offset="1" stopColor="#0F754E"/>
          </linearGradient>
        </defs>
      </svg>
      <span className="text-xs font-medium">Mir Pay</span>
    </div>
  );
}

function YooMoneyBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
      <svg viewBox="0 0 20 16" className="h-4" fill="none">
        <rect x="0" y="0" width="5" height="16" rx="1.5" fill="#8B3FFD"/>
        <path d="M5 3L10 3L10 7L7.5 7L7.5 9L10 9L10 13L5 13L5 3Z" fill="#8B3FFD"/>
        <circle cx="14" cy="8" r="6" fill="#8B3FFD"/>
        <circle cx="14" cy="8" r="2.5" fill="white"/>
      </svg>
      <span className="text-xs font-medium">ЮMoney</span>
    </div>
  );
}

function MirBadge() {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
      <svg viewBox="0 0 16 16" className="h-4 w-4">
        <rect width="16" height="16" rx="3" fill="white" stroke="#E0E0E0" strokeWidth="0.5"/>
        <path d="M2 5H14" stroke="url(#mirGrad2)" strokeWidth="2" strokeLinecap="round"/>
        <text x="8" y="12" textAnchor="middle" fill="#0F754E" fontSize="6" fontWeight="bold">MIR</text>
        <defs>
          <linearGradient id="mirGrad2" x1="2" y1="5" x2="14" y2="5">
            <stop stopColor="#00AEEF"/>
            <stop offset="0.5" stopColor="#006DB8"/>
            <stop offset="1" stopColor="#0F754E"/>
          </linearGradient>
        </defs>
      </svg>
      <span className="text-xs font-medium">Mir</span>
    </div>
  );
}

function B2BBadge() {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
      <svg viewBox="0 0 16 16" className="h-4 w-4">
        <rect width="16" height="16" rx="3" fill="#21A038"/>
        <text x="8" y="11" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">B2B</text>
      </svg>
      <span className="text-xs font-medium">B2B</span>
    </div>
  );
}

function PaymentMethodsDisplay({ showB2B = false }: { size?: "sm" | "md"; showB2B?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SBPBadge />
      <SberPayBadge />
      <TPayBadge />
      <MirPayBadge />
      <YooMoneyBadge />
      <MirBadge />
      {showB2B && <B2BBadge />}
    </div>
  );
}

export function Footer() {
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
  });

  const contacts = settings?.contacts;
  const requisites = settings?.requisites;

  return (
    <footer className="border-t py-12 bg-card/50" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 animate-traffic-light-text" />
              <span className="font-bold">{settings?.siteName || "SecureLex.ru"}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Автоматическая проверка сайтов на соответствие законодательству
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Сервис</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/#check" className="hover:text-foreground transition-colors" data-testid="link-footer-check">
                  Проверка сайта
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:text-foreground transition-colors" data-testid="link-footer-pricing">
                  Цены
                </Link>
              </li>
              <li>
                <Link href="/auth" className="hover:text-foreground transition-colors" data-testid="link-footer-auth">
                  Личный кабинет
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Информация</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/criteria" className="hover:text-foreground transition-colors" data-testid="link-footer-fz152">
                  О ФЗ-152
                </Link>
              </li>
              <li>
                <Link href="/guide" className="hover:text-foreground transition-colors" data-testid="link-footer-guide">
                  Справочник
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-foreground transition-colors" data-testid="link-footer-privacy-policy">
                  Политика конфиденциальности
                </Link>
              </li>
              <li>
                <Link href="/cookies-policy" className="hover:text-foreground transition-colors" data-testid="link-footer-cookies">
                  Политика cookies
                </Link>
              </li>
              <li>
                <Link href="/user-agreement" className="hover:text-foreground transition-colors" data-testid="link-footer-agreement">
                  Пользовательское соглашение
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Контакты</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <a 
                  href={`mailto:${contacts?.email || "support@securelex.ru"}`}
                  className="hover:text-foreground transition-colors"
                  data-testid="link-footer-email"
                >
                  {contacts?.email || "support@securelex.ru"}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <a 
                  href={`tel:${contacts?.phone || "+78005553535"}`}
                  className="hover:text-foreground transition-colors"
                  data-testid="link-footer-phone"
                >
                  {contacts?.phone || "+7 (800) 555-35-35"}
                </a>
              </li>
            </ul>
            {(contacts?.telegram || contacts?.whatsapp || contacts?.vk || contacts?.maxMessenger) && (
              <div className="flex items-center gap-3 mt-4">
                {contacts?.telegram && (
                  <a
                    href={contacts.telegram.startsWith("http") ? contacts.telegram : `https://t.me/${contacts.telegram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-[#0088cc] transition-colors"
                    data-testid="link-footer-telegram"
                  >
                    <SiTelegram className="h-5 w-5" />
                  </a>
                )}
                {contacts?.whatsapp && (
                  <a
                    href={contacts.whatsapp.startsWith("http") ? contacts.whatsapp : `https://wa.me/${contacts.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-[#25D366] transition-colors"
                    data-testid="link-footer-whatsapp"
                  >
                    <SiWhatsapp className="h-5 w-5" />
                  </a>
                )}
                {contacts?.vk && (
                  <a
                    href={contacts.vk.startsWith("http") ? contacts.vk : `https://vk.com/${contacts.vk}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-[#0077FF] transition-colors"
                    data-testid="link-footer-vk"
                  >
                    <SiVk className="h-5 w-5" />
                  </a>
                )}
                {contacts?.maxMessenger && contacts.maxMessenger.startsWith("http") && (
                  <a
                    href={contacts.maxMessenger}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-[#FF6600] transition-colors"
                    data-testid="link-footer-max"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </a>
                )}
              </div>
            )}
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Реквизиты</h4>
            {requisites ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="font-medium text-foreground">{requisites.companyName}</li>
                <li>ИНН: {requisites.inn}</li>
                {requisites.ogrn && <li>ОГРН: {requisites.ogrn}</li>}
                {requisites.ogrnip && <li>ОГРНИП: {requisites.ogrnip}</li>}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Реквизиты не указаны</p>
            )}
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Принимаем оплату через</span>
                <YookassaLogo className="h-5" />
              </div>
              <PaymentMethodsDisplay size="sm" showB2B={true} />
            </div>
            <div className="text-right space-y-2">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <Link href="/privacy-policy" className="hover:text-foreground transition-colors" data-testid="link-footer-privacy">
                  Политика конфиденциальности
                </Link>
                <Link href="/user-agreement" className="hover:text-foreground transition-colors" data-testid="link-footer-terms">
                  Условия использования
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} {settings?.siteName || "SecureLex.ru"}. Все права защищены.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
