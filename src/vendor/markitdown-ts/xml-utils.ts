// src/xml-utils.ts
// Hardened fast-xml-parser options shared across all XML-parsing converters.
// processEntities: false prevents XXE attacks.

export const SAFE_XML_OPTIONS = {
  allowBooleanAttributes: true,
  processEntities: false,
  htmlEntities: false,
  ignoreDeclaration: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
} as const;
