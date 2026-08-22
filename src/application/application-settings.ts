export type ApplicationLocale = "ar" | "en";
export type ApplicationTheme = "light" | "dark";
export type ApplicationDensity = "comfortable" | "compact";
export type ApplicationDirection = "rtl" | "ltr";

export interface ApplicationSettings {
  readonly version: 1;
  readonly locale: ApplicationLocale;
  readonly direction: ApplicationDirection;
  readonly theme: ApplicationTheme;
  readonly fontScale: number;
  readonly density: ApplicationDensity;
  readonly reduceMotion: boolean;
}

export interface UpdateApplicationSettingsRequest {
  readonly locale?: ApplicationLocale;
  readonly theme?: ApplicationTheme;
  readonly fontScale?: number;
  readonly density?: ApplicationDensity;
  readonly reduceMotion?: boolean;
}

export interface ApplicationSettingsPort {
  get(): ApplicationSettings;
  update(request: UpdateApplicationSettingsRequest): ApplicationSettings;
}

export const DEFAULT_APPLICATION_SETTINGS: ApplicationSettings = Object.freeze({
  version: 1,
  locale: "ar",
  direction: "rtl",
  theme: "dark",
  fontScale: 1,
  density: "comfortable",
  reduceMotion: false,
});

const isValidFontScale = (value: number): boolean => value >= 0.9 && value <= 1.25 && Math.abs(value * 20 - Math.round(value * 20)) < 1e-9;

const assertUpdate = (request: UpdateApplicationSettingsRequest): void => {
  if (request.locale !== undefined && request.locale !== "ar" && request.locale !== "en") throw new Error("unsupported locale");
  if (request.theme !== undefined && request.theme !== "light" && request.theme !== "dark") throw new Error("unsupported theme");
  if (request.fontScale !== undefined && !Number.isFinite(request.fontScale)) throw new Error("fontScale must be finite");
  if (request.fontScale !== undefined && !isValidFontScale(request.fontScale)) throw new Error("fontScale is outside the bounded range");
  if (request.density !== undefined && request.density !== "comfortable" && request.density !== "compact") throw new Error("unsupported density");
  if (request.reduceMotion !== undefined && typeof request.reduceMotion !== "boolean") throw new Error("reduceMotion must be boolean");
}

export class InMemoryApplicationSettings implements ApplicationSettingsPort {
  private settings: ApplicationSettings = DEFAULT_APPLICATION_SETTINGS;

  get(): ApplicationSettings {
    return this.settings;
  }

  update(request: UpdateApplicationSettingsRequest): ApplicationSettings {
    assertUpdate(request);
    const locale = request.locale ?? this.settings.locale;
    this.settings = Object.freeze({
      version: 1,
      locale,
      direction: locale === "ar" ? "rtl" : "ltr",
      theme: request.theme ?? this.settings.theme,
      fontScale: request.fontScale ?? this.settings.fontScale,
      density: request.density ?? this.settings.density,
      reduceMotion: request.reduceMotion ?? this.settings.reduceMotion,
    });
    return this.settings;
  }
}
