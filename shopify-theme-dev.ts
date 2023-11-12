#!/usr/bin/env ts-node-script

console.log(process.cwd(), "shopify-theme-dev: process.cwd()");
import { init } from "./src/index";

try {
  init();
} catch (err) {
  console.log(err);
}
