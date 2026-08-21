# DEPENDENCY_MAP

## فعلية

| dependency | الغرض | الحالة |
|---|---|---|
| TypeScript | type system/build check | مثبت |
| tsx | تشغيل اختبارات TypeScript | مثبت |
| @types/node | types للاختبارات والـ runtime | مثبت |

## مخططة عبر adapters

Electron، SQLite، React/React Native Web، Metro، Expo CLI، Git/gh، Android SDK/ADB، Xcode/simctl، providers، وMCP. لا تضاف أي dependency قبل license/security/maintenance review وتحديث `project/open-source-components.json` وSBOM.

## القاعدة

Domain لا يستورد dependency خارجية. Application يستورد types محلية. Infrastructure فقط يملك vendor imports.
