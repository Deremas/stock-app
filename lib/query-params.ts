export type RouteSearchParams = Record<string, string | string[] | undefined>;

export function getSingleSearchParam(
  params: RouteSearchParams | undefined,
  key: string,
) {
  const value = params?.[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
