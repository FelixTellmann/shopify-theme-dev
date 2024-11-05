import path from "path";

import { createRequire } from "module";
export const require = createRequire(import.meta.url);
