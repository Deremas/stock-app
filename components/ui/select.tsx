"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  triggerLabel?: React.ReactNode;
};

type SelectOption = {
  key: string;
  value: string;
  label: string;
  disabled: boolean;
};

function getNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => getNodeText(child)).join("");
  }

  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return getNodeText(element.props.children);
  }

  return "";
}

function extractOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  React.Children.forEach(children, (child, index) => {
    if (!React.isValidElement(child)) {
      return;
    }

    const element = child as React.ReactElement<{
      children?: React.ReactNode;
      disabled?: boolean;
      value?: string | number;
    }>;

    if (typeof element.type === "string" && element.type.toLowerCase() === "option") {
      const label = getNodeText(element.props.children);
      const value =
        element.props.value !== undefined && element.props.value !== null
          ? String(element.props.value)
          : label;

      options.push({
        key: element.key?.toString() ?? `${value}-${index}`,
        value,
        label,
        disabled: Boolean(element.props.disabled),
      });
      return;
    }

    if (element.props.children) {
      options.push(...extractOptions(element.props.children));
    }
  });

  return options;
}

function setSelectValue(element: HTMLSelectElement, nextValue: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(element, nextValue);
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      children,
      defaultValue,
      disabled,
      id,
      onBlur,
      onChange,
      triggerLabel,
      value,
      ...props
    },
    ref,
  ) => {
    const options = React.useMemo(() => extractOptions(children), [children]);
    const [open, setOpen] = React.useState(false);
    const selectRef = React.useRef<HTMLSelectElement | null>(null);
    const triggerId = id;
    const controlledValue = value !== undefined ? String(value) : undefined;
    const initialValue = React.useMemo(() => {
      if (controlledValue !== undefined) {
        return controlledValue;
      }

      if (defaultValue !== undefined && defaultValue !== null && !Array.isArray(defaultValue)) {
        return String(defaultValue);
      }

      return "";
    }, [controlledValue, defaultValue, options]);
    const [currentValue, setCurrentValue] = React.useState(initialValue);
    const selectedOption = options.find((option) => option.value === currentValue);
    const hasCustomTriggerLabel = triggerLabel !== undefined;
    const isPlaceholder = currentValue === "" && !hasCustomTriggerLabel;

    const setRefs = React.useCallback(
      (node: HTMLSelectElement | null) => {
        selectRef.current = node;

        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    React.useEffect(() => {
      if (controlledValue !== undefined) {
        setCurrentValue(controlledValue);
        return;
      }

      const nextValue = selectRef.current?.value ?? "";

      if (nextValue !== currentValue) {
        setCurrentValue(nextValue);
      }
    }, [children, controlledValue, currentValue]);

    const handleNativeChange = React.useCallback(
      (event: React.ChangeEvent<HTMLSelectElement>) => {
        setCurrentValue(event.target.value);
        onChange?.(event);
      },
      [onChange],
    );

    const handleValueChange = React.useCallback(
      (nextValue: string) => {
        if (disabled) {
          return;
        }

        const nativeSelect = selectRef.current;

        if (!nativeSelect) {
          setCurrentValue(nextValue);
          setOpen(false);
          return;
        }

        if (nativeSelect.value === nextValue) {
          setOpen(false);
          return;
        }

        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
        setter?.call(nativeSelect, nextValue);
        
        nativeSelect.dispatchEvent(new Event("input", { bubbles: true }));
        nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        setOpen(false);
      },
      [disabled],
    );

    const handleOpenChange = React.useCallback(
      (nextOpen: boolean) => {
        setOpen(nextOpen);

        if (!nextOpen && onBlur && selectRef.current) {
          onBlur({
            target: selectRef.current,
            currentTarget: selectRef.current,
          } as React.FocusEvent<HTMLSelectElement>);
        }
      },
      [onBlur],
    );

    return (
      <div className="relative w-full">
        <select
          {...props}
          ref={setRefs}
          className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
          disabled={disabled}
          onBlur={onBlur}
          onChange={handleNativeChange}
          tabIndex={-1}
          {...(controlledValue !== undefined
            ? { value: controlledValue }
            : { defaultValue: initialValue })}
        >
          {children}
        </select>
        <DropdownMenu modal={false} open={open} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              id={triggerId}
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                className,
              )}
            >
              <span
                className={cn(
                  "min-w-0 flex-1 text-left",
                  isPlaceholder ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {hasCustomTriggerLabel ? (
                  triggerLabel
                ) : (
                  <span className="block truncate">
                    {selectedOption?.label ?? "Select an option"}
                  </span>
                )}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
            <DropdownMenuContent
            align="start"
            collisionPadding={12}
            sideOffset={6}
            className="z-50 min-w-0 p-1"
            style={{
              minWidth: "var(--radix-dropdown-menu-trigger-width)",
              maxWidth: "min(28rem, calc(100vw - 1rem))",
              maxHeight: "min(18rem, calc(100vh - 6rem))",
              overflowY: "auto",
              scrollbarWidth: "thin",
            }}
          >
            <DropdownMenuRadioGroup value={currentValue} onValueChange={handleValueChange}>
              {options.map((option) => (
                <DropdownMenuRadioItem
                  key={option.key}
                  value={option.value}
                  disabled={option.disabled}
                  className="max-w-full"
                >
                  <span className="block min-w-0 py-0.5">{option.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
);

Select.displayName = "Select";

export { Select };
