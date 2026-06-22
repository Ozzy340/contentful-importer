import { readFile, writeFile } from 'node:fs/promises';

const snapshotPath = 'exports/model-snapshot-uat.json';
const componentMapPath = 'config/component-map.yml';
const outputPath = 'docs/CONTENTFUL_COMPONENT_FIELD_REFERENCE.md';

const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const componentMapText = await readFile(componentMapPath, 'utf8');
const contentTypes = [...(snapshot.contentTypes ?? [])].sort((left, right) =>
  left.id.localeCompare(right.id)
);
const mappedTargets = collectMappedTargets(componentMapText);
const parentRefs = collectParentRefs(contentTypes);

const lines = [];

lines.push('# Contentful Component Field Reference');
lines.push('');
lines.push('This document is generated from the local Contentful UAT model snapshot. It lists every content type, every field, the shape of values expected by Contentful, and any known allowed values or link targets.');
lines.push('');
lines.push('Source of truth:');
lines.push('');
lines.push('- [model-snapshot-uat.json](/Users/jamesatkins/Documents/JS/contentful-importer/exports/model-snapshot-uat.json)');
lines.push('- [component-map.yml](/Users/jamesatkins/Documents/JS/contentful-importer/config/component-map.yml)');
lines.push('');
lines.push('## Snapshot');
lines.push('');
lines.push(`- Generated: ${snapshot.generatedAt ?? 'unknown'}`);
lines.push(`- Space: \`${snapshot.spaceId ?? 'unknown'}\``);
lines.push(`- Environment: \`${snapshot.environmentId ?? 'unknown'}\``);
lines.push(`- Locales: ${(snapshot.locales ?? []).map((locale) => `\`${locale.code}\``).join(', ') || 'none in snapshot'}`);
lines.push(`- Content types: \`${contentTypes.length}\``);
lines.push('');
lines.push('## How To Read This');
lines.push('');
lines.push('- **Settable** says whether the field can normally be populated. Disabled or omitted fields are shown as not settable.');
lines.push('- **Input kind** describes the editorial/control shape: text input, dropdown, rich text, boolean, component link, asset link, object, or list.');
lines.push('- **Expected value** describes what the uploader or Contentful Management API should send.');
lines.push('- **Allowed values / constraints** includes dropdown options, rich text restrictions, size limits, unique fields, regex rules, and allowed linked content types.');
lines.push('- Fields marked required must be present for Contentful validation unless the content model supplies an implicit default elsewhere.');
lines.push('');
lines.push('## Component Index');
lines.push('');
lines.push('| Content Type ID | Name | Fields | Required | Importer mapped |');
lines.push('| --- | --- | ---: | --- | --- |');
for (const contentType of contentTypes) {
  const requiredFields = (contentType.fields ?? [])
    .filter((field) => field.required)
    .map((field) => `\`${field.id}\``)
    .join(', ') || 'none';
  lines.push(
    `| \`${contentType.id}\` | ${escapeTable(contentType.name ?? contentType.id)} | ${(contentType.fields ?? []).length} | ${escapeTable(requiredFields)} | ${mappedTargets.has(contentType.id) ? 'yes' : 'no'} |`
  );
}
lines.push('');
lines.push('## Full Field Reference');
lines.push('');

for (const contentType of contentTypes) {
  lines.push(`### ${contentType.id}`);
  lines.push('');
  lines.push(`- Name: ${contentType.name ?? contentType.id}`);
  lines.push(`- Display field: ${contentType.displayField ? `\`${contentType.displayField}\`` : 'none'}`);
  lines.push(`- Importer mapped target: ${mappedTargets.has(contentType.id) ? 'yes' : 'no'}`);
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
  lines.push('');
  lines.push('| Field ID | Field name | Required | Localized | Settable | Input kind | Expected value | Allowed values / constraints |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const field of contentType.fields ?? []) {
    const profile = describeField(field);
    lines.push(
      `| \`${field.id}\` | ${escapeTable(field.name ?? field.id)} | ${field.required ? 'yes' : 'no'} | ${field.localized ? 'yes' : 'no'} | ${profile.settable} | ${escapeTable(profile.inputKind)} | ${escapeTable(profile.expectedValue)} | ${escapeTable(profile.constraints)} |`
    );
  }
  lines.push('');
}

await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${outputPath} with ${contentTypes.length} content types.`);

function describeField(field) {
  const disabled = field.disabled || field.omitted;
  const allowedValues = collectAllowedValues(field);
  const linked = linkedContentTypes(field);
  const size = collectSizeRules(field);
  const constraints = [];

  if (allowedValues.length > 0) {
    constraints.push(`Allowed values: ${allowedValues.map((value) => `\`${String(value)}\``).join(', ')}`);
  }
  if (linked.length > 0) {
    constraints.push(`Allows links to: ${[...new Set(linked)].map((id) => `\`${id}\``).join(', ')}`);
  }
  constraints.push(...size);
  constraints.push(...collectOtherValidations(field));
  if (field.disabled) {
    constraints.push('disabled');
  }
  if (field.omitted) {
    constraints.push('omitted');
  }

  return {
    settable: disabled ? 'no' : 'yes',
    inputKind: disabled ? 'Not settable' : inputKind(field, allowedValues),
    expectedValue: expectedValue(field, allowedValues, linked),
    constraints: constraints.join('<br>') || 'none'
  };
}

function inputKind(field, allowedValues) {
  if (field.type === 'Array') {
    if (field.items?.type === 'Link') {
      return field.items.linkType === 'Asset' ? 'Asset link list' : 'Component/page link list';
    }
    if (allowedValues.length > 0) {
      return 'Multi-select dropdown';
    }
    return 'List';
  }

  if (allowedValues.length > 0) {
    return 'Dropdown / fixed choice';
  }

  if (field.type === 'Link') {
    return field.linkType === 'Asset' ? 'Asset link' : 'Component/page link';
  }

  switch (field.type) {
    case 'Symbol':
      return 'Short text';
    case 'Text':
      return 'Long text';
    case 'RichText':
      return 'Rich text';
    case 'Boolean':
      return 'Boolean';
    case 'Integer':
    case 'Number':
      return 'Number';
    case 'Date':
      return 'Date/time';
    case 'Object':
      return 'Structured object';
    case 'Location':
      return 'Location';
    default:
      return field.type ?? 'Unknown';
  }
}

function expectedValue(field, allowedValues, linked) {
  if (field.type === 'Array') {
    if (field.items?.type === 'Link') {
      return `Array of Contentful ${field.items.linkType ?? 'Entry'} links${linked.length > 0 ? ' to allowed targets' : ''}`;
    }
    if (allowedValues.length > 0) {
      return 'Array of selected dropdown values';
    }
    return `Array of ${field.items?.type ?? 'values'}`;
  }

  if (allowedValues.length > 0) {
    return 'One of the allowed values';
  }

  if (field.type === 'Link') {
    return `Contentful ${field.linkType ?? 'Entry'} link${linked.length > 0 ? ' to an allowed target' : ''}`;
  }

  switch (field.type) {
    case 'Symbol':
      return 'String, normally <= 255 characters';
    case 'Text':
      return 'Long string';
    case 'RichText':
      return 'Contentful Rich Text document';
    case 'Boolean':
      return '`true` or `false`';
    case 'Integer':
      return 'Whole number';
    case 'Number':
      return 'Number';
    case 'Date':
      return 'ISO date/time string';
    case 'Object':
      return 'JSON object';
    case 'Location':
      return 'Object with latitude and longitude';
    default:
      return field.type ?? 'unknown';
  }
}

function collectAllowedValues(field) {
  const values = [];
  for (const validation of allValidations(field)) {
    if (Array.isArray(validation.in)) {
      values.push(...validation.in);
    }
  }
  return [...new Set(values)];
}

function collectSizeRules(field) {
  const rules = [];
  for (const validation of allValidations(field)) {
    if (validation.size) {
      const parts = [];
      if (validation.size.min !== undefined) {
        parts.push(`min ${validation.size.min}`);
      }
      if (validation.size.max !== undefined) {
        parts.push(`max ${validation.size.max}`);
      }
      rules.push(`Size: ${parts.join(', ') || JSON.stringify(validation.size)}`);
    }
  }
  return rules;
}

function collectOtherValidations(field) {
  const details = [];
  for (const validation of allValidations(field)) {
    if (validation.in || validation.size || validation.linkContentType) {
      continue;
    }
    if (validation.unique) {
      details.push('Unique');
    } else if (validation.regexp) {
      details.push(`Regexp: \`${validation.regexp.pattern}\``);
    } else if (validation.enabledNodeTypes) {
      details.push(`Rich text nodes: ${validation.enabledNodeTypes.map((value) => `\`${value}\``).join(', ')}`);
    } else if (validation.enabledMarks) {
      details.push(`Rich text marks: ${validation.enabledMarks.map((value) => `\`${value}\``).join(', ')}`);
    } else if (validation.nodes) {
      details.push(`Node restrictions: ${inlineCode(JSON.stringify(validation.nodes))}`);
    } else if (validation.linkMimetypeGroup) {
      details.push(`Asset mimetype groups: ${validation.linkMimetypeGroup.map((value) => `\`${value}\``).join(', ')}`);
    } else {
      details.push(inlineCode(JSON.stringify(validation)));
    }
  }
  return details;
}

function allValidations(field) {
  return [...(field.validations ?? []), ...(field.items?.validations ?? [])];
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
  for (const validation of allValidations(field)) {
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

function clean(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function inlineCode(value) {
  return `\`${String(value).replace(/`/g, '\\`')}\``;
}

function escapeTable(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
