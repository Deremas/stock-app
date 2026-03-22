import type { SimpleColumn } from "@/lib/table";

const surfaceColor = "hsl(var(--card))";
const surfaceSoftColor = "hsl(var(--card) / 0.82)";
const surfaceMutedColor = "hsl(var(--muted) / 0.45)";
const textColor = "hsl(var(--foreground))";
const mutedTextColor = "hsl(var(--muted-foreground))";
const borderColor = "hsl(var(--border))";
const primaryColor = "hsl(var(--primary))";

function getHeaderWidth(header: string) {
  const normalized = header.trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const longestWord = words.reduce(
    (max, word) => Math.max(max, word.length),
    0,
  );

  return Math.max(
    92,
    Math.min(210, normalized.length * 8 + 38),
    Math.min(210, longestWord * 10 + 42),
  );
}

function ensureHeaderFits(
  header: string,
  sizing: {
    size: number;
    minSize: number;
    maxSize: number;
  },
) {
  const headerWidth = getHeaderWidth(header);

  return {
    size: Math.max(sizing.size, headerWidth),
    minSize: Math.max(sizing.minSize, headerWidth),
    maxSize: Math.max(sizing.maxSize, headerWidth + 28),
  };
}

export function getSimpleColumnSizing(column: SimpleColumn) {
  const key = column.key.toLowerCase();
  const header = column.header.toLowerCase();
  const isIdentityText =
    key.includes("name") ||
    key.includes("product") ||
    key.includes("item") ||
    key.includes("customer") ||
    key.includes("supplier") ||
    key.includes("seller") ||
    key.includes("account");
  const isBranchText = key.includes("branch");
  const isCompactText =
    key.includes("code") ||
    key.includes("role") ||
    key.includes("type") ||
    key.includes("unit") ||
    key.includes("method") ||
    key.includes("source") ||
    key.includes("direction") ||
    key.includes("ownership") ||
    header === "from" ||
    header === "to";
  const isReferenceText =
    key.includes("number") ||
    key.includes("reference") ||
    key.includes("applied") ||
    key.includes("status");
  const isQuantityField =
    key.includes("qty") ||
    key.includes("quantity") ||
    key.includes("count") ||
    header.includes("qty") ||
    header.includes("stock") ||
    header.includes("count") ||
    header.includes("threshold");

  if (column.type === "number") {
    return ensureHeaderFits(column.header, {
      size: isQuantityField ? 96 : 112,
      minSize: isQuantityField ? 82 : 94,
      maxSize: isQuantityField ? 118 : 136,
    });
  }

  if (column.type === "currency") {
    return ensureHeaderFits(column.header, {
      size: 122,
      minSize: 106,
      maxSize: 146,
    });
  }

  if (column.type === "status") {
    return ensureHeaderFits(column.header, {
      size: 122,
      minSize: 106,
      maxSize: 152,
    });
  }

  if (column.type === "dateTime") {
    return ensureHeaderFits(column.header, {
      size: 164,
      minSize: 146,
      maxSize: 210,
    });
  }

  if (isIdentityText) {
    return ensureHeaderFits(column.header, {
      size: 188,
      minSize: 150,
      maxSize: 280,
    });
  }

  if (isBranchText) {
    return ensureHeaderFits(column.header, {
      size: 146,
      minSize: 122,
      maxSize: 188,
    });
  }

  if (isReferenceText) {
    return ensureHeaderFits(column.header, {
      size: 146,
      minSize: 122,
      maxSize: 198,
    });
  }

  if (isCompactText) {
    return ensureHeaderFits(column.header, {
      size: 118,
      minSize: 96,
      maxSize: 156,
    });
  }

  return ensureHeaderFits(column.header, {
    size: 142,
    minSize: 116,
    maxSize: 220,
  });
}

export const materialTableToolbarSx = {
  minHeight: "auto",
  gap: "0.75rem",
  flexWrap: "wrap",
  backgroundColor: "transparent",
  color: textColor,
  paddingInline: 0,
  paddingTop: 0,
  "& .MuiIconButton-root": {
    color: mutedTextColor,
  },
  "& .MuiIconButton-root:hover": {
    backgroundColor: surfaceMutedColor,
  },
  "& .MuiSvgIcon-root": {
    color: mutedTextColor,
  },
};

export const materialTableBottomToolbarSx = {
  backgroundColor: "transparent",
  color: textColor,
  borderTop: `1px solid ${borderColor}`,
  paddingInline: 0,
  "& .MuiTablePagination-toolbar": {
    paddingInline: "0.25rem",
  },
  "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
    color: textColor,
  },
  "& .MuiSelect-select": {
    color: textColor,
  },
  "& .MuiSvgIcon-root": {
    color: mutedTextColor,
  },
  "& .MuiIconButton-root": {
    color: mutedTextColor,
  },
};

export const materialTableHeadCellSx = {
  backgroundColor: "transparent",
  color: textColor,
  borderBottom: `1px solid ${borderColor}`,
  fontWeight: 700,
  paddingBlock: "0.9rem",
  whiteSpace: "nowrap",
  overflow: "visible",
  textAlign: "center",
  "& .MuiButtonBase-root": {
    color: textColor,
  },
  "& .Mui-TableHeadCell-Content": {
    overflow: "visible",
    justifyContent: "center",
    width: "100%",
  },
  "& .Mui-TableHeadCell-Content-Wrapper": {
    overflow: "visible",
    textOverflow: "clip",
    textAlign: "center",
  },
  "& .Mui-TableHeadCell-Content-Labels": {
    justifyContent: "center",
  },
  "& .MuiTableSortLabel-root": {
    justifyContent: "center",
  },
  "& .MuiIconButton-root": {
    color: mutedTextColor,
  },
  "& .MuiTableSortLabel-icon, & .MuiSvgIcon-root": {
    color: mutedTextColor,
  },
};

export const materialTableBodyCellSx = {
  backgroundColor: "transparent",
  color: textColor,
  borderBottom: `1px solid ${borderColor}`,
  paddingBlock: "0.85rem",
};

export const materialTableBodyRowSx = {
  backgroundColor: "transparent",
  "&:hover td": {
    backgroundColor: surfaceMutedColor,
  },
};

export const materialTablePropsSx = {
  backgroundColor: "transparent",
  color: textColor,
  "& .MuiTable-root": {
    backgroundColor: "transparent",
  },
};

export const materialTableContainerSx = {
  maxHeight: "62vh",
  maxWidth: "100%",
  overflowX: "auto",
  borderRadius: "1rem",
  backgroundColor: "transparent",
};

export const materialTableSearchTextFieldProps = {
  placeholder: "Search records",
  size: "small" as const,
  sx: {
    minWidth: {
      xs: "100%",
      sm: 240,
    },
    "& .MuiOutlinedInput-root": {
      borderRadius: "9999px",
      backgroundColor: surfaceSoftColor,
      color: textColor,
      "& fieldset": {
        borderColor,
      },
      "&:hover fieldset": {
        borderColor: primaryColor,
      },
      "&.Mui-focused fieldset": {
        borderColor: primaryColor,
      },
    },
    "& .MuiInputBase-input::placeholder": {
      color: mutedTextColor,
      opacity: 1,
    },
    "& .MuiSvgIcon-root": {
      color: mutedTextColor,
    },
  },
};

export const materialTablePaginationProps = {
  rowsPerPageOptions: [10, 20, 30, 50, 100],
  SelectProps: {
    MenuProps: {
      PaperProps: {
        sx: {
          backgroundColor: surfaceColor,
          color: textColor,
          border: `1px solid ${borderColor}`,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
        },
      },
    },
  },
  sx: materialTableBottomToolbarSx,
};
