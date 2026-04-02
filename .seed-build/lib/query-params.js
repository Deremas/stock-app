export function getSingleSearchParam(params, key) {
    const value = params?.[key];
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
