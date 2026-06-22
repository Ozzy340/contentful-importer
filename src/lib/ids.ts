import path from 'node:path';
import { createHash } from 'node:crypto';

declare const contentfulTagIdBrand: unique symbol;

export type ContentfulTagId = string & {
  readonly [contentfulTagIdBrand]: 'ContentfulTagId';
};

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function toContentfulTagId(input: string): ContentfulTagId {
  const normalized = slugify(input);
  if (!normalized) {
    throw new Error(`Unable to derive a Contentful-safe tag ID from "${input}"`);
  }

  return normalized as ContentfulTagId;
}

export function toContentfulResourceId(input: string, maxLength = 64): string {
  const normalized = input.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!normalized) {
    throw new Error(`Unable to derive a Contentful-safe resource ID from "${input}"`);
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 8);
  const prefix = normalized.slice(0, maxLength - hash.length - 1).replace(/[-._]+$/g, '');
  return `${prefix}-${hash}`;
}

export function padIndex(index: number, width: number): string {
  return String(index).padStart(width, '0');
}

export function basenameWithoutExt(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

export function renderTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, token: string) => {
    const value = resolvePath(variables, token.trim());
    return value === undefined || value === null ? '' : String(value);
  });
}

export function resolvePath(value: unknown, pathExpression: string): unknown {
  if (!pathExpression) {
    return value;
  }

  return pathExpression.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, value);
}
