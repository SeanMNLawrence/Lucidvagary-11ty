function buildArtwork(number) {
  const padded = String(number).padStart(3, "0");
  const slug = `Sketch-${padded}`;
  const title = `Sketch ${padded}`;

  return {
    title,
    slug: slug.toLowerCase(),
    url: `/posts/${slug}/`,
    original_title: title,
    proposed_title: null,
    classification: {
      type: "sketch",
      confidence: 1
    },
    curatorial_status: "published",
    subjects: [],
    motifs: [],
    themes: [],
    constellations: [],
    relationships: [],
    assets: [
      {
        role: "primary",
        path: `/posts/${slug}/image.jpg`,
        original_filename: "image.jpg",
        asset_capture_date: null,
        confidence: 1
      }
    ],
    provenance: {
      artwork_creation_date: "2015-03-01",
      source_records: [`src/posts/${slug}/index.md`]
    }
  };
}

const items = Array.from({ length: 62 }, (_, index) => buildArtwork(index + 1));

function uniqueValues(key) {
  return [...new Set(items.flatMap((item) => item[key]).filter(Boolean))].sort();
}

module.exports = {
  items,
  count: items.length,
  filters: {
    classifications: [
      { value: "drawing", label: "Drawing" },
      { value: "sketch", label: "Sketch" },
      { value: "undecided", label: "Undecided" }
    ],
    subjects: uniqueValues("subjects"),
    motifs: uniqueValues("motifs"),
    themes: uniqueValues("themes"),
    constellations: uniqueValues("constellations")
  }
};
