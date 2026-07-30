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
  hideOnMobile?: boolean;
  defaultHidden?: boolean;
  align?: "left" | "center" | "right";
  size?: number;
  compact?: boolean;
};

export type RowActionConfig = {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  showLabel?: boolean;
};

export type SimpleRow = {
  id: string;
  __actions?: RowActionConfig[];
} & Record<
  string,
  string | number | boolean | null | undefined | RowActionConfig[]
>;

export type TableTab = {
  key: string;
  label: string;
  count?: number;
};

export type TablePageConfig = {
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  secondaryActionLabel?: string;
  secondaryActionParam?: string;
  secondaryActionValue?: string;
  exportFileName?: string;
  kpis?: MetricCard[];
  tabs?: TableTab[];
  activeTab?: string;
  tabParam?: string;
  columns: SimpleColumn[];
  rows: SimpleRow[];
};
