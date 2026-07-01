export const buildInfo = {
  version: __LUX_APP_VERSION__,
  buildId: __LUX_BUILD_ID__,
  buildTime: __LUX_BUILD_TIME__
} as const;

export function exposeBuildInfo() {
  document.documentElement.dataset.luxAppVersion = buildInfo.version;
  document.documentElement.dataset.luxBuildId = buildInfo.buildId;
}
