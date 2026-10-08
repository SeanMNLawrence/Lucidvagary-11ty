const test = require("node:test");
const assert = require("node:assert/strict");
const records = require("../src/_data/artworks.json");
const vocabulary = require("../src/_data/artworkVocabulary");
const constellations = require("../src/_data/constellations");
const compositeArtworks = require("../src/_data/compositeArtworks");
const { validateArtworkData, validateConstellationGroups } = require("../src/_data/artworkValidation");
const { validateCompositeArtworks } = require("../src/_data/compositeArtworkValidation");
const artworkArchive = require("../src/_data/artworkArchive");
const { relatedArtworks } = require("../src/_data/artworkRelations");

const validationVocabulary = { ...vocabulary, constellations };

test("catalogue has 61 unique artworks and 63 assigned digital assets", () => {
  assert.equal(records.length, 61);
  assert.equal(records.reduce((count, artwork) => count + artwork.assets.length, 0), 63);
  assert.equal(new Set(records.map((artwork) => artwork.slug)).size, 61);
  assert.equal(new Set(records.map((artwork) => artwork.artwork_id)).size, 61);
  assert.ok(records.every((artwork) => artwork.artwork_id.startsWith("lv-artwork-")));
  assert.equal(records.some((artwork) => artwork.slug === "sketch-003"), false);
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

test("Pentaptych composite links Sketch 037 by stable ID without assuming its sequence", () => {
  assert.deepEqual(validateCompositeArtworks(compositeArtworks, records), []);
  const composite = artworkArchive.compositeArtworks.find(
    (item) => item.artwork_id === "lv-composite-the-pentaptych-of-growth"
  );
  const component = composite.components[0];

  assert.equal(composite.url, "/posts/The-Pentaptych-of-Growth/");
  assert.equal(component.artwork.artwork_id, "lv-artwork-sketch-037");
  assert.equal(component.order, null);
  assert.deepEqual(component.artwork.partOf, [{
    artwork_id: composite.artwork_id,
    title: composite.title,
    url: composite.url,
    order: null,
  }]);
});

test("composite artwork validation rejects unresolved and duplicate component assignments", () => {
  const invalid = structuredClone(compositeArtworks);
  invalid[0].components = [
    { artwork_id: "lv-artwork-missing", order: 1 },
    { artwork_id: "lv-artwork-sketch-037", order: 1 },
  ];
  const errors = validateCompositeArtworks(invalid, records);

  assert.ok(errors.some((error) => error.includes('component artwork "lv-artwork-missing" does not exist')));
  assert.ok(errors.some((error) => error.includes('duplicate component order "1"')));
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
