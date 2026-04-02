export function toNumber(value) {
    return Number(value ?? 0);
}
export function sumRows(rows) {
    return rows.reduce((sum, value) => sum + value, 0);
}
