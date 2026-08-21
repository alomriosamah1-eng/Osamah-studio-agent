# Production Studio

## المبدأ

Production Studio ينسق **content plan → assets → assembly → render → validation → export**. لا يولد مستندًا طويلًا في context واحد، ولا يخلط source discovery مع final copy دون provenance.

## العروض

يبدأ العرض بـ outline وslide schema وtheme. كل slide يملك title، body، visual spec، source refs، speaker notes، وlayout constraints. يمر عبر render ثم overflow/contrast/empty-space checks. يدعم PPTX/HTML/Markdown export حسب capability. عدد الشرائح غير محدود منطقيًا عبر jobs متعددة، لكن كل run يملك حدًا وcheckpoint.

## المستندات

يستقبل PDF/DOCX/XLSX/PPTX/Markdown/TXT/CSV. العمليات الأساسية create/edit/merge/split/reorder/extract/summarize/rewrite/cite/export. يستعمل converters في workers مثل Pandoc/qpdf/pdfcpu/LibreOffice وفق license policy؛ لا يربط المكتبات ذات copyleft داخل core التجاري قبل المراجعة [1] [2] [3] [4].

## الصور والفيديو

الصورة generation/editing اختيارية عبر local ComfyUI أو provider remote، مع حفظ prompt/model/license/provenance. الفيديو في MVP يعني editing/transcoding/subtitles/transcription/voice-over عبر FFmpeg، لا video generation شاملة. كل media job يملك resource budget، temp directory، وcleanup.

## البحث الأكاديمي

يستخدم النظام مراحل: source discovery، source validation، claim extraction، outline، section generation، citation check، consistency review، assembly، pagination، final render. يحفظ كل claim مع source span وconfidence. لا يسمح بإسناد مرجع لم تتم قراءته.

## الجودة

critic agent يدقق factual claims وcitations، وformat validator يدقق overflow/encoding/RTL. final output يحمل manifest بالمصادر والإصدارات والأدوات المستخدمة. عند فشل converter يعرض fallback وسببًا، لا يكتب ملفًا ناقصًا على أنه مكتمل.

## References / المراجع

[1]: https://github.com/jgm/pandoc "Pandoc repository"
[2]: https://github.com/qpdf/qpdf "qpdf repository"
[3]: https://github.com/pdfcpu/pdfcpu "pdfcpu repository"
[4]: https://github.com/LibreOffice/core "LibreOffice repository"
[5]: https://github.com/FFmpeg/FFmpeg "FFmpeg repository"
[6]: https://github.com/Comfy-Org/ComfyUI "ComfyUI repository"

إعداد: Manus AI. تاريخ الفحص: 2026-08-21.
