// 워크스페이스 경로와 기존 경로 매핑
const ROUTE_MAP: Record<string, string> = {
  "/discovery": "/keyword/discover",
  "/production": "/keyword/ideas",
};

const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_MAP).map(([k, v]) => [v, k])
);

/**
 * 현재 pathname이 워크스페이스 내부인지 판별하고,
 * 적절한 경로를 반환합니다.
 */
export function resolveRoute(
  target: "/discovery" | "/production",
  currentPathname: string
): string {
  const isWorkspace =
    currentPathname.startsWith("/keyword/") ||
    currentPathname.startsWith("/blog/") ||
    currentPathname === "/";

  // 워크스페이스 layout 안이면서 route group에 해당하면 workspace 경로
  if (isWorkspace && ROUTE_MAP[target]) {
    return ROUTE_MAP[target];
  }
  return target;
}
