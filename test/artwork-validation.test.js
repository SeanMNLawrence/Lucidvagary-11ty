const test = require("node:test");
const assert = require("node:assert/strict");
const records = require("../src/_data/artworks.json");
const vocabulary = require("../src/_data/artworkVocabulary");
const constellations = require("../src/_data/constellations");
const { validateArtworkData, validateConstellationGroups } = require("../src/_data/artworkValidation");
const { relatedArtworks } = require("../src/_data/artworkRelations");

const validationVocabulary = { ...vocabulary, constellations };

test("catalogue has 62 unique artworks and 64 assigned digital assets", () => {
  assert.equal(records.length, 62);
  assert.equal(records.reduce((count, artwork) => count + artwork.assets.length, 0), 64);
  assert.equal(new Set(records.map((artwork) => artwork.slug)).size, 62);
  assert.equal(records.find((artwork) => artwork.slug === "sketch-037").title, "Cthodinic");

  const report = validateArtworkData(records, validationVocabulary, process.cwd());
  assert.deepEqual(report.errors, []);
  assert.equal(report.warnings.length, 2);
  assert.ok(report.warnings.every((warning) => warning.includes("source image")));
});

test("metadata validator reports duplicate slugs, unknown terms, and broken relationships", () => {
  const invalid = structuredClone(records);
  invalid[1].slug = invalid[0].slug;
  invalid[1].classification.type = "painting";
  invalid[1].subjects = ["unknown-term"];
  invalid[1].relationships = [{ type: "study-for", target_slug: "missing-work" }];

  const report = validateArtworkData(invalid, validationVocabulary, process.cwd());
  assert.ok(report.errors.some((error) => error.includes("duplicate artwork slug")));
  assert.ok(report.errors.some((error) => error.includes("classification type")));
  assert.ok(report.errors.some((error) => error.includes("unknown subject term")));
  assert.ok(report.errors.some((error) => error.includes("target \"missing-work\" does not exist")));
});

test("development relationships require evidence", () => {
  const invalid = structuredClone(records);
  invalid[0].relationships = [{ type: "study-for", target_slug: "sketch-002" }];

  const report = validateArtworkData(invalid, validationVocabulary, process.cwd());
  assert.ok(report.errors.some((error) => error.includes("study-for relationships require explicit evidence")));
});

test("primary artwork assets require authored alt text", () => {
  const invalid = structuredClone(records);
  delete invalid[0].assets.find((asset) => asset.role === "primary").alt;

  const report = validateArtworkData(invalid, validationVocabulary, process.cwd());
  assert.ok(report.errors.some((error) => error.includes("primary asset requires authored, non-empty alt text")));
});

test("constellation memberships resolve against canonical artwork slugs", () => {
  assert.deepEqual(validateConstellationGroups(constellations, records, vocabulary.constellations), []);
  assert.deepEqual(
    constellations.find((group) => group.id === "chromatic-visions").artworkSlugs,
    ["sketch-053", "sketch-054", "sketch-057", "sketch-058", "sketch-059", "sketch-060"]
  );
  const invalid = structuredClone(constellations);
  invalid[0].artworkSlugs.push("missing-artwork");
  assert.ok(
    validateConstellationGroups(invalid, records, vocabulary.constellations).some((error) =>
      error.includes('artwork "missing-artwork" does not exist')
    )
  );
});

test("related works prefer typed relationships and avoid duplicate or circular recommendations", () => {
  const works = [
    {
      slug: "current",
      relationships: [{ type: "study-for", target_slug: "explicit" }],
      motifs: [{ id: "eyes-gaze" }],
      themes: [],
    },
    { slug: "explicit", relationships: [], motifs: [{ id: "eyes-gaze" }], themes: [] },
    { slug: "semantic", relationships: [], motifs: [{ id: "eyes-gaze" }], themes: [] },
  ];
  const related = relatedArtworks(works, works[0], 4, 4);

  assert.deepEqual(related.explicit.map((item) => item.relationshipType), ["study-for"]);
  assert.deepEqual(related.semantic.map((item) => item.artwork.slug), ["semantic"]);
});
