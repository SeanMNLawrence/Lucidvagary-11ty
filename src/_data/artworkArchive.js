const fs = require("node:fs");
const path = require("node:path");
const records = require("./artworks.json");
const vocabulary = require("./artworkVocabulary");
const constellationGroups = require("./constellations");

const sourceDirectory = path.resolve(__dirname, "..");

function assetExists(asset) {
  if (!asset || typeof asset.path !== "string") return false;
  return fs.existsSync(path.join(sourceDirectory, asset.path.replace(/^\/+/, "")));
}

function taxonomyValues(artworks, field) {
  const values = new Set();
  artworks.forEach((artwork) => {
    (artwork[field] || []).forEach((term) => {
      const id = typeof term === "string" ? term : term.id;
      if (id) values.add(id);
    });
  });
  return [...values].sort();
}

function labelsFor(terms, ids) {
  return ids.map((id) => {
    const term = terms.find((item) => item.id === id);
    return { value: id, label: term ? term.label : id };
  });
}

const constellationMemberships = new Map();
const knownArtworkSlugs = new Set(records.map((record) => record.slug));
const subjectLabels = new Map(vocabulary.subjects.map((term) => [term.id, term.label]));

const constellations = constellationGroups
  .map((group) => {
    const artworkSlugs = group.artworkSlugs.filter((slug) => knownArtworkSlugs.has(slug));
    artworkSlugs.forEach((slug) => {
      const memberships = constellationMemberships.get(slug) || [];
      memberships.push(group.id);
      constellationMemberships.set(slug, memberships);
    });
    return {
      ...group,
      artworkSlugs,
      artworks: records.filter((record) => artworkSlugs.includes(record.slug)),
    };
  })
  .filter((group) => group.artworks.length > 0);

const items = records.map((record) => {
  const titleIsProposed = record.title === "Untitled" && Boolean(record.proposed_title);
  const displayTitle = titleIsProposed ? record.proposed_title : record.title;
  const authoredSubjects = record.subjects.map((subject) => subjectLabels.get(subject)).filter(Boolean);
  const assets = record.assets.map((asset) => ({
    ...asset,
    alt: asset.role === "primary"
      ? asset.alt
      : asset.alt ||
        `${titleIsProposed ? "Proposed artwork" : "Artwork"}: ${displayTitle}. Classified as a ${record.classification.type}${
          authoredSubjects.length ? `; catalogued under ${authoredSubjects.join(", ")}` : ""
        }.`,
    available: assetExists(asset),
  }));
  const primaryAsset = assets.find((asset) => asset.role === "primary");

  return {
    ...record,
    constellations: [...new Set([...(record.constellations || []), ...(constellationMemberships.get(record.slug) || [])])],
    assets,
    primaryAsset,
    displayTitle,
    titleIsProposed,
    url: `/artwork/${record.slug}/`,
  };
});

module.exports = {
  items,
  count: items.length,
  assetCount: items.reduce((count, artwork) => count + artwork.assets.length, 0),
  filters: {
    classifications: vocabulary.classifications.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
    subjects: labelsFor(vocabulary.subjects, taxonomyValues(records, "subjects")),
    motifs: labelsFor(vocabulary.motifs, taxonomyValues(records, "motifs")),
    themes: labelsFor(vocabulary.themes, taxonomyValues(records, "themes")),
    constellations: labelsFor(
      vocabulary.constellations,
      [...new Set(constellations.flatMap((group) => group.artworks.map(() => group.id)))].sort()
    ),
  },
  constellations,
};
