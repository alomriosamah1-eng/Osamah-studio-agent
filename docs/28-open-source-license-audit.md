# تدقيق التراخيص

## قاعدة التدقيق

Open Source لا يعني «بلا قيود». يسجل المشروع لكل dependency الاسم والإصدار وSPDX وsource وredistribution obligations وcopyleft exposure وnotice requirement. يجب تشغيل license scanner على lockfiles الفعلية قبل release؛ هذه المذكرة Discovery وليست رأيًا قانونيًا.

## المكونات ذات المخاطر الأقل نسبيًا

| المشروع | الترخيص الظاهر | الاستخدام المقترح | الملاحظة |
|---|---|---|---|
| OpenCode | MIT | adapter/reference | احتفظ بإشعار MIT وأي third-party notices |
| Hermes | MIT | adapter/reference | exact dependencies تحتاج فحصًا منفصلًا |
| OmniRoute | MIT | reference/adapter | package يحوي dependencies كثيرة؛ لا يكفي ترخيص root |
| DeepSeek Harness | MIT | reference/adapter | `THIRD_PARTY_NOTICES.md` إلزامي |
| Electron | MIT | runtime | Chromium/Node/dep notices وتحديثات أمنية |
| Tauri | MIT/Apache-2.0 | future shell | راجع كل crate وWebView terms |
| Playwright | Apache-2.0 | browser worker | browsers binaries وشروطها منفصلة |
| Qdrant/LanceDB | Apache-2.0 | optional data | راجع bindings والتوزيع |
| Whisper/faster-whisper/Piper/Silero | MIT ظاهر للمستودع | optional voice | أوزان النماذج قد تحمل شروطًا مختلفة |
| GitHub CLI/Gitleaks/Trivy | MIT/Apache-2.0 | tools/CI | احتفظ notices وتحقق من binaries |

## مكونات copyleft أو تحتاج مراجعة

| المكون | الترخيص snapshot | الخطر | القرار |
|---|---|---|---|
| OpenViking | AGPL-3.0 | copyleft عند توزيع/خدمة | لا embed في MVP |
| SearXNG | AGPL-3.0 | copyleft وتغييرات التوزيع | self-hosted optional بعد legal review |
| Logseq/AppFlowy | AGPL-3.0 | core code غير مناسب للنسخ التجاري غير المدروس | reference only |
| ComfyUI | GPL-3.0 | integration/redistribution obligations | worker منفصل أو بديل permissive |
| LibreOffice | GPL-3.0 | conversion distribution obligations | process optional بعد review |
| Pandoc | GPL-2.0 | distribution/linking obligations | process أو بديل |
| AutoGen | CC-BY-4.0 metadata | attribution/terms لا تشبه software permissive تلقائيًا | legal review |
| n8n/Windmill/MCP SDK metadata | NOASSERTION snapshot | لا يكفي field في GitHub API | فحص LICENSE/NOTICE قبل أي استخدام |
| FFmpeg | field غير محسوم في snapshot | codec/build configuration وLGPL/GPL variants | build profile + legal review |

## التبعية العميقة

MIT root لا يجعل كل dependencies MIT. يجب توليد SBOM CycloneDX أو SPDX، وفحص transitive dependencies، وتسجيل package lock hashes. لا ينسخ Osamah source files من مشروع مرجعي إلا بترخيص وإشعار واضحين. لا تستخدم model weights أو voices قبل فحص model card وcommercial-use status.

## سياسة release

كل release يرفق `THIRD_PARTY_NOTICES.md`, `SBOM`, وlicense report. يمنع CI merges التي تضيف license غير مصرح بها. يفتح `LEGAL_REVIEW_REQUIRED` عندما تكون license غير معروفة أو copyleft قريبًا من core أو عندما تكون model weights غير واضحة.

## References / المراجع

[1]: https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/THIRD_PARTY_NOTICES.md "OmniRoute third-party notices"
[2]: https://github.com/deepseek-ai/deepseek-harness/blob/master/THIRD_PARTY_NOTICES.md "DeepSeek Harness third-party notices"
[3]: https://spdx.org/licenses/ "SPDX License List"
[4]: https://github.com/FFmpeg/FFmpeg "FFmpeg repository"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
