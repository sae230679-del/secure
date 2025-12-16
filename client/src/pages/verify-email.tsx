import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { Shield, Loader2, CheckCircle, XCircle, Mail, RefreshCw } from "lucide-react";

type PageState = "loading" | "success" | "error" | "expired" | "resend";

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const token = new URLSearchParams(searchString).get("token");

  const verifyMutation = useMutation({
    mutationFn: async (verifyToken: string) => {
      const response = await apiRequest("POST", "/api/auth/verify-email", { token: verifyToken });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.alreadyVerified) {
        setPageState("success");
        toast({
          title: "Email уже подтвержден",
          description: "Вы можете войти в систему.",
        });
      } else {
        setPageState("success");
        toast({
          title: "Email подтвержден",
          description: "Теперь вы можете войти в систему.",
        });
      }
    },
    onError: (error: Error) => {
      const apiError = error as ApiError;
      const message = error.message || "Не удалось подтвердить email";
      if (apiError.code === "TOKEN_EXPIRED") {
        setPageState("expired");
        setErrorMessage("Ссылка истекла. Запросите новое письмо подтверждения.");
      } else {
        setPageState("error");
        setErrorMessage(message);
      }
    },
  });

  const resendMutation = useMutation({
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

  useEffect(() => {
    if (!token) {
      setPageState("error");
      setErrorMessage("Недействительная ссылка подтверждения");
      return;
    }

    verifyMutation.mutate(token);
  }, [token]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resendEmail && resendCooldown === 0) {
      resendMutation.mutate(resendEmail);
    }
  };

  const renderContent = () => {
    switch (pageState) {
      case "loading":
        return (
          <div className="text-center space-y-4">
            <Loader2 className="h-16 w-16 text-primary mx-auto animate-spin" />
            <h2 className="text-xl font-semibold">Подтверждаем email...</h2>
            <p className="text-muted-foreground">
              Пожалуйста, подождите
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Email подтвержден</h2>
            <p className="text-muted-foreground">
              Теперь вы можете войти в систему и начать работу.
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

      case "expired":
        return (
          <div className="text-center space-y-4">
            <XCircle className="h-16 w-16 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold">Ссылка истекла</h2>
            <p className="text-muted-foreground">
              {errorMessage}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setPageState("resend")}
              data-testid="button-request-new-link"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Отправить письмо ещё раз
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

      case "resend":
        return (
          <form onSubmit={handleResendSubmit} className="space-y-4">
            <div className="text-center mb-4">
              <Mail className="h-12 w-12 text-primary mx-auto mb-2" />
              <h2 className="text-xl font-semibold">Повторная отправка</h2>
              <p className="text-sm text-muted-foreground">
                Введите email для отправки нового письма подтверждения
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resend-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="resend-email"
                  type="email"
                  placeholder="ivan@mail.ru"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="pl-10"
                  disabled={resendMutation.isPending}
                  data-testid="input-resend-email"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={resendMutation.isPending || resendCooldown > 0}
              data-testid="button-resend-verification"
            >
              {resendMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Отправка...
                </>
              ) : resendCooldown > 0 ? (
                `Повторить через ${resendCooldown} сек`
              ) : (
                "Отправить письмо"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/auth")}
              data-testid="button-back-to-auth-from-resend"
            >
              Вернуться к входу
            </Button>
          </form>
        );

      case "error":
      default:
        return (
          <div className="text-center space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Ошибка подтверждения</h2>
            <p className="text-muted-foreground">
              {errorMessage || "Недействительная ссылка подтверждения"}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setPageState("resend")}
              data-testid="button-try-resend"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Отправить письмо ещё раз
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/auth")}
              data-testid="button-back-to-auth-error"
            >
              Вернуться к входу
            </Button>
          </div>
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
            Подтверждение email
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
