I have refactored the frontend to support hot reloading for configuration changes and added the missing background image configuration.

### Changes Implemented:

1.  **Refactored Components to Use Config**:
    -   Updated `LeftPanel.tsx` to read titles, subtitles, icons, aspect ratios, and resolutions from `appConfig.ts`.
    -   Updated `RightPanel.tsx` to read the gallery title and subtitle from `appConfig.ts`.
    -   Updated `App.tsx` to use `appConfig.ui.colors.background` and `appConfig.ui.backgroundImage`.

2.  **Expanded Configuration**:
    -   Added a `gallery` section to `appConfig.json` and `appConfig.ts` to support the RightPanel text.
    -   Updated `appConfig.json` background color to `transparent` by default to preserve the existing mesh gradient, while allowing it to be overridden.

3.  **Enabled Hot Reload**:
    -   By importing `appConfig.json` into the React components (via `appConfig.ts`), Vite's HMR (Hot Module Replacement) will now automatically reload the UI whenever `appConfig.json` is modified.

### Verification:
-   Configured `appConfig.json` changes will now instantly reflect in the browser without a full reload.
-   The background image can be set in `appConfig.json` under `ui.backgroundImage`.
-   The background color can be set in `appConfig.json` under `ui.colors.background`.