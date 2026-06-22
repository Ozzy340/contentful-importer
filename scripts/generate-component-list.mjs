import { readFile, writeFile } from 'node:fs/promises';

const snapshotPath = 'exports/model-snapshot-uat.json';
const componentMapPath = 'config/component-map.yml';
const outputPath = 'docs/COMPONENT_LIST.md';

const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const componentMapText = await readFile(componentMapPath, 'utf8');
const contentTypes = snapshot.contentTypes ?? [];
const contentTypesById = new Map(contentTypes.map((contentType) => [contentType.id, contentType]));
const mappedTargets = collectMappedTargets(componentMapText);
const bodyTypes = collectBodyTypes(contentTypesById);
const parentRefs = collectParentRefs(contentTypes);

const pageTemplateIds = new Set([
  'contentPage',
  'homePage',
  'listingPage',
  'notFoundPage',
  'resourcePage',
  'searchPage'
]);
const globalIds = new Set(['footerItem', 'resourceItem', 'resourceSet', 'siteSettings', 'socialItem']);
const mediaIds = new Set(['imageWithFocalPoint', 'mediaItem', 'resourceHero']);
const itemNamePattern = /(Item|Card|DataBlock)$/;

const categories = [
  ['Page Templates', (contentType) => pageTemplateIds.has(contentType.id)],
  ['Placeable Body Blocks', (contentType) => bodyTypes.has(contentType.id) && !pageTemplateIds.has(contentType.id)],
  [
    'Nested And Reusable Items',
    (contentType) =>
      !pageTemplateIds.has(contentType.id) &&
      !bodyTypes.has(contentType.id) &&
      !globalIds.has(contentType.id) &&
      !mediaIds.has(contentType.id) &&
      (itemNamePattern.test(contentType.id) || (parentRefs.has(contentType.id) && !contentType.id.endsWith('Block')))
  ],
  ['Media And Hero Support', (contentType) => mediaIds.has(contentType.id)],
  ['Global And System Content', (contentType) => globalIds.has(contentType.id)],
  ['Other Content Types', () => true]
];

const lines = [];
const assigned = new Set();

lines.push('# Component List');
lines.push('');
lines.push('This document is generated from the local Contentful UAT discovery snapshot and lists every content type currently available in the exported model.');
lines.push('');
lines.push('Source of truth:');
lines.push('');
lines.push('- [model-snapshot-uat.json](/Users/jamesatkins/Documents/JS/contentful-importer/exports/model-snapshot-uat.json)');
lines.push('- [model-snapshot-uat.md](/Users/jamesatkins/Documents/JS/contentful-importer/exports/model-snapshot-uat.md)');
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(`- Snapshot generated: ${snapshot.generatedAt ?? 'unknown'}`);
lines.push(`- Space: \`${snapshot.spaceId ?? 'unknown'}\``);
lines.push(`- Environment: \`${snapshot.environmentId ?? 'unknown'}\``);
lines.push(`- Environment name: \`${snapshot.environmentName ?? snapshot.environmentId ?? 'unknown'}\``);
lines.push(`- Locales: ${(snapshot.locales ?? []).map((locale) => `\`${locale.code}\``).join(', ') || 'none'}`);
lines.push(`- Total content types in export: \`${contentTypes.length}\``);
lines.push('- Current importer page target: `contentPage`');
lines.push(`- Current mapped target content types: ${[...mappedTargets].sort().map((id) => `\`${id}\``).join(', ') || 'none'}`);
lines.push('');
lines.push('## Category Index');
lines.push('');

for (const [category, predicate] of categories) {
  const items = category === 'Other Content Types'
    ? contentTypes.filter((contentType) => !assigned.has(contentType.id))
    : contentTypes.filter((contentType) => !assigned.has(contentType.id) && predicate(contentType));

  for (const item of items) {
    assigned.add(item.id);
  }

  writeCategory(category, items);
}

lines.push('## Importer Mapping Coverage');
lines.push('');
lines.push('The current importer mapping references these target content types in `config/component-map.yml`:');
lines.push('');
for (const id of [...mappedTargets].sort()) {
  const contentType = contentTypesById.get(id);
  lines.push(`- \`${id}\`${contentType ? ` (${contentType.name})` : ''}`);
}
lines.push('');

lines.push('## Full Content Type Details');
lines.push('');
for (const contentType of [...contentTypes].sort((left, right) => left.id.localeCompare(right.id))) {
  lines.push(`### ${contentType.id}`);
  lines.push('');
  lines.push(`- Name: ${contentType.name ?? contentType.id}`);
  lines.push(`- Display field: ${contentType.displayField ? `\`${contentType.displayField}\`` : 'none'}`);
  if (contentType.description) {
    lines.push(`- Description: ${clean(contentType.description)}`);
  }
  if ((contentType.metadataTaxonomySchemeIds ?? []).length > 0) {
    lines.push(`- Allowed taxonomy schemes: ${contentType.metadataTaxonomySchemeIds.map((id) => `\`${id}\``).join(', ')}`);
  }
  const refs = parentRefs.get(contentType.id);
  if (refs?.size) {
    lines.push(`- Referenced by: ${[...refs].sort().map((ref) => `\`${ref}\``).join(', ')}`);
  }
  lines.push(`- Importer mapped target: ${mappedTargets.has(contentType.id) ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('| Field ID | Name | Type | Required | Localized | Links / Validations |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const field of contentType.fields ?? []) {
    lines.push(
      `| \`${field.id}\` | ${escapeTable(field.name ?? field.id)} | ${escapeTable(fieldType(field))} | ${field.required ? 'yes' : 'no'} | ${field.localized ? 'yes' : 'no'} | ${escapeTable(fieldDetails(field))} |`
    );
  }
  lines.push('');
}

lines.push('## Notes');
lines.push('');
lines.push('- Page templates are top-level entries and are not usually nested inside body content.');
lines.push('- Placeable body blocks are content types allowed in page body regions such as `bodyContentArea` or `fullWidthContentArea`.');
lines.push('- Nested and reusable items are usually referenced by parent blocks rather than authored as standalone pages.');
lines.push('- Importer mapped target means the current YAML mapping can generate that Contentful content type directly or as a nested entry.');
lines.push('');

await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${outputPath} with ${contentTypes.length} content types.`);

function writeCategory(title, items) {
  lines.push(`### ${title}`);
  lines.push('');
  if (items.length === 0) {
    lines.push('None in this snapshot.');
    lines.push('');
    return;
  }

  lines.push('| ID | Name | Fields | Required fields | Referenced by | Importer mapped |');
  lines.push('| --- | --- | ---: | --- | --- | --- |');
  for (const contentType of [...items].sort((left, right) => left.id.localeCompare(right.id))) {
    const required = (contentType.fields ?? [])
      .filter((field) => field.required)
      .map((field) => `\`${field.id}\``)
      .join(', ') || 'none';
    const refs = parentRefs.get(contentType.id);
    lines.push(
      `| \`${contentType.id}\` | ${escapeTable(contentType.name ?? contentType.id)} | ${(contentType.fields ?? []).length} | ${escapeTable(required)} | ${escapeTable(refs?.size ? [...refs].sort().map((ref) => `\`${ref}\``).join(', ') : 'none')} | ${mappedTargets.has(contentType.id) ? 'yes' : 'no'} |`
    );
  }
  lines.push('');
}

function collectBodyTypes(contentTypesById) {
  const ids = new Set(['heroBlock']);
  for (const pageTypeId of ['contentPage', 'homePage', 'listingPage', 'resourcePage', 'searchPage']) {
    const contentType = contentTypesById.get(pageTypeId);
    for (const field of contentType?.fields ?? []) {
      if (['bodyContentArea', 'fullWidthContentArea'].includes(field.id)) {
        for (const target of linkedContentTypes(field)) {
          ids.add(target);
        }
      }
    }
  }
  return ids;
}

function collectParentRefs(contentTypes) {
  const refs = new Map();
  for (const contentType of contentTypes) {
    for (const field of contentType.fields ?? []) {
      for (const target of linkedContentTypes(field)) {
        if (!refs.has(target)) {
          refs.set(target, new Set());
        }
        refs.get(target).add(`${contentType.id}.${field.id}`);
      }
    }
  }
  return refs;
}

function linkedContentTypes(field) {
  const targets = [];
  for (const validation of field.validations ?? []) {
    if (Array.isArray(validation.linkContentType)) {
      targets.push(...validation.linkContentType);
    }
  }
  for (const validation of field.items?.validations ?? []) {
    if (Array.isArray(validation.linkContentType)) {
      targets.push(...validation.linkContentType);
    }
  }
  return targets;
}

function collectMappedTargets(componentMapText) {
  const targets = [...componentMapText.matchAll(/targetContentType:\s*([A-Za-z0-9_-]+)/g)]
    .map((match) => match[1])
    .filter(Boolean);
  return new Set(targets);
}

function fieldType(field) {
  if (field.type === 'Array' && field.items?.type) {
    const nested = field.items.linkType ? `${field.items.type}<${field.items.linkType}>` : field.items.type;
    return `Array<${nested}>`;
  }
  if (field.type === 'Link' && field.linkType) {
    return `Link<${field.linkType}>`;
  }
  return field.type ?? 'unknown';
}

function fieldDetails(field) {
  const linked = linkedContentTypes(field);
  const details = [];
  if (linked.length > 0) {
    details.push(`Allows: ${[...new Set(linked)].map((id) => `\`${id}\``).join(', ')}`);
  }
  if (field.disabled) {
    details.push('disabled');
  }
  if (field.omitted) {
    details.push('omitted');
  }
  const validations = [...(field.validations ?? []), ...(field.items?.validations ?? [])]
    .filter((validation) => !Array.isArray(validation.linkContentType));
  if (validations.length > 0) {
    details.push(validations.map(shortValidation).join('<br>'));
  }
  return details.join('<br>') || 'none';
}

function shortValidation(validation) {
  if (validation.in) {
    return `Allowed values: ${validation.in.map((value) => `\`${String(value)}\``).join(', ')}`;
  }
  if (validation.size) {
    return `Size: ${JSON.stringify(validation.size)}`;
  }
  if (validation.regexp) {
    return `Regexp: \`${validation.regexp.pattern}\``;
  }
  if (validation.enabledNodeTypes) {
    return `Rich text nodes: ${validation.enabledNodeTypes.map((value) => `\`${value}\``).join(', ')}`;
  }
  if (validation.enabledMarks) {
    return `Rich text marks: ${validation.enabledMarks.map((value) => `\`${value}\``).join(', ')}`;
  }
  if (validation.nodes) {
    return `Node restrictions: ${inlineCode(JSON.stringify(validation.nodes))}`;
  }
  if (validation.unique) {
    return 'Unique';
  }
  return inlineCode(JSON.stringify(validation));
}

function clean(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function inlineCode(value) {
  return `\`${String(value).replace(/`/g, '\\`')}\``;
}

function escapeTable(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
