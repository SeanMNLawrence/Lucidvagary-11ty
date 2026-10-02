const records = require("./artworks.json");

function termIds(values) {
  return values.map((value) => typeof value === "string" ? value : value.id);
}

const items = records.map((record) => ({
  ...record,
  url: `/artwork/${record.slug}/`,
  displayTitle: record.original_title || record.proposed_title || record.title,
  displayTitleIsProposed: !record.original_title && Boolean(record.proposed_title),
  motifs: termIds(record.motifs),
  themes: termIds(record.themes),
  assets: record.assets,
  primaryAsset: record.assets.find((asset) => asset.role === "primary"),
}));

function uniqueValues(key) {
  return [...new Set(items.flatMap((item) => item[key]).filter(Boolean))].sort();
}

module.exports = {
  items,
  count: items.length,
  assetCount: items.reduce((count, item) => count + item.assets.length, 0),
  unavailableAssetCount: items.reduce(
    (count, item) => count + item.assets.filter((asset) => asset.availability === "missing-from-repository").length,
    0
  ),
  filters: {
    classifications: [
      { value: "drawing", label: "Drawing" },
      { value: "sketch", label: "Sketch" },
      { value: "undecided", label: "Undecided" },
    ],
    subjects: uniqueValues("subjects"),
    motifs: uniqueValues("motifs"),
    themes: uniqueValues("themes"),
    constellations: uniqueValues("constellations"),
  },
};
