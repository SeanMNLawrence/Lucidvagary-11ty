const records = require("../src/_data/artworks.json");
const vocabulary = require("../src/_data/artworkVocabulary");
const constellations = require("../src/_data/constellations");
const { validateArtworkData, validateConstellationGroups } = require("../src/_data/artworkValidation");

const report = validateArtworkData(records, { ...vocabulary, constellations }, process.cwd());
report.errors.push(...validateConstellationGroups(constellations, records, vocabulary.constellations));

report.warnings.forEach((warning) => console.warn(`[warning] ${warning}`));
report.errors.forEach((error) => console.error(`[error] ${error}`));

if (report.errors.length) {
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${records.length} artworks and ${records.reduce((count, artwork) => count + artwork.assets.length, 0)} digital assets (${report.warnings.length} unavailable source images).`
  );
}
