export type AgentExecutionStatus = "bounded_capability" | "definition_only" | "not_implemented";
export type AgentDecisionAuthority = "suggest" | "review" | "approve" | "apply";
export type AgentMemoryVisibility = "private" | "workspace" | "project";
export type AgentMemoryRetention = "session" | "project" | "until_deleted";
export type AgentProviderAccess = "never" | "explicit_only";

export interface AgentMemoryRequirements {
  readonly visibility: AgentMemoryVisibility;
  readonly retention: AgentMemoryRetention;
  readonly providerAccess: AgentProviderAccess;
}

export interface AgentDefinition {
  readonly schemaVersion: 1;
  readonly agentId: string;
  readonly role: string;
  readonly mission: string;
  readonly responsibilities: readonly string[];
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly tools: readonly string[];
  readonly permissions: readonly string[];
  readonly knowledgeSources: readonly string[];
  readonly dependencies: readonly string[];
  readonly upstream: readonly string[];
  readonly downstream: readonly string[];
  readonly decisionAuthority: AgentDecisionAuthority;
  readonly validationCriteria: readonly string[];
  readonly failureHandling: readonly string[];
  readonly handoffProtocol: string;
  readonly memoryRequirements: AgentMemoryRequirements;
  readonly reportingRequirements: readonly string[];
  readonly securityBoundaries: readonly string[];
  readonly humanApprovalRequirements: readonly string[];
  readonly executionStatus: AgentExecutionStatus;
}

export interface AgentCatalogPort {
  list(limit?: number): readonly AgentDefinition[];
  get(agentId: string): AgentDefinition | undefined;
}

export class AgentCatalogError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AgentCatalogError";
  }
}

const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const boundedText = (value: string, field: string, maxLength: number): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || trimmed.includes("\0") || trimmed.includes("\r") || trimmed.includes("\n")) {
    throw new AgentCatalogError(`${field} is invalid.`);
  }
  return trimmed;
};

const boundedList = (values: readonly string[], field: string, maxItems: number, maxLength: number): readonly string[] => {
  if (!Array.isArray(values) || values.length > maxItems) throw new AgentCatalogError(`${field} exceeds bounded limits.`);
  return values.map((value) => boundedText(value, field, maxLength));
};

const uniqueList = (values: readonly string[], field: string, maxItems: number, maxLength: number): readonly string[] => {
  const bounded = boundedList(values, field, maxItems, maxLength);
  if (new Set(bounded).size !== bounded.length) throw new AgentCatalogError(`${field} contains duplicates.`);
  return bounded;
};

export const validateAgentDefinition = (definition: AgentDefinition): AgentDefinition => {
  if (!definition || definition.schemaVersion !== 1) throw new AgentCatalogError("Agent definition schemaVersion is invalid.");
  const agentId = boundedText(definition.agentId, "agentId", 128);
  if (!safeId.test(agentId)) throw new AgentCatalogError("agentId must be a safe lowercase identifier.");
  boundedText(definition.role, "role", 256);
  boundedText(definition.mission, "mission", 2_000);
  uniqueList(definition.responsibilities, "responsibilities", 16, 512);
  uniqueList(definition.inputs, "inputs", 16, 512);
  uniqueList(definition.outputs, "outputs", 16, 512);
  uniqueList(definition.tools, "tools", 32, 256);
  uniqueList(definition.permissions, "permissions", 32, 256);
  uniqueList(definition.knowledgeSources, "knowledgeSources", 32, 512);
  uniqueList(definition.dependencies, "dependencies", 16, 128);
  uniqueList(definition.upstream, "upstream", 16, 128);
  uniqueList(definition.downstream, "downstream", 16, 128);
  if (!["suggest", "review", "approve", "apply"].includes(definition.decisionAuthority)) throw new AgentCatalogError("decisionAuthority is invalid.");
  uniqueList(definition.validationCriteria, "validationCriteria", 16, 512);
  uniqueList(definition.failureHandling, "failureHandling", 16, 512);
  boundedText(definition.handoffProtocol, "handoffProtocol", 256);
  if (!definition.memoryRequirements || !["private", "workspace", "project"].includes(definition.memoryRequirements.visibility)) throw new AgentCatalogError("memory visibility is invalid.");
  if (!["session", "project", "until_deleted"].includes(definition.memoryRequirements.retention)) throw new AgentCatalogError("memory retention is invalid.");
  if (!["never", "explicit_only"].includes(definition.memoryRequirements.providerAccess)) throw new AgentCatalogError("memory provider access is invalid.");
  uniqueList(definition.reportingRequirements, "reportingRequirements", 16, 512);
  uniqueList(definition.securityBoundaries, "securityBoundaries", 16, 512);
  uniqueList(definition.humanApprovalRequirements, "humanApprovalRequirements", 16, 512);
  if (!["bounded_capability", "definition_only", "not_implemented"].includes(definition.executionStatus)) throw new AgentCatalogError("executionStatus is invalid.");
  return definition;
};

interface DefinitionSpec {
  readonly agentId: string;
  readonly role: string;
  readonly mission: string;
  readonly responsibilities: readonly string[];
  readonly executionStatus: AgentExecutionStatus;
  readonly tools?: readonly string[];
  readonly permissions?: readonly string[];
}

const makeDefinition = (spec: DefinitionSpec): AgentDefinition => ({
  schemaVersion: 1,
  agentId: spec.agentId,
  role: spec.role,
  mission: spec.mission,
  responsibilities: spec.responsibilities,
  inputs: ["approved.task_context"],
  outputs: ["reviewable.result", "evidence.refs", "open_questions"],
  tools: spec.tools ?? [],
  permissions: spec.permissions ?? [],
  knowledgeSources: ["local.project_context", "approved.source_records"],
  dependencies: [],
  upstream: [],
  downstream: [],
  decisionAuthority: "suggest",
  validationCriteria: ["schema_valid", "evidence_present", "scope_unchanged"],
  failureHandling: ["fail_closed", "bounded_retry_once", "escalate_to_human"],
  handoffProtocol: "handoff.v1.reviewable_packet",
  memoryRequirements: { visibility: "private", retention: "session", providerAccess: "never" },
  reportingRequirements: ["result", "evidence", "assumptions", "next_recommendation"],
  securityBoundaries: ["no_raw_secrets", "no_unapproved_network", "no_external_side_effects", "no_policy_override"],
  humanApprovalRequirements: ["filesystem.write", "terminal.exec", "git.commit", "github.push", "browser.submit", "media.publish"],
  executionStatus: spec.executionStatus,
});

const specs: readonly DefinitionSpec[] = [
  { agentId: "ceo-master-orchestrator", role: "CEO / Master Orchestrator", mission: "ترتيب الأهداف وتصعيد التعارضات دون تنفيذ مباشر.", responsibilities: ["تحديد نطاق workflow", "تصعيد التعارضات", "حماية حدود الاستقلال"], executionStatus: "definition_only" },
  { agentId: "program-manager", role: "Program Manager", mission: "تحويل الأهداف إلى milestones واعتماديات قابلة للمراجعة.", responsibilities: ["إدارة milestones", "تسجيل dependencies", "تحديد ownership"], executionStatus: "definition_only" },
  { agentId: "quality-director", role: "Quality Director", mission: "فرض evidence ومعايير القبول قبل التسليم.", responsibilities: ["تعريف quality gates", "رفض الناتج بلا evidence", "تصعيد فشل القبول"], executionStatus: "definition_only" },
  { agentId: "idea-research", role: "Idea Research Agent", mission: "تنظيم أسئلة الفكرة ومصادرها دون تحويلها إلى حقائق.", responsibilities: ["صياغة أسئلة البحث", "تسجيل مصادر مقترحة", "تمييز unknowns"], executionStatus: "not_implemented" },
  { agentId: "market-research", role: "Market Research Agent", mission: "جمع أدلة السوق القابلة للمراجعة ضمن نطاق موافق عليه.", responsibilities: ["تعريف market scope", "تلخيص مصادر السوق", "تسجيل confidence"], executionStatus: "not_implemented" },
  { agentId: "competitor-intelligence", role: "Competitor Intelligence Agent", mission: "بناء مقارنة منافسين موثقة بالمصادر.", responsibilities: ["تعريف competitor set", "مقارنة القدرات", "تسجيل source provenance"], executionStatus: "not_implemented" },
  { agentId: "customer-research", role: "Customer Research Agent", mission: "تنظيم أدلة احتياجات المستخدمين مع حماية الخصوصية.", responsibilities: ["تصنيف feedback", "استخراج themes", "منع كشف بيانات المقابلات"], executionStatus: "not_implemented" },
  { agentId: "problem-validation", role: "Problem Validation Agent", mission: "اختبار فرضيات المشكلة مقابل الأدلة المسجلة.", responsibilities: ["تعريف hypothesis", "مقارنة evidence", "إظهار unresolved claims"], executionStatus: "not_implemented" },
  { agentId: "business-model", role: "Business Model Agent", mission: "صياغة بدائل نموذج العمل وفرضياتها للمراجعة.", responsibilities: ["تسجيل business assumptions", "مقارنة البدائل", "تحديد المخاطر"], executionStatus: "not_implemented" },
  { agentId: "feasibility-study", role: "Feasibility Study Agent", mission: "تنظيم فحص الجدوى التقنية والتشغيلية والقانونية.", responsibilities: ["تقسيم محاور الجدوى", "ربط الأدلة", "تسجيل open decisions"], executionStatus: "not_implemented" },
  { agentId: "financial-analyst", role: "Financial Analyst Agent", mission: "إعداد تحليل مالي قابل للتدقيق دون توصيات تنفيذية غير معتمدة.", responsibilities: ["تنظيم inputs المالية", "إظهار assumptions", "منع claims غير المدعومة"], executionStatus: "not_implemented" },
  { agentId: "pricing-strategy", role: "Pricing Strategy Agent", mission: "مقارنة فرضيات التسعير وقيودها.", responsibilities: ["تعريف pricing hypotheses", "مقارنة sensitivity", "تسجيل evidence"], executionStatus: "not_implemented" },
  { agentId: "legal-compliance", role: "Legal & Compliance Agent", mission: "تنظيم مسائل الترخيص والامتثال للتدقيق البشري.", responsibilities: ["تحديد legal questions", "فحص license records", "تصعيد المسائل القانونية"], executionStatus: "definition_only" },
  { agentId: "risk-management", role: "Risk Management Agent", mission: "تجميع المخاطر والمالكين وإجراءات التخفيف.", responsibilities: ["تسجيل risks", "تحديد owners", "متابعة mitigations"], executionStatus: "definition_only" },
  { agentId: "brand-strategist", role: "Brand Strategist Agent", mission: "تنظيم مبادئ العلامة ومخرجاتها القابلة للمراجعة.", responsibilities: ["صياغة brand brief", "تسجيل constraints", "ربط evidence"], executionStatus: "not_implemented" },
  { agentId: "naming-identity", role: "Naming & Identity Agent", mission: "اقتراح أسماء وهوية مع سجل قرارات ومخاطر.", responsibilities: ["إنشاء alternatives", "تسجيل collision questions", "طلب review"], executionStatus: "not_implemented" },
  { agentId: "ux-research", role: "UX Research Agent", mission: "تحويل أدلة الاستخدام إلى insights قابلة للمراجعة.", responsibilities: ["تصنيف UX evidence", "صياغة findings", "إظهار uncertainty"], executionStatus: "definition_only" },
  { agentId: "product-strategist", role: "Product Strategist Agent", mission: "ربط أهداف المنتج بالأولويات والقيود.", responsibilities: ["اقتراح priorities", "تسجيل tradeoffs", "إعداد decision inputs"], executionStatus: "definition_only" },
  { agentId: "requirements-engineer", role: "Requirements Engineer Agent", mission: "تنظيم المتطلبات ومعايير القبول والتغييرات.", responsibilities: ["تسجيل requirement IDs", "كشف التناقضات", "حماية traceability"], executionStatus: "definition_only" },
  { agentId: "product-owner", role: "Product Owner Agent", mission: "اقتراح ترتيب الأولويات دون اعتماد نهائي تلقائي.", responsibilities: ["ترتيب backlog", "تعريف acceptance inputs", "تصعيد scope changes"], executionStatus: "definition_only" },
  { agentId: "system-architect", role: "System Architect Agent", mission: "صياغة بدائل المعمارية وحدودها وقراراتها.", responsibilities: ["تحديد boundaries", "مقارنة alternatives", "إعداد ADR inputs"], executionStatus: "definition_only" },
  { agentId: "technical-research", role: "Technical Research Agent", mission: "جمع مصادر تقنية أولية وتسجيل تاريخ الفحص.", responsibilities: ["تسجيل source records", "مقارنة implementation options", "تحديد freshness"], executionStatus: "definition_only" },
  { agentId: "technology-selection", role: "Technology Selection Agent", mission: "مقارنة التقنيات والتبعيات وفق معايير قابلة للتدقيق.", responsibilities: ["تقييم alternatives", "تسجيل license status", "اقتراح TDR"], executionStatus: "definition_only" },
  { agentId: "data-architect", role: "Data Architect Agent", mission: "تنظيم نماذج البيانات والهجرة والخصوصية.", responsibilities: ["تحديد entities", "مراجعة persistence boundaries", "تسجيل retention"], executionStatus: "definition_only" },
  { agentId: "api-architect", role: "API Architect Agent", mission: "حماية عقود typed IPC وواجهات التكامل.", responsibilities: ["تحديد schemas", "رفض payloads غير الصالحة", "حفظ backward compatibility"], executionStatus: "bounded_capability", tools: ["ipc.contract.review", "schema.validate"], permissions: ["contract.read", "contract.review"] },
  { agentId: "ui-ux-designer", role: "UI/UX Designer Agent", mission: "تنظيم تدفقات الواجهة ومخرجاتها القابلة للمراجعة.", responsibilities: ["تعريف user flows", "تسجيل accessibility needs", "اقتراح layout"], executionStatus: "definition_only" },
  { agentId: "design-system", role: "Design System Agent", mission: "اقتراح tokens وأنماط واجهة متسقة.", responsibilities: ["تسجيل design tokens", "كشف inconsistency", "تعريف component constraints"], executionStatus: "definition_only" },
  { agentId: "accessibility", role: "Accessibility Agent", mission: "فحص متطلبات الوصول وإظهار gaps دون نشر تغييرات.", responsibilities: ["تعريف accessibility checks", "تسجيل findings", "تصعيد blockers"], executionStatus: "definition_only" },
  { agentId: "responsive-cross-platform", role: "Responsive & Cross-Platform Agent", mission: "تنظيم مصفوفة التوافق دون ادعاء native fidelity.", responsibilities: ["تعريف capability matrix", "تسجيل platform gaps", "اقتراح fallbacks"], executionStatus: "definition_only" },
  { agentId: "frontend-engineer", role: "Frontend Engineer Agent", mission: "تنفيذ حدود واجهة bounded بعد موافقة واضحة.", responsibilities: ["اقتراح UI patch", "مراجعة safe DOM", "إخراج diff قابل للمراجعة"], executionStatus: "bounded_capability", tools: ["file.read", "editor.diff.preview"], permissions: ["filesystem.read", "editor.propose"] },
  { agentId: "backend-engineer", role: "Backend Engineer Agent", mission: "تنظيم خدمات Application وInfrastructure خلف ports.", responsibilities: ["اقتراح service changes", "مراجعة ports", "إخراج tests evidence"], executionStatus: "bounded_capability", tools: ["context.index", "editor.diff.preview"], permissions: ["filesystem.read", "editor.propose"] },
  { agentId: "mobile-engineer", role: "Mobile Engineer Agent", mission: "حماية preview compatibility ومواءمة مشاريع الهاتف دون native execution.", responsibilities: ["مراجعة project classification", "اقتراح preview mapping", "تسجيل unsupported capabilities"], executionStatus: "bounded_capability", tools: ["preview.inspect", "context.index"], permissions: ["filesystem.read", "preview.inspect"] },
  { agentId: "database-engineer", role: "Database Engineer Agent", mission: "مراجعة migrations وpersistence boundaries دون تعديل migration منشورة.", responsibilities: ["فحص schema", "اقتراح migration جديدة", "تسجيل backup/restore evidence"], executionStatus: "bounded_capability", tools: ["sqlite.schema.inspect", "migration.validate"], permissions: ["database.read", "migration.propose"] },
  { agentId: "integration-engineer", role: "Integration Engineer Agent", mission: "تصميم adapters خارجية خلف consent وpolicy.", responsibilities: ["تحديد connector boundary", "مراجعة capability scopes", "اقتراح failure isolation"], executionStatus: "definition_only" },
  { agentId: "devops-infrastructure", role: "DevOps / Infrastructure Agent", mission: "تنظيم CI/CD والموارد والتوزيع دون نشر تلقائي.", responsibilities: ["مراجعة workflow", "تسجيل resource budgets", "اقتراح release checks"], executionStatus: "definition_only" },
  { agentId: "package-dependency", role: "Package & Dependency Agent", mission: "تدقيق lockfile والتراخيص والتحديثات دون تعديل تلقائي.", responsibilities: ["مراجعة dependency graph", "تسجيل license status", "اقتراح upgrades"], executionStatus: "definition_only" },
  { agentId: "qa-testing", role: "QA & Testing Agent", mission: "تنظيم الاختبارات والأدلة قبل التسليم.", responsibilities: ["تعريف test plan", "مراجعة gate outputs", "تسجيل regressions"], executionStatus: "bounded_capability", tools: ["test.plan.review", "evidence.collect"], permissions: ["test.read", "evidence.read"] },
  { agentId: "security", role: "Security Agent", mission: "فحص حدود الأسرار والصلاحيات والعزل دون override للسياسة.", responsibilities: ["مراجعة threat boundaries", "كشف secret-shaped data", "تصعيد high-risk findings"], executionStatus: "bounded_capability", tools: ["policy.inspect", "audit.redaction.review"], permissions: ["security.read", "audit.read"] },
  { agentId: "code-review-best-practices", role: "Code Review & Best Practices Agent", mission: "مراجعة diff والمعايير دون تطبيق التعديل.", responsibilities: ["مراجعة diff", "كشف violations", "إخراج review comments"], executionStatus: "definition_only" },
  { agentId: "performance-engineer", role: "Performance Engineer Agent", mission: "قياس latency والذاكرة ضمن low-memory budget.", responsibilities: ["مراجعة performance smoke", "تسجيل regression", "اقتراح bounded optimization"], executionStatus: "bounded_capability", tools: ["performance.smoke.inspect", "resource.policy.inspect"], permissions: ["performance.read"] },
  { agentId: "documentation", role: "Documentation Agent", mission: "اقتراح تحديثات موثقة لا تغيّر status أو التاريخ بلا مراجعة.", responsibilities: ["فحص stale summaries", "اقتراح doc diff", "حماية traceability"], executionStatus: "definition_only" },
  { agentId: "technical-report", role: "Technical Report Agent", mission: "تنظيم تقارير تقنية evidence-based.", responsibilities: ["تجميع evidence", "إظهار assumptions", "إنتاج report draft"], executionStatus: "definition_only" },
  { agentId: "business-report", role: "Business Report Agent", mission: "تنظيم تقارير business مع فصل الفرضيات عن الحقائق.", responsibilities: ["تعريف report inputs", "تسجيل claims", "إظهار unresolved questions"], executionStatus: "not_implemented" },
  { agentId: "decision-log", role: "Decision Log Agent", mission: "حفظ القرارات وبدائلها وأدلتها بصورة قابلة للتتبع.", responsibilities: ["إنشاء decision draft", "تسجيل alternatives", "ربط approval"], executionStatus: "definition_only" },
  { agentId: "handover", role: "Handover Agent", mission: "إعداد حزمة تسليم قابلة لإعادة التشغيل لمطور أو وكيل لاحق.", responsibilities: ["تجميع state", "تسجيل SHAs", "فحص open risks"], executionStatus: "definition_only" },
  { agentId: "technology-intelligence", role: "Research / Latest Technology Intelligence Agent", mission: "تحديث المقارنات التقنية مع freshness وlicense evidence.", responsibilities: ["تسجيل source dates", "مقارنة alternatives", "اقتراح TDR دون upgrade تلقائي"], executionStatus: "definition_only" },
];

export const defaultAgentDefinitions: readonly AgentDefinition[] = specs.map(makeDefinition);

export class InMemoryAgentCatalog implements AgentCatalogPort {
  private readonly definitions: ReadonlyMap<string, AgentDefinition>;

  public constructor(definitions: readonly AgentDefinition[] = defaultAgentDefinitions) {
    if (definitions.length === 0 || definitions.length > 64) throw new AgentCatalogError("Agent catalog must contain between 1 and 64 definitions.");
    const entries = definitions.map((definition) => {
      const validated = validateAgentDefinition(definition);
      return [validated.agentId, validated] as const;
    });
    if (new Set(entries.map(([agentId]) => agentId)).size !== entries.length) throw new AgentCatalogError("Agent catalog contains duplicate agent IDs.");
    this.definitions = new Map(entries);
  }

  public list(limit = 64): readonly AgentDefinition[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 64) throw new AgentCatalogError("Agent catalog limit is invalid.");
    return [...this.definitions.values()].slice(0, limit);
  }

  public get(agentId: string): AgentDefinition | undefined {
    if (typeof agentId !== "string" || !safeId.test(agentId) || agentId.length > 128) return undefined;
    return this.definitions.get(agentId);
  }
}

export const agentCatalogContract = {
  mutatesFilesystem: false,
  executesCommands: false,
  invokesProviders: false,
  requiresHumanGateForMutation: true,
  executionStatusIsExplicit: true,
} as const;
