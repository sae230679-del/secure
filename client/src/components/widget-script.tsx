import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";

type PublicSettings = {
  siteName: string;
  widgetCode?: string;
};

export function WidgetScript() {
  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!settings?.widgetCode) return;

    const widgetCode = settings.widgetCode.trim();
    if (!widgetCode) return;

    const existingWidget = document.getElementById("consultant-widget-script");
    if (existingWidget) {
      existingWidget.remove();
    }

    const sanitizedFragment = DOMPurify.sanitize(widgetCode, {
      ADD_TAGS: ["script", "iframe"],
      ADD_ATTR: ["src", "async", "defer", "type", "allow", "allowfullscreen", "frameborder"],
      RETURN_DOM_FRAGMENT: true,
    });

    const container = document.createElement("div");
    container.id = "consultant-widget-script";
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

    document.body.appendChild(container);

    return () => {
      const scriptToRemove = document.getElementById("consultant-widget-script");
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [settings?.widgetCode]);

  return null;
}
