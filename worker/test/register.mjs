// Permet à Node de résoudre les imports TypeScript sans extension pendant les tests.
import { register } from "node:module";
register("./resolve.mjs", import.meta.url);
