# تصميم GitHub Actions

## مبدأ

تُصمم workflows قبل تنفيذها، وتستخدم least-privilege permissions وpinned action SHAs أو إصدارات موثقة، وتمنع secrets في fork PRs. لا ينشر workflow release إلا من tag محمي وبعد نجاح كل gates.

## الملفات المقترحة

```text
.github/workflows/
  ci.yml
  security.yml
  build-desktop.yml
  release.yml
  docs.yml
  dependency-review.yml
```

## CI

`ci.yml` يشغل format، lint، typecheck، unit، integration، migration، وcontract tests على Ubuntu. matrix إضافي يختبر Node/Python versions المدعومة، ويستخدم cache lockfile. يرفع test reports وcoverage كـ artifacts.

## Security

`security.yml` يشغل secret scan، dependency audit، license report، CodeQL أو SAST متاح، وcontainer scan عند وجود images. `dependency-review.yml` يمنع license أو severity غير مصرح بهما، مع allowlist موثق.

## build desktop

`build-desktop.yml` يستخدم matrix `{ubuntu-latest, windows-latest}` في MVP، ثم `macos-latest` بعد تفعيل signing. يبني core/workers، يثبت native deps، يعبئ Electron، يشغل packaged smoke، ويرفع artifacts مع SHA-256. يستهدف Windows NSIS/MSI وLinux AppImage/deb، وفق النمط الظاهر في Hermes Desktop [1].

## release

`release.yml` يشتغل على tag `v*`, يعيد build من clean checkout، يتحقق من git SHA، يولد SBOM وnotices وchangelog، ثم ينشر GitHub Release draft. يحتاج approval environment قبل publish. لا ينشر artifacts غير signed إذا كانت سياسة الإصدار تتطلب signing.

## docs

`docs.yml` يتحقق من Markdown links، Mermaid syntax، JSON schemas، traceability references، وعدم وجود **UNKNOWN** غير موسوم. يضمن أن الملفات المطلوبة موجودة وأن `PROJECT_STATUS.md` محدث.

## branch protection

تُطلب status checks، review واحد على الأقل، وعدم السماح force push إلى main. لا تستخدم self-hosted runners غير موثوقة لبيانات حساسة. workflows نفسها تمر بمراجعة أمنية، لأن GitHub Actions جزء من supply chain.

## معايير القبول

تُقبل بنية CI عندما تنجح على clean checkout، وتنتج artifact قابلًا للتثبيت على Windows/Linux، وتثبت أن secret scan لا يقرأ قيمًا حقيقية، وتفشل بوضوح عند missing OpenTo contract بدل بناء تكامل وهمي.

## References / المراجع

[1]: https://github.com/NousResearch/hermes-agent/blob/main/apps/desktop/package.json "Hermes packaging targets"
[2]: https://docs.github.com/en/actions "GitHub Actions documentation"
[3]: https://github.com/ossf/scorecard "OpenSSF Scorecard"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
