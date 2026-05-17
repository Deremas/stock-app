import * as React from "react";
import { NumericFormat, type NumericFormatProps } from "react-number-format";

import { cn } from "@/lib/utils";

export const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  NumericFormatProps
>(({ className, ...props }, ref) => {
  return (
    <NumericFormat
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      getInputRef={ref}
      thousandSeparator=","
      decimalScale={2}
      allowNegative={false}
      onFocus={(e) => {
        e.target.select();
        props.onFocus?.(e);
      }}
      {...props}
    />
  );
});

CurrencyInput.displayName = "CurrencyInput";
