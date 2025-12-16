import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { Shield, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

type PageState = "form" | "success" | "invalid" | "rate_limited";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pageState, setPageState] = useState<PageState>("form");
  const [errorMessage, setErrorMessage] = useState("");

  const token = new URLSearchParams(searchString).get("token");

  useEffect(() => {
    if (!token) {
      setPageState("invalid");
      setErrorMessage("Недействительная ссылка для сброса пароля");
    }
  }, [token]);

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", data);
      return response.json();
    },
    onSuccess: () => {
      setPageState("success");
      toast({
        title: "Пароль изменен",
        description: "Теперь вы можете войти с новым паролем.",
      });
    },
    onError: (err: Error) => {
      const apiError = err as ApiError;
      
      if (apiError.code === "TOKEN_EXPIRED" || apiError.code === "TOKEN_INVALID") {
        setPageState("invalid");
        setErrorMessage("Ссылка недействительна или истекла");
      } else if (apiError.code === "RATE_LIMITED" || apiError.status === 429) {
        setPageState("rate_limited");
        setErrorMessage("Слишком много попыток, попробуйте позже");
      } else {
        setPageState("invalid");
        setErrorMessage(err.message || "Не удалось сбросить пароль");
      }
      
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось сбросить пароль.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Ошибка",
        description: "Пароли не совпадают",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Ошибка",
        description: "Пароль должен быть не менее 6 символов",
        variant: "destructive",
      });
      return;
    }

    if (token) {
      resetPasswordMutation.mutate({ token, password });
    }
  };

  const renderContent = () => {
    switch (pageState) {
      case "success":
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Пароль успешно изменен</h2>
            <p className="text-muted-foreground">
              Теперь вы можете войти в систему с новым паролем.
            </p>
            <Button
              className="w-full"
              onClick={() => navigate("/auth")}
              data-testid="button-go-to-login"
            >
              Перейти к входу
            </Button>
          </div>
        );

      case "invalid":
        return (
          <div className="text-center space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Ссылка недействительна</h2>
            <p className="text-muted-foreground">
              {errorMessage || "Ссылка недействительна или истекла"}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/forgot-password")}
              data-testid="button-request-new-link"
            >
              Запросить новую ссылку
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/auth")}
              data-testid="button-back-to-auth"
            >
              Вернуться к входу
            </Button>
          </div>
        );

      case "rate_limited":
        return (
          <div className="text-center space-y-4">
            <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold">Слишком много попыток</h2>
            <p className="text-muted-foreground">
              {errorMessage || "Попробуйте позже"}
            </p>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/auth")}
              data-testid="button-back-to-auth-rate"
            >
              Вернуться к входу
            </Button>
          </div>
        );

      case "form":
      default:
        return (
          <>
            <CardHeader>
              <CardTitle>Новый пароль</CardTitle>
              <CardDescription>
                Введите новый пароль для вашего аккаунта
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Новый пароль</Label>
                  <PasswordInput
                    id="password"
                    placeholder="Минимум 6 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    showLeftIcon
                    disabled={resetPasswordMutation.isPending}
                    data-testid="input-new-password"
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Подтвердите пароль</Label>
                  <PasswordInput
                    id="confirm-password"
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    showLeftIcon
                    disabled={resetPasswordMutation.isPending}
                    data-testid="input-confirm-password"
                    required
                    minLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-reset-password"
                >
                  {resetPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    "Сохранить новый пароль"
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold">SecureLex.ru</span>
          </div>
          <p className="text-muted-foreground">
            Сброс пароля
          </p>
        </div>

        <Card>
          {pageState === "form" ? (
            renderContent()
          ) : (
            <CardContent className="pt-6">
              {renderContent()}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
