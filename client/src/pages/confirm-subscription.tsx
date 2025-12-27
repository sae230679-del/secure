import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ConfirmSubscriptionPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "already_confirmed" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Токен подтверждения не указан");
      return;
    }

    const confirmSubscription = async () => {
      try {
        const response = await fetch(`/api/confirm-subscription?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          if (data.alreadyConfirmed) {
            setStatus("already_confirmed");
            setMessage("Ваша подписка уже была подтверждена ранее");
          } else {
            setStatus("success");
            setMessage(data.message || "Подписка успешно подтверждена!");
          }
        } else {
          setStatus("error");
          setMessage(data.error || "Ошибка подтверждения подписки");
        }
      } catch (error) {
        setStatus("error");
        setMessage("Произошла ошибка при подтверждении подписки");
      }
    };

    confirmSubscription();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === "loading" && (
              <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            )}
            {status === "success" && (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
            {status === "already_confirmed" && (
              <Mail className="h-16 w-16 text-blue-500" />
            )}
            {status === "error" && (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl" data-testid="text-confirmation-title">
            {status === "loading" && "Подтверждение подписки..."}
            {status === "success" && "Подписка подтверждена!"}
            {status === "already_confirmed" && "Подписка уже активна"}
            {status === "error" && "Ошибка подтверждения"}
          </CardTitle>
          <CardDescription data-testid="text-confirmation-message">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {status === "success" && (
            <p className="text-sm text-center text-muted-foreground">
              Спасибо за подписку! Вы будете получать полезные материалы о защите персональных данных и соблюдении требований законодательства.
            </p>
          )}
          {status === "already_confirmed" && (
            <p className="text-sm text-center text-muted-foreground">
              Вы уже подписаны на нашу рассылку и будете получать полезные материалы.
            </p>
          )}
          <Button
            onClick={() => navigate("/")}
            className="w-full"
            data-testid="button-go-home"
          >
            На главную
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
