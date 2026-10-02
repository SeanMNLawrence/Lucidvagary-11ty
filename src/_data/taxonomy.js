module.exports = {
  collection: [
    { value: "drawings", label: "Drawings", field: "classification", match: ["drawing"] },
    { value: "sketches", label: "Sketches", field: "classification", match: ["sketch"] },
    { value: "undecided", label: "Undecided", field: "classification", match: ["undecided"] },
  ],
  subjects: [
    { value: "visages-masks", label: "Visages & Masks" },
    { value: "eyes-gaze", label: "Eyes & Gaze" },
    { value: "hands-gesture", label: "Hands & Gesture" },
    { value: "figures-bodies", label: "Figures & Bodies" },
    { value: "animals-hybrids", label: "Animals & Hybrids" },
    { value: "symbols-cosmograms", label: "Symbols & Cosmograms" },
    { value: "composite-worlds", label: "Composite Worlds" },
  ],
};
