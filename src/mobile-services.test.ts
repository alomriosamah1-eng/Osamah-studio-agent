import assert from "node:assert/strict";
import test from "node:test";
import { MobileProjectDetector, PlatformCapabilityService } from "./application/mobile-services.js";

test("detects an Expo project without executing project scripts", async () => {
  const detector = new MobileProjectDetector({
    async listRelativeFiles() { return ["package.json", "app.json", "metro.config.js", "src/App.tsx"]; },
    async readText() { return undefined; },
    async readJson() { return { dependencies: { expo: "^53.0.0", "react-native-web": "^0.21.0" }, main: "expo-router/entry" }; },
  });
  const descriptor = await detector.detect("/workspace/mobile");
  assert.equal(descriptor.kind, "expo");
  assert.equal(descriptor.hasMetroConfig, true);
  assert.equal(descriptor.supportsWeb, true);
  assert.equal(descriptor.hasAndroidFolder, false);
});

test("detects bare React Native project and native folders", async () => {
  const detector = new MobileProjectDetector({
    async listRelativeFiles() { return ["package.json", "android", "ios", "src/App.tsx"]; },
    async readText() { return undefined; },
    async readJson() { return { dependencies: { "react-native": "0.82.0" } }; },
  });
  const descriptor = await detector.detect("/workspace/rn");
  assert.equal(descriptor.kind, "react-native");
  assert.equal(descriptor.hasAndroidFolder, true);
  assert.equal(descriptor.hasIosFolder, true);
});

test("never exposes native iOS simulator on Windows/Linux", () => {
  const service = new PlatformCapabilityService();
  assert.equal(service.inspect("windows").iosNativeSimulator, "unsupported");
  assert.equal(service.inspect("linux").iosNativeSimulator, "unsupported");
  assert.equal(service.inspect("macos").iosNativeSimulator, "available-if-toolchain");
  assert.equal(service.inspect("windows").lightweightPreview, true);
});
