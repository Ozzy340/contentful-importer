import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import {
  assertSafeEnvironment,
  createContentfulContext,
  deleteTag,
  getTags,
  updateTag
} from '../lib/contentful-client.js';
import type { ContentfulContext, ContentfulTagResource } from '../lib/contentful-client.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import type { CliFlags, LoadedProjectConfig, RuntimeEnv } from '../lib/types.js';

const OLD_GROUP = 'Form name';
const NEW_GROUP = 'Form Name';
const OLD_PREFIX = `${OLD_GROUP}:`;
const NEW_PREFIX = `${NEW_GROUP}:`;
const CONTENTFUL_PAGE_SIZE = 100;

type MigrationMode = 'dry-run' | 'apply';
type MigrationAction =
  | 'would-rename'
  | 'renamed'
  | 'would-merge-and-delete'
  | 'merged-and-deleted';
type EntityType = 'entry' | 'asset';
type EntityUpdateAction = 'would-update' | 'updated';

interface CommandConfig {
  allowNonSandbox: boolean;
  dryRun: boolean;
  environmentId: string;
}

interface PlanIssue {
  severity: 'error' | 'warning';
  message: string;
  tagId?: string;
  entityId?: string;
}

interface TagMigrationPlan {
  action: MigrationAction;
  oldTag: ContentfulTagResource;
  newName: string;
  targetTag?: ContentfulTagResource;
}

interface EntityReferencePlan {
  action: EntityUpdateAction;
  entityId: string;
  entityType: EntityType;
  oldTagIds: string[];
  targetTagIds: string[];
  previousTagIds: string[];
  nextTagIds: string[];
}

interface MigrationReport {
  generatedAt: string;
  mode: MigrationMode;
  spaceId?: string;
  environmentId: string;
  input: {
    oldGroup: string;
    newGroup: string;
  };
  summary: ReportSummary;
  tags: TagMigrationPlan[];
  entityReferenceUpdates: EntityReferencePlan[];
  issues: PlanIssue[];
}

interface ReportSummary {
  assetsUpdated: number;
  assetsWouldUpdate: number;
  entriesUpdated: number;
  entriesWouldUpdate: number;
  errors: number;
  oldTagsFound: number;
  tagsMergedAndDeleted: number;
  tagsRenamed: number;
  tagsWouldMergeAndDelete: number;
  tagsWouldRename: number;
  warnings: number;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'form-name-tags');
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(flags, projectConfig.env);

  logger.info(commandConfig.dryRun ? 'Preparing Form Name tag migration dry run' : 'Applying Form Name tag migration', {
    environmentId: commandConfig.environmentId,
    oldGroup: OLD_GROUP,
    newGroup: NEW_GROUP
  });

  const context = await createContentfulContext({
    ...projectConfig.env,
    CONTENTFUL_ENVIRONMENT_ID: commandConfig.environmentId
  });

  if (!commandConfig.dryRun) {
    assertSafeEnvironment(
      context.environmentId,
      projectConfig.conventions,
      commandConfig.allowNonSandbox
    );
  }

  const issues: PlanIssue[] = [];
  const existingTags = await getTags(context);
  const tagPlans = buildTagMigrationPlan(existingTags, issues);
  validateTagMigrationPlan(tagPlans, issues);

  logger.info('Planned tag migration actions', {
    oldTagsFound: tagPlans.length,
    tagsToRename: tagPlans.filter((plan) => plan.action === 'would-rename').length,
    tagsToMergeAndDelete: tagPlans.filter((plan) => plan.action === 'would-merge-and-delete').length
  });

  let entityReferenceUpdates: EntityReferencePlan[] = [];
  const oldToTargetTagIds = buildMergeTargetMap(tagPlans);
  if (oldToTargetTagIds.size > 0 && !hasErrors(issues)) {
    logger.info('Scanning entries and assets for old Form name tag references', {
      oldTagIds: [...oldToTargetTagIds.keys()].join(', ')
    });
    entityReferenceUpdates = await findEntityReferenceUpdates(context, oldToTargetTagIds);
  }

  if (hasErrors(issues)) {
    const report = buildReport(projectConfig, commandConfig, tagPlans, entityReferenceUpdates, issues);
    const reportPaths = await writeReports(projectConfig, commandConfig, report);
    logger.error('Form Name tag migration has blocking errors; no Contentful writes were made', {
      errors: report.summary.errors,
      report: reportPaths.markdownPath
    });
    process.exitCode = 1;
    return;
  }

  if (!commandConfig.dryRun) {
    await applyEntityReferenceUpdates(context, entityReferenceUpdates);
    await applyTagMigrationPlan(context, tagPlans);
  }

  const report = buildReport(projectConfig, commandConfig, tagPlans, entityReferenceUpdates, issues);
  const reportPaths = await writeReports(projectConfig, commandConfig, report);

  for (const issue of issues.filter((item) => item.severity === 'warning')) {
    logger.warn(issue.message, {
      tagId: issue.tagId,
      entityId: issue.entityId
    });
  }

  logger.info(commandConfig.dryRun ? 'Form Name tag migration dry run finished' : 'Form Name tag migration finished', {
    report: reportPaths.markdownPath,
    ...report.summary
  });
}

function resolveCommandConfig(flags: CliFlags, env: RuntimeEnv): CommandConfig {
  requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN', 'CONTENTFUL_SPACE_ID']);

  const environmentId =
    stringFlag(flags, 'env') ??
    stringFlag(flags, 'environment') ??
    env.CONTENTFUL_ENVIRONMENT_ID;

  if (!environmentId) {
    throw new Error('Missing Contentful environment. Use --env <environment>.');
  }

  return {
    allowNonSandbox: Boolean(flags['allow-non-sandbox']),
    dryRun: !flags.yes,
    environmentId
  };
}

function buildTagMigrationPlan(
  tags: ContentfulTagResource[],
  issues: PlanIssue[]
): TagMigrationPlan[] {
  const tagsByName = new Map(tags.map((tag) => [tag.name, tag]));
  const oldTags = tags
    .filter((tag) => tag.name.startsWith(OLD_PREFIX))
    .sort((left, right) => left.name.localeCompare(right.name));

  const plans: TagMigrationPlan[] = [];

  for (const oldTag of oldTags) {
    const newName = toNewName(oldTag.name);
    const targetTag = tagsByName.get(newName);

    if (oldTag.visibility && oldTag.visibility !== 'public') {
      issues.push({
        severity: 'warning',
        tagId: oldTag.id,
        message: `Old tag ${oldTag.id} is ${oldTag.visibility}; migration will leave tag visibility unchanged.`
      });
    }

    if (targetTag && targetTag.id !== oldTag.id) {
      plans.push({
        action: 'would-merge-and-delete',
        oldTag,
        newName,
        targetTag
      });
      continue;
    }

    plans.push({
      action: 'would-rename',
      oldTag,
      newName
    });
  }

  return plans;
}

function validateTagMigrationPlan(
  tagPlans: TagMigrationPlan[],
  issues: PlanIssue[]
): void {
  for (const plan of tagPlans) {
    if (typeof plan.oldTag.version !== 'number') {
      issues.push({
        severity: 'error',
        tagId: plan.oldTag.id,
        message: `Cannot migrate tag ${plan.oldTag.id}; Contentful did not return its version.`
      });
    }
  }
}

function buildMergeTargetMap(tagPlans: TagMigrationPlan[]): Map<string, string> {
  const oldToTargetTagIds = new Map<string, string>();

  for (const plan of tagPlans) {
    if (plan.action !== 'would-merge-and-delete' || !plan.targetTag) {
      continue;
    }

    oldToTargetTagIds.set(plan.oldTag.id, plan.targetTag.id);
  }

  return oldToTargetTagIds;
}

async function findEntityReferenceUpdates(
  context: ContentfulContext,
  oldToTargetTagIds: Map<string, string>
): Promise<EntityReferencePlan[]> {
  const updates: EntityReferencePlan[] = [];
  updates.push(...await findEntryReferenceUpdates(context, oldToTargetTagIds));
  updates.push(...await findAssetReferenceUpdates(context, oldToTargetTagIds));
  return updates.sort((left, right) =>
    left.entityType.localeCompare(right.entityType) || left.entityId.localeCompare(right.entityId)
  );
}

async function findEntryReferenceUpdates(
  context: ContentfulContext,
  oldToTargetTagIds: Map<string, string>
): Promise<EntityReferencePlan[]> {
  const plans: EntityReferencePlan[] = [];
  let skip = 0;
  let total = 0;

  do {
    const response = await context.environment.getEntries({
      limit: CONTENTFUL_PAGE_SIZE,
      skip
    });

    for (const entry of response.items ?? []) {
      const plan = buildEntityReferencePlan('entry', entry, oldToTargetTagIds);
      if (plan) {
        plans.push(plan);
      }
    }

    total = Number(response.total ?? 0);
    skip += CONTENTFUL_PAGE_SIZE;
  } while (skip < total);

  return plans;
}

async function findAssetReferenceUpdates(
  context: ContentfulContext,
  oldToTargetTagIds: Map<string, string>
): Promise<EntityReferencePlan[]> {
  const plans: EntityReferencePlan[] = [];
  let skip = 0;
  let total = 0;

  do {
    const response = await context.environment.getAssets({
      limit: CONTENTFUL_PAGE_SIZE,
      skip
    });

    for (const asset of response.items ?? []) {
      const plan = buildEntityReferencePlan('asset', asset, oldToTargetTagIds);
      if (plan) {
        plans.push(plan);
      }
    }

    total = Number(response.total ?? 0);
    skip += CONTENTFUL_PAGE_SIZE;
  } while (skip < total);

  return plans;
}

function buildEntityReferencePlan(
  entityType: EntityType,
  entity: any,
  oldToTargetTagIds: Map<string, string>
): EntityReferencePlan | undefined {
  const entityId = getEntityId(entity);
  if (!entityId) {
    return undefined;
  }

  const previousTagIds = getMetadataTagIds(entity?.metadata?.tags);
  const oldTagIds = previousTagIds.filter((tagId) => oldToTargetTagIds.has(tagId));
  if (oldTagIds.length === 0) {
    return undefined;
  }

  const nextTagIds = unique(
    previousTagIds.map((tagId) => oldToTargetTagIds.get(tagId) ?? tagId)
  );

  return {
    action: 'would-update',
    entityId,
    entityType,
    oldTagIds: unique(oldTagIds),
    targetTagIds: unique(
      oldTagIds
        .map((tagId) => oldToTargetTagIds.get(tagId))
        .filter(isPresent)
    ),
    previousTagIds,
    nextTagIds
  };
}

async function applyEntityReferenceUpdates(
  context: ContentfulContext,
  entityReferenceUpdates: EntityReferencePlan[]
): Promise<void> {
  for (const updatePlan of entityReferenceUpdates) {
    const entity =
      updatePlan.entityType === 'entry'
        ? await context.environment.getEntry(updatePlan.entityId)
        : await context.environment.getAsset(updatePlan.entityId);

    const currentMetadata = isRecord(entity.metadata) ? entity.metadata : {};
    entity.metadata = {
      ...currentMetadata,
      tags: updatePlan.nextTagIds.map(toTagLink)
    };
    await entity.update();
    updatePlan.action = 'updated';
  }
}

async function applyTagMigrationPlan(
  context: ContentfulContext,
  tagPlans: TagMigrationPlan[]
): Promise<void> {
  for (const plan of tagPlans) {
    if (typeof plan.oldTag.version !== 'number') {
      throw new Error(`Cannot migrate tag ${plan.oldTag.id}; Contentful did not return its version.`);
    }

    if (plan.action === 'would-rename') {
      await updateTag(context, plan.oldTag.id, {
        name: plan.newName,
        version: plan.oldTag.version
      });
      plan.action = 'renamed';
      continue;
    }

    if (plan.action === 'would-merge-and-delete') {
      await deleteTag(context, plan.oldTag.id, plan.oldTag.version);
      plan.action = 'merged-and-deleted';
    }
  }
}

function buildReport(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  tags: TagMigrationPlan[],
  entityReferenceUpdates: EntityReferencePlan[],
  issues: PlanIssue[]
): MigrationReport {
  return {
    generatedAt: new Date().toISOString(),
    mode: commandConfig.dryRun ? 'dry-run' : 'apply',
    spaceId: projectConfig.env.CONTENTFUL_SPACE_ID,
    environmentId: commandConfig.environmentId,
    input: {
      oldGroup: OLD_GROUP,
      newGroup: NEW_GROUP
    },
    summary: summarize(tags, entityReferenceUpdates, issues),
    tags,
    entityReferenceUpdates,
    issues
  };
}

async function writeReports(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  report: MigrationReport
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runId = `form-name-tag-migration-${commandConfig.dryRun ? 'dry-run' : 'apply'}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const jsonPath = await writeJsonArtifact(projectConfig.paths.buildReportsDir, `${runId}.json`, report);
  const markdownPath = await writeTextArtifact(
    projectConfig.paths.buildReportsDir,
    `${runId}.md`,
    renderMarkdownReport(report)
  );

  return { jsonPath, markdownPath };
}

function renderMarkdownReport(report: MigrationReport): string {
  const lines: string[] = [];
  lines.push('# Form Name Tag Migration');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Space ID: ${report.spaceId ?? 'n/a'}`);
  lines.push(`- Environment ID: ${report.environmentId}`);
  lines.push(`- Old tag group: ${report.input.oldGroup}`);
  lines.push(`- New tag group: ${report.input.newGroup}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Old \`${OLD_GROUP}\` tags found | ${report.summary.oldTagsFound} |`);
  lines.push(`| Tags that would be renamed | ${report.summary.tagsWouldRename} |`);
  lines.push(`| Tags renamed | ${report.summary.tagsRenamed} |`);
  lines.push(`| Tags that would be merged and deleted | ${report.summary.tagsWouldMergeAndDelete} |`);
  lines.push(`| Tags merged and deleted | ${report.summary.tagsMergedAndDeleted} |`);
  lines.push(`| Entries that would be retagged | ${report.summary.entriesWouldUpdate} |`);
  lines.push(`| Entries retagged | ${report.summary.entriesUpdated} |`);
  lines.push(`| Assets that would be retagged | ${report.summary.assetsWouldUpdate} |`);
  lines.push(`| Assets retagged | ${report.summary.assetsUpdated} |`);
  lines.push(`| Warnings | ${report.summary.warnings} |`);
  lines.push(`| Errors | ${report.summary.errors} |`);
  lines.push('');

  if (report.issues.length > 0) {
    lines.push('## Issues');
    lines.push('');
    for (const issue of report.issues) {
      const context = [
        issue.tagId ? `tag ${issue.tagId}` : undefined,
        issue.entityId ? `entity ${issue.entityId}` : undefined
      ].filter(Boolean).join(', ');
      lines.push(`- ${issue.severity.toUpperCase()}: ${context ? `${context}: ` : ''}${issue.message}`);
    }
    lines.push('');
  }

  lines.push('## Tag Migrations');
  lines.push('');
  if (report.tags.length === 0) {
    lines.push('No old `Form name` tags were found.');
    lines.push('');
  } else {
    lines.push('| Old tag ID | Old name | New name | Action | Target tag ID | Target name |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const tag of report.tags) {
      lines.push(
        [
          markdownTableCell(tag.oldTag.id),
          markdownTableCell(tag.oldTag.name),
          markdownTableCell(tag.newName),
          markdownTableCell(tag.action),
          markdownTableCell(tag.targetTag?.id ?? ''),
          markdownTableCell(tag.targetTag?.name ?? '')
        ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')
      );
    }
    lines.push('');
  }

  lines.push('## Entity Reference Updates');
  lines.push('');
  if (report.entityReferenceUpdates.length === 0) {
    lines.push('No entry or asset reference updates are needed.');
    lines.push('');
  } else {
    lines.push('| Type | Entity ID | Old tag IDs | New tag IDs | Previous metadata tags | Next metadata tags | Action |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const update of report.entityReferenceUpdates) {
      lines.push(
        [
          markdownTableCell(update.entityType),
          markdownTableCell(update.entityId),
          markdownTableCell(update.oldTagIds.join(', ')),
          markdownTableCell(update.targetTagIds.join(', ')),
          markdownTableCell(update.previousTagIds.join(', ')),
          markdownTableCell(update.nextTagIds.join(', ')),
          markdownTableCell(update.action)
        ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')
      );
    }
    lines.push('');
  }

  if (report.mode === 'dry-run') {
    lines.push('No Contentful writes were made. Re-run with `--yes` after reviewing this report.');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function summarize(
  tags: TagMigrationPlan[],
  entityReferenceUpdates: EntityReferencePlan[],
  issues: PlanIssue[]
): ReportSummary {
  return {
    assetsUpdated: entityReferenceUpdates.filter((plan) => plan.entityType === 'asset' && plan.action === 'updated').length,
    assetsWouldUpdate: entityReferenceUpdates.filter((plan) => plan.entityType === 'asset' && plan.action === 'would-update').length,
    entriesUpdated: entityReferenceUpdates.filter((plan) => plan.entityType === 'entry' && plan.action === 'updated').length,
    entriesWouldUpdate: entityReferenceUpdates.filter((plan) => plan.entityType === 'entry' && plan.action === 'would-update').length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    oldTagsFound: tags.length,
    tagsMergedAndDeleted: tags.filter((tag) => tag.action === 'merged-and-deleted').length,
    tagsRenamed: tags.filter((tag) => tag.action === 'renamed').length,
    tagsWouldMergeAndDelete: tags.filter((tag) => tag.action === 'would-merge-and-delete').length,
    tagsWouldRename: tags.filter((tag) => tag.action === 'would-rename').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length
  };
}

function toNewName(oldName: string): string {
  return `${NEW_PREFIX}${oldName.slice(OLD_PREFIX.length)}`;
}

function getEntityId(entity: any): string | undefined {
  return typeof entity?.sys?.id === 'string' ? entity.sys.id : undefined;
}

function getMetadataTagIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tag) => tag?.sys?.id)
    .filter((tagId): tagId is string => typeof tagId === 'string' && tagId.trim().length > 0);
}

function toTagLink(tagId: string): { sys: { type: 'Link'; linkType: 'Tag'; id: string } } {
  return {
    sys: {
      type: 'Link',
      linkType: 'Tag',
      id: tagId
    }
  };
}

function unique<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const deduped: T[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    deduped.push(value);
  }

  return deduped;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasErrors(issues: PlanIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

function markdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function stringFlag(flags: CliFlags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
