import * as React from "react";

const Collapsible = ({ open, onOpenChange, children }) => {
  return (
    <div data-state={open ? "open" : "closed"}>
      {React.Children.map(children, child =>
        React.cloneElement(child, { open, onOpenChange })
      )}
    </div>
  );
};

const CollapsibleTrigger = ({ children, open, onOpenChange, className = "", ...props }) => {
  return (
    <button
      type="button"
      onClick={() => onOpenChange && onOpenChange(!open)}
      className={`w-full ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const CollapsibleContent = ({ children, open }) => {
  return (
    <div
      style={{
        display: open ? "block" : "none",
      }}
    >
      {children}
    </div>
  );
};

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
