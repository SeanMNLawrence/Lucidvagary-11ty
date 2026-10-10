const Ajv2020 = require("ajv/dist/2020");
const schema = require("./compositeArtwork.schema.json");

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);

function validateCompositeArtworks(composites, artworks) {
  const errors = [];
  const compositeIds = new Set();
  const compositeUrls = new Set();
  const artworksById = new Set(artworks.map((artwork) => artwork.artwork_id));

  if (!Array.isArray(composites)) {
    return ["Composite artwork catalogue must be an array."];
  }

  composites.forEach((composite, index) => {
    const label = `compositeArtworks[${index}]`;
    if (!composite || typeof composite !== "object" || Array.isArray(composite)) {
      errors.push(`${label}: record must be an object.`);
      return;
    }
    if (!validateSchema(composite)) {
      errors.push(
        `${label}: schema validation failed: ${ajv.errorsText(validateSchema.errors, { separator: "; " })}`
      );
    }
    if (compositeIds.has(composite.artwork_id)) {
      errors.push(`${label}: duplicate composite artwork ID "${composite.artwork_id}".`);
    }
    compositeIds.add(composite.artwork_id);
    if (compositeUrls.has(composite.url)) {
      errors.push(`${label}: duplicate composite page URL "${composite.url}".`);
    }
    compositeUrls.add(composite.url);

    if (!Array.isArray(composite.components)) return;
    const componentIds = new Set();
    const componentOrders = new Set();
    composite.components.forEach((component) => {
      if (!component || typeof component !== "object") return;
      if (!artworksById.has(component.artwork_id)) {
        errors.push(`${label}: component artwork "${component.artwork_id}" does not exist.`);
      }
      if (componentIds.has(component.artwork_id)) {
        errors.push(`${label}: duplicate component artwork "${component.artwork_id}".`);
      }
      componentIds.add(component.artwork_id);
      if (Number.isInteger(component.order)) {
        if (componentOrders.has(component.order)) {
          errors.push(`${label}: duplicate component order "${component.order}".`);
        }
        componentOrders.add(component.order);
      }
    });
  });

  return errors;
}

module.exports = { validateCompositeArtworks };
