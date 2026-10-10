const vocabulary = require("./artworkVocabulary");

module.exports = {
  collection: [
    { value: "drawings", label: "Drawings", field: "classification", match: ["drawing"] },
    { value: "sketches", label: "Sketches", field: "classification", match: ["sketch"] },
    { value: "undecided", label: "Undecided", field: "classification", match: ["undecided"] },
  ],
  subjects: vocabulary.subjects.map((term) => ({
    value: term.id,
    label: term.label,
    field: "subjects",
    match: [term.id, ...(term.aliases || [])],
  })),
  motifs: vocabulary.motifs.map((term) => ({
    value: term.id,
    label: term.label,
    field: "motifs",
    match: [term.id, ...(term.aliases || [])],
  })),
  themes: vocabulary.themes.map((term) => ({
    value: term.id,
    label: term.label,
    field: "themes",
    match: [term.id, ...(term.aliases || [])],
  })),
};
