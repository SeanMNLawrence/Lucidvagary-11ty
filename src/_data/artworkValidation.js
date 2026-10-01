const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const schema = require("./artwork.schema.json");

const sourceDirectory = path.resolve(__dirname, "../..");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function taxonomyId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value.id;
  return undefined;
}

function validateArtworkData(records, vocabulary, rootDirectory = sourceDirectory) {
  const errors = [];
  const warnings = [];
  const slugs = new Set();
  const ids = new Set();
  const validClassifications = new Set(vocabulary.classifications);
  const validStatuses = new Set(vocabulary.curatorialStatuses);
  const validRelationships = new Set(vocabulary.relationshipTypes);
  const validTaxonomy = {
    subjects: new Set(vocabulary.subjects.map((item) => item.id)),
    motifs: new Set(vocabulary.motifs.map((item) => item.id)),
    themes: new Set(vocabulary.themes.map((item) => item.id)),
    constellations: new Set(vocabulary.constellations.map((item) => item.id)),
  };
  const sourceDirectoryPath = path.join(rootDirectory, "src");

  if (!Array.isArray(records)) {
    return { errors: ["Artwork catalogue must be an array."], warnings };
  }

  for (const [index, artwork] of records.entries()) {
    const label = `artworks[${index}]`;
    if (!artwork || typeof artwork !== "object" || Array.isArray(artwork)) {
      errors.push(`${label}: record must be an object.`);
      continue;
    }
    if (!validateSchema(artwork)) {
      errors.push(
        `${label}: JSON Schema validation failed: ${ajv.errorsText(validateSchema.errors, { separator: "; " })}`
      );
    }

    if (typeof artwork.slug !== "string" || !slugPattern.test(artwork.slug)) {
      errors.push(`${label}: slug must be a lowercase URL-safe identifier.`);
    } else if (slugs.has(artwork.slug)) {
      errors.push(`${label}: duplicate artwork slug "${artwork.slug}".`);
    } else {
      slugs.add(artwork.slug);
    }
    if (typeof artwork.artwork_id === "string") {
      if (ids.has(artwork.artwork_id)) errors.push(`${label}: duplicate artwork ID "${artwork.artwork_id}".`);
      ids.add(artwork.artwork_id);
    }
    if (typeof artwork.title !== "string" || !artwork.title.trim()) {
      errors.push(`${label}: title is required.`);
    }
    if (
      artwork.title === "Untitled" &&
      artwork.original_title == null &&
      (typeof artwork.proposed_title !== "string" || !artwork.proposed_title.trim())
    ) {
      errors.push(`${label}: provide an original title or a proposed title.`);
    }

    const classification = artwork.classification;
    if (
      !classification ||
      !validClassifications.has(classification.type) ||
      !Number.isFinite(classification.confidence) ||
      classification.confidence < 0 ||
      classification.confidence > 1
    ) {
      errors.push(`${label}: classification type or confidence is invalid.`);
    }
    if (!validStatuses.has(artwork.curatorial_status)) {
      errors.push(`${label}: unknown curatorial status "${artwork.curatorial_status}".`);
    }

    for (const field of ["subjects", "motifs", "themes", "constellations"]) {
      const values = artwork[field];
      if (!Array.isArray(values)) {
        errors.push(`${label}: ${field} must be an array.`);
        continue;
      }
      const seenTerms = new Set();
      values.forEach((value) => {
        const id = taxonomyId(value);
        if (!id || !validTaxonomy[field].has(id)) {
          errors.push(`${label}: unknown ${field.slice(0, -1)} term "${id || value}".`);
        }
        if (seenTerms.has(id)) errors.push(`${label}: duplicate ${field.slice(0, -1)} term "${id}".`);
        seenTerms.add(id);
        if (
          value &&
          typeof value === "object" &&
          value.confidence !== undefined &&
          (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1)
        ) {
          errors.push(`${label}: ${field.slice(0, -1)} confidence must be between 0 and 1.`);
        }
      });
    }

    if (!Array.isArray(artwork.relationships)) {
      errors.push(`${label}: relationships must be an array.`);
    } else {
      artwork.relationships.forEach((relationship) => {
        if (!relationship || !validRelationships.has(relationship.type)) {
          errors.push(`${label}: unknown relationship type "${relationship && relationship.type}".`);
        }
        if (
          relationship &&
          ["study-for", "developed-into"].includes(relationship.type) &&
          (typeof relationship.evidence !== "string" || !relationship.evidence.trim())
        ) {
          errors.push(`${label}: ${relationship.type} relationships require explicit evidence.`);
        }
        if (!relationship || typeof relationship.target_slug !== "string" || !slugPattern.test(relationship.target_slug)) {
          errors.push(`${label}: relationship target slug is missing or invalid.`);
        }
      });
    }

    if (!Array.isArray(artwork.assets) || artwork.assets.length === 0) {
      errors.push(`${label}: at least one digital asset is required.`);
      continue;
    }
    const primaryAssets = artwork.assets.filter((asset) => asset && asset.role === "primary");
    if (primaryAssets.length !== 1) {
      errors.push(`${label}: exactly one primary digital asset is required.`);
    }

    artwork.assets.forEach((asset, assetIndex) => {
      const assetLabel = `${label}.assets[${assetIndex}]`;
      if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
        errors.push(`${assetLabel}: digital asset must be an object.`);
        return;
      }
      if (!asset || !["primary", "alternate"].includes(asset.role)) {
        errors.push(`${assetLabel}: role must be primary or alternate.`);
      }
      if (asset.role === "primary" && (typeof asset.alt !== "string" || !asset.alt.trim())) {
        errors.push(`${assetLabel}: primary asset requires authored, non-empty alt text.`);
      }
      if (typeof asset.original_filename !== "string" || !asset.original_filename.trim()) {
        errors.push(`${assetLabel}: original_filename is required.`);
      }
      if (asset.path === null && asset.availability === "source-unavailable") {
        warnings.push(
          `${assetLabel}: source image "${asset.original_filename}" is not present in the repository; add it to restore alternate-image access.`
        );
        return;
      }
      if (typeof asset.path !== "string" || !asset.path.startsWith("/")) {
        errors.push(`${assetLabel}: path must be a site-root-relative path or a declared unavailable source.`);
        return;
      }
      const localPath = path.resolve(sourceDirectoryPath, asset.path.replace(/^\/+/, ""));
      if (localPath !== sourceDirectoryPath && !localPath.startsWith(`${sourceDirectoryPath}${path.sep}`)) {
        errors.push(`${assetLabel}: image path "${asset.path}" escapes the source directory.`);
        return;
      }
      if (!fs.existsSync(localPath)) {
        errors.push(`${assetLabel}: referenced image "${asset.path}" does not exist.`);
      }
      if (
        asset.confidence !== undefined &&
        (!Number.isFinite(asset.confidence) || asset.confidence < 0 || asset.confidence > 1)
      ) {
        errors.push(`${assetLabel}: confidence must be between 0 and 1.`);
      }
    });

    if (!artwork.provenance || !Array.isArray(artwork.provenance.source_records) || !artwork.provenance.source_records.length) {
      errors.push(`${label}: provenance.source_records must contain at least one source.`);
    }
    const creationDate = artwork.provenance && artwork.provenance.artwork_creation_date;
    if (creationDate !== null && creationDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(creationDate)) {
      errors.push(`${label}: artwork_creation_date must be an ISO date or null.`);
    }
  }

  const knownSlugs = new Set(records.filter(Boolean).map((artwork) => artwork.slug));
  records.forEach((artwork, index) => {
    (artwork && Array.isArray(artwork.relationships) ? artwork.relationships : []).forEach((relationship) => {
      if (relationship && relationship.target_slug && !knownSlugs.has(relationship.target_slug)) {
        errors.push(`artworks[${index}]: relationship target "${relationship.target_slug}" does not exist.`);
      }
    });
  });

  return { errors, warnings };
}

function validateConstellationGroups(groups, records, vocabulary) {
  const errors = [];
  const validIds = new Set(vocabulary.map((item) => item.id));
  const artworkSlugs = new Set(records.map((item) => item.slug));
  const seenIds = new Set();

  groups.forEach((group, index) => {
    const label = `constellations[${index}]`;
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      errors.push(`${label}: constellation must be an object.`);
      return;
    }
    if (!validIds.has(group.id) || group.id !== group.slug) {
      errors.push(`${label}: constellation ID "${group.id}" is not in the controlled vocabulary.`);
    }
    if (seenIds.has(group.id)) errors.push(`${label}: duplicate constellation ID "${group.id}".`);
    seenIds.add(group.id);
    if (!group.title || !group.introduction) errors.push(`${label}: title and introduction are required.`);
    if (!Array.isArray(group.artworkSlugs)) {
      errors.push(`${label}: artworkSlugs must be an array.`);
      return;
    }
    const members = new Set();
    group.artworkSlugs.forEach((slug) => {
      if (!artworkSlugs.has(slug)) errors.push(`${label}: artwork "${slug}" does not exist.`);
      if (members.has(slug)) errors.push(`${label}: duplicate artwork membership "${slug}".`);
      members.add(slug);
    });
  });

  return errors;
}

module.exports = { validateArtworkData, validateConstellationGroups };
