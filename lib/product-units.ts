export const PRODUCT_UNITS = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "set", label: "Sets" },
  { value: "pair", label: "Pairs" },
  { value: "pack", label: "Packs" },
  { value: "box", label: "Boxes" },
  { value: "roll", label: "Rolls" },
  { value: "meter", label: "Meters" },
  { value: "kg", label: "Kilograms" },
] as const;

export const PRODUCT_UNIT_VALUES = PRODUCT_UNITS.map(
  (unit) => unit.value,
) as [
  (typeof PRODUCT_UNITS)[number]["value"],
  ...(typeof PRODUCT_UNITS)[number]["value"][],
];

export function normalizeProductUnit(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  return PRODUCT_UNITS.some((unit) => unit.value === normalized)
    ? (normalized as (typeof PRODUCT_UNITS)[number]["value"])
    : "pcs";
}
