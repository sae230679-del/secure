import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { Shield, Loader2, Mail, User, Phone, KeyRound, ArrowLeft, CheckCircle, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";

type AuthMode = "login" | "register";
type LoginStep = "credentials" | "otp" | "email_not_verified" | "registration_pending";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const state = params.get("state");
    
    if (state === "verified") {
      toast({
        title: "Email подтвержден",
        description: "Теперь вы можете войти в систему.",
      });
      window.history.replaceState({}, "", "/auth");
    } else if (state === "password_reset") {
      toast({
        title: "Пароль изменен",
        description: "Теперь вы можете войти с новым паролем.",
      });
      window.history.replaceState({}, "", "/auth");
    }
  }, [searchString, toast]);

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [otpData, setOtpData] = useState({ userId: 0, code: "" });
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    privacyConsent: false,
    pdnConsent: false,
    offerConsent: false,
    marketingConsent: false,
  });
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.requireOtp) {
        setOtpData({ userId: data.userId, code: "" });
        setLoginStep("otp");
        toast({
          title: "Код подтверждения отправлен",
          description: "Проверьте ваш email",
        });
      } else {
        login(data.user);
        toast({
          title: "Добро пожаловать!",
          description: "Вы успешно вошли в систему.",
        });
        navigate("/dashboard");
      }
    },
    onError: (error: Error) => {
      const apiError = error as ApiError;
      if (apiError.code === "EMAIL_NOT_VERIFIED") {
        setPendingVerifyEmail(loginData.email);
        setLoginStep("email_not_verified");
        toast({
          title: "Email не подтвержден",
          description: "Проверьте почту для подтверждения.",
        });
      } else {
        toast({
          title: "Ошибка входа",
          description: error.message || "Неверный email или пароль.",
          variant: "destructive",
        });
      }
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { userId: number; code: string }) => {
      const response = await apiRequest("POST", "/api/auth/verify-otp", data);
      return response.json();
    },
    onSuccess: (data) => {
      login(data.user);
      toast({
        title: "Добро пожаловать!",
        description: "Вы успешно вошли в систему.",
      });
      navigate("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка подтверждения",
        description: error.message || "Неверный или истекший код.",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; phone?: string; password: string; privacyConsent: boolean; pdnConsent: boolean; offerConsent: boolean; marketingConsent: boolean }) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.emailVerificationRequired) {
        setPendingVerifyEmail(registerData.email);
        setLoginStep("registration_pending");
        toast({
          title: "Проверьте почту",
          description: data.message || "Мы отправили письмо для подтверждения email.",
        });
      } else {
        login(data.user);
        toast({
          title: "Регистрация успешна!",
          description: "Ваш аккаунт создан.",
        });
        navigate("/dashboard");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка регистрации",
        description: error.message || "Не удалось создать аккаунт.",
        variant: "destructive",
      });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/auth/resend-verification", { email });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Письмо отправлено",
        description: "Проверьте вашу почту для подтверждения.",
      });
      setResendCooldown(60);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить письмо.",
        variant: "destructive",
      });
    },
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyOtpMutation.mutate(otpData);
  };

  const handleBackToCredentials = () => {
    setLoginStep("credentials");
    setOtpData({ userId: 0, code: "" });
    setPendingVerifyEmail("");
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(registerData);
  };

  const handleResendVerification = () => {
    if (pendingVerifyEmail && resendCooldown === 0) {
      resendVerificationMutation.mutate(pendingVerifyEmail);
    }
  };

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const isLoading = loginMutation.isPending || registerMutation.isPending || verifyOtpMutation.isPending || resendVerificationMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold">SecureLex.ru</span>
          </div>
          <p className="text-muted-foreground">
            Проверка сайтов на соответствие законодательству
          </p>
        </div>

        <Card>
          {(loginStep === "email_not_verified" || loginStep === "registration_pending") ? (
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                {loginStep === "registration_pending" ? (
                  <>
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                    <h2 className="text-xl font-semibold">Проверьте почту</h2>
                    <p className="text-muted-foreground">
                      Мы отправили письмо для подтверждения на <strong>{pendingVerifyEmail}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Нажмите на ссылку в письме, чтобы активировать аккаунт.
                    </p>
                  </>
                ) : (
                  <>
                    <Mail className="h-16 w-16 text-amber-500 mx-auto" />
                    <h2 className="text-xl font-semibold">Email не подтвержден</h2>
                    <p className="text-muted-foreground">
                      Для входа необходимо подтвердить email <strong>{pendingVerifyEmail}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Проверьте почту или запросите новое письмо.
                    </p>
                  </>
                )}
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendVerification}
                  disabled={isLoading || resendCooldown > 0}
                  data-testid="button-resend-verification"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Отправка...
                    </>
                  ) : resendCooldown > 0 ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Повторить через {resendCooldown} сек
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Отправить письмо ещё раз
                    </>
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleBackToCredentials}
                  data-testid="button-back-to-login-from-verify"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Назад к входу
                </Button>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>
                  {loginStep === "otp" 
                    ? "Подтверждение входа" 
                    : mode === "login" 
                      ? "Вход в систему" 
                      : "Регистрация"}
                </CardTitle>
                <CardDescription>
                  {loginStep === "otp"
                    ? "Введите код из письма"
                    : mode === "login"
                      ? "Введите ваши данные для входа"
                      : "Создайте аккаунт для начала работы"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loginStep === "otp" ? (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp-code">Код подтверждения</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="otp-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="123456"
                      value={otpData.code}
                      onChange={(e) => setOtpData({ ...otpData, code: e.target.value.replace(/\D/g, "") })}
                      className="pl-10 text-center text-2xl tracking-widest"
                      disabled={isLoading}
                      data-testid="input-otp-code"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Код отправлен на {loginData.email}
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || otpData.code.length !== 6}
                  data-testid="button-verify-otp"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Проверка...
                    </>
                  ) : (
                    "Подтвердить"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleBackToCredentials}
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Назад к входу
                </Button>
              </form>
            ) : mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="ivan@mail.ru"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                      data-testid="input-login-email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Пароль</Label>
                  <PasswordInput
                    id="login-password"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    showLeftIcon
                    disabled={isLoading}
                    data-testid="input-login-password"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Вход...
                    </>
                  ) : (
                    "Войти"
                  )}
                </Button>

                <div className="text-center">
                  <a
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline"
                    data-testid="link-forgot-password"
                  >
                    Забыли пароль?
                  </a>
                </div>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      или войти через
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => window.location.href = "/api/oauth/vk"}
                    disabled={isLoading}
                    data-testid="button-login-vk"
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4 8.57 4 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.455 2.27 4.607 2.86 4.607.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.762-.491h1.744c.525 0 .644.271.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.491-.085.745-.576.745z"/>
                    </svg>
                    VK
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => window.location.href = "/api/oauth/yandex"}
                    disabled={isLoading}
                    data-testid="button-login-yandex"
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.04 12c0-5.523 4.476-10 10-10 5.522 0 10 4.477 10 10s-4.478 10-10 10c-5.524 0-10-4.477-10-10zm10 6.462V5.538H9.96v4.77L6.538 5.538h-2.5l4.346 6.462-4.731 6.462h2.5l3.807-5.654v5.654h2.08z"/>
                    </svg>
                    Яндекс
                  </Button>
                </div>

                {/* ФЗ-152: Уведомление о принятии условий при входе */}
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Входя в систему, вы принимаете условия{" "}
                  <Link href="/user-agreement" className="text-primary hover:underline">
                    Пользовательского соглашения
                  </Link>{" "}
                  и{" "}
                  <Link href="/privacy-policy" className="text-primary hover:underline">
                    Политики конфиденциальности
                  </Link>.
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Ваше имя</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Иван Петров"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                      data-testid="input-register-name"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="ivan@mail.ru"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                      data-testid="input-register-email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-phone">Телефон (опционально)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-phone"
                      type="tel"
                      placeholder="+7 (999) 999-99-99"
                      value={registerData.phone}
                      onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                      className="pl-10"
                      disabled={isLoading}
                      data-testid="input-register-phone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Пароль</Label>
                  <PasswordInput
                    id="register-password"
                    placeholder="Минимум 6 символов"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    showLeftIcon
                    disabled={isLoading}
                    data-testid="input-register-password"
                    required
                    minLength={6}
                  />
                </div>

                {/* ФЗ-152: Чекбоксы согласий при регистрации */}
                <div className="space-y-3 pt-2 border-t">
                  {/* Ознакомление с политикой конфиденциальности */}
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="privacy-consent"
                      checked={registerData.privacyConsent}
                      onCheckedChange={(checked) => 
                        setRegisterData({ ...registerData, privacyConsent: checked === true })
                      }
                      disabled={isLoading}
                      data-testid="checkbox-privacy-consent"
                    />
                    <label
                      htmlFor="privacy-consent"
                      className="text-sm leading-tight cursor-pointer"
                    >
                      Я ознакомлен с{" "}
                      <Link href="/privacy-policy" className="text-primary hover:underline">
                        политикой конфиденциальности
                      </Link>
                    </label>
                  </div>

                  {/* Обязательное согласие на обработку ПДн */}
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="pdn-consent"
                      checked={registerData.pdnConsent}
                      onCheckedChange={(checked) => 
                        setRegisterData({ ...registerData, pdnConsent: checked === true })
                      }
                      disabled={isLoading}
                      data-testid="checkbox-pdn-consent"
                    />
                    <label
                      htmlFor="pdn-consent"
                      className="text-sm leading-tight cursor-pointer"
                    >
                      Даю{" "}
                      <Link href="/personal-data" className="text-primary hover:underline">
                        согласие на обработку персональных данных
                      </Link>
                    </label>
                  </div>

                  {/* Принятие оферты */}
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="offer-consent"
                      checked={registerData.offerConsent}
                      onCheckedChange={(checked) => 
                        setRegisterData({ ...registerData, offerConsent: checked === true })
                      }
                      disabled={isLoading}
                      data-testid="checkbox-offer-consent"
                    />
                    <label
                      htmlFor="offer-consent"
                      className="text-sm leading-tight cursor-pointer"
                    >
                      Принимаю условия{" "}
                      <Link href="/offer" className="text-primary hover:underline">
                        договора оферты
                      </Link>
                    </label>
                  </div>
                  
                  {/* Необязательное согласие на маркетинговые рассылки */}
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="marketing-consent"
                      checked={registerData.marketingConsent}
                      onCheckedChange={(checked) => 
                        setRegisterData({ ...registerData, marketingConsent: checked === true })
                      }
                      disabled={isLoading}
                      data-testid="checkbox-marketing-consent"
                    />
                    <label
                      htmlFor="marketing-consent"
                      className="text-sm text-muted-foreground leading-tight cursor-pointer"
                    >
                      Согласен получать новости и предложения сервиса SecureLex на указанный e-mail
                    </label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !registerData.privacyConsent || !registerData.pdnConsent || !registerData.offerConsent}
                  data-testid="button-register"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Регистрация...
                    </>
                  ) : (
                    "Создать аккаунт"
                  )}
                </Button>
              </form>
            )}

            {loginStep !== "otp" && (
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => setMode(mode === "login" ? "register" : "login")}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-auth-mode"
                    >
                      {mode === "login" ? (
                        <>
                          Нет аккаунта? <span className="text-primary font-medium">Зарегистрируйтесь</span>
                        </>
                      ) : (
                        <>
                          Уже есть аккаунт? <span className="text-primary font-medium">Войдите</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Продолжая, вы соглашаетесь с{" "}
          <Link href="/user-agreement" className="text-primary hover:underline">
            условиями использования
          </Link>{" "}
          и{" "}
          <Link href="/privacy-policy" className="text-primary hover:underline">
            политикой конфиденциальности
          </Link>
        </p>
      </div>
    </div>
  );
}
