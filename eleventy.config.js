const fs = require("node:fs");
const path = require("node:path");
const markdownIt = require("markdown-it");
const artworkVocabulary = require("./src/_data/artworkVocabulary");

module.exports = function (eleventyConfig) {
  const repoRoot = __dirname;
  const artworkClassificationSet = new Set(artworkVocabulary.classifications);
  const artworkCuratorialStatusSet = new Set(artworkVocabulary.curatorialStatuses);
  const artworkRelationshipTypeSet = new Set(artworkVocabulary.relationshipTypes);
  const artworkTaxonomySets = Object.fromEntries(
    Object.entries(artworkVocabulary.taxonomy).map(([group, values]) => [group, new Set(values)])
  );

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === "") return [];
    return [value];
  }

  function slugify(str) {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function normalizeValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeSlug(value) {
    return slugify(String(value || ""));
  }

  function getDefaultArtworkSlug(item) {
    const parsedPath = path.parse(item.inputPath);
    return parsedPath.name === "index" ? path.basename(parsedPath.dir) : parsedPath.name;
  }

  function getArtworkSlug(item) {
    return typeof item.data.slug === "string" && item.data.slug.trim().length > 0
      ? item.data.slug.trim()
      : getDefaultArtworkSlug(item);
  }

  function getArtworkIdentifiers(item) {
    return [
      item.data.artworkId,
      item.data.id,
      item.data.slug,
      getDefaultArtworkSlug(item),
      getArtworkSlug(item),
    ]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => normalizeSlug(value));
  }

  function isArtwork(item) {
    const tags = toArray(item.data.tags).map(normalizeValue);
    return (
      tags.includes("artwork") ||
      tags.includes("sketch") ||
      item.data.classification !== undefined ||
      item.data.curatorial_status !== undefined ||
      item.data.curatorialStatus !== undefined ||
      item.data.relationships !== undefined ||
      item.data.related_works !== undefined ||
      item.data.subjects !== undefined ||
      item.data.motifs !== undefined ||
      item.data.themes !== undefined ||
      item.data.constellations !== undefined
    );
  }

  function getTaxonomyValueId(value) {
    if (typeof value === "string") return normalizeSlug(value);
    if (!value || typeof value !== "object") return "";
    return normalizeSlug(value.id || value.slug || value.value);
  }

  function getRelationshipTarget(value) {
    if (typeof value === "string") return normalizeSlug(value);
    if (!value || typeof value !== "object") return "";

    if (typeof value.url === "string") {
      const match = value.url.match(/\/(?:artwork|posts)\/([^/]+)\/?$/);
      if (match) return normalizeSlug(match[1]);
    }

    return normalizeSlug(
      value.target_slug ||
        value.targetSlug ||
        value.target_id ||
        value.targetId ||
        value.target ||
        value.slug ||
        value.id
    );
  }

  function resolveAssetPath(inputPath, assetPath) {
    if (typeof assetPath !== "string" || assetPath.trim().length === 0) return null;
    if (assetPath.startsWith("/")) {
      return path.join(repoRoot, "src", assetPath.replace(/^\/+/, ""));
    }
    return path.resolve(path.dirname(inputPath), assetPath);
  }

  function getArtworkAssetPaths(item) {
    const assetPaths = [];

    if (typeof item.data.image === "string" && item.data.image.trim().length > 0) {
      assetPaths.push(item.data.image.trim());
    }

    toArray(item.data.assets).forEach((asset) => {
      if (asset && typeof asset === "object" && typeof asset.path === "string") {
        assetPaths.push(asset.path.trim());
      }
    });

    toArray(item.data.digitalAssets).forEach((asset) => {
      if (typeof asset === "string") {
        assetPaths.push(asset.trim());
      } else if (asset && typeof asset === "object") {
        if (typeof asset.path === "string") assetPaths.push(asset.path.trim());
        if (typeof asset.src === "string") assetPaths.push(asset.src.trim());
      }
    });

    toArray(item.data.alternate_views).forEach((asset) => {
      if (typeof asset === "string") {
        assetPaths.push(asset.trim());
      } else if (asset && typeof asset === "object" && typeof asset.src === "string") {
        assetPaths.push(asset.src.trim());
      }
    });

    return assetPaths.filter(Boolean);
  }

  function validateArtworkMetadata(posts) {
    const artworkPosts = posts.filter((item) => isArtwork(item));
    const errors = [];
    const slugOwners = new Map();
    const knownArtworkIdentifiers = new Set();

    artworkPosts.forEach((item) => {
      const slug = normalizeSlug(getArtworkSlug(item));
      if (slugOwners.has(slug)) {
        errors.push(
          `${item.inputPath}: duplicate artwork slug "${slug}" also used by ${slugOwners.get(slug)}`
        );
      } else {
        slugOwners.set(slug, item.inputPath);
      }

      getArtworkIdentifiers(item).forEach((identifier) => knownArtworkIdentifiers.add(identifier));
    });

    artworkPosts.forEach((item) => {
      const metadataPath = path.relative(repoRoot, item.inputPath);
      const classification =
        typeof item.data.classification === "string"
          ? normalizeValue(item.data.classification)
          : normalizeValue(item.data.classification && item.data.classification.type);
      if (classification && !artworkClassificationSet.has(classification)) {
        errors.push(
          `${metadataPath}: unknown classification "${classification}". Allowed values: ${[
            ...artworkClassificationSet,
          ].join(", ")}`
        );
      }

      const curatorialStatus = normalizeValue(
        item.data.curatorial_status ||
          item.data.curatorialStatus ||
          (item.data.curatorial && item.data.curatorial.status)
      );
      if (curatorialStatus && !artworkCuratorialStatusSet.has(curatorialStatus)) {
        errors.push(
          `${metadataPath}: invalid curatorial status "${curatorialStatus}". Allowed values: ${[
            ...artworkCuratorialStatusSet,
          ].join(", ")}`
        );
      }

      Object.entries(artworkTaxonomySets).forEach(([group, allowedValues]) => {
        toArray(item.data[group]).forEach((value) => {
          const taxonomyId = getTaxonomyValueId(value);
          if (taxonomyId && !allowedValues.has(taxonomyId)) {
            errors.push(
              `${metadataPath}: unknown ${group.slice(0, -1)} taxonomy term "${taxonomyId}". Allowed values: ${[
                ...allowedValues,
              ].join(", ")}`
            );
          }
        });
      });

      [...toArray(item.data.relationships), ...toArray(item.data.related_works)].forEach((relationship) => {
        const relationshipType = normalizeValue(relationship && relationship.type);
        if (relationshipType && !artworkRelationshipTypeSet.has(relationshipType)) {
          errors.push(
            `${metadataPath}: unknown relationship type "${relationshipType}". Allowed values: ${[
              ...artworkRelationshipTypeSet,
            ].join(", ")}`
          );
        }

        const relationshipTarget = getRelationshipTarget(relationship);
        if (!relationshipTarget) {
          errors.push(
            `${metadataPath}: artwork relationship is missing a target slug or ID (${JSON.stringify(
              relationship
            )})`
          );
          return;
        }

        if (!knownArtworkIdentifiers.has(relationshipTarget)) {
          errors.push(
            `${metadataPath}: artwork relationship target "${relationshipTarget}" does not match any known artwork slug or ID`
          );
        }
      });

      const assetPaths = getArtworkAssetPaths(item);
      if (assetPaths.length === 0) {
        errors.push(
          `${metadataPath}: missing image metadata. Add "image", "assets", "digitalAssets", or "alternate_views".`
        );
      }

      assetPaths.forEach((assetPath) => {
        const resolvedAssetPath = resolveAssetPath(item.inputPath, assetPath);
        if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
          errors.push(
            `${metadataPath}: referenced image "${assetPath}" does not exist at ${path.relative(
              repoRoot,
              resolvedAssetPath || item.inputPath
            )}`
          );
        }
      });
    });

    if (errors.length > 0) {
      throw new Error(
        [
          "Artwork metadata validation failed.",
          `Update controlled values in src/_data/artworkVocabulary.js or fix the cited content files.`,
          ...errors.map((error) => `- ${error}`),
        ].join("\n")
      );
    }
  }

  let validatedPostsCache;

  function getValidatedPosts(collectionApi) {
    if (validatedPostsCache) return validatedPostsCache;

    validatedPostsCache = collectionApi.getFilteredByGlob("src/posts/**/*.md").sort((a, b) => {
      return b.date - a.date;
    });

    validateArtworkMetadata(validatedPostsCache);
    return validatedPostsCache;
  }

  // Hard line breaks: a single newline becomes <br>, matching the poem
  // formatting fix from the Hugo site (single line breaks were being
  // silently swallowed by standard Markdown rules).
  const md = markdownIt({ html: true, breaks: true });
  eleventyConfig.setLibrary("md", md);

  // Pass through static assets as-is
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/posts/**/*.jpg");
  eleventyConfig.addPassthroughCopy("src/posts/**/*.png");

  // "posts" collection, newest first, mirrors Hugo's unified posts stream
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return getValidatedPosts(collectionApi);
  });

  // Collection filtered to poem-tagged pieces
  eleventyConfig.addCollection("poems", function (collectionApi) {
    return getValidatedPosts(collectionApi).filter((item) => item.data.tags && item.data.tags.includes("poem"));
  });

  // Collection filtered to sketch/artwork pieces
  eleventyConfig.addCollection("sketches", function (collectionApi) {
    return getValidatedPosts(collectionApi).filter((item) => {
      const tags = item.data.tags || [];
      return tags.includes("artwork") || tags.includes("sketch");
    });
  });

  // Tag list helper, mirrors Hugo's /tags/ pages
  eleventyConfig.addCollection("tagList", function (collectionApi) {
    const tagSet = new Set();
    getValidatedPosts(collectionApi).forEach((item) => {
      (item.data.tags || []).forEach((tag) => tagSet.add(tag));
    });
    return [...tagSet].sort();
  });

  // Shared homepage layout logic: figures out the hero, the next 3
  // "recent" posts, and one highlight per tag - making sure none of the
  // three sections repeat the same post.
  function computeHomepageLayout(collectionApi) {
    const posts = getValidatedPosts(collectionApi);
    const hero = posts.find((p) => p.data.featured === true) || posts[0];
    const used = new Set(hero ? [hero.url] : []);

    const recent = posts.filter((p) => !used.has(p.url)).slice(0, 3);
    recent.forEach((p) => used.add(p.url));

    const tagSet = new Set();
    posts.forEach((item) => (item.data.tags || []).forEach((t) => tagSet.add(t)));
    const highlights = [];
    const perTagLimit = 2;
    [...tagSet].sort().forEach((tag) => {
      const candidates = posts.filter((p) => (p.data.tags || []).includes(tag));
      let count = 0;
      candidates.forEach((p) => {
        if (count >= perTagLimit || used.has(p.url)) return;
        highlights.push({ tag, post: p });
        used.add(p.url);
        count++;
      });
    });

    // Anything still unused after the above (e.g. a piece whose tags were
    // all already spoken for) gets one more pass, grouped under its first tag,
    // so nothing in the archive stays permanently hidden from the homepage.
    posts.forEach((p) => {
      if (used.has(p.url)) return;
      const tag = (p.data.tags || [])[0] || "more";
      highlights.push({ tag, post: p });
      used.add(p.url);
    });

    return { hero, recent, highlights };
  }

  // One highlight per tag: the newest post carrying each tag, preferring
  // posts not already shown as the hero or in the recent feed, so the
  // homepage never repeats the same piece across its three sections.
  eleventyConfig.addCollection("highlightsByTag", function (collectionApi) {
    return computeHomepageLayout(collectionApi).highlights;
  });

  // Featured post for the homepage hero: the post with `featured: true`
  // in its front matter, if one is set; otherwise the newest post.
  eleventyConfig.addCollection("featuredPost", function (collectionApi) {
    const hero = computeHomepageLayout(collectionApi).hero;
    return hero ? [hero] : [];
  });

  // Recent posts feed: the 3 posts shown in the homepage's left column,
  // already excluding the hero and never repeated in the tag column.
  eleventyConfig.addCollection("recentPosts", function (collectionApi) {
    return computeHomepageLayout(collectionApi).recent;
  });

  // Human-readable date filter
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  // Slugify filter for tag URLs
  eleventyConfig.addFilter("slugify", slugify);

  // Related posts for the single-post sidebar: posts sharing at least one
  // tag with the current post, newest first, excluding the post itself.
  // Backfills with the most recent other posts if there aren't enough.
  eleventyConfig.addFilter("relatedPosts", (posts, currentUrl, currentTags, limit) => {
    limit = limit || 4;
    const tags = currentTags || [];
    const others = posts.filter((p) => p.url !== currentUrl);
    const shared = others.filter((p) => (p.data.tags || []).some((t) => tags.includes(t)));
    const result = [...shared];
    if (result.length < limit) {
      others.forEach((p) => {
        if (result.length >= limit) return;
        if (!result.includes(p)) result.push(p);
      });
    }
    return result.slice(0, limit);
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
