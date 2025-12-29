import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Home,
  FileSearch,
  User,
  CreditCard,
  LogOut,
  ChevronUp,
  ChevronDown,
  Settings,
  Users,
  Package,
  BarChart3,
  Activity,
  Crown,
  Palette,
  Gift,
  Building2,
  Tag,
  Mail,
  Wallet,
  FileText,
  BookOpen,
  History,
  ClipboardList,
} from "lucide-react";

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSuperAdmin = user?.role === "superadmin";

  const userMenuItems = [
    { title: "Главная", url: "/dashboard", icon: Home },
    { title: "Экспресс-проверки", url: "/dashboard/express-checks", icon: Activity },
    { title: "Полные аудиты", url: "/dashboard/audits", icon: FileSearch },
    { title: "Мой профиль", url: "/dashboard/profile", icon: User },
    { title: "История платежей", url: "/dashboard/payments", icon: CreditCard },
    { title: "Реферальная программа", url: "/dashboard/referral", icon: Gift },
    { title: "Персональные данные", url: "/dashboard/personal-data", icon: Shield },
  ];

  const adminMenuItems = [
    { title: "Панель управления", url: "/admin", icon: BarChart3 },
    { title: "Экспресс-проверка", url: "/admin/express-audits", icon: Activity },
    { title: "Полный аудит", url: "/admin/audits", icon: FileSearch },
    { title: "Управление пакетами", url: "/admin/packages", icon: Package },
    { title: "Акции", url: "/admin/promotions", icon: Gift },
    { title: "Реквизиты и контакты", url: "/admin/company", icon: Building2 },
  ];

  const superAdminMenuItems = [
    { title: "Панель супер-админа", url: "/superadmin", icon: Crown },
    { title: "Пользователи", url: "/superadmin/users", icon: Users },
    { title: "Услуги и инструменты", url: "/superadmin/services", icon: Package },
    { title: "Настройки сайта", url: "/superadmin/settings", icon: Settings },
    { title: "Email / SMTP", url: "/superadmin/email-settings", icon: Mail },
    { title: "OAuth авторизация", url: "/superadmin/oauth-settings", icon: Users },
    { title: "Платежи / ЮKassa", url: "/superadmin/payment-settings", icon: Wallet },
    { title: "Темы дизайна", url: "/superadmin/themes", icon: Palette },
    { title: "Промокоды", url: "/superadmin/promo-codes", icon: Tag },
    { title: "Управление ПДн", url: "/superadmin/pdn", icon: Shield },
    { title: "SEO-страницы", url: "/superadmin/seo-pages", icon: FileText },
    { title: "Справочник", url: "/superadmin/guide", icon: BookOpen },
    { title: "Журнал изменений", url: "/superadmin/changelog", icon: History },
    { title: "ТЗ для ИИ-агента", url: "/superadmin/technical-specs", icon: ClipboardList },
    { title: "Журнал действий", url: "/superadmin/logs", icon: Activity },
  ];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isUserSectionActive = userMenuItems.some(item => location === item.url || location.startsWith(item.url + "/"));
  const isAdminSectionActive = adminMenuItems.some(item => location === item.url || location.startsWith(item.url + "/"));
  const isSuperAdminSectionActive = superAdminMenuItems.some(item => location === item.url || location.startsWith(item.url + "/"));

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-8 w-8 animate-traffic-light-text" />
          <span className="font-bold text-lg">SecureLex.ru</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <Collapsible defaultOpen={isUserSectionActive || !isSuperAdmin} className="group">
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer flex items-center justify-between gap-1 pr-2">
                <span>Личный кабинет</span>
                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {userMenuItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`nav-${item.url.replace(/\//g, "-")}`}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {isAdmin && (
          <Collapsible defaultOpen={isAdminSectionActive || !isSuperAdmin} className="group">
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer flex items-center justify-between gap-1 pr-2">
                  <span>Администрирование</span>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminMenuItems.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url}
                          data-testid={`nav-${item.url.replace(/\//g, "-")}`}
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {isSuperAdmin && (
          <Collapsible defaultOpen={isSuperAdminSectionActive} className="group">
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer flex items-center justify-between gap-1 pr-2">
                  <span>Супер-администратор</span>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {superAdminMenuItems.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url}
                          data-testid={`nav-${item.url.replace(/\//g, "-")}`}
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-2"
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {user?.name ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || "Пользователь"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <ChevronUp className="h-4 w-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <User className="h-4 w-4 mr-2" />
                Профиль
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive cursor-pointer"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
