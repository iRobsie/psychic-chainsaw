const fs = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

const DIRECTORIES_TO_COPY = ["assets", "game-lib", "games"];
const FILES_TO_COPY = ["games.json"];

async function ensureCleanDocs() {
  await fs.rm(DOCS, { recursive: true, force: true });
  await fs.mkdir(DOCS, { recursive: true });
}

async function copyDirectory(relativePath) {
  const source = path.join(ROOT, relativePath);
  const destination = path.join(DOCS, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true });
}

async function copyHtmlFiles() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
      .map(async (entry) => {
        const source = path.join(ROOT, entry.name);
        const destination = path.join(DOCS, entry.name);
        await fs.copyFile(source, destination);
      })
  );
}

async function copyExtraFiles() {
  await Promise.all(
    FILES_TO_COPY.map(async (relativePath) => {
      const source = path.join(ROOT, relativePath);
      const destination = path.join(DOCS, relativePath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(source, destination);
    })
  );
}

async function writeNoJekyll() {
  const target = path.join(DOCS, ".nojekyll");
  await fs.writeFile(target, "\n");
}

async function main() {
  await ensureCleanDocs();

  for (const directory of DIRECTORIES_TO_COPY) {
    await copyDirectory(directory);
  }

  await copyHtmlFiles();
  await copyExtraFiles();
  await writeNoJekyll();
}

main().catch((error) => {
  console.error("Failed to build docs folder", error);
  process.exitCode = 1;
});
