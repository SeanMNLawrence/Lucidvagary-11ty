const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const outputDirectory = path.join(repositoryRoot, "_site");
if (path.dirname(outputDirectory) !== repositoryRoot || path.basename(outputDirectory) !== "_site") {
  throw new Error(`Refusing to clean unexpected build output: ${outputDirectory}`);
}
fs.rmSync(outputDirectory, { recursive: true, force: true });
