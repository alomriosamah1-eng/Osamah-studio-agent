# معمارية Preview Sharing وBrowser Validation وExternal Integrations

**الحالة:** تحليل معماري موثق؛ لا يوجد تنفيذ tunnel أو Playwright أو OAuth أو MCP في المستودع.

## 1. القرار العام

لا يُربط Osamah Studio Agent بمزود خارجي واحد داخل core. يُنشأ لكل فئة `Port` مستقل، ويكون التطبيق local-only افتراضيًا. أي مشاركة أو حساب خارجي أو browser automation أو tool call يحتاج provider adapter وconsent وaudit وrevoke/cancel ومسار فشل معزول. لا تعمل هذه القدرات عند startup ولا تُحمّل credentials إلى renderer أو prompt.

## 2. Preview Sharing وPort Forwarding

```text
Workspace Preview
  → PreviewSharePort
  → Share Policy + Human Gate
  → Provider Adapter
  → outbound tunnel process
  → loopback local service
  → PreviewShareSession(status/expiry/revoke)
  → Audit event
```

| العقد المقترح | الحقول/الحدود |
|---|---|
| `PreviewShareRequest` | `projectId`, `localPort`, `visibility`, `authMode`, `ttl`, `providerId`؛ لا token |
| `PreviewShareSession` | `sessionId`, `providerId`, `localPort`, `publicUrl`, `visibility`, `createdAt`, `expiresAt`, `status`, `auditId` |
| `PreviewSharePort` | `create`, `status`, `revoke`, `expire`; جميعها typed وقابلة للإلغاء |
| Policy | disabled/private default، loopback-only origin، TTL bounded، public يتطلب Human Gate |
| Evidence | provider/version/status/error code؛ لا credentials أو raw headers |

### مقارنة الخيارات

| الخيار | ملاءمة | حدود القرار |
|---|---|---|
| VS Code Dev Tunnels | private افتراضيًا وauth بحساب GitHub/Microsoft، public اختياري [1] | مناسب لبيئة فريق مرتبطة بحساب؛ يحتاج account/provider validation |
| Cloudflare Tunnel | outbound-only وhostname عام دون public IP/inbound port [2] | مناسب لdomain/Access مؤسسي؛ يحتاج account و`cloudflared` وسياسة egress |
| ngrok | outbound TLS وpublic URL أثناء endpoint وTraffic Policy [3] [4] | سريع للتجارب؛ SaaS/limits/public exposure يجب إظهاره للمستخدم |
| Tailscale Serve/Funnel | Serve داخل tailnet وFunnel عام عبر HTTPS مع start/stop/status [5] | مناسب لشبكة خاصة؛ Funnel العام ليس default |
| LocalTunnel | لم يُثبت في مصادر المشروع ولا configuration | `UNVERIFIED`، لا يضاف بلا audit مستقل |

**توصية:** ابدأ abstraction فقط. إذا قرر المالك preview sharing، فابدأ provider واحدًا في dev-only أو private mode، مع human confirmation، TTL قصير، explicit revoke، وعدم تشغيل project scripts. لا يعاد استخدام `providerGateway` الخاص بالنماذج لتجنب خلط privacy/capability semantics.

## 3. Playwright Worker

لا توجد Playwright dependency أو config حاليًا. إذا اعتمدت لاحقًا، تكون dev/test worker وليست قدرة agent عامة. يدعم Playwright baseURL وstorageState وdevice/locale/timezone/permissions emulation وoffline/network controls، كما يدعم screenshots/videos/traces [6]. يمكن تفعيل trace عند أول retry أو عند الفشل فقط لتقليل كلفة الموارد [7].

```text
QA Agent
  → TestPlan (origin allowlist, fixtures, assertions, data policy)
  → BrowserContext (headless, isolated, timeout)
  → Preview / approved share URL
  → Evidence (bounded assertions + screenshot/trace)
  → TestResult
  → Quality Director / Human Reviewer
```

الحدود الإلزامية: origin allowlist، headless افتراضي، `acceptDownloads=false`، no arbitrary navigation، no credentials in storageState، no trace upload تلقائي، trace/screenshot only-on-failure، network mock/offline mode عند الإمكان، timeout/cancellation، cap على evidence، وHuman Gate للإرسال/الحذف/المشاركة/النشر. لا يثبت وجود Playwright في المشروع الآن؛ هذه architecture future فقط.

## 4. OAuth 2.0/OIDC للحسابات الخارجية

```text
User
  → Main-process Auth Coordinator
  → System Browser / external user-agent
  → Authorization Endpoint
  → exact loopback redirect (random local port)
  → one-time code + state
  → PKCE S256 token exchange
  → OS keychain/encrypted profile
  → scoped Integration Adapter
  → Agent Capability Check
  → External API
  → Audit / Revoke / Disconnect
```

RFC 8252 يوصي external user-agent للتطبيقات native ويفرض PKCE على public clients، ويعرض loopback أو claimed HTTPS أو private-use redirect بحسب المنصة [8]. توضح Google أن installed apps لا تستطيع حماية client secrets، وتستخدم system browser وauthorization code وPKCE و`state` وتبادل access/refresh tokens [9].

| متطلب | سياسة المشروع المقترحة |
|---|---|
| redirect | loopback `127.0.0.1` على random port في Desktop، exact match فقط |
| PKCE | S256، verifier cryptographically random، لا logs |
| state | random، single-use، short TTL، validation قبل code exchange |
| token storage | OS secure storage أو encrypted profile بعد قرار platform؛ لا renderer/SQLite plain |
| scopes | أقل صلاحية، per-service، incremental approval حسب دعم provider |
| account identity | issuer + subject + provider + account label؛ لا email وحده كمفتاح |
| refresh/revoke | typed lifecycle وdisconnect يمسح السر ويكتب audit metadata بلا token |
| consent | عرض service/scopes/agent/action/resource قبل authorization |
| errors | auth denied/expired/revoked/mismatch/offline مفصولة ولا تسرب raw response |

### Google least-privilege baseline

المصفوفة التالية مرشح تصميم وليست scope approval نهائيًا. يجب التحقق من كل method وGoogle Cloud project وreview requirement قبل التنفيذ.

| الخدمة | بداية القراءة/الملف المقترحة | ما يجب تجنبه افتراضيًا |
|---|---|---|
| Drive | `drive.file` عندما يكفي per-file access [10] | `drive` و`drive.readonly` الشاملان |
| Sheets | `drive.file` إن كان per-file كافيًا، أو `spreadsheets.readonly` للقراءة [11] | `spreadsheets` write الشامل |
| Calendar | `calendar.readonly` أو events-owned/readonly بحسب method | `calendar` العام |
| Gmail | `gmail.readonly`، و`gmail.send` فقط لعملية إرسال واضحة | `mail.google.com` |
| Docs | `documents.readonly` للقراءة، و`documents` للكتابة المبررة | edit/delete بلا confirmation |
| Slides | `presentations.readonly` ثم write عند الحاجة | publish/share تلقائي |
| Meet | scope API-specific بعد التحقق | تخمين scope من Calendar/Drive |
| Cloud | service-specific read-only | `cloud-platform` العام |

Google توضح أن scopes قد تكون non-sensitive أو sensitive أو restricted، وأن الأقل صلاحية يقلل المراجعة والمخاطر [12] [13]. Drive وSheets يوضحان أن `drive.file` قد يضيق الوصول إلى الملفات التي اختارها المستخدم، بينما الوصول الشامل مقيد وحساس [10] [11]. لا يستطيع Agent استنتاج الوصول من token؛ يفحص capability grant وresource scope في كل request.

## 5. MCP / Tool Router

```text
Agent
  → Tool Router (agent capability + user consent + resource scope)
  → MCP Client Worker
  → MCP Server / Connector
  → JSON-RPC tools/list / tools/call
  → schema validation + output labeling
  → audit + result to Agent
```

MCP يعرّف Host/Client/Server فوق JSON-RPC، وresources/prompts/tools، وprogress/cancellation، مع اشتراط consent والتحكم البشري وعدم نقل البيانات دون موافقة [14]. مواصفة tools توصي بإظهار الأدوات ومدخلاتها وHuman-in-the-loop والتحقق من النتائج والمهلات والتدقيق [15].

قبل التنفيذ، يجب فرض server identity وallowlist وcapability negotiation وinput/output schemas وpagination وtimeout/cancellation وrate limits. كما يجب منع token passthrough، والتحقق من audience، ومنع SSRF إلى private IPs، ومعالجة confused deputy وstate-handle hijacking وlocal server compromise وفق إرشادات MCP الأمنية [16].

## 6. مصفوفة الوصول حسب Agent

| الدور | الوصول الأولي المقترح | ممنوع افتراضيًا |
|---|---|---|
| Research | Source Registry وapproved search read | إرسال/نشر/تعديل حساب |
| Documentation/Report | Drive/Docs/Sheets read أو per-file write بعد preview | مشاركة/حذف/إرسال |
| Project Manager | Calendar read ثم create event بعد approval | تعديل صلاحيات الحساب |
| Development | Git read-only وlocal filesystem bounded | push/deploy/native toolchain |
| QA | Playwright على origins allowlisted | login credentials/download/upload |
| Integration Admin | connector health/config metadata | تشغيل tool نيابة عن Agent دون consent |
| Security/Quality | audit/policy evidence | override policy أو قبول exception ذاتيًا |

## 7. متطلبات الاختبار قبل أي connector

يجب إضافة contract tests لـdisabled/offline، malformed payload، unknown provider/tool، scope mismatch، consent denial، token expiry/revocation، account switching، redirect/state mismatch، SSRF/private IP، rate limit، timeout/cancel، audit redaction، duplicate idempotency، provider crash، TTL/revoke، وno startup network. لا يبدأ التنفيذ قبل وجود test fixture لا يحتاج حسابًا حقيقيًا، ولا تُحفظ tokens أو traces أو user files في Git.

## 8. قرارات مطلوبة

يجب أن يقرر المالك هل preview sharing جزء من MVP، وما provider الأول، وهل الحسابات الخارجية مطلوبة قبل beta، وأي Google APIs تبدأ، وهل Playwright dev-only، وهل MCP local-only أم remote، وما مستوى autonomy. حتى تُحسم هذه النقاط، يبقى التنفيذ `MISSING` والتحليل `DOCUMENTED ONLY`.

## المراجع

[1]: https://code.visualstudio.com/docs/debugtest/port-forwarding "VS Code Port Forwarding"
[2]: https://developers.cloudflare.com/tunnel/ "Cloudflare Tunnel"
[3]: https://ngrok.com/docs/guides/share-localhost/tunnels "ngrok Secure Tunnels"
[4]: https://ngrok.com/docs/gateway/traffic-policy "ngrok Traffic Policy"
[5]: https://tailscale.com/docs/reference/tailscale-cli/funnel "Tailscale Funnel CLI"
[6]: https://playwright.dev/docs/test-use-options "Playwright configuration"
[7]: https://playwright.dev/docs/trace-viewer "Playwright Trace Viewer"
[8]: https://datatracker.ietf.org/doc/html/rfc8252 "RFC 8252 OAuth 2.0 for Native Apps"
[9]: https://developers.google.com/identity/protocols/oauth2/native-app "Google OAuth 2.0 for iOS & Desktop Apps"
[10]: https://developers.google.com/workspace/drive/api/guides/api-specific-auth "Google Drive API scopes"
[11]: https://developers.google.com/workspace/sheets/api/scopes "Google Sheets API scopes"
[12]: https://developers.google.com/identity/protocols/oauth2/scopes "OAuth 2.0 Scopes for Google APIs"
[13]: https://developers.google.com/workspace/guides/configure-oauth-consent "Google OAuth consent screen and scopes"
[14]: https://modelcontextprotocol.io/specification/2026-07-28 "MCP Specification 2026-07-28"
[15]: https://modelcontextprotocol.io/specification/2025-06-18/server/tools "MCP Tools"
[16]: https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices "MCP Security Best Practices"

إعداد: Manus AI. لا تمثل هذه الوثيقة تنفيذًا أو credential configuration.
