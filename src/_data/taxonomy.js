module.exports = {
  collection: [
    { value: "drawings", label: "drawings", field: "tags" },
    { value: "sketches", label: "sketches", field: "tags", match: ["sketches", "sketch"] },
  ],
  subjects: [
    { value: "eyes-and-gaze", label: "eyes and gaze" },
    { value: "hands-and-gesture", label: "hands and gesture" },
    { value: "visages-and-masks", label: "visages and masks" },
    { value: "animals-and-hybrids", label: "animals and hybrids" },
  ],
};
