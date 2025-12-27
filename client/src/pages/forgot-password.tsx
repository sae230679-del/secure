import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Shield, Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pdnConsent, setPdnConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!privacyConsent || !pdnConsent) {
      toast({
        title: "Необходимо согласие",
        description: "Пожалуйста, подтвердите ознакомление с политикой конфиденциальности и дайте согласие на обработку персональных данных.",
        variant: "destructive",
      });
      return;
    }
    forgotPasswordMutation.mutate({ email });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-10 w-10 text-primary" />
              <span className="text-3xl font-bold">SecureLex.ru</span>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold">Проверьте почту</h2>
                <p className="text-muted-foreground">
                  Если указанный email зарегистрирован в системе, вы получите письмо с инструкциями по сбросу пароля.
                </p>
                <p className="text-sm text-muted-foreground">
                  Не получили письмо? Проверьте папку "Спам" или попробуйте снова через несколько минут.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/auth")}
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Вернуться к входу
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold">SecureLex.ru</span>
          </div>
          <p className="text-muted-foreground">
            Восстановление пароля
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Забыли пароль?</CardTitle>
            <CardDescription>
              Введите ваш email, и мы отправим ссылку для сброса пароля
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="ivan@mail.ru"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={forgotPasswordMutation.isPending}
                    data-testid="input-forgot-email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="privacy-consent-forgot"
                    checked={privacyConsent}
                    onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
                    disabled={forgotPasswordMutation.isPending}
                    data-testid="checkbox-privacy-consent-forgot"
                  />
                  <label
                    htmlFor="privacy-consent-forgot"
                    className="text-sm leading-tight cursor-pointer"
                  >
                    Я ознакомлен с{" "}
                    <Link href="/privacy-policy" className="text-primary hover:underline">
                      политикой конфиденциальности
                    </Link>
                  </label>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="pdn-consent-forgot"
                    checked={pdnConsent}
                    onCheckedChange={(checked) => setPdnConsent(checked === true)}
                    disabled={forgotPasswordMutation.isPending}
                    data-testid="checkbox-pdn-consent-forgot"
                  />
                  <label
                    htmlFor="pdn-consent-forgot"
                    className="text-sm leading-tight cursor-pointer"
                  >
                    Даю{" "}
                    <Link href="/personal-data-agreement" className="text-primary hover:underline">
                      согласие на обработку персональных данных
                    </Link>
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={forgotPasswordMutation.isPending || !pdnConsent || !privacyConsent}
                data-testid="button-send-reset"
              >
                {forgotPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  "Отправить ссылку"
                )}
              </Button>

              <div className="text-center">
                <a
                  href="/auth"
                  className="text-sm text-primary hover:underline"
                  data-testid="link-back-to-login"
                >
                  <ArrowLeft className="h-3 w-3 inline mr-1" />
                  Вернуться к входу
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
