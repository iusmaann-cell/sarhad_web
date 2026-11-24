// Copies the MapLibre web worker into the app's public folder, so the map can
// load it from the same origin. Run from an app folder (see its build script).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("maplibre-gl/package.json"));
const dest = join(process.cwd(), "public", "maplibre");
mkdirSync(dest, { recursive: true });
copyFileSync(join(pkg, "dist", "maplibre-gl-worker.mjs"), join(dest, "maplibre-gl-worker.mjs"));
