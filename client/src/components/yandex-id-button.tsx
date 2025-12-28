import { Loader2 } from "lucide-react";

interface YandexIDButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  size?: "s" | "m" | "l";
  variant?: "primary" | "secondary";
  className?: string;
}

function YandexLogo({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M13.62 21V11.7L17.82 3H15.14L12.09 9.68H11.97L8.86 3H6L10.43 11.91V21H13.62Z" 
        fill="currentColor"
      />
    </svg>
  );
}

export function YandexIDButton({ 
  onClick, 
  disabled = false, 
  size = "m",
  variant = "primary",
  className = "" 
}: YandexIDButtonProps) {
  const sizeClasses = {
    s: "h-9 text-sm px-4",
    m: "h-11 text-base px-5",
    l: "h-14 text-lg px-6",
  };

  const iconSizes = {
    s: "h-4 w-4",
    m: "h-5 w-5",
    l: "h-6 w-6",
  };

  const variantClasses = {
    primary: "bg-[#000000] hover:bg-[#1a1a1a] text-white border-transparent",
    secondary: "bg-white hover:bg-gray-50 text-black border border-gray-300 dark:bg-[#2d2d2d] dark:hover:bg-[#3d3d3d] dark:text-white dark:border-[#4d4d4d]",
  };

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    } else if (!disabled) {
      window.location.href = "/api/oauth/yandex";
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2.5
        rounded-lg font-medium transition-colors
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFCC00]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      data-testid="button-login-yandex"
    >
      {disabled ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <div className="flex items-center justify-center bg-[#FC3F1D] rounded-md p-1">
          <YandexLogo className={`${iconSizes[size]} text-white`} />
        </div>
      )}
      <span>Войти с Яндекс ID</span>
    </button>
  );
}

export function YandexIDIconButton({ 
  onClick, 
  disabled = false,
  size = "m",
  className = "" 
}: Omit<YandexIDButtonProps, "variant">) {
  const sizeClasses = {
    s: "h-9 w-9",
    m: "h-11 w-11",
    l: "h-14 w-14",
  };

  const iconSizes = {
    s: "h-5 w-5",
    m: "h-6 w-6",
    l: "h-7 w-7",
  };

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    } else if (!disabled) {
      window.location.href = "/api/oauth/yandex";
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        rounded-lg transition-colors
        bg-[#FC3F1D] hover:bg-[#e63512]
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FC3F1D]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${className}
      `}
      data-testid="button-login-yandex-icon"
      title="Войти с Яндекс ID"
    >
      {disabled ? (
        <Loader2 className={`${iconSizes[size]} animate-spin text-white`} />
      ) : (
        <YandexLogo className={`${iconSizes[size]} text-white`} />
      )}
    </button>
  );
}
