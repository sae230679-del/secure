import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";

type PublicSettings = {
  siteName: string;
  siteDescription: string;
  supportEmail: string;
  footerText: string;
  yandexMetrikaCode?: string;
  yandexWebmasterVerification?: string;
};

export function YandexMetrika() {
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!settings?.yandexMetrikaCode) return;

    const metrikaCode = settings.yandexMetrikaCode.trim();
    if (!metrikaCode) return;

    const existingScript = document.getElementById("yandex-metrika-script");
    if (existingScript) {
      existingScript.remove();
    }

    const sanitizedFragment = DOMPurify.sanitize(metrikaCode, {
      ADD_TAGS: ["script", "noscript", "img"],
      ADD_ATTR: ["src", "async", "defer", "type", "alt"],
      RETURN_DOM_FRAGMENT: true,
    });

    const container = document.createElement("div");
    container.id = "yandex-metrika-script";
    container.appendChild(sanitizedFragment);

    const scripts = container.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      
      if (oldScript.textContent) {
        newScript.textContent = oldScript.textContent;
      }
      
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });

    document.head.appendChild(container);

    return () => {
      const scriptToRemove = document.getElementById("yandex-metrika-script");
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [settings?.yandexMetrikaCode]);

  useEffect(() => {
    const existingMeta = document.getElementById("yandex-webmaster-verification");
    if (existingMeta) {
      existingMeta.remove();
    }

    if (!settings?.yandexWebmasterVerification) return;

    const verificationCode = settings.yandexWebmasterVerification.trim();
    if (!verificationCode) return;

    const meta = document.createElement("meta");
    meta.id = "yandex-webmaster-verification";
    meta.name = "yandex-verification";
    meta.content = verificationCode;
    document.head.appendChild(meta);

    return () => {
      const metaToRemove = document.getElementById("yandex-webmaster-verification");
      if (metaToRemove) {
        metaToRemove.remove();
      }
    };
  }, [settings?.yandexWebmasterVerification]);

  return null;
}
