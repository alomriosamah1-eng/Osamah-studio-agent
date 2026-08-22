import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_APPLICATION_SETTINGS, InMemoryApplicationSettings } from "./application/application-settings.js";

test("application settings default to Arabic RTL dark comfortable local preferences", () => {
  const settings = new InMemoryApplicationSettings().get();
  assert.deepEqual(settings, DEFAULT_APPLICATION_SETTINGS);
  assert.equal(settings.locale, "ar");
  assert.equal(settings.direction, "rtl");
  assert.equal(settings.theme, "dark");
  assert.equal(settings.fontScale, 1);
  assert.equal(settings.density, "comfortable");
});

test("application settings update derives direction and preserves unspecified fields", () => {
  const settings = new InMemoryApplicationSettings();
  const updated = settings.update({ locale: "en", theme: "light", fontScale: 1.25, density: "compact", reduceMotion: true });
  assert.deepEqual(updated, { version: 1, locale: "en", direction: "ltr", theme: "light", fontScale: 1.25, density: "compact", reduceMotion: true });
  const partial = settings.update({ locale: "ar", fontScale: 1.1 });
  assert.equal(partial.direction, "rtl");
  assert.equal(partial.theme, "light");
  assert.equal(partial.density, "compact");
  assert.equal(partial.reduceMotion, true);
});

test("application settings reject unsupported values and keep last valid snapshot", () => {
  const settings = new InMemoryApplicationSettings();
  const before = settings.get();
  assert.throws(() => settings.update({ locale: "fr" as never }), /unsupported locale/);
  assert.throws(() => settings.update({ theme: "system" as never }), /unsupported theme/);
  assert.throws(() => settings.update({ fontScale: 1.03 }), /bounded range/);
  assert.throws(() => settings.update({ fontScale: 1.3 }), /bounded range/);
  assert.throws(() => settings.update({ density: "spacious" as never }), /unsupported density/);
  assert.deepEqual(settings.get(), before);
});

export const applicationSettingsContract = {
  defaultLocale: "ar",
  defaultDirection: "rtl",
  mutatesFilesystem: false,
  invokesProviders: false,
  requiresHumanGate: false,
} as const;
