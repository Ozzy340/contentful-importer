import { setTimeout as delay } from 'node:timers/promises';

import contentfulManagement from 'contentful-management';

import { loadProjectConfig, parseCliFlags, requireEnv } from '../lib/config.js';
import {
  assertSafeEnvironment,
  createContentfulContext,
  getAssetIfExists,
  getEntryIfExists
} from '../lib/contentful-client.js';
import type { ContentfulContext } from '../lib/contentful-client.js';
import { slugify, toContentfulResourceId } from '../lib/ids.js';
import { Logger } from '../lib/logger.js';
import { writeJsonArtifact, writeTextArtifact } from '../lib/reporter.js';
import type { CliFlags, LoadedProjectConfig, RuntimeEnv } from '../lib/types.js';

const DEFAULT_TEMPLATE_ENTRY_ID = '4bXLshsUozuOaCY9SvfJnc';
const DEFAULT_TEMPLATE_ENVIRONMENT_ID = 'master';
const DEFAULT_BASE_URL = 'https://api.smartrecruiters.com';
const DEFAULT_COMPANY_ID = 'Quadient1';
const DEFAULT_UAT_PARENT_ENTRY_ID = '2RUCrqd5KHdqR6721zkgD8';
const DEFAULT_MANAGED_ENTRY_PREFIX = 'job--';
const DEFAULT_SLUG_PREFIX = 'careers/jobs';
const DEFAULT_LIMIT = 100;
const RESOURCE_PAGE_CONTENT_TYPE = 'resourcePage';
const MAIN_RICH_TEXT_ENTRY_SUFFIX = 'main-content';
const ADDITIONAL_RICH_TEXT_ENTRY_SUFFIX = 'additional-information';

type EntryAction =
  | 'create'
  | 'update'
  | 'no-change'
  | 'unarchive-and-update'
  | 'archive'
  | 'already-archived';

type TaxonomyAction =
  | 'existing'
  | 'would-create'
  | 'created'
  | 'would-add-to-scheme'
  | 'added-to-scheme';

interface CommandConfig {
  allowNonSandbox: boolean;
  baseUrl: string;
  companyId: string;
  dryRun: boolean;
  environmentId: string;
  limit?: number;
  locale: string;
  managedEntryPrefix: string;
  orgId: string;
  pageLimit: number;
  parentEntryId?: string;
  heroImageEntryId?: string;
  slugPrefix: string;
  smartToken: string;
  templateEntryId: string;
  templateEnvironmentId: string;
}

interface SmartRecruitersJob {
  additionalInformation?: string;
  additionalInformationTitle?: string;
  applyUrl?: string;
  city?: string;
  companyDescription?: string;
  companyDescriptionTitle?: string;
  compensation?: string;
  country?: string;
  fullLocation?: string;
  hybrid: boolean;
  id: string;
  jobCategory?: string;
  jobDescription?: string;
  jobDescriptionTitle?: string;
  locationType: 'In Office' | 'Remote' | 'Hybrid';
  name: string;
  qualifications?: string;
  qualificationsTitle?: string;
  remote: boolean;
  sourceStatus?: string;
  time?: string;
}

interface TemplateGraph {
  assets: TemplateAsset[];
  rootEntryId: string;
  entries: TemplateEntry[];
  orderedSourceIds: string[];
}

interface TemplateEntry {
  contentType: string;
  fields: Record<string, Record<string, unknown>>;
  linkedClonedEntryIds: string[];
  metadata: Record<string, unknown>;
  parentSourceId?: string;
  role: 'root' | 'child';
  sequence: number;
  sourceId: string;
  sourceName?: string;
}

interface TemplateAsset {
  fields: Record<string, Record<string, unknown>>;
  metadata: Record<string, unknown>;
  sourceId: string;
  sourceName?: string;
}

interface DesiredEntry {
  action: EntryAction;
  contentType: string;
  entryId: string;
  fields: Record<string, Record<string, unknown>>;
  metadata: Record<string, unknown>;
  role: 'root' | 'child';
  sourceTemplateId?: string;
  status: string;
}

interface DesiredAsset {
  action: EntryAction;
  assetId: string;
  fields: Record<string, Record<string, unknown>>;
  metadata: Record<string, unknown>;
  sourceTemplateId: string;
  status: string;
}

interface JobPlan {
  action: EntryAction;
  assets: DesiredAsset[];
  data: JobReportData;
  entries: DesiredEntry[];
  entryTitle: string;
  issues: PlanIssue[];
  job: SmartRecruitersJob;
  rootEntryId: string;
  slug: string;
  status: string;
  taxonomies: PlannedJobTaxonomy[];
}

interface PlannedJobTaxonomy {
  conceptId: string;
  label: string;
  schemeId: string;
  schemeLabel: string;
}

interface JobReportData {
  additionalInformation?: string;
  additionalInformationTitle?: string;
  applyUrl?: string;
  city?: string;
  compensation?: string;
  country?: string;
  companyDescriptionTitle?: string;
  fullLocation?: string;
  introduction?: string;
  jobCategory?: string;
  jobDescription?: string;
  jobDescriptionTitle?: string;
  locationType: string;
  qualifications?: string;
  qualificationsTitle?: string;
  roleTitle: string;
  time?: string;
}

interface ArchivePlan {
  action: EntryAction;
  entryIds: string[];
  rootEntryId: string;
  title?: string;
}

interface TaxonomyPlan {
  concepts: TaxonomyConceptPlan[];
  contentType: ContentTypeTaxonomyPlan;
  schemes: TaxonomySchemePlan[];
}

interface TaxonomySchemePlan {
  action: 'existing' | 'would-create' | 'created';
  label: string;
  schemeId: string;
}

interface TaxonomyConceptPlan {
  action: TaxonomyAction;
  conceptId: string;
  label: string;
  schemeId: string;
  schemeLabel: string;
  topConcept: boolean;
}

interface ContentTypeTaxonomyPlan {
  action: 'no-change' | 'would-update' | 'updated';
  contentTypeId: string;
  existingSchemeIds: string[];
  missingSchemeIds: string[];
  requiredSchemeIds: string[];
}

interface PlanIssue {
  code: string;
  message: string;
  severity: 'warning' | 'error';
  jobId?: string;
}

interface JobSyncReport {
  archives: ArchivePlan[];
  generatedAt: string;
  input: {
    companyId: string;
    heroImageEntryId?: string;
    managedEntryPrefix: string;
    parentEntryId?: string;
    slugPrefix: string;
    templateEntryId: string;
    templateEnvironmentId: string;
  };
  issues: PlanIssue[];
  jobs: JobPlan[];
  mode: 'dry-run' | 'upload';
  spaceId?: string;
  environmentId: string;
  summary: JobSyncSummary;
  taxonomy: TaxonomyPlan;
}

interface JobSyncSummary {
  activeJobs: number;
  archivedEntries: number;
  archivePlans: number;
  createdEntries: number;
  entriesToArchive: number;
  entriesToCreate: number;
  entriesToUpdate: number;
  errors: number;
  jobsToCreate: number;
  jobsToUpdate: number;
  noChangeJobs: number;
  taxonomyConceptsToAdd: number;
  taxonomySchemesToCreate: number;
  updatedEntries: number;
  warnings: number;
}

interface TaxonomyCatalog {
  conceptToSchemeIds: Map<string, Set<string>>;
  conceptsById: Map<string, RawTaxonomyConcept>;
  schemesById: Map<string, RawTaxonomyScheme>;
}

interface RawTaxonomyConcept {
  prefLabel?: unknown;
  sys?: {
    id?: string;
    version?: number;
  };
}

interface RawTaxonomyScheme {
  concepts?: RawLink[];
  definition?: unknown;
  prefLabel?: unknown;
  sys?: {
    id?: string;
    version?: number;
  };
  topConcepts?: RawLink[];
}

interface RawLink {
  sys?: {
    id?: string;
    linkType?: string;
    type?: string;
  };
}

interface PostingPage {
  items: unknown[];
  total?: number;
}

const REQUIRED_TAXONOMY_SCHEMES = [
  { id: 'resourceType', label: 'Resource Type' },
  { id: 'country', label: 'Country' },
  { id: 'city', label: 'City' },
  { id: 'jobCategory', label: 'Job Category' },
  { id: 'jobLocationType', label: 'Job Location Type' }
];

const PAGE_REFERENCE_CONTENT_TYPES = new Set([
  'contentPage',
  'homePage',
  'listingPage',
  'notFoundPage',
  'resourcePage',
  'searchPage'
]);

const PRESERVED_ENTRY_CONTENT_TYPES = new Set([
  ...PAGE_REFERENCE_CONTENT_TYPES
]);

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const logger = new Logger(Boolean(flags.verbose), 'sync-jobs');
  const projectConfig = await loadProjectConfig();
  const commandConfig = resolveCommandConfig(flags, projectConfig.env, projectConfig.conventions.defaults.locale);

  logger.info(commandConfig.dryRun ? 'Preparing SmartRecruiters job dry run' : 'Preparing SmartRecruiters job upload', {
    companyId: commandConfig.companyId,
    environmentId: commandConfig.environmentId,
    templateEntryId: commandConfig.templateEntryId,
    templateEnvironmentId: commandConfig.templateEnvironmentId
  });

  const [targetContext, templateContext] = await Promise.all([
    createContentfulContext({
      ...projectConfig.env,
      CONTENTFUL_ENVIRONMENT_ID: commandConfig.environmentId
    }),
    createContentfulContext({
      ...projectConfig.env,
      CONTENTFUL_ENVIRONMENT_ID: commandConfig.templateEnvironmentId
    })
  ]);

  if (!commandConfig.dryRun) {
    assertSafeEnvironment(
      targetContext.environmentId,
      projectConfig.conventions,
      commandConfig.allowNonSandbox
    );
  }

  logger.info('Fetching SmartRecruiters postings');
  const jobs = await fetchSmartRecruitersJobs(commandConfig);
  logger.info('Fetched active SmartRecruiters jobs', { activeJobs: jobs.length });

  logger.info('Collecting Contentful job template graph');
  const templateGraph = await collectTemplateGraph(templateContext, commandConfig.templateEntryId);
  logger.info('Collected template graph', {
    assets: templateGraph.assets.length,
    entries: templateGraph.entries.length,
    rootEntryId: templateGraph.rootEntryId
  });

  const taxonomyClient = createTaxonomyClient(projectConfig.env);
  const taxonomyPlan = await buildTaxonomyPlan(taxonomyClient, targetContext, jobs, commandConfig);
  const jobPlans = await buildJobPlans(targetContext, templateGraph, jobs, taxonomyPlan, commandConfig);
  const archivePlans = await buildArchivePlans(targetContext, new Set(jobPlans.map((plan) => plan.rootEntryId)), commandConfig);
  const issues = [
    ...await inspectConfiguredTargetLinks(targetContext, commandConfig),
    ...jobPlans.flatMap((plan) => plan.issues)
  ];

  if (!commandConfig.dryRun && !hasErrors(issues)) {
    logger.info('Applying taxonomy changes', {
      schemesToCreate: taxonomyPlan.schemes.filter((scheme) => scheme.action === 'would-create').length,
      conceptsToAdd: taxonomyPlan.concepts.filter((concept) => concept.action !== 'existing').length
    });
    await applyTaxonomyPlan(taxonomyClient, targetContext, taxonomyPlan, commandConfig);

    logger.info('Upserting and publishing active job entries', {
      jobs: jobPlans.length,
      entries: jobPlans.flatMap((plan) => plan.entries).length
    });
    await applyJobPlans(targetContext, jobPlans, logger);

    logger.info('Archiving jobs missing from SmartRecruiters', {
      archivePlans: archivePlans.length,
      entries: archivePlans.reduce((sum, plan) => sum + plan.entryIds.length, 0)
    });
    await applyArchivePlans(targetContext, archivePlans);
  }

  const report = buildReport(projectConfig, commandConfig, taxonomyPlan, jobPlans, archivePlans, issues);
  const reportPaths = await writeReports(projectConfig, commandConfig, report);

  for (const issue of issues.filter((item) => item.severity === 'warning')) {
    logger.warn(issue.message, { code: issue.code, jobId: issue.jobId });
  }

  if (hasErrors(issues)) {
    logger.error('Job sync finished with blocking errors', {
      errors: report.summary.errors,
      report: reportPaths.markdownPath
    });
    process.exitCode = 1;
    return;
  }

  logger.info(commandConfig.dryRun ? 'SmartRecruiters job dry run finished' : 'SmartRecruiters job upload finished', {
    report: reportPaths.markdownPath,
    ...report.summary
  });
}

function resolveCommandConfig(flags: CliFlags, env: RuntimeEnv, defaultLocale: string): CommandConfig {
  requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN', 'CONTENTFUL_SPACE_ID', 'CONTENTFUL_ORG_ID']);

  const environmentId = stringFlag(flags, 'env')
    ?? stringFlag(flags, 'environment')
    ?? env.SMARTRECRUITERS_TARGET_ENVIRONMENT_ID
    ?? env.CONTENTFUL_ENVIRONMENT_ID;
  const companyId = stringFlag(flags, 'company-id')
    ?? env.SMARTRECRUITERS_COMPANY_ID
    ?? DEFAULT_COMPANY_ID;
  const smartToken = stringFlag(flags, 'smart-token')
    ?? stringFlag(flags, 'token')
    ?? env.SMARTRECRUITERS_TOKEN;

  const missing = [
    ['Contentful environment', environmentId],
    ['SmartRecruiters company ID', companyId],
    ['SmartRecruiters token', smartToken]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing job sync configuration: ${missing.map(([label]) => label).join(', ')}.`
    );
  }

  const resolvedEnvironmentId = environmentId!;

  return {
    allowNonSandbox: Boolean(flags['allow-non-sandbox']),
    baseUrl: trimTrailingSlash(stringFlag(flags, 'base-url') ?? env.SMARTRECRUITERS_BASE_URL ?? DEFAULT_BASE_URL),
    companyId: companyId!,
    dryRun: !flags.yes,
    environmentId: resolvedEnvironmentId,
    heroImageEntryId: resolveEnvironmentSetting({
      env,
      environmentId: resolvedEnvironmentId,
      flagValue: stringFlag(flags, 'hero-image-entry-id') ?? stringFlag(flags, 'image-entry-id'),
      genericEnvKey: 'SMARTRECRUITERS_HERO_IMAGE_ENTRY_ID',
      uatEnvKey: 'SMARTRECRUITERS_UAT_IMAGE_ENTRY_ID',
      masterEnvKey: 'SMARTRECRUITERS_MASTER_IMAGE_ENTRY_ID'
    }),
    limit: numberFlag(flags, 'limit'),
    locale: stringFlag(flags, 'locale') ?? defaultLocale,
    managedEntryPrefix: stringFlag(flags, 'managed-entry-prefix')
      ?? env.SMARTRECRUITERS_MANAGED_ENTRY_PREFIX
      ?? DEFAULT_MANAGED_ENTRY_PREFIX,
    orgId: env.CONTENTFUL_ORG_ID!,
    pageLimit: numberFlag(flags, 'page-limit') ?? DEFAULT_LIMIT,
    parentEntryId: resolveEnvironmentSetting({
      env,
      environmentId: resolvedEnvironmentId,
      flagValue: stringFlag(flags, 'parent-entry-id'),
      genericEnvKey: 'SMARTRECRUITERS_PARENT_ENTRY_ID',
      uatEnvKey: 'SMARTRECRUITERS_UAT_PARENT_ENTRY_ID',
      masterEnvKey: 'SMARTRECRUITERS_MASTER_PARENT_ENTRY_ID',
      uatDefault: DEFAULT_UAT_PARENT_ENTRY_ID
    }),
    slugPrefix: trimSlashes(stringFlag(flags, 'slug-prefix') ?? env.SMARTRECRUITERS_JOB_SLUG_PREFIX ?? DEFAULT_SLUG_PREFIX),
    smartToken: smartToken!,
    templateEntryId: stringFlag(flags, 'template-entry-id')
      ?? env.SMARTRECRUITERS_TEMPLATE_ENTRY_ID
      ?? DEFAULT_TEMPLATE_ENTRY_ID,
    templateEnvironmentId: stringFlag(flags, 'template-env')
      ?? env.SMARTRECRUITERS_TEMPLATE_ENVIRONMENT_ID
      ?? DEFAULT_TEMPLATE_ENVIRONMENT_ID
  };
}

async function fetchSmartRecruitersJobs(config: CommandConfig): Promise<SmartRecruitersJob[]> {
  const summaries: unknown[] = [];
  let offset = 0;
  let total: number | undefined;

  do {
    const url = new URL(`${config.baseUrl}/v1/companies/${encodeURIComponent(config.companyId)}/postings`);
    url.searchParams.set('limit', String(config.pageLimit));
    url.searchParams.set('offset', String(offset));

    const page = parsePostingPage(await fetchSmartRecruitersJson(url, config.smartToken));
    summaries.push(...page.items);
    total = page.total;
    offset += config.pageLimit;

    if (config.limit && summaries.length >= config.limit) {
      summaries.splice(config.limit);
      break;
    }
  } while (total === undefined ? summaries.length > 0 && summaries.length === offset : offset < total);

  const activeSummaries = summaries.filter(isActivePostingSummary);
  const jobs: SmartRecruitersJob[] = [];

  for (const summary of activeSummaries) {
    const postingId = getPostingId(summary);
    if (!postingId) {
      continue;
    }

    const detailUrl = new URL(
      `${config.baseUrl}/v1/companies/${encodeURIComponent(config.companyId)}/postings/${encodeURIComponent(postingId)}`
    );
    const detail = await fetchSmartRecruitersJson(detailUrl, config.smartToken);
    const job = normalizeSmartRecruitersJob(detail, summary);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

async function fetchSmartRecruitersJson(url: URL, smartToken: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-SmartToken': smartToken
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SmartRecruiters request failed ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  return response.json();
}

function parsePostingPage(value: unknown): PostingPage {
  const record = asRecord(value);
  const items = firstArray(
    record?.content,
    record?.items,
    record?.postings,
    record?.results,
    record?.data
  );

  return {
    items: items ?? [],
    total: firstNumber(record?.totalFound, record?.total, record?.count)
  };
}

function isActivePostingSummary(value: unknown): boolean {
  const status = pickString(
    getPath(value, 'status'),
    getPath(value, 'postingStatus'),
    getPath(value, 'visibility'),
    getPath(value, 'state')
  );

  if (!status) {
    return true;
  }

  return !['archived', 'closed', 'deleted', 'filled', 'inactive', 'unpublished'].includes(
    status.trim().toLowerCase()
  );
}

function getPostingId(value: unknown): string | undefined {
  return pickString(
    getPath(value, 'id'),
    getPath(value, 'postingId'),
    getPath(value, 'uuid')
  );
}

function normalizeSmartRecruitersJob(detail: unknown, summary: unknown): SmartRecruitersJob | undefined {
  const id = pickString(getPath(detail, 'id'), getPath(detail, 'postingId'), getPath(summary, 'id'), getPath(summary, 'postingId'));
  const name = pickString(
    getPath(detail, 'name'),
    getPath(detail, 'title'),
    getPath(detail, 'jobAd.title'),
    getPath(summary, 'name'),
    getPath(summary, 'title')
  );

  if (!id || !name) {
    return undefined;
  }

  const customFields = firstArray(
    getPath(detail, 'customFields'),
    getPath(detail, 'customField'),
    getPath(detail, 'custom_fields')
  ) ?? [];
  const location = asRecord(getPath(detail, 'location')) ?? {};
  const remote = firstBoolean(
    getPath(detail, 'remote'),
    location.remote,
    customFieldBoolean(customFields, ['REMOTE', 'Remote'])
  ) ?? false;
  const hybrid = firstBoolean(
    getPath(detail, 'hybrid'),
    location.hybrid,
    customFieldBoolean(customFields, ['HYBRID', 'Hybrid'])
  ) ?? false;
  const locationType = hybrid ? 'Hybrid' : remote ? 'Remote' : 'In Office';
  const city = pickString(location.city, getPath(detail, 'city'), getPath(summary, 'location.city'));
  const country = customFieldValue(customFields, ['COUNTRY', 'Country'])
    ?? pickString(location.country, location.countryName, getPath(detail, 'country'));
  const fullLocation = normalizeLocationText(pickString(
    location.fullLocation,
    location.location,
    getPath(detail, 'fullLocation')
  )) ?? joinPresent([city, pickString(location.region, location.regionName), country], ', ');
  const jobCategory = customFieldValue(customFields, ['JOB_FAMILY_GROUP', 'Job Family Group', 'jobFamilyGroup'])
    ?? pickString(getPath(detail, 'jobFamilyGroup.label'), getPath(detail, 'jobFamilyGroup'), getPath(detail, 'function.label'));

  const sections = asRecord(getPath(detail, 'jobAd.sections')) ?? asRecord(getPath(detail, 'sections')) ?? {};
  const companyDescription = sectionData(sections, ['companyDescription', 'company_description', 'Company Description']);
  const jobDescription = sectionData(sections, ['jobDescription', 'job_description', 'Job Description']);
  const qualifications = sectionData(sections, ['qualifications', 'Qualifications']);
  const additionalInformation = sectionData(sections, ['additionalInformation', 'additional_information', 'Additional Information']);

  return {
    additionalInformation: additionalInformation.text,
    additionalInformationTitle: additionalInformation.title ?? 'Additional Information',
    applyUrl: pickString(
      getPath(detail, 'applyUrl'),
      getPath(detail, 'applyURL'),
      getPath(detail, 'actions.apply.url'),
      getPath(detail, 'postingUrl'),
      getPath(summary, 'applyUrl'),
      getPath(summary, 'postingUrl')
    ),
    city,
    companyDescription: companyDescription.text,
    companyDescriptionTitle: companyDescription.title ?? 'Company Description',
    compensation: formatCompensation(detail),
    country,
    fullLocation,
    hybrid,
    id,
    jobCategory,
    jobDescription: jobDescription.text,
    jobDescriptionTitle: jobDescription.title ?? 'Job Description',
    locationType,
    name,
    qualifications: qualifications.text,
    qualificationsTitle: qualifications.title ?? 'Qualifications',
    remote,
    sourceStatus: pickString(getPath(detail, 'status'), getPath(summary, 'status')),
    time: normalizeJobTime(
      pickString(
        getPath(detail, 'typeOfEmployment.label'),
        getPath(detail, 'employmentType.label'),
        getPath(detail, 'contractType.label'),
        customFieldValue(customFields, ['EMPLOYMENT_TYPE', 'Employment Type', 'Job Time'])
      )
    )
  };
}

function sectionData(sections: Record<string, unknown>, keys: string[]): { text?: string; title?: string } {
  for (const key of keys) {
    const direct = sections[key];
    const directRecord = asRecord(direct);
    const text = pickString(getPath(direct, 'text'), getPath(direct, 'content'), direct);
    if (text) {
      return {
        text,
        title: pickString(directRecord?.title, directRecord?.label, key)
      };
    }
  }

  const normalizedKeys = new Set(keys.map(normalizeToken));
  for (const [key, value] of Object.entries(sections)) {
    const record = asRecord(value);
    const title = pickString(record?.title, record?.label, key);
    if (!title || !normalizedKeys.has(normalizeToken(title))) {
      continue;
    }
    const text = pickString(record?.text, record?.content);
    if (text) {
      return {
        text,
        title
      };
    }
  }

  return {};
}

function customFieldValue(customFields: unknown[], names: string[]): string | undefined {
  const candidates = new Set(names.map(normalizeToken));

  for (const field of customFields) {
    const label = pickString(
      getPath(field, 'fieldId'),
      getPath(field, 'id'),
      getPath(field, 'name'),
      getPath(field, 'fieldLabel'),
      getPath(field, 'label')
    );

    if (!label || !candidates.has(normalizeToken(label))) {
      continue;
    }

    const value = pickString(
      getPath(field, 'valueLabel'),
      getPath(field, 'value'),
      getPath(field, 'label'),
      getPath(field, 'name')
    );
    if (value) {
      return value;
    }
  }

  return undefined;
}

function customFieldBoolean(customFields: unknown[], names: string[]): boolean | undefined {
  const value = customFieldValue(customFields, names);
  if (!value) {
    return undefined;
  }
  return parseBoolean(value);
}

function normalizeJobTime(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized === 'full time' || normalized === 'fulltime') {
    return 'Full Time';
  }
  if (normalized === 'part time' || normalized === 'parttime') {
    return 'Part Time';
  }

  return value.trim();
}

function formatCompensation(detail: unknown): string | undefined {
  const compensation = asRecord(getPath(detail, 'compensation'))
    ?? asRecord(getPath(detail, 'salary'))
    ?? asRecord(getPath(detail, 'payRange'));
  if (!compensation) {
    return undefined;
  }

  const currency = pickString(compensation.currency, compensation.currencyCode, compensation.currencyLabel);
  const min = pickCompensationAmount(compensation.min, compensation.minimum, compensation.from, compensation.salaryMin, compensation.minValue);
  const max = pickCompensationAmount(compensation.max, compensation.maximum, compensation.to, compensation.salaryMax, compensation.maxValue);

  if (!min && !max) {
    return undefined;
  }

  const range = min && max && min !== max ? `${min} - ${max}` : min ?? max ?? '';
  return joinPresent(['Compensation:', currency, range], ' ');
}

function pickCompensationAmount(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = normalizeCompensationAmount(value);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function normalizeCompensationAmount(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0 ? String(value) : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const numericText = trimmed.replace(/[^0-9.-]+/g, '');
  const numeric = numericText ? Number(numericText) : undefined;
  if (Number.isFinite(numeric) && numeric === 0) {
    return undefined;
  }

  return trimmed;
}

async function collectTemplateGraph(context: ContentfulContext, rootEntryId: string): Promise<TemplateGraph> {
  const root = await getEntryIfExists(context, rootEntryId);
  if (!root) {
    throw new Error(`Template entry ${rootEntryId} was not found in ${context.environmentId}.`);
  }

  const entries = new Map<string, TemplateEntry>();
  const assets = new Map<string, TemplateAsset>();
  const queued = [{ sourceId: rootEntryId, sequence: 1 }] as Array<{ sourceId: string; parentSourceId?: string; sequence: number }>;
  const queuedIds = new Set([rootEntryId]);
  let sequence = 1;

  while (queued.length > 0) {
    const item = queued.shift();
    if (!item || entries.has(item.sourceId)) {
      continue;
    }

    const entry = await getEntryIfExists(context, item.sourceId);
    if (!entry) {
      continue;
    }

    const contentType = getEntryContentType(entry);
    const references = collectEntryLinkIds(entry.fields ?? {});
    const assetReferenceIds = collectAssetLinkIds(entry.fields ?? {});
    const linkedClonedEntryIds: string[] = [];

    for (const linkedEntryId of references) {
      const linkedEntry = await getEntryIfExists(context, linkedEntryId);
      if (!linkedEntry) {
        continue;
      }

      const linkedContentType = getEntryContentType(linkedEntry);
      if (PRESERVED_ENTRY_CONTENT_TYPES.has(linkedContentType)) {
        continue;
      }

      linkedClonedEntryIds.push(linkedEntryId);
      if (!queuedIds.has(linkedEntryId)) {
        sequence += 1;
        queuedIds.add(linkedEntryId);
        queued.push({
          sourceId: linkedEntryId,
          parentSourceId: item.sourceId,
          sequence
        });
      }
    }

    for (const assetId of assetReferenceIds) {
      if (assets.has(assetId)) {
        continue;
      }

      const asset = await getAssetIfExists(context, assetId);
      if (!asset) {
        continue;
      }

      assets.set(assetId, {
        fields: cloneJson(asset.fields ?? {}),
        metadata: cloneJson(asset.metadata ?? {}),
        sourceId: assetId,
        sourceName: extractAssetName(asset.fields ?? {})
      });
    }

    entries.set(item.sourceId, {
      contentType,
      fields: cloneJson(entry.fields ?? {}),
      linkedClonedEntryIds,
      metadata: cloneJson(entry.metadata ?? {}),
      parentSourceId: item.parentSourceId,
      role: item.sourceId === rootEntryId ? 'root' : 'child',
      sequence: item.sequence,
      sourceId: item.sourceId,
      sourceName: extractEntryName(entry.fields ?? {})
    });
  }

  const orderedSourceIds = orderTemplateEntries(entries);
  return {
    assets: [...assets.values()],
    rootEntryId,
    entries: [...entries.values()],
    orderedSourceIds
  };
}

function orderTemplateEntries(entries: Map<string, TemplateEntry>): string[] {
  const ordered: string[] = [];
  const completed = new Set<string>();
  const pending = new Map(entries);

  while (pending.size > 0) {
    const ready = [...pending.values()].filter((entry) =>
      entry.linkedClonedEntryIds.every((linkedId) => completed.has(linkedId) || !pending.has(linkedId))
    );

    if (ready.length === 0) {
      return [...entries.values()].sort((left, right) => left.sequence - right.sequence).map((entry) => entry.sourceId);
    }

    for (const entry of ready.sort((left, right) => {
      if (left.role !== right.role) {
        return left.role === 'child' ? -1 : 1;
      }
      return left.sequence - right.sequence;
    })) {
      ordered.push(entry.sourceId);
      completed.add(entry.sourceId);
      pending.delete(entry.sourceId);
    }
  }

  return ordered;
}

async function buildTaxonomyPlan(
  taxonomyClient: any,
  context: ContentfulContext,
  jobs: SmartRecruitersJob[],
  config: CommandConfig
): Promise<TaxonomyPlan> {
  const catalog = await fetchTaxonomyCatalog(taxonomyClient, config.orgId);
  const schemes = REQUIRED_TAXONOMY_SCHEMES.map((scheme) => ({
    action: catalog.schemesById.has(scheme.id) ? 'existing' as const : 'would-create' as const,
    label: scheme.label,
    schemeId: scheme.id
  }));

  const requiredConcepts = collectRequiredConcepts(jobs);
  const concepts = requiredConcepts.map((required) =>
    planConcept(required, catalog)
  );
  const contentType = await planContentTypeTaxonomy(context, REQUIRED_TAXONOMY_SCHEMES.map((scheme) => scheme.id));

  return {
    concepts,
    contentType,
    schemes
  };
}

function collectRequiredConcepts(jobs: SmartRecruitersJob[]): Array<{
  conceptId: string;
  label: string;
  schemeId: string;
  schemeLabel: string;
}> {
  const concepts = new Map<string, {
    conceptId: string;
    label: string;
    schemeId: string;
    schemeLabel: string;
  }>();

  add('resourceType', 'Resource Type', 'job', 'Job');
  for (const type of ['In Office', 'Remote', 'Hybrid']) {
    add('jobLocationType', 'Job Location Type', locationTypeConceptId(type), type);
  }

  for (const job of jobs) {
    if (job.country) {
      add('country', 'Country', taxonomyConceptId('country', job.country), job.country);
    }
    if (job.city) {
      add('city', 'City', taxonomyConceptId('city', job.city), job.city);
    }
    if (job.jobCategory) {
      add('jobCategory', 'Job Category', taxonomyConceptId('jobCategory', job.jobCategory), job.jobCategory);
    }
  }

  return [...concepts.values()].sort((left, right) =>
    left.schemeLabel.localeCompare(right.schemeLabel) || left.label.localeCompare(right.label)
  );

  function add(schemeId: string, schemeLabel: string, conceptId: string, label: string): void {
    concepts.set(`${schemeId}:${label.toLowerCase()}`, {
      conceptId,
      label,
      schemeId,
      schemeLabel
    });
  }
}

function planConcept(
  required: { conceptId: string; label: string; schemeId: string; schemeLabel: string },
  catalog: TaxonomyCatalog
): TaxonomyConceptPlan {
  const existingInScheme = findConceptInSchemeByLabel(catalog, required.schemeId, required.label);
  if (existingInScheme) {
    return {
      action: 'existing',
      conceptId: existingInScheme,
      label: required.label,
      schemeId: required.schemeId,
      schemeLabel: required.schemeLabel,
      topConcept: true
    };
  }

  const existingById = catalog.conceptsById.get(required.conceptId);
  if (existingById && normalizeToken(pickLocalizedString(existingById.prefLabel) ?? '') === normalizeToken(required.label)) {
    return {
      action: 'would-add-to-scheme',
      conceptId: required.conceptId,
      label: required.label,
      schemeId: required.schemeId,
      schemeLabel: required.schemeLabel,
      topConcept: true
    };
  }

  return {
    action: 'would-create',
    conceptId: existingById ? toContentfulResourceId(`${required.conceptId}-${hashLabel(required.label)}`) : required.conceptId,
    label: required.label,
    schemeId: required.schemeId,
    schemeLabel: required.schemeLabel,
    topConcept: true
  };
}

async function planContentTypeTaxonomy(
  context: ContentfulContext,
  requiredSchemeIds: string[]
): Promise<ContentTypeTaxonomyPlan> {
  const contentType = await context.environment.getContentType(RESOURCE_PAGE_CONTENT_TYPE);
  const existingSchemeIds = getContentTypeTaxonomySchemeIds(contentType);
  const missingSchemeIds = requiredSchemeIds.filter((schemeId) => !existingSchemeIds.includes(schemeId));

  return {
    action: missingSchemeIds.length > 0 ? 'would-update' : 'no-change',
    contentTypeId: RESOURCE_PAGE_CONTENT_TYPE,
    existingSchemeIds,
    missingSchemeIds,
    requiredSchemeIds
  };
}

async function fetchTaxonomyCatalog(taxonomyClient: any, organizationId: string): Promise<TaxonomyCatalog> {
  const [schemes, concepts] = await Promise.all([
    fetchCursorCollection<RawTaxonomyScheme>((query) =>
      taxonomyClient.conceptScheme.getMany({ organizationId, query })
    ),
    fetchCursorCollection<RawTaxonomyConcept>((query) =>
      taxonomyClient.concept.getMany({ organizationId, query })
    )
  ]);

  const schemesById = new Map<string, RawTaxonomyScheme>();
  const conceptsById = new Map<string, RawTaxonomyConcept>();
  const conceptToSchemeIds = new Map<string, Set<string>>();

  for (const scheme of schemes) {
    const schemeId = scheme.sys?.id;
    if (!schemeId) {
      continue;
    }
    schemesById.set(schemeId, scheme);
    for (const conceptId of extractLinkIds(scheme.concepts)) {
      if (!conceptToSchemeIds.has(conceptId)) {
        conceptToSchemeIds.set(conceptId, new Set());
      }
      conceptToSchemeIds.get(conceptId)!.add(schemeId);
    }
  }

  for (const concept of concepts) {
    const conceptId = concept.sys?.id;
    if (conceptId) {
      conceptsById.set(conceptId, concept);
    }
  }

  return {
    conceptToSchemeIds,
    conceptsById,
    schemesById
  };
}

async function fetchCursorCollection<T>(
  fetchPage: (query: { limit: number } | { pageUrl: string }) => Promise<{ items?: T[]; pages?: { next?: string } }>
): Promise<T[]> {
  const items: T[] = [];
  let page = await fetchPage({ limit: 100 });
  items.push(...(page.items ?? []));

  while (page.pages?.next) {
    page = await fetchPage({ pageUrl: page.pages.next });
    items.push(...(page.items ?? []));
  }

  return items;
}

async function buildJobPlans(
  context: ContentfulContext,
  templateGraph: TemplateGraph,
  jobs: SmartRecruitersJob[],
  taxonomyPlan: TaxonomyPlan,
  config: CommandConfig
): Promise<JobPlan[]> {
  const plans: JobPlan[] = [];
  const conceptBySchemeAndLabel = new Map(
    taxonomyPlan.concepts.map((concept) => [`${concept.schemeId}:${normalizeToken(concept.label)}`, concept])
  );

  for (const job of jobs) {
    const plan = buildDesiredJobPlan(templateGraph, job, conceptBySchemeAndLabel, config);
    await inspectDesiredAssets(context, plan);
    await inspectDesiredEntries(context, plan);
    plans.push(plan);
  }

  return plans;
}

function buildDesiredJobPlan(
  templateGraph: TemplateGraph,
  job: SmartRecruitersJob,
  conceptBySchemeAndLabel: Map<string, TaxonomyConceptPlan>,
  config: CommandConfig
): JobPlan {
  const rootEntryId = toContentfulResourceId(`${config.managedEntryPrefix}${job.id}`);
  const slug = buildJobSlug(job, config);
  const entryTitle = `Job - ${job.id} - ${job.name}`;
  const sourceToTargetId = buildSourceToTargetIdMap(templateGraph, rootEntryId, config.heroImageEntryId);
  const sourceToTargetAssetId = config.heroImageEntryId
    ? new Map<string, string>()
    : buildSourceToTargetAssetIdMap(templateGraph);
  const richTextAssignments = pickRichTextAssignments(templateGraph);
  const applyCtaSourceIds = pickApplyCtaSourceIds(templateGraph);
  const replacements = buildJobReplacements(job, slug);
  const assets = config.heroImageEntryId ? [] : templateGraph.assets.map((asset) => ({
    action: 'create' as const,
    assetId: sourceToTargetAssetId.get(asset.sourceId) ?? toContentfulResourceId(`job-template-asset--${asset.sourceId}`),
    fields: normalizeAssetFieldsToLocale(asset.fields, config.locale),
    metadata: cloneJson(asset.metadata ?? {}),
    sourceTemplateId: asset.sourceId,
    status: 'planned'
  }));
  const entriesById = new Map<string, DesiredEntry>();
  const issues: PlanIssue[] = [];

  for (const sourceId of templateGraph.orderedSourceIds) {
    const templateEntry = templateGraph.entries.find((entry) => entry.sourceId === sourceId);
    if (!templateEntry) {
      continue;
    }

    if (config.heroImageEntryId && templateEntry.contentType === 'imageWithFocalPoint') {
      continue;
    }

    const entryId = sourceToTargetId.get(templateEntry.sourceId);
    if (!entryId) {
      continue;
    }

    if (templateEntry.contentType === 'richTextBlock' && shouldSkipRichTextBlock(templateEntry, job, config.locale)) {
      continue;
    }

    const fields = normalizeFieldsToLocale(
      replacePlaceholdersDeep(
        rewriteLinks(templateEntry.fields, sourceToTargetId, sourceToTargetAssetId),
        replacements
      ) as Record<string, Record<string, unknown>>,
      config.locale
    );
    const metadata = cloneJson(templateEntry.metadata ?? {});

    applyEntryDisplayName(fields, templateEntry.contentType, entryTitle, config.locale);

    if (templateEntry.contentType === RESOURCE_PAGE_CONTENT_TYPE) {
      applyResourcePageFields(fields, metadata, job, slug, entryTitle, conceptBySchemeAndLabel, config, issues);
    }

    if (templateEntry.contentType === 'richTextBlock') {
      applyRichTextBlockFields(fields, templateEntry.fields, job, config.locale);
    }

    if (templateEntry.contentType === 'ctaItem' && applyCtaSourceIds.has(templateEntry.sourceId)) {
      applyCtaFields(fields, job, config.locale);
    }

    if (templateEntry.contentType === 'heroBlock') {
      applyHeroFields(fields, job, config);
    }

    entriesById.set(entryId, {
      action: 'create',
      contentType: templateEntry.contentType,
      entryId,
      fields,
      metadata,
      role: templateEntry.role,
      sourceTemplateId: templateEntry.sourceId,
      status: 'planned'
    });
  }

  ensureJobContentBlocks(entriesById, rootEntryId, job, entryTitle, richTextAssignments, config);

  const entries = orderDesiredEntries([...entriesById.values()]);
  const taxonomies = jobTaxonomies(job, conceptBySchemeAndLabel);
  const data = toJobReportData(job);

  return {
    action: 'create',
    assets,
    data,
    entries,
    entryTitle,
    issues,
    job,
    rootEntryId,
    slug,
    status: 'planned',
    taxonomies
  };
}

function applyResourcePageFields(
  fields: Record<string, Record<string, unknown>>,
  metadata: Record<string, unknown>,
  job: SmartRecruitersJob,
  slug: string,
  entryTitle: string,
  conceptBySchemeAndLabel: Map<string, TaxonomyConceptPlan>,
  config: CommandConfig,
  issues: PlanIssue[]
): void {
  setField(fields, 'internalName', config.locale, entryTitle);
  setFieldIfMissing(fields, 'heading', config.locale, job.name);
  setField(fields, 'slug', config.locale, slug);
  if (config.parentEntryId) {
    setField(fields, 'parent', config.locale, entryLink(config.parentEntryId));
  } else {
    issues.push({
      code: 'JOB_PARENT_MISSING',
      jobId: job.id,
      message: `Job ${job.id} cannot be published because no page parent is configured for environment ${config.environmentId}.`,
      severity: 'error'
    });
  }
  setFieldIfMissing(fields, 'secondaryHeading', config.locale, 'Connect with Quadient');
  setField(fields, 'introduction', config.locale, richTextDocument(htmlToRichTextBlocks(job.companyDescription)));
  setField(fields, 'resourceSummary', config.locale, buildResourceSummary(job));
  setField(fields, 'teaserTitle', config.locale, job.name);
  setField(fields, 'metaTitle', config.locale, `${job.name} | Careers at Quadient`);
  setField(fields, 'metaDescription', config.locale, truncateText(plainTextFromHtml(job.companyDescription ?? job.jobDescription ?? ''), 300));
  setField(fields, 'excludeFromSearch', config.locale, false);

  const concepts = jobTaxonomies(job, conceptBySchemeAndLabel);
  metadata.concepts = concepts.map((concept) => taxonomyConceptLink(concept.conceptId));

  for (const scheme of REQUIRED_TAXONOMY_SCHEMES) {
    if (scheme.id === 'city' && !job.city) {
      continue;
    }
    if (scheme.id === 'country' && !job.country) {
      continue;
    }
    if (scheme.id === 'jobCategory' && !job.jobCategory) {
      continue;
    }
    if (!concepts.some((concept) => concept.schemeId === scheme.id)) {
      issues.push({
        code: 'JOB_TAXONOMY_MISSING',
        jobId: job.id,
        message: `Job ${job.id} is missing taxonomy for ${scheme.label}.`,
        severity: 'warning'
      });
    }
  }
}

function applyCtaFields(fields: Record<string, Record<string, unknown>>, job: SmartRecruitersJob, locale: string): void {
  if (job.applyUrl) {
    setField(fields, 'useExternalLink', locale, true);
    setField(fields, 'externalUrl', locale, job.applyUrl);
    setField(fields, 'openUrlInNewTab', locale, true);
  }
  setField(fields, 'linkText', locale, 'Apply now');
  setField(fields, 'customiseStyle', locale, true);
}

function applyHeroFields(fields: Record<string, Record<string, unknown>>, job: SmartRecruitersJob, config: CommandConfig): void {
  const locale = config.locale;
  if (!job.compensation) {
    deleteField(fields, 'lowerSubtext', locale);
  }
  if (config.heroImageEntryId) {
    setField(fields, 'media', locale, entryLink(config.heroImageEntryId));
    setField(fields, 'mobileMedia', locale, entryLink(config.heroImageEntryId));
  }
}

function shouldSkipRichTextBlock(templateEntry: TemplateEntry, job: SmartRecruitersJob, locale: string): boolean {
  const section = requiredSectionForRichTextBlock(templateEntry.fields, locale);
  if (!section) {
    return false;
  }

  return !plainTextFromHtml(job[section] ?? '').trim();
}

function requiredSectionForRichTextBlock(
  fields: Record<string, Record<string, unknown>>,
  locale: string
): 'additionalInformation' | 'jobDescription' | 'qualifications' | undefined {
  const content = getLocalizedValue(fields.content, locale);
  const markers = collectRichTextPlaceholders(content).map(normalizeToken);

  if (markers.some((marker) => ['additionalinformation', 'additionalinformationtext'].includes(marker))) {
    return 'additionalInformation';
  }
  if (markers.some((marker) => ['jobdescription', 'jobdescriptiontext'].includes(marker))) {
    return 'jobDescription';
  }
  if (markers.some((marker) => ['qualifications', 'qualificationstext'].includes(marker))) {
    return 'qualifications';
  }

  return undefined;
}

function collectRichTextPlaceholders(value: unknown): string[] {
  const markers = new Set<string>();
  visit(value);
  return [...markers];

  function visit(candidate: unknown): void {
    if (typeof candidate === 'string') {
      for (const match of candidate.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
        if (match[1]) {
          markers.add(match[1].trim());
        }
      }
      return;
    }

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        visit(item);
      }
      return;
    }

    if (!candidate || typeof candidate !== 'object') {
      return;
    }

    for (const nested of Object.values(candidate as Record<string, unknown>)) {
      visit(nested);
    }
  }
}

function applyRichTextBlockFields(
  fields: Record<string, Record<string, unknown>>,
  templateFields: Record<string, Record<string, unknown>>,
  job: SmartRecruitersJob,
  locale: string
): void {
  const templateContent = getLocalizedValue(templateFields.content, locale);
  if (!isRichTextDocument(templateContent)) {
    return;
  }

  const replacements = buildRichTextPlaceholderReplacements(job);

  setField(fields, 'content', locale, replaceRichTextPlaceholderBlocks(templateContent, replacements));
}

interface RichTextPlaceholderReplacement {
  blocks?: Array<Record<string, unknown>>;
  text?: string;
}

function buildRichTextPlaceholderReplacements(job: SmartRecruitersJob): Map<string, RichTextPlaceholderReplacement> {
  const replacements = new Map<string, RichTextPlaceholderReplacement>();

  addText('Additional Information - Title', job.additionalInformationTitle ?? 'Additional Information');
  addText('Additional Information - title', job.additionalInformationTitle ?? 'Additional Information');
  addBlocks('Additional Information - Text', htmlToRichTextBlocks(job.additionalInformation));
  addBlocks('Additional Information', htmlToRichTextBlocks(job.additionalInformation));

  addText('Job Description - Title', job.jobDescriptionTitle ?? 'Job Description');
  addText('jobDescription - Title', job.jobDescriptionTitle ?? 'Job Description');
  addBlocks('Job Description - Text', htmlToRichTextBlocks(job.jobDescription));
  addBlocks('jobDescription - Text', htmlToRichTextBlocks(job.jobDescription));
  addBlocks('Job Description', htmlToRichTextBlocks(job.jobDescription));

  addText('Qualifications - Title', job.qualificationsTitle ?? 'Qualifications');
  addBlocks('Qualifications - Text', htmlToRichTextBlocks(job.qualifications));
  addBlocks('Qualifications', htmlToRichTextBlocks(job.qualifications));

  return replacements;

  function addText(marker: string, text: string): void {
    replacements.set(normalizeToken(marker), { text });
  }

  function addBlocks(marker: string, blocks: Array<Record<string, unknown>>): void {
    replacements.set(normalizeToken(marker), { blocks });
  }
}

function replaceRichTextPlaceholderBlocks(
  document: Record<string, unknown>,
  replacements: Map<string, RichTextPlaceholderReplacement>
): Record<string, unknown> {
  const nextDocument = cloneJson(document);
  const content = Array.isArray(nextDocument.content)
    ? replaceRichTextNodes(nextDocument.content, replacements)
    : [];

  return {
    ...nextDocument,
    content: content.length > 0 ? content : [paragraphNode('')]
  };
}

function replaceRichTextNodes(
  nodes: unknown[],
  replacements: Map<string, RichTextPlaceholderReplacement>
): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];

  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      continue;
    }

    const record = node as Record<string, unknown>;
    const marker = exactRichTextPlaceholder(record);
    const replacement = marker ? replacements.get(normalizeToken(marker)) : undefined;
    if (replacement?.blocks) {
      output.push(...(replacement.blocks.length > 0 ? cloneJson(replacement.blocks) : [paragraphNode('')]));
      continue;
    }
    if (replacement?.text !== undefined) {
      output.push({
        ...record,
        content: [textNode(replacement.text)]
      });
      continue;
    }

    if (Array.isArray(record.content)) {
      record.content = replaceRichTextNodes(record.content, replacements);
    }
    output.push(record);
  }

  return output;
}

function exactRichTextPlaceholder(node: Record<string, unknown>): string | undefined {
  if (typeof node.nodeType !== 'string' || !['heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6', 'paragraph'].includes(node.nodeType)) {
    return undefined;
  }

  const text = richTextNodeText(node).trim();
  const match = text.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  return match?.[1]?.trim();
}

function richTextNodeText(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  const record = node as Record<string, unknown>;
  if (record.nodeType === 'text') {
    return typeof record.value === 'string' ? record.value : '';
  }

  if (Array.isArray(record.content)) {
    return record.content.map(richTextNodeText).join('');
  }

  return '';
}

function isRichTextDocument(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).nodeType === 'document');
}

function ensureJobContentBlocks(
  entriesById: Map<string, DesiredEntry>,
  rootEntryId: string,
  job: SmartRecruitersJob,
  entryTitle: string,
  richTextAssignments: { mainSourceId?: string; additionalSourceId?: string },
  config: CommandConfig
): void {
  const root = entriesById.get(rootEntryId);
  if (!root) {
    return;
  }

  let mainEntryId = richTextAssignments.mainSourceId
    ? [...entriesById.values()].find((entry) => entry.sourceTemplateId === richTextAssignments.mainSourceId)?.entryId
    : undefined;
  let additionalEntryId = richTextAssignments.additionalSourceId
    ? [...entriesById.values()].find((entry) => entry.sourceTemplateId === richTextAssignments.additionalSourceId)?.entryId
    : undefined;
  const resourceContentLinks = getLocalizedArray(root.fields.resourceContent, config.locale);
  const hasTemplateRichTextLinks = resourceContentLinks.some((link) => {
    const linkedId = getLinkId(link);
    return Boolean(linkedId && entriesById.get(linkedId)?.contentType === 'richTextBlock');
  });

  if (!hasTemplateRichTextLinks && !mainEntryId && (job.jobDescription || job.qualifications)) {
    mainEntryId = toContentfulResourceId(`${rootEntryId}--${MAIN_RICH_TEXT_ENTRY_SUFFIX}`);
    entriesById.set(mainEntryId, createRichTextDesiredEntry({
      content: buildMainJobContent(job),
      entryId: mainEntryId,
      internalName: `${entryTitle} - Main content`,
      locale: config.locale
    }));
  }

  if (!hasTemplateRichTextLinks && !additionalEntryId && job.additionalInformation) {
    additionalEntryId = toContentfulResourceId(`${rootEntryId}--${ADDITIONAL_RICH_TEXT_ENTRY_SUFFIX}`);
    entriesById.set(additionalEntryId, createRichTextDesiredEntry({
      content: richTextDocument(htmlToRichTextBlocks(job.additionalInformation)),
      entryId: additionalEntryId,
      internalName: `${entryTitle} - Additional information`,
      locale: config.locale
    }));
  }

  const nextLinks = resourceContentLinks.filter((link) => {
    const linkedId = getLinkId(link);
    return !linkedId || !linkedId.startsWith(`${rootEntryId}--`) || entriesById.has(linkedId);
  });
  if (mainEntryId) {
    appendEntryLinkIfMissing(nextLinks, mainEntryId);
  }
  if (additionalEntryId) {
    appendEntryLinkIfMissing(nextLinks, additionalEntryId);
  }
  setField(root.fields, 'resourceContent', config.locale, nextLinks);
}

function createRichTextDesiredEntry(input: {
  content: Record<string, unknown>;
  entryId: string;
  internalName: string;
  locale: string;
}): DesiredEntry {
  return {
    action: 'create',
    contentType: 'richTextBlock',
    entryId: input.entryId,
    fields: {
      internalName: { [input.locale]: input.internalName },
      content: { [input.locale]: input.content }
    },
    metadata: { tags: [] },
    role: 'child',
    status: 'planned'
  };
}

async function inspectDesiredEntries(context: ContentfulContext, plan: JobPlan): Promise<void> {
  let hasCreates = false;
  let hasUpdates = false;

  for (const entry of plan.entries) {
    const existing = await getEntryIfExists(context, entry.entryId);
    if (!existing) {
      entry.action = 'create';
      entry.status = 'will be created';
      hasCreates = true;
      continue;
    }

    if (getEntryContentType(existing) !== entry.contentType) {
      plan.issues.push({
        code: 'JOB_ENTRY_CONTENT_TYPE_MISMATCH',
        jobId: plan.job.id,
        message:
          `Managed entry ${entry.entryId} exists as ${getEntryContentType(existing)}, ` +
          `but the job sync needs ${entry.contentType}.`,
        severity: 'error'
      });
      entry.action = 'update';
      entry.status = 'blocked';
      continue;
    }

    if (isArchived(existing)) {
      entry.action = 'unarchive-and-update';
      entry.status = 'will be unarchived and updated';
      hasUpdates = true;
      continue;
    }

    if (sameEntryPayload(existing, entry)) {
      entry.action = 'no-change';
      entry.status = isPublishedAndClean(existing) ? 'already published' : 'will be published';
      continue;
    }

    entry.action = 'update';
    entry.status = 'will be updated';
    hasUpdates = true;
  }

  plan.action = hasCreates ? 'create' : hasUpdates ? 'update' : 'no-change';
  plan.status = hasCreates ? 'will be created' : hasUpdates ? 'will be updated' : 'already synced';
}

async function inspectDesiredAssets(context: ContentfulContext, plan: JobPlan): Promise<void> {
  for (const asset of plan.assets) {
    const existing = await getAssetIfExists(context, asset.assetId);
    if (!existing) {
      asset.action = 'create';
      asset.status = 'will be created';
      continue;
    }

    if (isArchived(existing)) {
      asset.action = 'unarchive-and-update';
      asset.status = 'will be unarchived and updated';
      continue;
    }

    asset.action = 'no-change';
    asset.status = isPublishedAndClean(existing) ? 'already published' : 'will be published';
  }
}

async function buildArchivePlans(
  context: ContentfulContext,
  activeRootEntryIds: Set<string>,
  config: CommandConfig
): Promise<ArchivePlan[]> {
  const plans: ArchivePlan[] = [];
  const managedRoots = await fetchManagedJobRootEntries(context, config.managedEntryPrefix);

  for (const root of managedRoots) {
    const rootEntryId = root.sys?.id;
    if (!rootEntryId || activeRootEntryIds.has(rootEntryId)) {
      continue;
    }

    const entryIds = await collectManagedEntryTree(context, rootEntryId);
    plans.push({
      action: isArchived(root) ? 'already-archived' : 'archive',
      entryIds,
      rootEntryId,
      title: extractEntryName(root.fields ?? {})
    });
  }

  return plans.sort((left, right) => left.rootEntryId.localeCompare(right.rootEntryId));
}

async function inspectConfiguredTargetLinks(
  context: ContentfulContext,
  config: CommandConfig
): Promise<PlanIssue[]> {
  const issues: PlanIssue[] = [];

  if (config.parentEntryId) {
    const parent = await getEntryIfExists(context, config.parentEntryId);
    if (!parent) {
      issues.push({
        code: 'JOB_PARENT_NOT_FOUND',
        message: `Configured job page parent ${config.parentEntryId} was not found in environment ${config.environmentId}.`,
        severity: 'error'
      });
    }
  }

  if (config.heroImageEntryId) {
    const heroImage = await getEntryIfExists(context, config.heroImageEntryId);
    if (!heroImage) {
      issues.push({
        code: 'JOB_HERO_IMAGE_NOT_FOUND',
        message: `Configured job hero image entry ${config.heroImageEntryId} was not found in environment ${config.environmentId}.`,
        severity: 'error'
      });
    } else if (getEntryContentType(heroImage) !== 'imageWithFocalPoint') {
      issues.push({
        code: 'JOB_HERO_IMAGE_CONTENT_TYPE_MISMATCH',
        message:
          `Configured job hero image entry ${config.heroImageEntryId} is ${getEntryContentType(heroImage)}, ` +
          'not imageWithFocalPoint.',
        severity: 'error'
      });
    }
  }

  return issues;
}

async function fetchManagedJobRootEntries(context: ContentfulContext, managedEntryPrefix: string): Promise<any[]> {
  const roots: any[] = [];
  const limit = 100;
  let skip = 0;
  let total = 0;

  do {
    const response = await context.environment.getEntries({
      content_type: RESOURCE_PAGE_CONTENT_TYPE,
      limit,
      skip
    });
    const items = response.items ?? [];
    roots.push(...items.filter((entry: any) => String(entry?.sys?.id ?? '').startsWith(managedEntryPrefix)));
    total = Number(response.total ?? 0);
    skip += limit;
  } while (skip < total);

  return roots;
}

async function collectManagedEntryTree(context: ContentfulContext, rootEntryId: string): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  const queue = [rootEntryId];

  while (queue.length > 0) {
    const entryId = queue.shift();
    if (!entryId || seen.has(entryId)) {
      continue;
    }
    seen.add(entryId);
    ids.push(entryId);

    const entry = await getEntryIfExists(context, entryId);
    if (!entry) {
      continue;
    }

    for (const linkedId of collectEntryLinkIds(entry.fields ?? {})) {
      if (linkedId.startsWith(`${rootEntryId}--`) && !seen.has(linkedId)) {
        queue.push(linkedId);
      }
    }
  }

  return ids;
}

async function applyTaxonomyPlan(
  taxonomyClient: any,
  context: ContentfulContext,
  plan: TaxonomyPlan,
  config: CommandConfig
): Promise<void> {
  for (const scheme of plan.schemes.filter((item) => item.action === 'would-create')) {
    await taxonomyClient.conceptScheme.createWithId(
      {
        conceptSchemeId: scheme.schemeId,
        organizationId: config.orgId
      },
      {
        concepts: [],
        prefLabel: { [config.locale]: scheme.label },
        topConcepts: []
      }
    );
    scheme.action = 'created';
  }

  for (const concept of plan.concepts.filter((item) => item.action === 'would-create')) {
    await taxonomyClient.concept.createWithId(
      {
        conceptId: concept.conceptId,
        organizationId: config.orgId
      },
      {
        prefLabel: { [config.locale]: concept.label }
      }
    );
    concept.action = 'created';
  }

  const conceptsByScheme = new Map<string, TaxonomyConceptPlan[]>();
  for (const concept of plan.concepts.filter((item) => item.action !== 'existing')) {
    const current = conceptsByScheme.get(concept.schemeId) ?? [];
    current.push(concept);
    conceptsByScheme.set(concept.schemeId, current);
  }

  for (const [schemeId, concepts] of conceptsByScheme) {
    const currentScheme = await taxonomyClient.conceptScheme.get({
      conceptSchemeId: schemeId,
      organizationId: config.orgId
    }) as RawTaxonomyScheme;
    const currentConceptIds = new Set(extractLinkIds(currentScheme.concepts));
    const currentTopConceptIds = new Set(extractLinkIds(currentScheme.topConcepts));
    const nextConcepts = [...(currentScheme.concepts ?? [])];
    const nextTopConcepts = [...(currentScheme.topConcepts ?? [])];

    for (const concept of concepts) {
      if (!currentConceptIds.has(concept.conceptId)) {
        nextConcepts.push(taxonomyConceptLink(concept.conceptId));
        currentConceptIds.add(concept.conceptId);
      }
      if (concept.topConcept && !currentTopConceptIds.has(concept.conceptId)) {
        nextTopConcepts.push(taxonomyConceptLink(concept.conceptId));
        currentTopConceptIds.add(concept.conceptId);
      }
    }

    await taxonomyClient.conceptScheme.updatePut(
      {
        conceptSchemeId: schemeId,
        organizationId: config.orgId,
        version: currentScheme.sys?.version
      },
      {
        concepts: nextConcepts,
        definition: currentScheme.definition,
        prefLabel: currentScheme.prefLabel,
        topConcepts: nextTopConcepts
      }
    );

    for (const concept of concepts) {
      if (concept.action === 'would-add-to-scheme') {
        concept.action = 'added-to-scheme';
      }
    }
  }

  if (plan.contentType.action === 'would-update') {
    const contentType = await context.environment.getContentType(plan.contentType.contentTypeId);
    const currentTaxonomy = Array.isArray(contentType.metadata?.taxonomy)
      ? contentType.metadata.taxonomy
      : [];
    const existingIds = new Set(getContentTypeTaxonomySchemeIds(contentType));
    contentType.metadata = {
      ...(contentType.metadata ?? {}),
      taxonomy: [
        ...currentTaxonomy,
        ...plan.contentType.missingSchemeIds
          .filter((schemeId) => !existingIds.has(schemeId))
          .map((schemeId) => ({
            required: false,
            sys: {
              id: schemeId,
              linkType: 'TaxonomyConceptScheme',
              type: 'Link'
            }
          }))
      ]
    };
    const updated = await contentType.update();
    await updated.publish();
    plan.contentType.action = 'updated';
  }
}

async function applyJobPlans(context: ContentfulContext, plans: JobPlan[], logger: Logger): Promise<void> {
  const totalJobs = plans.length;

  for (const [jobOffset, plan] of plans.entries()) {
    const jobIndex = jobOffset + 1;
    logger.info('Syncing job upload phase', {
      phase: 'upload',
      jobId: plan.job.id,
      jobIndex,
      rootEntryId: plan.rootEntryId,
      title: plan.job.name,
      totalJobs
    });

    for (const [assetOffset, asset] of plan.assets.entries()) {
      logger.info('Processing job asset', {
        action: asset.action,
        assetId: asset.assetId,
        assetIndex: assetOffset + 1,
        assetTotal: plan.assets.length,
        jobId: plan.job.id,
        jobIndex,
        phase: 'upload',
        status: asset.status,
        totalJobs
      });

      const existing = await getAssetIfExists(context, asset.assetId);

      if (existing && isArchived(existing)) {
        await existing.unarchive();
      }

      if (!existing) {
        const created = await context.environment.createAssetWithId(asset.assetId, {
          fields: asset.fields,
          metadata: asset.metadata
        });
        await created.processForAllLocales();
        await waitForProcessedAsset(context, asset.assetId);
        asset.status = 'created';
      } else if (asset.action === 'unarchive-and-update') {
        existing.fields = asset.fields;
        existing.metadata = asset.metadata;
        const updated = await existing.update();
        await updated.processForAllLocales();
        await waitForProcessedAsset(context, asset.assetId);
        asset.status = 'updated';
      }
    }

    for (const [entryOffset, entry] of plan.entries.entries()) {
      logger.info('Processing job entry', {
        action: entry.action,
        contentType: entry.contentType,
        entryId: entry.entryId,
        entryIndex: entryOffset + 1,
        entryTotal: plan.entries.length,
        jobId: plan.job.id,
        jobIndex,
        phase: 'upload',
        role: entry.role,
        status: entry.status,
        totalJobs
      });

      const existing = await getEntryIfExists(context, entry.entryId);

      if (existing && isArchived(existing)) {
        await existing.unarchive();
      }

      if (entry.action === 'create' || !existing) {
        await context.environment.createEntryWithId(entry.contentType, entry.entryId, {
          fields: entry.fields,
          metadata: entry.metadata
        });
        entry.status = 'created';
        continue;
      }

      if (entry.action === 'update' || entry.action === 'unarchive-and-update') {
        existing.fields = entry.fields;
        existing.metadata = entry.metadata;
        await existing.update();
        entry.status = 'updated';
      }
    }

    await publishJobPlan(context, plan, logger, jobIndex, totalJobs);
  }
}

interface PublishCandidate {
  desired: DesiredAsset | DesiredEntry;
  entity: any;
  entityId: string;
  entityIndex: number;
  entityTotal: number;
  linkType: 'Asset' | 'Entry';
}

async function publishJobPlan(
  context: ContentfulContext,
  plan: JobPlan,
  logger: Logger,
  jobIndex: number,
  totalJobs: number
): Promise<void> {
  const candidates: PublishCandidate[] = [];
  const totalEntities = plan.assets.length + plan.entries.length;
  let entityIndex = 0;

  for (const asset of plan.assets) {
    entityIndex += 1;
    const entity = await getAssetIfExists(context, asset.assetId);
    const shouldPublish = Boolean(entity && !isArchived(entity) && !isPublishedAndClean(entity));
    logger.info('Checking job asset publish state', {
      action: shouldPublish ? 'queue publish' : 'skip',
      assetId: asset.assetId,
      entityIndex,
      entityTotal: totalEntities,
      jobId: plan.job.id,
      jobIndex,
      phase: 'publish',
      status: asset.status,
      totalJobs
    });
    if (entity && shouldPublish) {
      candidates.push({
        desired: asset,
        entity,
        entityId: asset.assetId,
        entityIndex,
        entityTotal: totalEntities,
        linkType: 'Asset'
      });
    }
  }

  for (const entry of plan.entries) {
    entityIndex += 1;
    const entity = await getEntryIfExists(context, entry.entryId);
    const shouldPublish = Boolean(entity && !isArchived(entity) && !isPublishedAndClean(entity));
    logger.info('Checking job entry publish state', {
      action: shouldPublish ? 'queue publish' : 'skip',
      contentType: entry.contentType,
      entityIndex,
      entityTotal: totalEntities,
      entryId: entry.entryId,
      jobId: plan.job.id,
      jobIndex,
      phase: 'publish',
      role: entry.role,
      status: entry.status,
      totalJobs
    });
    if (entity && shouldPublish) {
      candidates.push({
        desired: entry,
        entity,
        entityId: entry.entryId,
        entityIndex,
        entityTotal: totalEntities,
        linkType: 'Entry'
      });
    }
  }

  if (candidates.length === 0) {
    logger.info('Job reference chain already published', {
      jobId: plan.job.id,
      jobIndex,
      phase: 'publish',
      rootEntryId: plan.rootEntryId,
      totalJobs
    });
    return;
  }

  logger.info('Publishing job reference chain', {
    entities: candidates.length,
    jobId: plan.job.id,
    jobIndex,
    phase: 'publish',
    rootEntryId: plan.rootEntryId,
    totalJobs
  });

  try {
    await publishCandidatesInBulk(context, candidates);
    for (const candidate of candidates) {
      candidate.desired.status = publishedStatus(candidate.desired.status);
    }
  } catch (error) {
    logger.warn('Bulk publish failed; falling back to individual publish calls', {
      error: error instanceof Error ? error.message : String(error),
      jobId: plan.job.id,
      jobIndex,
      phase: 'publish',
      rootEntryId: plan.rootEntryId,
      totalJobs
    });
    await publishCandidatesIndividually(candidates, logger, plan, jobIndex, totalJobs);
  }
}

async function publishCandidatesInBulk(context: ContentfulContext, candidates: PublishCandidate[]): Promise<void> {
  const environment = context.environment as any;
  if (typeof environment.createPublishBulkAction !== 'function') {
    throw new Error('Contentful SDK environment does not support createPublishBulkAction.');
  }

  const bulkAction = await environment.createPublishBulkAction({
    entities: {
      sys: { type: 'Array' },
      items: candidates.map((candidate) => versionedLink(candidate.entity, candidate.linkType))
    }
  });
  const completed = typeof bulkAction.waitProcessing === 'function'
    ? await bulkAction.waitProcessing()
    : bulkAction;

  const status = completed?.sys?.status;
  if (status && status !== 'succeeded') {
    throw new Error(`Bulk publish finished with status ${status}.`);
  }
}

async function publishCandidatesIndividually(
  candidates: PublishCandidate[],
  logger: Logger,
  plan: JobPlan,
  jobIndex: number,
  totalJobs: number
): Promise<void> {
  for (const candidate of candidates) {
    logger.info('Publishing individual job entity', {
      action: 'publish',
      entityId: candidate.entityId,
      entityIndex: candidate.entityIndex,
      entityTotal: candidate.entityTotal,
      jobId: plan.job.id,
      jobIndex,
      linkType: candidate.linkType,
      phase: 'publish',
      totalJobs
    });
    await candidate.entity.publish();
    candidate.desired.status = publishedStatus(candidate.desired.status);
  }
}

function versionedLink(entity: any, linkType: 'Asset' | 'Entry'): RawLink & { sys: RawLink['sys'] & { version: number } } {
  return {
    sys: {
      id: String(entity.sys.id),
      linkType,
      type: 'Link',
      version: Number(entity.sys.version)
    }
  };
}

function publishedStatus(status: string): string {
  if (status.includes('published')) {
    return status;
  }
  if (status === 'planned' || status.startsWith('will')) {
    return 'published';
  }
  return `${status}, published`;
}

async function applyArchivePlans(context: ContentfulContext, plans: ArchivePlan[]): Promise<void> {
  for (const plan of plans) {
    for (const entryId of plan.entryIds) {
      const entry = await getEntryIfExists(context, entryId);
      if (!entry || isArchived(entry)) {
        continue;
      }
      if (typeof entry.isPublished === 'function' && entry.isPublished()) {
        await entry.unpublish();
      }
      await entry.archive();
    }
    if (plan.action === 'archive') {
      plan.action = 'already-archived';
    }
  }
}

async function waitForProcessedAsset(context: ContentfulContext, assetId: string): Promise<void> {
  const maxAttempts = 20;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const asset = await getAssetIfExists(context, assetId);
    const file = asset?.fields?.file;
    const localizedFiles = file && typeof file === 'object'
      ? Object.values(file as Record<string, unknown>)
      : [];
    const hasUpload = localizedFiles.some((localizedFile) =>
      Boolean(asRecord(localizedFile)?.upload)
    );

    if (!hasUpload) {
      return;
    }

    await delay(500 * attempt);
  }

  throw new Error(`Asset ${assetId} did not finish processing in Contentful.`);
}

function buildReport(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  taxonomy: TaxonomyPlan,
  jobs: JobPlan[],
  archives: ArchivePlan[],
  issues: PlanIssue[]
): JobSyncReport {
  return {
    archives,
    generatedAt: new Date().toISOString(),
    input: {
      companyId: commandConfig.companyId,
      heroImageEntryId: commandConfig.heroImageEntryId,
      managedEntryPrefix: commandConfig.managedEntryPrefix,
      parentEntryId: commandConfig.parentEntryId,
      slugPrefix: commandConfig.slugPrefix,
      templateEntryId: commandConfig.templateEntryId,
      templateEnvironmentId: commandConfig.templateEnvironmentId
    },
    issues,
    jobs,
    mode: commandConfig.dryRun ? 'dry-run' : 'upload',
    spaceId: projectConfig.env.CONTENTFUL_SPACE_ID,
    environmentId: commandConfig.environmentId,
    summary: summarize(jobs, taxonomy, archives, issues),
    taxonomy
  };
}

async function writeReports(
  projectConfig: LoadedProjectConfig,
  commandConfig: CommandConfig,
  report: JobSyncReport
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runId = `smartrecruiters-jobs-${commandConfig.dryRun ? 'dry-run' : 'upload'}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const jsonPath = await writeJsonArtifact(projectConfig.paths.buildReportsDir, `${runId}.json`, report);
  const markdownPath = await writeTextArtifact(
    projectConfig.paths.buildReportsDir,
    `${runId}.md`,
    renderMarkdownReport(report)
  );

  return { jsonPath, markdownPath };
}

function renderMarkdownReport(report: JobSyncReport): string {
  const lines: string[] = [];
  lines.push('# SmartRecruiters Job Sync Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Space ID: ${report.spaceId ?? 'n/a'}`);
  lines.push(`- Environment ID: ${report.environmentId}`);
  lines.push(`- Company ID: ${report.input.companyId}`);
  lines.push(`- Template: ${report.input.templateEnvironmentId}/${report.input.templateEntryId}`);
  lines.push(`- Page parent: ${report.input.parentEntryId ?? 'not configured'}`);
  lines.push(`- Hero image entry: ${report.input.heroImageEntryId ?? 'template clone'}`);
  lines.push(`- Managed entry prefix: ${report.input.managedEntryPrefix}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Active jobs from API | ${report.summary.activeJobs} |`);
  lines.push(`| Jobs to create | ${report.summary.jobsToCreate} |`);
  lines.push(`| Jobs to update | ${report.summary.jobsToUpdate} |`);
  lines.push(`| Jobs already synced | ${report.summary.noChangeJobs} |`);
  lines.push(`| Entries to create | ${report.summary.entriesToCreate} |`);
  lines.push(`| Entries to update | ${report.summary.entriesToUpdate} |`);
  lines.push(`| Archive plans | ${report.summary.archivePlans} |`);
  lines.push(`| Entries to archive | ${report.summary.entriesToArchive} |`);
  lines.push(`| Taxonomy schemes to create | ${report.summary.taxonomySchemesToCreate} |`);
  lines.push(`| Taxonomy concepts to add | ${report.summary.taxonomyConceptsToAdd} |`);
  lines.push(`| Warnings | ${report.summary.warnings} |`);
  lines.push(`| Errors | ${report.summary.errors} |`);
  lines.push('');

  if (report.issues.length > 0) {
    lines.push('## Issues');
    lines.push('');
    for (const issue of report.issues) {
      lines.push(`- ${issue.severity.toUpperCase()} ${issue.code}${issue.jobId ? ` (${issue.jobId})` : ''}: ${issue.message}`);
    }
    lines.push('');
  }

  lines.push('## Environment Taxonomy');
  lines.push('');
  lines.push('| Type | Scheme | Concept | ID | Action |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const scheme of report.taxonomy.schemes) {
    lines.push(`| Scheme | ${markdownTableCell(scheme.label)} |  | ${markdownTableCell(scheme.schemeId)} | ${scheme.action} |`);
  }
  for (const concept of report.taxonomy.concepts) {
    lines.push(
      `| Concept | ${markdownTableCell(concept.schemeLabel)} | ${markdownTableCell(concept.label)} | ${markdownTableCell(concept.conceptId)} | ${concept.action} |`
    );
  }
  lines.push('');
  lines.push('Content type taxonomy attachment:');
  lines.push(`- Content type: ${report.taxonomy.contentType.contentTypeId}`);
  lines.push(`- Action: ${report.taxonomy.contentType.action}`);
  lines.push(`- Missing scheme IDs: ${report.taxonomy.contentType.missingSchemeIds.join(', ') || 'none'}`);
  lines.push('');

  lines.push('## Jobs');
  lines.push('');
  for (const job of report.jobs) {
    lines.push(`### ${job.entryTitle}`);
    lines.push('');
    lines.push(`- Root entry: ${job.rootEntryId}`);
    lines.push(`- Slug: ${job.slug}`);
    lines.push(`- Status: ${job.status}`);
    lines.push(`- Action: ${job.action}`);
    lines.push(`- Taxonomies: ${job.taxonomies.map((taxonomy) => `${taxonomy.schemeLabel}: ${taxonomy.label} (${taxonomy.conceptId})`).join('; ') || 'none'}`);
    lines.push('');
    lines.push('Job data:');
    lines.push(`- Job Time: ${job.data.time ?? 'n/a'}`);
    lines.push(`- Role Title/Job Name: ${job.data.roleTitle}`);
    lines.push(`- Role City: ${job.data.city ?? 'n/a'}`);
    lines.push(`- Role Full Location: ${job.data.fullLocation ?? 'n/a'}`);
    lines.push(job.data.compensation ? `- ${job.data.compensation}` : '- Compensation: n/a');
    lines.push(`- Apply URL: ${job.data.applyUrl ?? 'n/a'}`);
    lines.push(`- Introduction: ${summarizeText(job.data.introduction)}`);
    lines.push(`- Job Description: ${summarizeText(job.data.jobDescription)}`);
    lines.push(`- Qualifications: ${summarizeText(job.data.qualifications)}`);
    lines.push(`- Additional Information: ${summarizeText(job.data.additionalInformation)}`);
    lines.push('');
    lines.push('Sub entities:');
    lines.push('');
    lines.push('| Entity ID | Type | Role | Action | Status |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const asset of job.assets) {
      lines.push(
        `| ${markdownTableCell(asset.assetId)} | Asset | dependency | ${asset.action} | ${markdownTableCell(asset.status)} |`
      );
    }
    for (const entry of job.entries) {
      lines.push(
        `| ${markdownTableCell(entry.entryId)} | ${markdownTableCell(entry.contentType)} | ${entry.role} | ${entry.action} | ${markdownTableCell(entry.status)} |`
      );
    }
    lines.push('');
  }

  lines.push('## Archives');
  lines.push('');
  if (report.archives.length === 0) {
    lines.push('- No managed job pages need archiving.');
  } else {
    lines.push('| Root entry | Title | Entries | Action |');
    lines.push('| --- | --- | ---: | --- |');
    for (const archive of report.archives) {
      lines.push(
        `| ${markdownTableCell(archive.rootEntryId)} | ${markdownTableCell(archive.title ?? '')} | ${archive.entryIds.length} | ${archive.action} |`
      );
    }
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function summarize(
  jobs: JobPlan[],
  taxonomy: TaxonomyPlan,
  archives: ArchivePlan[],
  issues: PlanIssue[]
): JobSyncSummary {
  const entries = jobs.flatMap((job) => job.entries);
  return {
    activeJobs: jobs.length,
    archivedEntries: archives
      .filter((archive) => archive.action === 'already-archived')
      .reduce((sum, archive) => sum + archive.entryIds.length, 0),
    archivePlans: archives.length,
    createdEntries: entries.filter((entry) => entry.status.includes('created')).length,
    entriesToArchive: archives
      .filter((archive) => archive.action === 'archive')
      .reduce((sum, archive) => sum + archive.entryIds.length, 0),
    entriesToCreate: entries.filter((entry) => entry.action === 'create').length,
    entriesToUpdate: entries.filter((entry) => entry.action === 'update' || entry.action === 'unarchive-and-update').length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    jobsToCreate: jobs.filter((job) => job.action === 'create').length,
    jobsToUpdate: jobs.filter((job) => job.action === 'update').length,
    noChangeJobs: jobs.filter((job) => job.action === 'no-change').length,
    taxonomyConceptsToAdd: taxonomy.concepts.filter((concept) => concept.action !== 'existing').length,
    taxonomySchemesToCreate: taxonomy.schemes.filter((scheme) => scheme.action === 'would-create').length,
    updatedEntries: entries.filter((entry) => entry.status.includes('updated')).length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length
  };
}

function buildSourceToTargetIdMap(
  templateGraph: TemplateGraph,
  rootEntryId: string,
  heroImageEntryId?: string
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of templateGraph.entries) {
    if (heroImageEntryId && entry.contentType === 'imageWithFocalPoint') {
      map.set(entry.sourceId, heroImageEntryId);
      continue;
    }

    if (entry.role === 'root') {
      map.set(entry.sourceId, rootEntryId);
      continue;
    }

    if (entry.sourceId.startsWith(`${templateGraph.rootEntryId}--`)) {
      map.set(entry.sourceId, toContentfulResourceId(`${rootEntryId}${entry.sourceId.slice(templateGraph.rootEntryId.length)}`));
      continue;
    }

    map.set(
      entry.sourceId,
      toContentfulResourceId(`${rootEntryId}--${slugify(entry.contentType) || 'entry'}--${String(entry.sequence).padStart(3, '0')}`)
    );
  }
  return map;
}

function buildSourceToTargetAssetIdMap(templateGraph: TemplateGraph): Map<string, string> {
  return new Map(
    templateGraph.assets.map((asset) => [
      asset.sourceId,
      toContentfulResourceId(`job-template-asset--${asset.sourceId}`)
    ])
  );
}

function pickRichTextAssignments(templateGraph: TemplateGraph): { mainSourceId?: string; additionalSourceId?: string } {
  const richTextEntries = templateGraph.entries.filter((entry) => entry.contentType === 'richTextBlock');
  const main = richTextEntries.find((entry) => containsText(entry.fields, ['{{Job Description}}', '{{Qualifications}}', 'Your role in our future']))
    ?? richTextEntries.find((entry) => normalizeToken(entry.sourceName ?? '').includes('main'))
    ?? richTextEntries[0];
  const additional = richTextEntries.find((entry) => entry.sourceId !== main?.sourceId && containsText(entry.fields, ['{{Additional Information}}']))
    ?? richTextEntries.find((entry) => entry.sourceId !== main?.sourceId && normalizeToken(entry.sourceName ?? '').includes('additional'))
    ?? richTextEntries.find((entry) => entry.sourceId !== main?.sourceId);

  return {
    additionalSourceId: additional?.sourceId,
    mainSourceId: main?.sourceId
  };
}

function pickApplyCtaSourceIds(templateGraph: TemplateGraph): Set<string> {
  const ctas = templateGraph.entries.filter((entry) => entry.contentType === 'ctaItem');
  const matching = ctas.filter((entry) => containsText(entry.fields, ['{{ApplyURL}}', 'Apply']));
  return new Set((matching.length > 0 ? matching : ctas.slice(0, 1)).map((entry) => entry.sourceId));
}

function jobTaxonomies(
  job: SmartRecruitersJob,
  conceptBySchemeAndLabel: Map<string, TaxonomyConceptPlan>
): PlannedJobTaxonomy[] {
  const values: Array<[string, string, string]> = [
    ['resourceType', 'Resource Type', 'Job'],
    ['jobLocationType', 'Job Location Type', job.locationType]
  ];

  if (job.country) {
    values.push(['country', 'Country', job.country]);
  }
  if (job.city) {
    values.push(['city', 'City', job.city]);
  }
  if (job.jobCategory) {
    values.push(['jobCategory', 'Job Category', job.jobCategory]);
  }

  return values
    .map(([schemeId, schemeLabel, label]) => {
      const concept = conceptBySchemeAndLabel.get(`${schemeId}:${normalizeToken(label)}`);
      if (!concept) {
        return undefined;
      }
      return {
        conceptId: concept.conceptId,
        label,
        schemeId,
        schemeLabel
      };
    })
    .filter((item): item is PlannedJobTaxonomy => Boolean(item));
}

function toJobReportData(job: SmartRecruitersJob): JobReportData {
  return {
    additionalInformation: plainTextFromHtml(job.additionalInformation ?? ''),
    additionalInformationTitle: job.additionalInformationTitle,
    applyUrl: job.applyUrl,
    city: job.city,
    compensation: job.compensation,
    country: job.country,
    companyDescriptionTitle: job.companyDescriptionTitle,
    fullLocation: job.fullLocation,
    introduction: plainTextFromHtml(job.companyDescription ?? ''),
    jobCategory: job.jobCategory,
    jobDescription: plainTextFromHtml(job.jobDescription ?? ''),
    jobDescriptionTitle: job.jobDescriptionTitle,
    locationType: job.locationType,
    qualifications: plainTextFromHtml(job.qualifications ?? ''),
    qualificationsTitle: job.qualificationsTitle,
    roleTitle: job.name,
    time: job.time
  };
}

function buildJobReplacements(job: SmartRecruitersJob, slug: string): Map<string, string> {
  return new Map([
    ['Additional Information', plainTextFromHtml(job.additionalInformation ?? '')],
    ['Additional Information - Text', plainTextFromHtml(job.additionalInformation ?? '')],
    ['Additional Information - Title', job.additionalInformationTitle ?? 'Additional Information'],
    ['Additional Information - title', job.additionalInformationTitle ?? 'Additional Information'],
    ['ApplyURL', job.applyUrl ?? ''],
    ['Apply URL', job.applyUrl ?? ''],
    ['City', job.city ?? ''],
    ['Company Description', plainTextFromHtml(job.companyDescription ?? '')],
    ['Company Description - Text', plainTextFromHtml(job.companyDescription ?? '')],
    ['Company Description - Title', job.companyDescriptionTitle ?? 'Company Description'],
    ['companyDescription - Text', plainTextFromHtml(job.companyDescription ?? '')],
    ['companyDescription - Title', job.companyDescriptionTitle ?? 'Company Description'],
    ['Compensation', job.compensation ?? ''],
    ['Country', job.country ?? ''],
    ['Function Label', job.jobCategory ?? ''],
    ['Full Location', job.fullLocation ?? ''],
    ['Introduction', plainTextFromHtml(job.companyDescription ?? '')],
    ['Job Category', job.jobCategory ?? ''],
    ['Job City', job.city ?? ''],
    ['Job Country', job.country ?? ''],
    ['Job Description', plainTextFromHtml(job.jobDescription ?? '')],
    ['Job Description - Text', plainTextFromHtml(job.jobDescription ?? '')],
    ['Job Description - Title', job.jobDescriptionTitle ?? 'Job Description'],
    ['jobDescription - Text', plainTextFromHtml(job.jobDescription ?? '')],
    ['jobDescription - Title', job.jobDescriptionTitle ?? 'Job Description'],
    ['Job Full Location', job.fullLocation ?? ''],
    ['Job Hybrid/Remote/In Office', job.locationType],
    ['Job ID', job.id],
    ['Job Introduction', plainTextFromHtml(job.companyDescription ?? '')],
    ['Job Location Type', job.locationType],
    ['Job Name', job.name],
    ['Job Role', job.name],
    ['Job Title', job.name],
    ['Job Time', job.time ?? ''],
    ['Job Summary', buildJobSummaryText(job)],
    ['Qualifications', plainTextFromHtml(job.qualifications ?? '')],
    ['Qualifications - Text', plainTextFromHtml(job.qualifications ?? '')],
    ['Qualifications - Title', job.qualificationsTitle ?? 'Qualifications'],
    ['Role City', job.city ?? ''],
    ['Role Full Location', job.fullLocation ?? ''],
    ['Role Name', job.name],
    ['Role Title', job.name],
    ['Role Title/Job Name', job.name],
    ['Secondary Heading', 'Connect with Quadient'],
    ['Slug', slug]
  ]);
}

function buildJobSummaryText(job: SmartRecruitersJob): string {
  const rows = [
    ['Job Time', job.time],
    ['Location Type', job.locationType],
    ['City', job.city],
    ['Location', job.fullLocation]
  ];

  return [
    ...rows
    .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`),
    ...(job.compensation ? [job.compensation] : [])
  ]
    .join('\n');
}

function buildJobSlug(job: SmartRecruitersJob, config: CommandConfig): string {
  return joinPresent([
    config.slugPrefix,
    `${slugify(job.name) || 'job'}-${slugify(job.id) || toContentfulResourceId(job.id)}`
  ], '/');
}

function buildMainJobContent(job: SmartRecruitersJob): Record<string, unknown> {
  return richTextDocument([
    headingNode(3, 'Your role in our future'),
    ...htmlToRichTextBlocks(job.jobDescription),
    headingNode(3, 'Your profile'),
    ...htmlToRichTextBlocks(job.qualifications)
  ]);
}

function buildResourceSummary(job: SmartRecruitersJob): Record<string, unknown> {
  const rows = [
    ['Job Time', job.time],
    ['Location Type', job.locationType],
    ['City', job.city],
    ['Location', job.fullLocation]
  ].filter(([, value]) => value);
  const summaryLines = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(job.compensation ? [job.compensation] : [])
  ];

  return richTextDocument(
    summaryLines.length > 0
      ? summaryLines.map((line) => paragraphNode(line))
      : [paragraphNode(job.name)]
  );
}

function richTextDocument(content: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    data: {},
    nodeType: 'document',
    content: content.length > 0 ? content : [paragraphNode('')]
  };
}

function htmlToRichTextBlocks(html: string | undefined): Array<Record<string, unknown>> {
  if (!html || !html.trim()) {
    return [];
  }

  const placeholders: Record<string, unknown>[] = [];
  let working = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  working = working.replace(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi, (_match, tag: string, inner: string) => {
    const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((item) => plainTextFromHtml(item[1] ?? ''))
      .filter((item): item is string => Boolean(item));
    const nodeType = tag.toLowerCase() === 'ol' ? 'ordered-list' : 'unordered-list';
    const placeholder = `__JOB_LIST_${placeholders.length}__`;
    placeholders.push({
      data: {},
      nodeType,
      content: items.map((item) => ({
        data: {},
        nodeType: 'list-item',
        content: [paragraphNode(item)]
      }))
    });
    return `\n\n${placeholder}\n\n`;
  });

  working = working.replace(/<h([2-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, inner: string) => {
    const placeholder = `__JOB_HEADING_${placeholders.length}__`;
    placeholders.push(headingNode(Number(level), plainTextFromHtml(inner)));
    return `\n\n${placeholder}\n\n`;
  });

  working = working
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article)>/gi, '\n\n')
    .replace(/<(p|div|section|article)[^>]*>/gi, '');

  return working
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const placeholderIndex = part.match(/^__JOB_(?:LIST|HEADING)_(\d+)__$/)?.[1];
      if (placeholderIndex !== undefined) {
        return placeholders[Number(placeholderIndex)];
      }
      return paragraphNode(plainTextFromHtml(part));
    })
    .filter((node): node is Record<string, unknown> => Boolean(node));
}

function paragraphNode(text: string): Record<string, unknown> {
  return {
    data: {},
    nodeType: 'paragraph',
    content: [textNode(text)]
  };
}

function headingNode(level: number, text: string): Record<string, unknown> {
  const boundedLevel = Math.min(Math.max(level, 2), 6);
  return {
    data: {},
    nodeType: `heading-${boundedLevel}`,
    content: [textNode(text)]
  };
}

function textNode(value: string): Record<string, unknown> {
  return {
    data: {},
    marks: [],
    nodeType: 'text',
    value
  };
}

function plainTextFromHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
  );
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const radix = entity[1]?.toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? entity.slice(2) : entity.slice(1);
      const codePoint = Number.parseInt(digits, radix);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return named[entity.toLowerCase()] ?? match;
  });
}

function rewriteLinks(
  value: unknown,
  sourceToTargetId: Map<string, string>,
  sourceToTargetAssetId: Map<string, string>
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteLinks(item, sourceToTargetId, sourceToTargetAssetId));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sys = asRecord(record.sys);
  if (sys?.type === 'Link' && typeof sys.id === 'string') {
    const mappedId = sys.linkType === 'Entry'
      ? sourceToTargetId.get(sys.id)
      : sys.linkType === 'Asset'
        ? sourceToTargetAssetId.get(sys.id)
        : undefined;
    if (mappedId) {
      return {
        ...record,
        sys: {
          ...sys,
          id: mappedId
        }
      };
    }
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(record)) {
    output[key] = rewriteLinks(nested, sourceToTargetId, sourceToTargetAssetId);
  }
  return output;
}

function replacePlaceholdersDeep(value: unknown, replacements: Map<string, string>): unknown {
  if (typeof value === 'string') {
    let next = value;
    for (const [key, replacement] of replacements) {
      next = next.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'gi'), replacement);
    }
    return next;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholdersDeep(item, replacements));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = replacePlaceholdersDeep(nested, replacements);
  }
  return output;
}

function collectEntryLinkIds(value: unknown): string[] {
  const ids = new Set<string>();
  visit(value);
  return [...ids];

  function visit(candidate: unknown): void {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        visit(item);
      }
      return;
    }

    if (!candidate || typeof candidate !== 'object') {
      return;
    }

    const record = candidate as Record<string, unknown>;
    const sys = asRecord(record.sys);
    if (sys?.type === 'Link' && sys.linkType === 'Entry' && typeof sys.id === 'string') {
      ids.add(sys.id);
      return;
    }

    for (const nested of Object.values(record)) {
      visit(nested);
    }
  }
}

function collectAssetLinkIds(value: unknown): string[] {
  const ids = new Set<string>();
  visit(value);
  return [...ids];

  function visit(candidate: unknown): void {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        visit(item);
      }
      return;
    }

    if (!candidate || typeof candidate !== 'object') {
      return;
    }

    const record = candidate as Record<string, unknown>;
    const sys = asRecord(record.sys);
    if (sys?.type === 'Link' && sys.linkType === 'Asset' && typeof sys.id === 'string') {
      ids.add(sys.id);
      return;
    }

    for (const nested of Object.values(record)) {
      visit(nested);
    }
  }
}

function containsText(fields: Record<string, Record<string, unknown>>, needles: string[]): boolean {
  const haystack = JSON.stringify(fields).toLowerCase();
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

function orderDesiredEntries(entries: DesiredEntry[]): DesiredEntry[] {
  const ordered: DesiredEntry[] = [];
  const pending = new Map(entries.map((entry) => [entry.entryId, entry]));
  const completed = new Set<string>();

  while (pending.size > 0) {
    const ready = [...pending.values()].filter((entry) =>
      collectEntryLinkIds(entry.fields).every((linkedId) =>
        completed.has(linkedId) || !pending.has(linkedId)
      )
    );

    if (ready.length === 0) {
      ordered.push(...[...pending.values()].sort(compareDesiredEntries));
      break;
    }

    for (const entry of ready.sort(compareDesiredEntries)) {
      ordered.push(entry);
      completed.add(entry.entryId);
      pending.delete(entry.entryId);
    }
  }

  return ordered;
}

function compareDesiredEntries(left: DesiredEntry, right: DesiredEntry): number {
  if (left.role !== right.role) {
    return left.role === 'child' ? -1 : 1;
  }
  return left.entryId.localeCompare(right.entryId);
}

function sameEntryPayload(existing: any, desired: DesiredEntry): boolean {
  return stableStringify(existing.fields ?? {}) === stableStringify(desired.fields)
    && stableStringify(existing.metadata ?? {}) === stableStringify(desired.metadata);
}

function sameAssetPayload(existing: any, desired: DesiredAsset): boolean {
  return stableStringify(existing.fields ?? {}) === stableStringify(desired.fields)
    && stableStringify(existing.metadata ?? {}) === stableStringify(desired.metadata);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortJson(item)])
  );
}

function createTaxonomyClient(env: RuntimeEnv): any {
  const required = requireEnv(env, ['CONTENTFUL_MANAGEMENT_TOKEN']);
  return contentfulManagement.createClient(
    {
      accessToken: required.CONTENTFUL_MANAGEMENT_TOKEN,
      host: env.CONTENTFUL_HOST,
      hostUpload: env.CONTENTFUL_HOST_UPLOAD
    },
    { type: 'plain' }
  );
}

function findConceptInSchemeByLabel(catalog: TaxonomyCatalog, schemeId: string, label: string): string | undefined {
  const normalizedLabel = normalizeToken(label);
  for (const [conceptId, schemeIds] of catalog.conceptToSchemeIds) {
    if (!schemeIds.has(schemeId)) {
      continue;
    }
    const concept = catalog.conceptsById.get(conceptId);
    if (normalizeToken(pickLocalizedString(concept?.prefLabel) ?? '') === normalizedLabel) {
      return conceptId;
    }
  }
  return undefined;
}

function getContentTypeTaxonomySchemeIds(contentType: any): string[] {
  return (contentType.metadata?.taxonomy ?? [])
    .map((item: any) => item?.sys?.id)
    .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
}

function extractEntryName(fields: Record<string, Record<string, unknown>>): string | undefined {
  for (const fieldId of ['internalName', 'name', 'title', 'heading']) {
    const value = pickLocalizedString(fields[fieldId]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function extractAssetName(fields: Record<string, Record<string, unknown>>): string | undefined {
  return pickLocalizedString(fields.title)
    ?? pickLocalizedString(fields.file);
}

function getEntryContentType(entry: any): string {
  return String(entry?.sys?.contentType?.sys?.id ?? '');
}

function isArchived(entry: any): boolean {
  return typeof entry?.isArchived === 'function'
    ? entry.isArchived()
    : Boolean(entry?.sys?.archivedVersion);
}

function isPublishedAndClean(entry: any): boolean {
  const published = typeof entry?.isPublished === 'function'
    ? entry.isPublished()
    : Boolean(entry?.sys?.publishedVersion);
  const updated = typeof entry?.isUpdated === 'function'
    ? entry.isUpdated()
    : Boolean(entry?.sys?.publishedVersion && entry?.sys?.version > entry.sys.publishedVersion + 1);
  return published && !updated;
}

function setField(fields: Record<string, Record<string, unknown>>, fieldId: string, locale: string, value: unknown): void {
  if (value === undefined) {
    return;
  }
  fields[fieldId] = {
    ...(fields[fieldId] ?? {}),
    [locale]: value
  };
}

function deleteField(fields: Record<string, Record<string, unknown>>, fieldId: string, locale: string): void {
  if (!fields[fieldId]) {
    return;
  }

  const next = { ...fields[fieldId] };
  delete next[locale];
  if (Object.keys(next).length === 0) {
    delete fields[fieldId];
    return;
  }

  fields[fieldId] = next;
}

function setFieldIfMissing(fields: Record<string, Record<string, unknown>>, fieldId: string, locale: string, value: unknown): void {
  if (getLocalizedValue(fields[fieldId], locale) !== undefined) {
    return;
  }
  setField(fields, fieldId, locale, value);
}

function getLocalizedValue(field: Record<string, unknown> | undefined, locale: string): unknown {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    return undefined;
  }
  return Object.prototype.hasOwnProperty.call(field, locale)
    ? field[locale]
    : Object.values(field).find((candidate) => candidate !== undefined);
}

function applyEntryDisplayName(
  fields: Record<string, Record<string, unknown>>,
  contentType: string,
  entryTitle: string,
  locale: string
): void {
  if (Object.prototype.hasOwnProperty.call(fields, 'internalName')) {
    setField(fields, 'internalName', locale, entryTitle);
    return;
  }

  if (contentType === 'imageWithFocalPoint' && Object.prototype.hasOwnProperty.call(fields, 'title')) {
    setField(fields, 'title', locale, entryTitle);
  }
}

function normalizeFieldsToLocale(
  fields: Record<string, Record<string, unknown>>,
  locale: string
): Record<string, Record<string, unknown>> {
  const normalized: Record<string, Record<string, unknown>> = {};

  for (const [fieldId, localizedValues] of Object.entries(fields)) {
    if (!localizedValues || typeof localizedValues !== 'object' || Array.isArray(localizedValues)) {
      continue;
    }

    const value = Object.prototype.hasOwnProperty.call(localizedValues, locale)
      ? localizedValues[locale]
      : Object.values(localizedValues).find((candidate) => candidate !== undefined);

    if (value !== undefined) {
      normalized[fieldId] = { [locale]: value };
    }
  }

  return normalized;
}

function normalizeAssetFieldsToLocale(
  fields: Record<string, Record<string, unknown>>,
  locale: string
): Record<string, Record<string, unknown>> {
  const normalized = normalizeFieldsToLocale(fields, locale);
  const file = normalized.file?.[locale];

  if (file && typeof file === 'object') {
    const fileRecord = file as Record<string, unknown>;
    const url = typeof fileRecord.url === 'string'
      ? fileRecord.url
      : typeof fileRecord.upload === 'string'
        ? fileRecord.upload
        : undefined;

    if (url) {
      normalized.file = {
        [locale]: {
          contentType: fileRecord.contentType,
          fileName: fileRecord.fileName,
          upload: normalizeAssetUrl(url)
        }
      };
    }
  }

  return normalized;
}

function normalizeAssetUrl(url: string): string {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
}

function getLocalizedArray(field: Record<string, unknown> | undefined, locale: string): unknown[] {
  const value = field?.[locale] ?? Object.values(field ?? {})[0];
  return Array.isArray(value) ? value : [];
}

function appendEntryLinkIfMissing(values: unknown[], entryId: string): void {
  if (values.some((value) => getLinkId(value) === entryId)) {
    return;
  }
  values.push(entryLink(entryId));
}

function getLinkId(value: unknown): string | undefined {
  return pickString(getPath(value, 'sys.id'));
}

function entryLink(entryId: string): RawLink {
  return {
    sys: {
      id: entryId,
      linkType: 'Entry',
      type: 'Link'
    }
  };
}

function taxonomyConceptLink(conceptId: string): RawLink {
  return {
    sys: {
      id: conceptId,
      linkType: 'TaxonomyConcept',
      type: 'Link'
    }
  };
}

function extractLinkIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => getPath(item, 'sys.id'))
    .filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function taxonomyConceptId(schemeId: string, label: string): string {
  return toContentfulResourceId(`${schemeId}-${slugify(label)}`);
}

function locationTypeConceptId(label: string): string {
  if (label === 'In Office') {
    return 'inOffice';
  }
  return slugify(label);
}

function hashLabel(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(16);
}

function pickLocalizedString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  for (const candidate of Object.values(value as Record<string, unknown>)) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseBoolean(value);
      if (parsed !== undefined) {
        return parsed;
      }
    }
  }
  return undefined;
}

function parseBoolean(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalized)) {
    return true;
  }
  if (['false', 'no', 'n', '0'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function firstArray(...values: unknown[]): unknown[] | undefined {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function getPath(value: unknown, pathExpression: string): unknown {
  if (!pathExpression) {
    return value;
  }
  return pathExpression.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '');
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function joinPresent(values: Array<string | undefined>, separator: string): string {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(separator);
}

function normalizeLocationText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const cleaned = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');

  return cleaned || undefined;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function summarizeText(value: string | undefined): string {
  const cleaned = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return 'n/a';
  }
  return markdownTableCell(truncateText(cleaned, 180));
}

function markdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stringFlag(flags: CliFlags, name: string): string | undefined {
  const value = flags[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function numberFlag(flags: CliFlags, name: string): number | undefined {
  const value = stringFlag(flags, name);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number.`);
  }
  return parsed;
}

function resolveEnvironmentSetting(input: {
  env: RuntimeEnv;
  environmentId: string;
  flagValue?: string;
  genericEnvKey: keyof RuntimeEnv;
  uatEnvKey: keyof RuntimeEnv;
  masterEnvKey: keyof RuntimeEnv;
  uatDefault?: string;
}): string | undefined {
  if (input.flagValue) {
    return input.flagValue;
  }

  const normalizedEnvironment = input.environmentId.toLowerCase();
  if (normalizedEnvironment === 'uat') {
    return input.env[input.uatEnvKey] ?? input.env[input.genericEnvKey] ?? input.uatDefault;
  }

  if (normalizedEnvironment === 'master') {
    return input.env[input.masterEnvKey] ?? input.env[input.genericEnvKey];
  }

  return input.env[input.genericEnvKey];
}

function hasErrors(issues: PlanIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
