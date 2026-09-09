import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  name: text("name"),
  city: text("city"),
  termsAcceptedAt: text("terms_accepted_at"),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),





}, (table) => [uniqueIndex("users_email_unique").on(table.email), uniqueIndex("users_phone_unique").on(table.phone),
  index("users_deleted_at_idx").on(table.deletedAt),
]);

export const otpChallenges = sqliteTable("otp_challenges", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),






}, (table) => [index("otp_email_created_idx").on(table.email, table.createdAt)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull(),






}, (table) => [uniqueIndex("sessions_token_unique").on(table.tokenHash), index("sessions_user_idx").on(table.userId)]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  providerOrderId: text("provider_order_id").notNull(),
  providerPaymentId: text("provider_payment_id"),
  analysisId: text("analysis_id").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  product: text("product").notNull(),
  provider: text("provider").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  providerStatus: text("provider_status"),
  providerVerifiedAt: text("provider_verified_at"),

  reconciliationCheckedAt: text("reconciliation_checked_at"),



}, (table) => [uniqueIndex("payments_provider_order_unique").on(table.providerOrderId), index("payments_analysis_idx").on(table.analysisId),
  index("payments_status_updated_idx").on(table.status, table.updatedAt),
  index("payments_reconciliation_due_idx").on(table.reconciliationCheckedAt, table.id),
]);

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerSubscriptionId: text("provider_subscription_id").notNull(),
  provider: text("provider").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  currentPeriodEnd: integer("current_period_end"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  providerPlanId: text("provider_plan_id"),
  cancelAtPeriodEnd: integer("cancel_at_period_end").notNull().default(0),
  endedAt: integer("ended_at"),
  providerVerifiedAt: text("provider_verified_at"),

  reconciliationCheckedAt: text("reconciliation_checked_at"),



}, (table) => [uniqueIndex("subscriptions_provider_id_unique").on(table.providerSubscriptionId), index("subscriptions_user_status_idx").on(table.userId, table.status),
  index("subscriptions_status_period_idx").on(table.status, table.currentPeriodEnd),
  index("subscriptions_reconciliation_due_idx").on(table.reconciliationCheckedAt, table.id),
]);

export const entitlements = sqliteTable("entitlements", {
  id: text("id").primaryKey(),
  analysisId: text("analysis_id").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  paymentId: text("payment_id").references(() => payments.id, { onDelete: "restrict" }),
  product: text("product").notNull(),
  status: text("status").notNull(),
  issuedAt: text("issued_at").notNull(),
  expiresAt: integer("expires_at"),






}, (table) => [uniqueIndex("entitlement_analysis_product_unique").on(table.analysisId, table.product), index("entitlement_user_idx").on(table.userId)]);

export const webhookEvents = sqliteTable("webhook_events", {
  providerEventId: text("provider_event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  payloadHash: text("payload_hash").notNull(),
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
  state: text("state").notNull().default("received"),
  attemptCount: integer("attempt_count").notNull().default(0),
  processingStartedAt: text("processing_started_at"),
  lastErrorCode: text("last_error_code"),
  lastErrorAt: text("last_error_at"),





}, (table) => [
  index("webhook_events_state_received_idx").on(table.state, table.receivedAt),
]);

export const sellerProfiles = sqliteTable("seller_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),






}, (table) => [index("seller_profiles_user_idx").on(table.userId)]);

export const savedCosts = sqliteTable("saved_costs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  profileId: text("profile_id").references(() => sellerProfiles.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  productCostPaise: integer("product_cost_paise").notNull(),
  packagingCostPaise: integer("packaging_cost_paise"),
  variableCostPaise: integer("variable_cost_paise"),
  updatedAt: text("updated_at").notNull(),






}, (table) => [uniqueIndex("saved_cost_user_profile_sku_unique").on(table.userId, table.profileId, table.sku)]);

export const analyses = sqliteTable("analyses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  profileId: text("profile_id").references(() => sellerProfiles.id, { onDelete: "set null" }),
  label: text("label").notNull(),
  summaryJson: text("summary_json").notNull(),
  parserVersion: text("parser_version").notNull(),
  engineVersion: text("engine_version").notNull(),
  createdAt: text("created_at").notNull(),






}, (table) => [index("analyses_user_created_idx").on(table.userId, table.createdAt)]);

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  profileId: text("profile_id").references(() => sellerProfiles.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  sku: text("sku"),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),






}, (table) => [index("alerts_user_status_idx").on(table.userId, table.status)]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(),






});

export const contactRequests = sqliteTable("contact_requests", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
  category: text("category").notNull().default("general"),
  priority: text("priority").notNull().default("normal"),
  assignedTo: text("assigned_to"),
  updatedAt: text("updated_at"),
  resolutionNote: text("resolution_note"),
  resolvedAt: text("resolved_at"),





}, (table) => [index("contact_status_created_idx").on(table.status, table.createdAt),
  index("contact_priority_status_created_idx").on(table.priority, table.status, table.createdAt),
]);

export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey(),
  configJson: text("config_json").notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: text("updated_at").notNull(),






});

export const blogPosts = sqliteTable("blog_posts", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  tag: text("tag").notNull(),
  category: text("category"),
  tagsJson: text("tags_json").notNull().default("[]"),
  keywordsJson: text("keywords_json").notNull().default("[]"),
  imageKey: text("image_key"),
  imageAlt: text("image_alt"),
  imageWidth: integer("image_width"),
  imageHeight: integer("image_height"),
  imageCaption: text("image_caption").notNull().default(""),
  imageCredit: text("image_credit").notNull().default(""),
  htmlContent: text("html_content").notNull(),
  htmlContentEn: text("html_content_en").notNull().default(""),
  status: text("status").notNull().default("draft"),
  featured: integer("featured").notNull().default(0),
  contentType: text("content_type").notNull().default("blog"),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  canonicalUrl: text("canonical_url").notNull().default(""),
  indexable: integer("indexable").notNull().default(1),
  followLinks: integer("follow_links").notNull().default(1),
  discoverEnabled: integer("discover_enabled").notNull().default(1),
  newsEnabled: integer("news_enabled").notNull().default(1),
  preferredSourceCta: integer("preferred_source_cta").notNull().default(1),
  authorName: text("author_name").notNull().default("SellerHisab Research Team"),
  authorUrl: text("author_url").notNull().default("/authors/sellerhisab-research"),
  reviewedAt: text("reviewed_at"),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  sourceUrlsJson: text("source_urls_json").notNull().default("[]"),
  relatedSlugsJson: text("related_slugs_json").notNull().default("[]"),
  localeAlternatesJson: text("locale_alternates_json").notNull().default("[]"),
  videoEnabled: integer("video_enabled").notNull().default(0),
  videoTitle: text("video_title").notNull().default(""),
  videoDescription: text("video_description").notNull().default(""),
  videoThumbnailUrl: text("video_thumbnail_url").notNull().default(""),
  videoEmbedUrl: text("video_embed_url").notNull().default(""),
  videoContentUrl: text("video_content_url").notNull().default(""),
  videoDurationSeconds: integer("video_duration_seconds"),
  videoUploadDate: text("video_upload_date"),




  localeMetadataJson: text("locale_metadata_json").notNull().default("{}"),

}, (table) => [
  uniqueIndex("blog_posts_slug_unique").on(table.slug),
  index("blog_posts_status_published_idx").on(table.status, table.publishedAt),
  index("blog_posts_featured_idx").on(table.featured),
  index("blog_posts_content_type_published_idx").on(table.contentType, table.status, table.publishedAt),
  index("blog_posts_indexable_published_idx").on(table.indexable, table.status, table.publishedAt),
]);

export const seoRedirects = sqliteTable("seo_redirects", {
  id: text("id").primaryKey(),
  fromPath: text("from_path").notNull(),
  toPath: text("to_path").notNull(),
  statusCode: integer("status_code").notNull().default(308),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),






}, (table) => [
  uniqueIndex("seo_redirects_from_path_unique").on(table.fromPath),
  index("seo_redirects_active_updated_idx").on(table.active, table.updatedAt),
]);

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  index("tenants_owner_idx").on(table.ownerUserId),
]);

export const tenantMembers = sqliteTable("tenant_members", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("owner"),
  createdAt: text("created_at").notNull(),






}, (table) => [
  uniqueIndex("tenant_members_tenant_user_unique").on(table.tenantId, table.userId),
  index("tenant_members_user_idx").on(table.userId),
]);

export const legalEntities = sqliteTable("legal_entities", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  gstin: text("gstin"),
  pan: text("pan"),
  countryCode: text("country_code").notNull().default("IN"),
  baseCurrency: text("base_currency").notNull().default("INR"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  index("legal_entities_tenant_idx").on(table.tenantId),
]);

export const channelAccounts = sqliteTable("channel_accounts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  legalEntityId: text("legal_entity_id").references(() => legalEntities.id, { onDelete: "set null" }),
  channelId: text("channel_id").notNull(),
  externalAccountId: text("external_account_id"),
  displayName: text("display_name").notNull(),
  region: text("region").notNull().default("IN"),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  index("channel_accounts_tenant_idx").on(table.tenantId),
  index("channel_accounts_channel_idx").on(table.channelId),
  uniqueIndex("channel_accounts_external_unique").on(table.tenantId, table.channelId, table.region, table.externalAccountId),
]);


export const connectorConnections = sqliteTable("connector_connections", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  channelAccountId: text("channel_account_id").references(() => channelAccounts.id, { onDelete: "set null" }),
  connectorId: text("connector_id").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull().default("not_connected"),
  enabledCapabilitiesJson: text("enabled_capabilities_json").notNull().default("[]"),
  grantedScopesJson: text("granted_scopes_json").notNull().default("[]"),
  lastSyncAt: text("last_sync_at"),
  lastSuccessAt: text("last_success_at"),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  index("connector_connections_tenant_idx").on(table.tenantId),
  index("connector_connections_channel_idx").on(table.channelAccountId),
  index("connector_connections_connector_status_idx").on(table.connectorId, table.status),
]);

export const connectorOauthStates = sqliteTable("connector_oauth_states", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  connectorId: text("connector_id").notNull(),
  stateHash: text("state_hash").notNull(),
  contextJson: text("context_json").notNull().default("{}"),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull(),






}, (table) => [
  uniqueIndex("connector_oauth_states_hash_unique").on(table.stateHash),
  index("connector_oauth_states_user_expiry_idx").on(table.userId, table.expiresAt),
]);

export const connectorCredentials = sqliteTable("connector_credentials", {
  connectionId: text("connection_id").primaryKey().references(() => connectorConnections.id, { onDelete: "cascade" }),
  encryptedPayload: text("encrypted_payload").notNull(),
  iv: text("iv").notNull(),
  keyVersion: text("key_version").notNull().default("v1"),
  expiresAt: integer("expires_at"),
  refreshExpiresAt: integer("refresh_expires_at"),
  updatedAt: text("updated_at").notNull(),






});

export const connectorSyncRuns = sqliteTable("connector_sync_runs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  connectionId: text("connection_id").notNull().references(() => connectorConnections.id, { onDelete: "cascade" }),
  connectorId: text("connector_id").notNull(),
  status: text("status").notNull(),
  coverageStart: text("coverage_start"),
  coverageEnd: text("coverage_end"),
  orderCount: integer("order_count").notNull().default(0),
  financialRecordCount: integer("financial_record_count").notNull().default(0),
  issueCount: integer("issue_count").notNull().default(0),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  errorCode: text("error_code"),
  createdAt: text("created_at").notNull(),
  attemptCount: integer("attempt_count").notNull().default(1),
  nextRetryAt: text("next_retry_at"),
  lastErrorMessage: text("last_error_message"),


  coverageJson: text("coverage_json"),


}, (table) => [
  index("connector_sync_runs_connection_started_idx").on(table.connectionId, table.startedAt),
  index("connector_sync_runs_tenant_started_idx").on(table.tenantId, table.startedAt),
  index("connector_sync_retry_idx").on(table.status, table.nextRetryAt),
]);

export const masterProducts = sqliteTable("master_products", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  brand: text("brand"),
  canonicalCategory: text("canonical_category"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  index("master_products_tenant_idx").on(table.tenantId),
]);

export const productVariants = sqliteTable("product_variants", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  masterProductId: text("master_product_id").notNull().references(() => masterProducts.id, { onDelete: "cascade" }),
  sellerSku: text("seller_sku"),
  gtin: text("gtin"),
  title: text("title"),
  size: text("size"),
  color: text("color"),
  pack: text("pack"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  index("product_variants_tenant_idx").on(table.tenantId),
  index("product_variants_master_idx").on(table.masterProductId),
]);

export const channelListings = sqliteTable("channel_listings", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  channelAccountId: text("channel_account_id").notNull().references(() => channelAccounts.id, { onDelete: "cascade" }),
  productVariantId: text("product_variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  externalListingId: text("external_listing_id").notNull(),
  externalSku: text("external_sku"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  uniqueIndex("channel_listings_external_unique").on(table.channelAccountId, table.externalListingId),
  index("channel_listings_variant_idx").on(table.productVariantId),
]);

export const skuAliases = sqliteTable("sku_aliases", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  productVariantId: text("product_variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  channelAccountId: text("channel_account_id").notNull().references(() => channelAccounts.id, { onDelete: "cascade" }),
  channelListingId: text("channel_listing_id").references(() => channelListings.id, { onDelete: "set null" }),
  aliasType: text("alias_type").notNull(),
  aliasValue: text("alias_value").notNull(),
  confidenceBps: integer("confidence_bps").notNull().default(0),
  source: text("source").notNull().default("import"),
  approvedBy: text("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: text("approved_at"),
  effectiveFrom: text("effective_from"),
  effectiveTo: text("effective_to"),
  createdAt: text("created_at").notNull(),






}, (table) => [
  uniqueIndex("sku_alias_scope_unique").on(table.channelAccountId, table.aliasType, table.aliasValue),
  index("sku_alias_variant_idx").on(table.productVariantId),
]);

export const dataImports = sqliteTable("data_imports", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  channelAccountId: text("channel_account_id").references(() => channelAccounts.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  sourceKind: text("source_kind").notNull(),
  connectorId: text("connector_id").notNull(),
  parserVersion: text("parser_version").notNull(),
  originalFileName: text("original_file_name"),
  sourceFingerprint: text("source_fingerprint").notNull(),
  schemaFingerprint: text("schema_fingerprint"),
  coverageStart: text("coverage_start"),
  coverageEnd: text("coverage_end"),
  status: text("status").notNull().default("completed"),
  issueCount: integer("issue_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
  failedAt: text("failed_at"),
  supersededByImportId: text("superseded_by_import_id"),
  lastErrorCode: text("last_error_code"),





}, (table) => [
  uniqueIndex("data_imports_tenant_fingerprint_unique").on(table.tenantId, table.sourceFingerprint),
  index("data_imports_channel_created_idx").on(table.channelAccountId, table.createdAt),
  index("data_imports_superseded_idx").on(table.supersededByImportId),
  index("data_imports_tenant_status_created_idx").on(table.tenantId, table.status, table.createdAt),
]);

export const commerceLedgerEntries = sqliteTable("commerce_ledger_entries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  legalEntityId: text("legal_entity_id").references(() => legalEntities.id, { onDelete: "set null" }),
  channelAccountId: text("channel_account_id").references(() => channelAccounts.id, { onDelete: "set null" }),
  sourceImportId: text("source_import_id").references(() => dataImports.id, { onDelete: "set null" }),
  orderLineUid: text("order_line_uid"),
  semantic: text("semantic").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  currency: text("currency").notNull().default("INR"),
  occurredAt: text("occurred_at"),
  sourceReferenceJson: text("source_reference_json"),
  reversalOfEntryId: text("reversal_of_entry_id"),
  formulaVersion: text("formula_version"),
  createdAt: text("created_at").notNull(),






}, (table) => [
  index("ledger_tenant_occurred_idx").on(table.tenantId, table.occurredAt),
  index("ledger_channel_occurred_idx").on(table.channelAccountId, table.occurredAt),
  index("ledger_order_line_idx").on(table.orderLineUid),
  index("ledger_source_import_idx").on(table.sourceImportId),
]);

export const actionRecommendations = sqliteTable("action_recommendations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  channelAccountId: text("channel_account_id").references(() => channelAccounts.id, { onDelete: "set null" }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  actionType: text("action_type").notNull(),
  expectedImpactPaise: integer("expected_impact_paise"),
  confidenceBps: integer("confidence_bps").notNull().default(0),
  evidenceJson: text("evidence_json").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  index("actions_tenant_status_idx").on(table.tenantId, table.status),
  index("actions_channel_status_idx").on(table.channelAccountId, table.status),
]);

export const actionOutcomes = sqliteTable("action_outcomes", {
  id: text("id").primaryKey(),
  actionId: text("action_id").notNull().references(() => actionRecommendations.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  outcomeType: text("outcome_type").notNull(),
  measuredImpactPaise: integer("measured_impact_paise"),
  metricsJson: text("metrics_json"),
  measuredAt: text("measured_at").notNull(),
  createdAt: text("created_at").notNull(),






}, (table) => [
  index("action_outcomes_action_idx").on(table.actionId),
  index("action_outcomes_tenant_idx").on(table.tenantId),
]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull(),






}, (table) => [
  index("audit_events_tenant_created_idx").on(table.tenantId, table.createdAt),
  index("audit_events_user_created_idx").on(table.userId, table.createdAt),
]);


export const bankTransactions = sqliteTable("bank_transactions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  sourceImportId: text("source_import_id").notNull().references(() => dataImports.id, { onDelete: "cascade" }),
  rowKey: text("row_key").notNull(),
  transactionFingerprint: text("transaction_fingerprint").notNull(),
  bookedAt: text("booked_at").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  direction: text("direction").notNull(),
  currency: text("currency").notNull().default("INR"),
  reference: text("reference"),
  description: text("description"),
  closingBalancePaise: integer("closing_balance_paise"),
  sourceRow: integer("source_row").notNull(),
  createdAt: text("created_at").notNull(),
  logicalKey: text("logical_key"),
  isActive: integer("is_active").notNull().default(1),
  supersededAt: text("superseded_at"),





}, (table) => [
  uniqueIndex("bank_transactions_import_row_unique").on(table.sourceImportId, table.rowKey),
  uniqueIndex("bank_transactions_tenant_fingerprint_unique").on(table.tenantId, table.transactionFingerprint),
  index("bank_transactions_tenant_booked_idx").on(table.tenantId, table.bookedAt),
  index("bank_transactions_tenant_direction_idx").on(table.tenantId, table.direction),
  index("bank_transactions_tenant_logical_idx").on(table.tenantId, table.logicalKey),
  index("bank_transactions_tenant_active_booked_idx").on(table.tenantId, table.isActive, table.bookedAt),
]);

export const cashMatches = sqliteTable("cash_matches", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  bankTransactionId: text("bank_transaction_id").notNull().references(() => bankTransactions.id, { onDelete: "cascade" }),
  expectedLedgerEntryId: text("expected_ledger_entry_id").notNull().references(() => commerceLedgerEntries.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  matchMethod: text("match_method"),
  expectedPaise: integer("expected_paise").notNull(),
  actualPaise: integer("actual_paise"),
  differencePaise: integer("difference_paise"),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  uniqueIndex("cash_matches_expected_unique").on(table.expectedLedgerEntryId),
  uniqueIndex("cash_matches_bank_unique").on(table.bankTransactionId),
  index("cash_matches_tenant_status_idx").on(table.tenantId, table.status),
]);

export const cashPreferences = sqliteTable("cash_preferences", {
  tenantId: text("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
  currentBalancePaise: integer("current_balance_paise"),
  weeklyFixedOutflowPaise: integer("weekly_fixed_outflow_paise"),
  updatedAt: text("updated_at").notNull(),






});

export const adPerformanceRows = sqliteTable("ad_performance_rows", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  sourceImportId: text("source_import_id").notNull().references(() => dataImports.id, { onDelete: "cascade" }),
  rowKey: text("row_key").notNull(),
  reportDate: text("report_date").notNull(),
  channelId: text("channel_id").notNull(),
  campaignName: text("campaign_name").notNull(),
  campaignId: text("campaign_id"),
  adGroupName: text("ad_group_name"),
  sku: text("sku"),
  spendPaise: integer("spend_paise").notNull(),
  attributedSalesPaise: integer("attributed_sales_paise"),
  attributedOrders: integer("attributed_orders"),
  clicks: integer("clicks"),
  impressions: integer("impressions"),
  currency: text("currency").notNull().default("INR"),
  sourceRow: integer("source_row").notNull(),
  createdAt: text("created_at").notNull(),
  logicalKey: text("logical_key"),
  isActive: integer("is_active").notNull().default(1),
  supersededAt: text("superseded_at"),





}, (table) => [
  uniqueIndex("ad_performance_import_row_unique").on(table.sourceImportId, table.rowKey),
  index("ad_performance_tenant_date_idx").on(table.tenantId, table.reportDate),
  index("ad_performance_tenant_channel_idx").on(table.tenantId, table.channelId),
  index("ad_performance_tenant_campaign_idx").on(table.tenantId, table.campaignName),
  index("ad_performance_tenant_logical_idx").on(table.tenantId, table.logicalKey),
  index("ad_performance_tenant_active_date_idx").on(table.tenantId, table.isActive, table.reportDate),
]);

export const adPreferences = sqliteTable("ad_preferences", {
  tenantId: text("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
  preAdMarginBps: integer("pre_ad_margin_bps"),
  returnLossBps: integer("return_loss_bps").notNull().default(0),
  updatedAt: text("updated_at").notNull(),






});

export const inventoryPositionRows = sqliteTable("inventory_position_rows", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  sourceImportId: text("source_import_id").notNull().references(() => dataImports.id, { onDelete: "cascade" }),
  rowKey: text("row_key").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  channelId: text("channel_id").notNull(),
  sku: text("sku").notNull(),
  masterSku: text("master_sku"),
  productName: text("product_name"),
  availableUnits: integer("available_units").notNull(),
  inboundUnits: integer("inbound_units"),
  unitsSold30d: integer("units_sold_30d"),
  leadTimeDays: integer("lead_time_days"),
  unitCostPaise: integer("unit_cost_paise"),
  contributionMarginBps: integer("contribution_margin_bps"),
  location: text("location"),
  sourceRow: integer("source_row").notNull(),
  createdAt: text("created_at").notNull(),
  logicalKey: text("logical_key"),
  isActive: integer("is_active").notNull().default(1),
  supersededAt: text("superseded_at"),





}, (table) => [
  uniqueIndex("inventory_position_import_row_unique").on(table.sourceImportId, table.rowKey),
  index("inventory_position_tenant_date_idx").on(table.tenantId, table.snapshotDate),
  index("inventory_position_tenant_channel_sku_idx").on(table.tenantId, table.channelId, table.sku),
  index("inventory_position_tenant_master_sku_idx").on(table.tenantId, table.masterSku),
  index("inventory_position_tenant_logical_idx").on(table.tenantId, table.logicalKey),
  index("inventory_position_tenant_active_date_idx").on(table.tenantId, table.isActive, table.snapshotDate),
]);

export const inventoryPreferences = sqliteTable("inventory_preferences", {
  tenantId: text("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
  defaultLeadTimeDays: integer("default_lead_time_days").notNull().default(14),
  safetyDays: integer("safety_days").notNull().default(7),
  targetCoverDays: integer("target_cover_days").notNull().default(30),
  overstockDays: integer("overstock_days").notNull().default(120),
  updatedAt: text("updated_at").notNull(),






});

export const workspacePreferences = sqliteTable("workspace_preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  activeTenantId: text("active_tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  index("workspace_preferences_tenant_idx").on(table.activeTenantId),
]);

export const workspaceInvites = sqliteTable("workspace_invites", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  tokenHash: text("token_hash").notNull(),
  invitedByUserId: text("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  acceptedAt: text("accepted_at"),






}, (table) => [
  uniqueIndex("workspace_invites_token_unique").on(table.tokenHash),
  index("workspace_invites_tenant_status_idx").on(table.tenantId, table.status),
  index("workspace_invites_email_status_idx").on(table.email, table.status),
]);

export const actionWorkflows = sqliteTable("action_workflows", {
  actionId: text("action_id").primaryKey().references(() => actionRecommendations.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assignedToUserId: text("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
  approvalRequired: integer("approval_required").notNull().default(0),
  approvalStatus: text("approval_status").notNull().default("not_required"),
  requestedByUserId: text("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
  requestedAt: text("requested_at"),
  approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: text("approved_at"),
  rejectedByUserId: text("rejected_by_user_id").references(() => users.id, { onDelete: "set null" }),
  rejectedAt: text("rejected_at"),
  rejectionNote: text("rejection_note"),
  completedByUserId: text("completed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  index("action_workflows_tenant_approval_idx").on(table.tenantId, table.approvalStatus),
  index("action_workflows_assignee_idx").on(table.assignedToUserId),
]);

export const benchmarkPreferences = sqliteTable("benchmark_preferences", {
  tenantId: text("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
  contributeEnabled: integer("contribute_enabled").notNull().default(0),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: text("updated_at").notNull(),






}, (table) => [
  index("benchmark_preferences_contribute_idx").on(table.contributeEnabled),
]);

export const billingAuditEvents = sqliteTable("billing_audit_events", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  paymentId: text("payment_id").references(() => payments.id, { onDelete: "set null" }),
  subscriptionId: text("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  providerEventId: text("provider_event_id"),
  eventType: text("event_type").notNull(),
  state: text("state").notNull(),
  detailJson: text("detail_json"),
  createdAt: text("created_at").notNull(),





}, (table) => [
  index("billing_audit_provider_event_idx").on(table.providerEventId),
  index("billing_audit_user_created_idx").on(table.userId, table.createdAt),
]);

export const subscriptionPaymentEvents = sqliteTable("subscription_payment_events", {
  id: text("id").primaryKey().notNull(),
  subscriptionId: text("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  providerPaymentId: text("provider_payment_id").notNull(),
  eventType: text("event_type").notNull(),
  amountPaise: integer("amount_paise"),
  currency: text("currency"),
  status: text("status").notNull(),
  occurredAt: text("occurred_at").notNull(),





}, (table) => [
  index("subscription_payment_subscription_occurred_idx").on(table.subscriptionId, table.occurredAt),
  uniqueIndex("subscription_payment_provider_unique").on(table.providerPaymentId),
]);

export const ledgerEntryRevisions = sqliteTable("ledger_entry_revisions", {
  id: text("id").primaryKey().notNull(),
  ledgerEntryId: text("ledger_entry_id").notNull(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sourceImportId: text("source_import_id"),
  semantic: text("semantic").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  currency: text("currency").notNull(),
  occurredAt: text("occurred_at"),
  sourceReferenceJson: text("source_reference_json"),
  replacedAt: text("replaced_at").notNull(),





}, (table) => [
  index("ledger_revisions_tenant_replaced_idx").on(table.tenantId, table.replacedAt),
  index("ledger_revisions_entry_replaced_idx").on(table.ledgerEntryId, table.replacedAt),
]);

export const supportRequestEvents = sqliteTable("support_request_events", {
  id: text("id").primaryKey().notNull(),
  supportRequestId: text("support_request_id").notNull().references(() => contactRequests.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  detailJson: text("detail_json"),
  createdAt: text("created_at").notNull(),





}, (table) => [
  index("support_events_request_created_idx").on(table.supportRequestId, table.createdAt),
]);

export const accountDeletionReceipts = sqliteTable("account_deletion_receipts", {
  id: text("id").primaryKey().notNull(),
  userHash: text("user_hash").notNull(),
  requestedAt: text("requested_at").notNull(),
  completedAt: text("completed_at").notNull(),
  retainedCategoriesJson: text("retained_categories_json").notNull(),
  deletedCategoriesJson: text("deleted_categories_json").notNull(),





}, (table) => [
  index("account_deletion_receipts_completed_idx").on(table.completedAt),
]);

export const connectorSyncJobs = sqliteTable("connector_sync_jobs", {
  id: text("id").primaryKey().notNull(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  connectionId: text("connection_id").notNull().references(() => connectorConnections.id, { onDelete: "cascade" }),
  requestedByUserId: text("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
  days: integer("days").notNull().default(30),
  status: text("status").notNull().default("queued"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  nextAttemptAt: text("next_attempt_at").notNull(),
  processingStartedAt: text("processing_started_at"),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),

  logicalKey: text("logical_key"),
  checkpointJson: text("checkpoint_json"),
  coverageJson: text("coverage_json"),
  leaseToken: text("lease_token"),


}, (table) => [
  index("connector_sync_jobs_connection_created_idx").on(table.connectionId, table.createdAt),
  index("connector_sync_jobs_due_idx").on(table.status, table.nextAttemptAt),
  uniqueIndex("connector_sync_jobs_logical_unique").on(table.logicalKey),
]);

export const billingTrialSettings = sqliteTable("billing_trial_settings", {
  plan: text("plan").primaryKey().notNull(),
  enabled: integer("enabled").notNull().default(0),
  trialDays: integer("trial_days").notNull().default(3),
  updatedAt: text("updated_at").notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),





});

export const billingTrialClaims = sqliteTable("billing_trial_claims", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  subscriptionId: text("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "restrict" }),
  providerSubscriptionId: text("provider_subscription_id").notNull(),
  plan: text("plan").notNull(),
  trialDays: integer("trial_days").notNull(),
  trialStartedAt: text("trial_started_at"),
  trialEndsAt: integer("trial_ends_at").notNull(),
  status: text("status").notNull().default("checkout_pending"),
  autoPayStatus: text("auto_pay_status").notNull().default("pending"),
  checkoutEmail: text("checkout_email"),
  checkoutPhone: text("checkout_phone"),
  providerLastStatus: text("provider_last_status"),
  firstChargePaymentId: text("first_charge_payment_id"),
  convertedAt: text("converted_at"),
  failedAt: text("failed_at"),
  cancelledAt: text("cancelled_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),





}, (table) => [
  index("billing_trial_claims_plan_created_idx").on(table.plan, table.createdAt),
  index("billing_trial_claims_status_end_idx").on(table.status, table.trialEndsAt),
  uniqueIndex("billing_trial_claims_provider_unique").on(table.providerSubscriptionId),
  uniqueIndex("billing_trial_claims_user_unique").on(table.userId),
]);

export const billingEventJobs = sqliteTable("billing_event_jobs", {
  eventId: text("event_id").primaryKey().notNull().references(() => webhookEvents.providerEventId, { onDelete: "cascade" }),
  payloadJson: text("payload_json").notNull(),
  state: text("state").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: text("next_attempt_at").notNull(),
  leaseToken: text("lease_token"),
  leaseUntil: text("lease_until"),
  errorCode: text("error_code"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),



}, (table) => [
  index("billing_event_jobs_due_idx").on(table.state, table.nextAttemptAt),
]);

export const paymentIntents = sqliteTable("payment_intents", {
  id: text("id").primaryKey().notNull(),
  analysisId: text("analysis_id").notNull(),
  product: text("product").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  amountPaise: integer("amount_paise").notNull(),
  currency: text("currency").notNull(),
  state: text("state").notNull().default("creating"),
  providerOrderId: text("provider_order_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),



}, (table) => [
  uniqueIndex("payment_intents_provider_unique").on(table.providerOrderId),
  uniqueIndex("payment_intents_purchase_unique").on(table.analysisId, table.product),
]);

export const connectorPageReceipts = sqliteTable("connector_page_receipts", {
  id: text("id").primaryKey().notNull(),
  jobId: text("job_id").notNull().references(() => connectorSyncJobs.id, { onDelete: "cascade" }),
  pageKey: text("page_key").notNull(),
  createdAt: text("created_at").notNull(),


}, (table) => [
  uniqueIndex("connector_page_receipts_job_page_unique").on(table.jobId, table.pageKey),
]);

export const connectorNotifications = sqliteTable("connector_notifications", {
  id: text("id").primaryKey().notNull(),
  connectionId: text("connection_id").notNull().references(() => connectorConnections.id, { onDelete: "cascade" }),
  receivedAt: text("received_at").notNull(),
  historyDays: integer("history_days").notNull(),
  jobId: text("job_id").references(() => connectorSyncJobs.id, { onDelete: "set null" }),
  state: text("state").notNull().default("queued"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("connector_notifications_due_idx").on(table.state, table.receivedAt),
]);
