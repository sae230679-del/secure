import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

interface VKIDConfig {
  app: number;
  redirectUrl: string;
  state: string;
  codeChallenge: string;
  scope: string;
}

interface VKIDWidgetProps {
  disabled?: boolean;
}

export function VKIDWidget({ disabled = false }: VKIDWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initVKID = async () => {
      try {
        const configResponse = await fetch("/api/oauth/vk/config", {
          credentials: "include",
        });
        
        if (!configResponse.ok) {
          setError("VK ID не настроен");
          setIsLoading(false);
          return;
        }

        const config: VKIDConfig = await configResponse.json();
        
        const VKID = await import("@vkid/sdk");
        
        VKID.Config.init({
          app: config.app,
          redirectUrl: config.redirectUrl,
          state: config.state,
          codeChallenge: config.codeChallenge,
          scope: config.scope,
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
        });

        if (containerRef.current) {
          const oAuthList = new VKID.OAuthList();
          
          oAuthList.render({
            container: containerRef.current,
            scheme: VKID.Scheme.DARK,
            oauthList: [VKID.OAuthName.VK, VKID.OAuthName.MAIL, VKID.OAuthName.OK],
          });

          oAuthList.on(VKID.WidgetEvents.ERROR, (error: unknown) => {
            console.error("[VK ID Widget] Error:", error);
          });

          oAuthList.on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, async (payload: { code: string; device_id: string; state?: string }) => {
            try {
              const exchangeResponse = await fetch("/api/oauth/vk/exchange", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                  code: payload.code,
                  deviceId: payload.device_id,
                  state: payload.state || config.state,
                }),
              });

              const result = await exchangeResponse.json();

              if (result.success) {
                login(result.user);
                toast({
                  title: "Добро пожаловать!",
                  description: "Вы успешно вошли через VK ID.",
                });
                navigate("/dashboard");
              } else {
                toast({
                  title: "Ошибка входа",
                  description: result.error || "Не удалось войти через VK ID.",
                  variant: "destructive",
                });
              }
            } catch (err) {
              console.error("[VK ID Widget] Exchange error:", err);
              toast({
                title: "Ошибка",
                description: "Произошла ошибка при входе через VK ID.",
                variant: "destructive",
              });
            }
          });
        }

        setIsLoading(false);
      } catch (err) {
        console.error("[VK ID Widget] Init error:", err);
        setError("Не удалось инициализировать VK ID");
        setIsLoading(false);
      }
    };

    initVKID();
  }, [toast, login, navigate]);

  if (error) {
    return null;
  }

  return (
    <div className="w-full relative">
      {isLoading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div 
        ref={containerRef} 
        id="VkIdSdkOAuthList"
        className={isLoading ? "hidden" : ""}
        data-testid="vk-id-widget"
      />
      {disabled && !isLoading && (
        <div 
          className="absolute inset-0 bg-background/50 cursor-not-allowed"
          title="Для входа через VK ID примите условия ниже"
          data-testid="vk-id-widget-disabled-overlay"
        />
      )}
    </div>
  );
}
