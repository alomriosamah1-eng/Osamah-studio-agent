# مصادر التدقيق الخارجي — 2026-08-22

هذا الملف يسجل فقط الأدلة الخارجية التي تم الرجوع إليها أثناء تدقيق Osamah Studio Agents. لا يُعد أي مصدر دليلًا على تنفيذ ميزة داخل المستودع؛ التنفيذ يُثبت من الكود والاختبارات وGit فقط.

## Port Forwarding وTunneling

1. [VS Code Port Forwarding](https://code.visualstudio.com/docs/debugtest/port-forwarding): يوضح أن VS Code يستخدم Microsoft dev tunnels، وأن المنفذ يكون Private افتراضيًا ويتطلب تسجيل دخول الحساب نفسه، بينما Public لا يتطلب تسجيل دخول؛ يذكر أيضًا أن الاتصالات outbound إلى Azure ولا تحتاج عادةً فتح جدار ناري، ويحذر من نشر معلومات سرية على المنافذ العامة. صفحة المصدر مؤرخة 2026-08-19.
2. [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/): يصف اتصالًا outbound-only عبر `cloudflared`، وربط hostname عام بخدمة محلية دون public IP أو inbound ports، مع إمكانات Cloudflare مثل WAF وDDoS؛ لا يثبت وجود connector داخل هذا المستودع.
3. [ngrok Secure Tunnels](https://ngrok.com/docs/guides/share-localhost/tunnels): يصف agent ينشئ اتصال TLS outbound، ويُنشئ public URL مؤقتًا أثناء عمل endpoint، مع Traffic Policy للمصادقة وrate limiting وغيرها.
4. [ngrok Traffic Policy](https://ngrok.com/docs/gateway/traffic-policy): يذكر actions للمصادقة، وrate-limit، وJWT/OAuth/OIDC، والفلترة وإعادة كتابة URLs؛ هذه قدرات provider خارجية يجب عزلها خلف adapter.
5. [Tailscale Funnel CLI](https://tailscale.com/docs/reference/tailscale-cli/funnel): يصف نشر خدمة محلية عبر HTTPS مع شهادة TLS تلقائية، ويبين أن `tailscale serve` مناسب للمشاركة داخل tailnet، وأن Funnel العام يمكن تشغيله/إيقافه وحالته عبر CLI. صفحة المصدر validated 2026-01-26.

## Playwright

6. [Playwright configuration](https://playwright.dev/docs/test-use-options): يثبت إمكانات baseURL وstorageState وdevice/locale/timezone/permissions emulation وoffline/network options وscreenshots/video/traces، مع تفضيل `screenshot: only-on-failure` و`trace: on-first-retry` في أمثلة التوثيق.
7. [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer): يثبت وجود DOM snapshots وaction logs وsource locations وconsole/network/metadata/attachments، وأن Trace Viewer المحلي يتيح فحص الأدلة؛ يجب عدم رفع traces التي تحتوي بيانات حساسة دون redaction.

## OAuth 2.0 وGoogle

8. [RFC 8252 — OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252): يوصي باستخدام external user-agent، ويفرض PKCE على public native clients، ويعرض redirect عبر claimed HTTPS أو loopback أو private-use scheme مع اعتبارات أمنية.
9. [Google OAuth 2.0 for iOS & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app): يوضح أن installed apps لا تستطيع حفظ secrets، وتفتح system browser، وتستخدم authorization code وPKCE؛ يوضح code verifier بطول 43–128، S256 الموصى به، `state` لمقاومة CSRF، scope consent، وتبادل code إلى access/refresh tokens. كما يذكر تفعيل APIs وإنشاء credentials من Google Cloud Console.

## MCP

10. [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28): يصف Hosts/Clients/Servers فوق JSON-RPC، وresources/prompts/tools، وprogress/cancellation، ويشدد على consent والتحكم البشري وعدم إرسال بيانات المستخدم دون موافقة ومعاملة tool annotations كبيانات غير موثوقة.
11. [MCP Security Best Practices 2026-07-28](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices): يذكر مخاطر confused deputy وtoken passthrough وSSRF وstate-handle hijacking وlocal server compromise، ويشدد على per-client consent، exact redirect matching، state single-use، audience validation، منع private IP SSRF، وربط handles بالمستخدم.
12. [MCP Tools 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/server/tools): يثبت `tools/list` و`tools/call` وpagination وinput/output schema، ويوصي دائمًا بوجود human-in-the-loop، وإظهار الأدوات ومدخلاتها، والتحقق من النتائج، والمهلات والتدقيق.

## ملاحظة حالة

هذه الأدلة تدعم توصيات معمارية مستقبلية فقط. لا يوجد في `package.json` الحالي dependency لـPlaywright أو tunnel provider أو Google OAuth أو MCP client، ولا يجوز تصنيفها كمنفذة لمجرد إدراجها في الخطة أو سياسة open-source.
13. [Google OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes): يوضح تصنيف scopes إلى non-sensitive/sensitive/restricted وأن الأقل صلاحية أفضل، وأن التطبيقات العامة قد تحتاج verification.
14. [Google OAuth Consent Screen](https://developers.google.com/workspace/guides/configure-oauth-consent): يثبت ضرورة consent screen واختيار أقل scope مطلوب، مع مراجعة إضافية للنطاقات الحساسة والمقيدة؛ الصفحة محدثة 2026-07-22.
15. [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth): يبين أن Cloud Console تحدد سقف scopes الممكنة والكود يحدد scopes الجلسة، ويوصي `drive.file` عندما يكفي بدل الوصول الشامل، ويشرح الحاجة إلى تخزين refresh tokens في secure long-term storage.
16. [Google Sheets API scopes](https://developers.google.com/workspace/sheets/api/scopes): يوضح أن Sheets scopes تنطبق على ملف spreadsheet ولا تُقيد بورقة منفردة، ويوصي `drive.file` عند ملاءمته، ويصنف `spreadsheets.readonly` و`spreadsheets` كـ sensitive و`drive` كـ restricted.
