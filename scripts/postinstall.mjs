#!/usr/bin/env node

import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import https from "node:https";
import fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ICONS_DIR = join(ROOT, "downloaded_icons");
const ZIP_URL =
  "https://github.com/agent-clis/diagrams/releases/download/cloud-icons-v1/cloud-icons-v1.zip";
const ZIP_PATH = join(ROOT, "cloud-icons-v1.zip");

async function main() {
  // Skip if icons already exist
  if (existsSync(join(ICONS_DIR, "aws"))) {
    return;
  }

  console.log("Downloading cloud icons...");

  try {
    await download(ZIP_URL, ZIP_PATH);
    extract(ZIP_PATH, ROOT);
    unlinkSync(ZIP_PATH);

    const count = countFiles(ICONS_DIR);
    console.log(`✓ Cloud icons installed (${count} entries)`);
  } catch (err) {
    // Clean up partial download
    try {
      if (existsSync(ZIP_PATH)) unlinkSync(ZIP_PATH);
    } catch {}

    console.warn(
      `⚠ Cloud icons unavailable — aws: and gcp: icons won't render.`
    );
    console.warn(
      `  Run \`diagrams setup-icons\` to retry, or manually download from:`
    );
    console.warn(`  ${ZIP_URL}`);
    console.warn(`  Error: ${err.message}`);
  }
}

function download(url, dest, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error("Too many redirects"));
    }

    const request = https.get(url, (response) => {
      // Follow redirects (GitHub releases redirect to S3)
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        return download(response.headers.location, dest, maxRedirects - 1).then(
          resolve,
          reject
        );
      }

      if (response.statusCode !== 200) {
        response.resume();
        return reject(
          new Error(`Download failed with status ${response.statusCode}`)
        );
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", (err) => {
        unlinkSync(dest);
        reject(err);
      });
    });

    request.on("error", reject);
    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error("Download timed out"));
    });
  });
}

function extract(zipPath, destDir) {
  try {
    // Try unzip first (macOS, most Linux)
    execSync(`unzip -qo "${zipPath}" -d "${destDir}"`, {
      stdio: "ignore",
    });
  } catch {
    // Fallback to tar (some minimal Linux images)
    try {
      execSync(`tar -xf "${zipPath}" -C "${destDir}"`, {
        stdio: "ignore",
      });
    } catch {
      throw new Error(
        "Could not extract icons: neither unzip nor tar available"
      );
    }
  }
}

function countFiles(dir) {
  try {
    const output = execSync(`find "${dir}" -type f | wc -l`, {
      encoding: "utf-8",
    });
    return output.trim();
  } catch {
    return "?";
  }
}

main();
