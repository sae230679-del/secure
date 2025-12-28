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
        
        try {
          VKID.Config.init({
            app: config.app,
            redirectUrl: config.redirectUrl,
            state: config.state,
            codeChallenge: config.codeChallenge,
            scope: config.scope,
            responseMode: VKID.ConfigResponseMode.Callback,
            source: VKID.ConfigSource.LOWCODE,
          });
        } catch (initError) {
          console.warn("[VK ID Widget] Config init error (CORS in dev?):", initError);
        }

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
        setError("sdk_failed");
        setIsLoading(false);
      }
    };

    initVKID();
  }, [toast, login, navigate]);

  const handleFallbackVKLogin = () => {
    if (disabled) return;
    window.location.href = "/api/oauth/vk";
  };

  if (error === "VK ID не настроен") {
    return null;
  }

  if (error === "sdk_failed") {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={handleFallbackVKLogin}
          disabled={disabled}
          className={`
            w-full flex items-center justify-center gap-2 
            h-11 rounded-lg font-medium transition-colors
            bg-[#0077FF] hover:bg-[#0066DD] text-white
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          data-testid="button-login-vk-fallback"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.525-2.049-1.714-1.033-1.01-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.339-3.202-2.17-3.046-2.764-5.339-2.764-5.813 0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.864 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.644v3.46c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.305-.491.745-.491h1.744c.525 0 .644.27.525.644-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.049.17.475-.085.72-.576.72z"/>
          </svg>
          <span>Войти через ВКонтакте</span>
        </button>
      </div>
    );
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
          title="Для входа через VK ID примите условия выше"
          data-testid="vk-id-widget-disabled-overlay"
        />
      )}
    </div>
  );
}
