import React from "react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = "md", label }) => {
  const sizes: Record<string, string> = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-[3px]",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className={`${sizes[size]} animate-spin rounded-full border-eni-200 border-t-eni-700`}
        role="status"
        aria-label={label || "Chargement"}
      />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  );
};

export default Spinner;
