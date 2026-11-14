import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "gold" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  type = "button",
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eni-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

  const variants: Record<string, string> = {
    primary: "bg-eni-700 text-white hover:bg-eni-800 shadow-xs",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    gold: "bg-gold-400 text-eni-950 font-semibold hover:bg-gold-300 shadow-xs",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-xs",
    ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
  };

  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-xs min-h-[34px]",
    md: "px-4 py-2 text-sm min-h-[40px]",
    lg: "px-5 py-2.5 text-base min-h-[44px]",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
};

export default Button;
