# MOBILE_SIMULATOR_MAP

| المكون | المسؤولية | Windows/Linux | macOS | الحالة |
|---|---|---|---|---|
| DeviceProfile | geometry/theme/safe-area/orientation | نعم | نعم | Domain منفذ |
| LightweightPreview | Web/React Native Web compatibility | نعم | نعم | مخطط |
| MetroAdapter | bundle/Fast Refresh/logs | نعم | نعم | مخطط |
| AndroidAdapter | SDK/AVD/ADB/install/run/log/screenshot | نعم عند doctor pass | نعم | مخطط |
| IOSAdapter | Xcode/simctl/build/run/log | غير متاح native | نعم | مخطط/macOS-only |
| PhysicalDeviceAdapter | device transport | حسب toolchain | حسب toolchain | مخطط |
| EASAdapter | remote build/update | نعم | نعم | مخطط |
| AIInspector | screenshot/semantic tree/logs | preview/native بحسب target | preview/native بحسب target | مخطط |
| VisualLoop | compare/patch/refresh/bounded retry | نعم | نعم | مخطط |

راجع `docs/33-mobile-development-architecture.md` و`research/mobile-research-findings-01.md` لكل قرار أو claim خارجي.
