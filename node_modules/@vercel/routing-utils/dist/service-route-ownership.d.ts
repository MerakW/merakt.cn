/**
 * Normalize a route prefix to always have a leading slash and no trailing slash
 * unless it is root (`/`).
 */
export declare function normalizeRoutePrefix(routePrefix: string): string;
/**
 * Create a service ownership guard:
 * - Root services exclude all non-root prefixes.
 * - Non-root services are constrained to their prefix and exclude descendants.
 */
export declare function getOwnershipGuard(ownerPrefix: string, allRoutePrefixes: string[]): string;
export declare function scopeRouteSourceToOwnership(source: string, ownershipGuard: string): string;
