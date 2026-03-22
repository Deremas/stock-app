export function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export function sumRows(rows: number[]) {
  return rows.reduce((sum, value) => sum + value, 0);
}
