import type { IconName } from "@/lib/icons";
import type { MetricCard } from "@/lib/types";

export type SimpleColumnType =
  | "text"
  | "multiline"
  | "number"
  | "currency"
  | "dateTime"
  | "status";

export type SimpleColumn = {
  key: string;
  header: string;
  type?: SimpleColumnType;
};

export type RowActionConfig = {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
};

export type SimpleRow = {
  id: string;
  __actions?: RowActionConfig[];
} & Record<
  string,
  string | number | boolean | null | undefined | RowActionConfig[]
>;

export type TablePageConfig = {
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  exportFileName?: string;
  kpis?: MetricCard[];
  columns: SimpleColumn[];
  rows: SimpleRow[];
};
