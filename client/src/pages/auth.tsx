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
import { VKIDWidget } from "@/components/vk-id-widget";
import { YandexIDButton } from "@/components/yandex-id-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";

type AuthMode = "login" | "register";
type LoginStep = "credentials" | "otp" | "email_not_verified" | "registration_pending";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");
  const [consentsAccepted, setConsentsAccepted] = useState(false);
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
  const [loginConsents, setLoginConsents] = useState({
    privacyConsent: false,
    pdnConsent: false,
    offerConsent: false,
  });
  const [registerConsents, setRegisterConsents] = useState({
    privacyConsent: false,
    pdnConsent: false,
    offerConsent: false,
    marketingConsent: false,
  });
  const [otpData, setOtpData] = useState({ userId: 0, code: "" });
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
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
    mutationFn: async (data: { 
      name: string; 
      email: string; 
      phone?: string; 
      password: string; 
      privacyConsent: boolean; 
      pdnConsent: boolean; 
      offerConsent: boolean; 
      marketingConsent: boolean 
    }) => {
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
    registerMutation.mutate({
      ...registerData,
      privacyConsent: registerConsents.privacyConsent,
      pdnConsent: registerConsents.pdnConsent,
      offerConsent: registerConsents.offerConsent,
      marketingConsent: registerConsents.marketingConsent,
    });
  };

  const handleResendVerification = () => {
    if (pendingVerifyEmail && resendCooldown === 0) {
      resendVerificationMutation.mutate(pendingVerifyEmail);
    }
  };

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleAcceptConsents = () => {
    setConsentsAccepted(true);
  };

  const loginConsentsValid = loginConsents.privacyConsent && loginConsents.pdnConsent && loginConsents.offerConsent;
  const registerConsentsValid = registerConsents.privacyConsent && registerConsents.pdnConsent && registerConsents.offerConsent;

  const isLoading = loginMutation.isPending || registerMutation.isPending || verifyOtpMutation.isPending || resendVerificationMutation.isPending;

  const showConsentOverlay = !consentsAccepted && loginStep === "credentials";

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

        <Card className="relative overflow-visible">
          {showConsentOverlay && (
            <div className="absolute inset-0 z-50 bg-background/95 consent-overlay rounded-lg flex flex-col justify-center p-4 sm:p-6">
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold">
                    {mode === "login" ? "Перед входом" : "Перед регистрацией"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Для продолжения необходимо принять условия
                  </p>
                </div>

                <div className="space-y-3">
                  {mode === "login" ? (
                    <>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="overlay-privacy"
                          checked={loginConsents.privacyConsent}
                          onCheckedChange={(checked) => 
                            setLoginConsents({ ...loginConsents, privacyConsent: checked === true })
                          }
                          data-testid="checkbox-overlay-privacy"
                        />
                        <label htmlFor="overlay-privacy" className="text-sm leading-tight cursor-pointer">
                          Я ознакомлен с{" "}
                          <Link href="/privacy-policy" className="text-primary hover:underline">
                            политикой конфиденциальности
                          </Link>
                        </label>
                      </div>

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="overlay-pdn"
                          checked={loginConsents.pdnConsent}
                          onCheckedChange={(checked) => 
                            setLoginConsents({ ...loginConsents, pdnConsent: checked === true })
                          }
                          data-testid="checkbox-overlay-pdn"
                        />
                        <label htmlFor="overlay-pdn" className="text-sm leading-tight cursor-pointer">
                          Даю{" "}
                          <Link href="/personal-data-agreement" className="text-primary hover:underline">
                            согласие на обработку персональных данных
                          </Link>
                        </label>
                      </div>

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="overlay-offer"
                          checked={loginConsents.offerConsent}
                          onCheckedChange={(checked) => 
                            setLoginConsents({ ...loginConsents, offerConsent: checked === true })
                          }
                          data-testid="checkbox-overlay-offer"
                        />
                        <label htmlFor="overlay-offer" className="text-sm leading-tight cursor-pointer">
                          Принимаю условия{" "}
                          <Link href="/offer" className="text-primary hover:underline">
                            договора оферты
                          </Link>
                        </label>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="overlay-reg-privacy"
                          checked={registerConsents.privacyConsent}
                          onCheckedChange={(checked) => 
                            setRegisterConsents({ ...registerConsents, privacyConsent: checked === true })
                          }
                          data-testid="checkbox-overlay-reg-privacy"
                        />
                        <label htmlFor="overlay-reg-privacy" className="text-sm leading-tight cursor-pointer">
                          Я ознакомлен с{" "}
                          <Link href="/privacy-policy" className="text-primary hover:underline">
                            политикой конфиденциальности
                          </Link>
                        </label>
                      </div>

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="overlay-reg-pdn"
                          checked={registerConsents.pdnConsent}
                          onCheckedChange={(checked) => 
                            setRegisterConsents({ ...registerConsents, pdnConsent: checked === true })
                          }
                          data-testid="checkbox-overlay-reg-pdn"
                        />
                        <label htmlFor="overlay-reg-pdn" className="text-sm leading-tight cursor-pointer">
                          Даю{" "}
                          <Link href="/personal-data-agreement" className="text-primary hover:underline">
                            согласие на обработку персональных данных
                          </Link>
                        </label>
                      </div>

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="overlay-reg-offer"
                          checked={registerConsents.offerConsent}
                          onCheckedChange={(checked) => 
                            setRegisterConsents({ ...registerConsents, offerConsent: checked === true })
                          }
                          data-testid="checkbox-overlay-reg-offer"
                        />
                        <label htmlFor="overlay-reg-offer" className="text-sm leading-tight cursor-pointer">
                          Принимаю условия{" "}
                          <Link href="/offer" className="text-primary hover:underline">
                            договора оферты
                          </Link>
                        </label>
                      </div>

                      <div className="flex items-start gap-3 pt-2 border-t">
                        <Checkbox
                          id="overlay-reg-marketing"
                          checked={registerConsents.marketingConsent}
                          onCheckedChange={(checked) => 
                            setRegisterConsents({ ...registerConsents, marketingConsent: checked === true })
                          }
                          data-testid="checkbox-overlay-reg-marketing"
                        />
                        <label htmlFor="overlay-reg-marketing" className="text-sm leading-tight cursor-pointer">
                          <span className="text-muted-foreground">
                            Согласен получать уведомления на email
                          </span>
                          <span className="block mt-1 text-xs font-bold text-green-600 dark:text-green-400 animate-blink-green">
                            СПАМА не будет! Уведомим об изменении ФЗ-152!
                          </span>
                        </label>
                      </div>
                    </>
                  )}
                </div>

                <Button
                  className="w-full mt-4"
                  disabled={mode === "login" ? !loginConsentsValid : !registerConsentsValid}
                  onClick={handleAcceptConsents}
                  data-testid="button-accept-consents"
                >
                  Принять и продолжить
                </Button>
              </div>
            </div>
          )}

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
                        Код действителен 10 минут
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
                      data-testid="button-back-from-otp"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Назад
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
                          disabled={isLoading || !consentsAccepted}
                          data-testid="input-login-email"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="login-password">Пароль</Label>
                        <Link 
                          href="/forgot-password" 
                          className="text-xs text-muted-foreground hover:text-primary transition-colors"
                          data-testid="link-forgot-password"
                        >
                          Забыли пароль?
                        </Link>
                      </div>
                      <PasswordInput
                        id="login-password"
                        placeholder="Введите пароль"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        showLeftIcon
                        disabled={isLoading || !consentsAccepted}
                        data-testid="input-login-password"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || !consentsAccepted}
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

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          или войдите через
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="w-full">
                        <VKIDWidget disabled={isLoading || !consentsAccepted} />
                      </div>
                      
                      <YandexIDButton 
                        disabled={isLoading || !consentsAccepted} 
                        size="m"
                        variant="secondary"
                        className="w-full"
                      />
                    </div>
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
                          disabled={isLoading || !consentsAccepted}
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
                          disabled={isLoading || !consentsAccepted}
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
                          disabled={isLoading || !consentsAccepted}
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
                        disabled={isLoading || !consentsAccepted}
                        data-testid="input-register-password"
                        required
                        minLength={6}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || !consentsAccepted}
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

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          или зарегистрируйтесь через
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="w-full">
                        <VKIDWidget disabled={isLoading || !consentsAccepted} />
                      </div>
                      
                      <YandexIDButton 
                        disabled={isLoading || !consentsAccepted} 
                        size="m"
                        variant="secondary"
                        className="w-full"
                      />
                    </div>
                  </form>
                )}

                {loginStep !== "otp" && (
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMode(mode === "login" ? "register" : "login");
                        setConsentsAccepted(false);
                      }}
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
