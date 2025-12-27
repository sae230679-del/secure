import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeManagerProvider, useThemeManager } from "@/lib/theme-manager";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { MaintenanceOverlay } from "@/components/maintenance-overlay";
import { YandexMetrika } from "@/components/yandex-metrika";
import { WidgetScript } from "@/components/widget-script";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import AuditsPage from "@/pages/audits";
import AuditDetailPage from "@/pages/audit-detail";
import ProfilePage from "@/pages/profile";
import PaymentsPage from "@/pages/payments";
import AdminDashboardPage from "@/pages/admin-dashboard";
import AdminAuditsPage from "@/pages/admin-audits";
import AdminPackagesPage from "@/pages/admin-packages";
import SuperAdminDashboardPage from "@/pages/superadmin-dashboard";
import SuperAdminUsersPage from "@/pages/superadmin-users";
import SuperAdminSettingsPage from "@/pages/superadmin-settings";
import SuperAdminThemesPage from "@/pages/superadmin-themes";
import SuperAdminLogsPage from "@/pages/superadmin-logs";
import SuperAdminPromoCodesPage from "@/pages/superadmin-promo-codes";
import AdminPromotionsPage from "@/pages/admin-promotions";
import SuperAdminEmailSettingsPage from "@/pages/superadmin-email-settings";
import SuperAdminOAuthSettingsPage from "@/pages/superadmin-oauth-settings";
import SuperAdminPaymentSettingsPage from "@/pages/superadmin-payment-settings";
import SuperAdminServicesPage from "@/pages/superadmin-services";
import PdnManagementPage from "@/pages/superadmin/pdn-management";
import SeoManagementPage from "@/pages/superadmin/seo-pages";
import GuideManagementPage from "@/pages/superadmin/guide-management";
import ChangelogPage from "@/pages/superadmin/changelog";
import TechnicalSpecsPage from "@/pages/superadmin/technical-specs";
import ReferralPage from "@/pages/referral";
import CheckoutPage from "@/pages/checkout";
import PaymentResultPage from "@/pages/payment-result";
import AdminCompanySettingsPage from "@/pages/admin-company-settings";
import CriteriaPage from "@/pages/criteria";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";
import ConfirmSubscriptionPage from "@/pages/confirm-subscription";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import CookiesPolicyPage from "@/pages/cookies-policy";
import UserAgreementPage from "@/pages/user-agreement";
import PersonalDataPage from "@/pages/personal-data";
import PrivacyPage from "@/pages/dashboard/privacy";
import SeoPageView from "@/pages/seo-page";
import OfferPage from "@/pages/offer";
import PersonalDataAgreementPage from "@/pages/personal-data-agreement";
import ToolsPage from "@/pages/tools";
import FullAuditPage from "@/pages/full-audit";
import GuidePage from "@/pages/guide";
import GuideArticlePage from "@/pages/guide-article";
import GuideSectionPage from "@/pages/guide-section";
import GuideTopicPage from "@/pages/guide-topic";
import { CookieConsent } from "@/components/cookie-consent";
import { Loader2, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "admin" && user?.role !== "superadmin") {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "superadmin") {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function MaintenanceCheck({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [location] = useLocation();
  
  const { data: maintenanceData, isLoading: maintenanceLoading, isError } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/maintenance-mode"],
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 2,
  });

  const isAdminPath = location.startsWith("/admin") || location.startsWith("/superadmin") || location.startsWith("/dashboard");
  const isAdminUser = user?.role === "admin" || user?.role === "superadmin";
  const isPublicPage = location === "/" || location === "/auth" || location === "/criteria";
  
  const showMaintenance = maintenanceData?.enabled && !isAdminUser && !isAdminPath;
  
  if (showMaintenance && isPublicPage) {
    return (
      <>
        {children}
        <MaintenanceOverlay />
      </>
    );
  }
  
  if (showMaintenance) {
    return (
      <>
        <LandingPage />
        <MaintenanceOverlay />
      </>
    );
  }

  return <>{children}</>;
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { layout } = useThemeManager();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  
  const style = {
    "--sidebar-width": layout?.sidebarWidth || "18rem",
    "--sidebar-width-icon": "4rem",
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b bg-background shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <ColorModeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user?.name ? getInitials(user.name) : "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => navigate("/dashboard/profile")}>
                    <User className="h-4 w-4 mr-2" />
                    Профиль
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="text-destructive" data-testid="button-mobile-logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/confirm-subscription" component={ConfirmSubscriptionPage} />
      <Route path="/criteria" component={CriteriaPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/cookies-policy" component={CookiesPolicyPage} />
      <Route path="/user-agreement" component={UserAgreementPage} />
      <Route path="/offer" component={OfferPage} />
      <Route path="/personal-data-agreement" component={PersonalDataAgreementPage} />
      <Route path="/tools" component={ToolsPage} />
      <Route path="/full-audit" component={FullAuditPage} />
      <Route path="/guide" component={GuidePage} />
      <Route path="/guide/section/:sectionSlug" component={GuideSectionPage} />
      <Route path="/guide/topic/:topicSlug" component={GuideTopicPage} />
      <Route path="/guide/:slug" component={GuideArticlePage} />
      <Route path="/seo/:slug" component={SeoPageView} />
      
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <DashboardPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dashboard/audits">
        <ProtectedRoute>
          <DashboardLayout>
            <AuditsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dashboard/audits/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <AuditDetailPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dashboard/profile">
        <ProtectedRoute>
          <DashboardLayout>
            <ProfilePage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dashboard/payments">
        <ProtectedRoute>
          <DashboardLayout>
            <PaymentsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dashboard/referral">
        <ProtectedRoute>
          <DashboardLayout>
            <ReferralPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dashboard/personal-data">
        <ProtectedRoute>
          <DashboardLayout>
            <PersonalDataPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dashboard/privacy">
        <ProtectedRoute>
          <DashboardLayout>
            <PrivacyPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/checkout/:auditId">
        <ProtectedRoute>
          <CheckoutPage />
        </ProtectedRoute>
      </Route>

      <Route path="/payment-result">
        <ProtectedRoute>
          <PaymentResultPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute>
          <AdminRoute>
            <DashboardLayout>
              <AdminDashboardPage />
            </DashboardLayout>
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/audits">
        <ProtectedRoute>
          <AdminRoute>
            <DashboardLayout>
              <AdminAuditsPage />
            </DashboardLayout>
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/packages">
        <ProtectedRoute>
          <AdminRoute>
            <DashboardLayout>
              <AdminPackagesPage />
            </DashboardLayout>
          </AdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/promotions">
        <ProtectedRoute>
          <AdminRoute>
            <DashboardLayout>
              <AdminPromotionsPage />
            </DashboardLayout>
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/company">
        <ProtectedRoute>
          <AdminRoute>
            <DashboardLayout>
              <AdminCompanySettingsPage />
            </DashboardLayout>
          </AdminRoute>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SuperAdminDashboardPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/users">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SuperAdminUsersPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/settings">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SuperAdminSettingsPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/themes">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SuperAdminThemesPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>
      
      <Route path="/superadmin/logs">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SuperAdminLogsPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/promo-codes">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SuperAdminPromoCodesPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/email-settings">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SuperAdminEmailSettingsPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/oauth-settings">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SuperAdminOAuthSettingsPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/payment-settings">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SuperAdminPaymentSettingsPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/services">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SuperAdminServicesPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/pdn">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <PdnManagementPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/seo-pages">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <SeoManagementPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/guide">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <GuideManagementPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/changelog">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <ChangelogPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/superadmin/technical-specs">
        <ProtectedRoute>
          <SuperAdminRoute>
            <DashboardLayout>
              <TechnicalSpecsPage />
            </DashboardLayout>
          </SuperAdminRoute>
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeManagerProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <YandexMetrika />
            <WidgetScript />
            <MaintenanceCheck>
              <Router />
            </MaintenanceCheck>
            <CookieConsent />
          </TooltipProvider>
        </AuthProvider>
      </ThemeManagerProvider>
    </QueryClientProvider>
  );
}

export default App;
