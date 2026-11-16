import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Incremental cache (KV or R2)
  // incrementalCache: {
  //   type: "kv",
  //   binding: "CACHE",
  // },
  
  // Image optimization
  // imageLoader: "cloudflare",
  
  // Enable R2 for static assets
  // assets: {
  //   directory: ".open-next/assets",
  //   binding: "ASSETS",
  // },
});