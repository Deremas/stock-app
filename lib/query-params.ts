export type RouteSearchParams = Record<string, string | string[] | undefined>;

export function getSingleSearchParam(
  params: RouteSearchParams | undefined,
  key: string,
) {
  if (!params) return undefined;

  let value = params[key];

  if (value === undefined) {
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(params).find(
      (k) => k.toLowerCase() === lowerKey
    );
    if (foundKey) {
      value = params[foundKey];
    }
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
