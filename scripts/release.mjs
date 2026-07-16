import { createWriteStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { dirname, extname, join, relative, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { minify } from "terser";
import yazl from "yazl";

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const sourceDir = join(rootDir, "extension");
const releaseDir = join(rootDir, "release");
const releaseName = "ai-subtitle-translator";

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function getCurrentReleaseTag() {
  if (process.env.RELEASE_TAG) {
    return process.env.RELEASE_TAG;
  }

  try {
    const { stdout } = await execFileAsync("git", ["describe", "--tags", "--exact-match", "HEAD"], {
      cwd: rootDir
    });
    return stdout.trim();
  } catch {
    throw new Error("HEAD is not exactly on a git tag. Set RELEASE_TAG explicitly or create/check out a release tag.");
  }
}

function getManifestVersionFromTag(tag) {
  const version = tag.replace(/^v/i, "");
  if (!/^\d+(\.\d+){0,3}$/.test(version)) {
    throw new Error(`Tag "${tag}" cannot be used as a Chrome extension version`);
  }

  return version;
}

function toZipPath(path) {
  return path.split(sep).join("/");
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolutePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files.sort();
}

async function copyOptimizedExtension(targetDir) {
  const files = await listFiles(sourceDir);

  for (const sourcePath of files) {
    const relativePath = relative(sourceDir, sourcePath);
    const targetPath = join(targetDir, relativePath);
    await mkdir(dirname(targetPath), { recursive: true });

    if (extname(sourcePath) === ".js") {
      const source = await readFile(sourcePath, "utf8");
      const result = await minify(source, {
        compress: {
          passes: 2
        },
        ecma: 2020,
        format: {
          ascii_only: true,
          comments: false
        },
        mangle: false,
        module: true,
        sourceMap: false
      });

      if (!result.code) {
        throw new Error(`Failed to optimize ${relativePath}`);
      }

      await writeFile(targetPath, `${result.code}\n`, "utf8");
      continue;
    }

    await copyFile(sourcePath, targetPath);
  }
}

async function validateRelease(targetDir) {
  const manifest = await readJson(join(targetDir, "manifest.json"));
  if (manifest.manifest_version !== 3) {
    throw new Error("Release manifest must use manifest_version 3");
  }

  const files = await listFiles(targetDir);
  const unexpected = files
    .map((file) => toZipPath(relative(targetDir, file)))
    .filter((file) => {
      const firstSegment = file.split("/")[0];
      return firstSegment === "docs"
        || firstSegment === "tests"
        || firstSegment === "node_modules"
        || file === "package.json"
        || file === "package-lock.json";
    });

  if (unexpected.length > 0) {
    throw new Error(`Release contains non-extension files: ${unexpected.join(", ")}`);
  }

  const jsFiles = files.filter((file) => extname(file) === ".js");
  for (const jsFile of jsFiles) {
    await execFileAsync(process.execPath, ["--check", jsFile], { cwd: rootDir });
  }
}

async function applyReleaseManifestVersion(targetDir, tag) {
  const manifestPath = join(targetDir, "manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.version = getManifestVersionFromTag(tag);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function createZip(sourcePath, zipPath) {
  const zipfile = new yazl.ZipFile();
  const files = await listFiles(sourcePath);

  for (const file of files) {
    const relativePath = toZipPath(relative(sourcePath, file));
    const fileStat = await stat(file);
    zipfile.addFile(file, relativePath, {
      mtime: fileStat.mtime
    });
  }

  await mkdir(dirname(zipPath), { recursive: true });
  await new Promise((resolve, reject) => {
    zipfile.outputStream
      .pipe(createWriteStream(zipPath))
      .on("close", resolve)
      .on("error", reject);
    zipfile.on("error", reject);
    zipfile.end();
  });
}

async function main() {
  const tag = await getCurrentReleaseTag();
  const targetDir = join(releaseDir, `${releaseName}-${tag}`);
  const zipPath = join(releaseDir, `${releaseName}-${tag}.zip`);

  if (!await pathExists(sourceDir)) {
    throw new Error("extension directory does not exist");
  }

  await mkdir(releaseDir, { recursive: true });
  await rm(targetDir, { recursive: true, force: true });
  await rm(zipPath, { force: true });
  await mkdir(targetDir, { recursive: true });

  await copyOptimizedExtension(targetDir);
  await applyReleaseManifestVersion(targetDir, tag);
  await validateRelease(targetDir);
  await createZip(targetDir, zipPath);

  console.log(`Release tag: ${tag}`);
  console.log(`Release directory: ${relative(rootDir, targetDir)}`);
  console.log(`Chrome Web Store zip: ${relative(rootDir, zipPath)}`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
