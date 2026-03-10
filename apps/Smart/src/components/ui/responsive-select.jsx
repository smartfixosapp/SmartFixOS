import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

// Hook to detect touch device
function useTouchDevice() {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches
      );
    };
    
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  return isTouch;
}

// Responsive Select Component
export function ResponsiveSelect({ 
  value, 
  onValueChange, 
  children, 
  placeholder,
  triggerClassName,
  label,
  ...props 
}) {
  const isTouch = useTouchDevice();
  const [open, setOpen] = React.useState(false);

  // Extract items from children
  const items = React.Children.toArray(children)
    .filter(child => child.type === SelectItem)
    .map(child => ({
      value: child.props.value,
      label: child.props.children,
    }));

  const selectedItem = items.find(item => item.value === value);

  if (isTouch) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName
          )}
        >
          <span className={cn(!selectedItem && "text-muted-foreground")}>
            {selectedItem?.label || placeholder || "Select..."}
          </span>
        </button>

        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="pb-safe">
            <DrawerHeader>
              <DrawerTitle>{label || "Select option"}</DrawerTitle>
            </DrawerHeader>
            <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      onValueChange(item.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all",
                      value === item.value
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                    )}
                  >
                    <span className="font-medium">{item.label}</span>
                    {value === item.value && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: use regular Select
  return (
    <Select value={value} onValueChange={onValueChange} {...props}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {children}
      </SelectContent>
    </Select>
  );
}

// Re-export Select components for convenience
export { SelectItem, SelectGroup, SelectLabel } from "@/components/ui/select";
