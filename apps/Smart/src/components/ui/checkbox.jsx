import * as React from "react";
import { Check } from "lucide-react";

export const Checkbox = React.forwardRef(({ className = "", checked, onCheckedChange, disabled, ...props }, ref) => {
  const handleClick = () => {
    if (!disabled && onCheckedChange) {
      onCheckedChange(!checked);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      className={`peer h-5 w-5 shrink-0 rounded border-2 ${
        checked 
          ? 'bg-[#FF0000] border-[#FF0000] text-white' 
          : 'border-gray-600 bg-transparent'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors flex items-center justify-center ${className}`}
      {...props}
    >
      {checked && <Check className="h-4 w-4" />}
    </button>
  );
});

Checkbox.displayName = "Checkbox";
