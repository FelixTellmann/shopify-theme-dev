import fs from "fs";
import path from "path";

export const initThemeFolders = (folder: string) => {
  /*= =============== Root Folder ================ */
  if (!fs.existsSync(path.join(process.cwd(), folder))) {
    fs.mkdirSync(path.join(process.cwd(), folder), { recursive: true });
  }

  /*= =============== Theme ================ */

  if (!fs.existsSync(path.join(process.cwd(), folder, "assets"))) {
    fs.mkdirSync(path.join(process.cwd(), folder, "assets"), { recursive: true });
  }
  if (!fs.existsSync(path.join(process.cwd(), folder, "locales"))) {
    fs.mkdirSync(path.join(process.cwd(), folder, "locales"), { recursive: true });
  }
  if (!fs.existsSync(path.join(process.cwd(), folder, "config"))) {
    fs.mkdirSync(path.join(process.cwd(), folder, "config"), { recursive: true });
  }
  if (!fs.existsSync(path.join(process.cwd(), folder, "layout"))) {
    fs.mkdirSync(path.join(process.cwd(), folder, "layout"), { recursive: true });
  }
  if (!fs.existsSync(path.join(process.cwd(), folder, "sections"))) {
    fs.mkdirSync(path.join(process.cwd(), folder, "sections"), { recursive: true });
  }
  if (!fs.existsSync(path.join(process.cwd(), folder, "snippets"))) {
    fs.mkdirSync(path.join(process.cwd(), folder, "snippets"), { recursive: true });
  }
  if (!fs.existsSync(path.join(process.cwd(), folder, "templates"))) {
    fs.mkdirSync(path.join(process.cwd(), folder, "templates"), { recursive: true });
  }
  if (!fs.existsSync(path.join(process.cwd(), folder, "templates", "customers"))) {
    fs.mkdirSync(path.join(process.cwd(), folder, "templates", "customers"), { recursive: true });
  }
};
