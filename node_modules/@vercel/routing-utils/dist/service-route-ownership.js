"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var service_route_ownership_exports = {};
__export(service_route_ownership_exports, {
  getOwnershipGuard: () => getOwnershipGuard,
  normalizeRoutePrefix: () => normalizeRoutePrefix,
  scopeRouteSourceToOwnership: () => scopeRouteSourceToOwnership
});
module.exports = __toCommonJS(service_route_ownership_exports);
function normalizeRoutePrefix(routePrefix) {
  let normalized = routePrefix.startsWith("/") ? routePrefix : `/${routePrefix}`;
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized || "/";
}
function escapeForRegex(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}
function toPrefixMatcher(routePrefix) {
  return `${escapeForRegex(routePrefix)}(?:/|$)`;
}
function isDescendantPrefix(candidate, prefix) {
  return candidate !== prefix && candidate.startsWith(`${prefix}/`);
}
function getOwnershipGuard(ownerPrefix, allRoutePrefixes) {
  const owner = normalizeRoutePrefix(ownerPrefix);
  const normalizedPrefixes = Array.from(
    new Set(allRoutePrefixes.map(normalizeRoutePrefix))
  );
  const nonRootPrefixes = normalizedPrefixes.filter((prefix) => prefix !== "/").sort((a, b) => b.length - a.length);
  if (owner === "/") {
    return nonRootPrefixes.map((prefix) => `(?!${toPrefixMatcher(prefix)})`).join("");
  }
  const descendants = nonRootPrefixes.filter(
    (prefix) => isDescendantPrefix(prefix, owner)
  );
  const positive = `(?=${toPrefixMatcher(owner)})`;
  const negative = descendants.map((prefix) => `(?!${toPrefixMatcher(prefix)})`).join("");
  return `${positive}${negative}`;
}
function scopeRouteSourceToOwnership(source, ownershipGuard) {
  if (!ownershipGuard) {
    return source;
  }
  const inner = source.startsWith("^") ? source.slice(1) : source;
  return `^${ownershipGuard}(?:${inner})`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getOwnershipGuard,
  normalizeRoutePrefix,
  scopeRouteSourceToOwnership
});
