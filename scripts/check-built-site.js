const fs = require("node:fs");
const path = require("node:path");
const { parseDocument, DomUtils } = require("htmlparser2");
const records = require("../src/_data/artworks.json");
const taxonomy = require("../src/_data/taxonomy");
const artworkArchive = require("../src/_data/artworkArchive");
const compositeArtworks = require("../src/_data/compositeArtworks");

const outputDirectory = path.resolve(process.cwd(), "_site");
const failures = [];

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function resolveLocalUrl(value, fromFile) {
  if (!value || value.startsWith("#") || /^(?:data:|mailto:|tel:|javascript:)/i.test(value)) return null;
  let parsed;
  try {
    parsed = new URL(value, "https://lucidvagary.invalid");
  } catch {
    failures.push(`${path.relative(outputDirectory, fromFile)}: invalid URL "${value}".`);
    return null;
  }
  if (parsed.origin !== "https://lucidvagary.invalid") return null;

  const pathname = decodeURIComponent(parsed.pathname);
  const target = path.resolve(outputDirectory, `.${pathname}`);
  if (!target.startsWith(`${outputDirectory}${path.sep}`) && target !== outputDirectory) {
    failures.push(`${path.relative(outputDirectory, fromFile)}: URL escapes the site output: "${value}".`);
    return null;
  }
  if (pathname.endsWith("/")) return path.join(target, "index.html");
  if (!path.extname(pathname)) return path.join(target, "index.html");
  return target;
}

function getAttribute(node, name) {
  return node.attribs && node.attribs[name];
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function checkSrcset(srcset, file) {
  (srcset || "").split(",").forEach((candidate) => {
    const source = candidate.trim().split(/\s+/)[0];
    const target = resolveLocalUrl(source, file);
    if (target && !fs.existsSync(target)) {
      failures.push(`${path.relative(outputDirectory, file)}: missing responsive image "${source}".`);
    }
  });
}

const htmlFiles = listFiles(outputDirectory).filter((file) => file.endsWith(".html"));
const archiveFile = path.join(outputDirectory, "archive", "index.html");
const archiveDocument = parseDocument(fs.readFileSync(archiveFile, "utf8"));
const homeDocument = parseDocument(fs.readFileSync(path.join(outputDirectory, "index.html"), "utf8"));
const mainNavigation = DomUtils.findOne(
  (node) => node.name === "nav" && getAttribute(node, "aria-label") === "Main navigation",
  homeDocument.children
);
const mainNavigationLinks = DomUtils.findAll((node) => node.name === "a", mainNavigation ? [mainNavigation] : []);
const mainNavigationRoutes = mainNavigationLinks.map((link) => getAttribute(link, "href"));
if (JSON.stringify(mainNavigationRoutes) !== JSON.stringify(["/", "/collection/", "/archive/", "/constellations/", "/about/"])) {
  failures.push(`main navigation routes are ${JSON.stringify(mainNavigationRoutes)}; expected home, collections, archive, constellations, and about.`);
}
if (!DomUtils.findOne(
  (node) => node.name === "a" && getAttribute(node, "href") === "/about/",
  DomUtils.findAll((node) => node.name === "nav" && getAttribute(node, "aria-label") === "Footer navigation", homeDocument.children)
)) {
  failures.push("footer navigation does not link to About.");
}
if (!DomUtils.findOne(
  (node) => node.name === "button" && getAttribute(node, "id") === "search-toggle",
  homeDocument.children
)) {
  failures.push("header does not include the Search control.");
}
const archiveCards = DomUtils.findAll(
  (node) => node.attribs && String(node.attribs.class || "").split(/\s+/).includes("archive-card"),
  archiveDocument.children
);
const artworkCards = archiveCards.filter((card) => card.attribs["data-origin"] === "catalogue");
if (artworkCards.length !== records.length) {
  failures.push(`archive contains ${artworkCards.length} catalogue artwork cards; expected ${records.length}.`);
}
const legacyCards = archiveCards.filter((card) => card.attribs["data-origin"] === "legacy");
if (legacyCards.length === 0) {
  failures.push("archive does not contain any legacy artwork or writing entries.");
}
if (!artworkCards.some((card) => card.attribs["data-year"])) {
  failures.push("archive does not include any artwork dates for its year filter.");
}
["archive-type", "archive-year", "archive-subject", "archive-tag"].forEach((id) => {
  if (!DomUtils.findOne((node) => getAttribute(node, "id") === id, archiveDocument.children)) {
    failures.push(`archive is missing the ${id.replace("archive-", "")} filter.`);
  }
});

const artworkPages = records
  .map((artwork) => path.join(outputDirectory, "artwork", artwork.slug, "index.html"))
  .filter((file) => fs.existsSync(file));
if (artworkPages.length !== records.length) {
  failures.push(`found ${artworkPages.length} artwork detail pages; expected ${records.length}.`);
}
const catalogueAssetCount = records.reduce((count, artwork) => count + artwork.assets.length, 0);
[
  path.join(outputDirectory, "posts", "Sketch-003", "index.html"),
  path.join(outputDirectory, "artwork", "sketch-003", "index.html"),
  path.join(outputDirectory, "posts", "Sketch-003", "image.jpg"),
].forEach((file) => {
  if (fs.existsSync(file)) failures.push(`${path.relative(outputDirectory, file)} should not be published.`);
});

for (const [group, entries] of Object.entries(taxonomy)) {
  entries.forEach((entry) => {
    const matchValues = (entry.match || [entry.value]).map(slugify);
    const expectedCount = records.filter((artwork) => {
      const values = entry.field === "classification"
        ? [artwork.classification.type]
        : artwork[entry.field].map((term) => (typeof term === "string" ? term : term.id));
      return values.map(slugify).some((value) => matchValues.includes(value));
    }).length;
    if (!expectedCount) return;
    const route = path.join(outputDirectory, group, slugify(entry.value), "index.html");
    if (!fs.existsSync(route)) {
      failures.push(`taxonomy route /${group}/${slugify(entry.value)}/ was not generated.`);
    } else if (!DomUtils.textContent(parseDocument(fs.readFileSync(route, "utf8"))).includes(`${expectedCount} artwork`)) {
      failures.push(`taxonomy route /${group}/${slugify(entry.value)}/ does not report ${expectedCount} artworks.`);
    }
  });
}

artworkArchive.constellations.forEach((constellation) => {
  const route = path.join(outputDirectory, "constellations", constellation.slug, "index.html");
  if (!fs.existsSync(route)) {
    failures.push(`constellation route /constellations/${constellation.slug}/ was not generated.`);
  } else if (!DomUtils.textContent(parseDocument(fs.readFileSync(route, "utf8"))).includes(`${constellation.artworks.length} artwork`)) {
    failures.push(`constellation route /constellations/${constellation.slug}/ has a mismatched artwork count.`);
  }
});

compositeArtworks.forEach((composite) => {
  const compositePath = path.join(outputDirectory, composite.url, "index.html");
  if (!fs.existsSync(compositePath)) {
    failures.push(`composite artwork page "${composite.url}" was not generated.`);
  } else {
    const compositeDocument = parseDocument(fs.readFileSync(compositePath, "utf8"));
    composite.components.forEach((component) => {
      const artwork = records.find((record) => record.artwork_id === component.artwork_id);
      if (!artwork) return;
      const componentLink = DomUtils.findOne(
        (node) => node.name === "a" && getAttribute(node, "href") === `/artwork/${artwork.slug}/`,
        compositeDocument.children
      );
      if (!componentLink) {
        failures.push(`composite page "${composite.url}" is missing component link to "${artwork.artwork_id}".`);
      }

      const artworkPath = path.join(outputDirectory, "artwork", artwork.slug, "index.html");
      if (!fs.existsSync(artworkPath)) return;
      const artworkDocument = parseDocument(fs.readFileSync(artworkPath, "utf8"));
      const parentLink = DomUtils.findOne(
        (node) => node.name === "a" && getAttribute(node, "href") === composite.url,
        artworkDocument.children
      );
      if (!parentLink || !DomUtils.textContent(parentLink).includes(composite.title)) {
        failures.push(`artwork page "/artwork/${artwork.slug}/" is missing its reciprocal Part of link.`);
      }
    });
  }
});

for (const file of htmlFiles) {
  const document = parseDocument(fs.readFileSync(file, "utf8"));
  const images = DomUtils.findAll((node) => node.name === "img", document.children);
  for (const image of images) {
    if (getAttribute(image, "alt") === undefined) {
      failures.push(`${path.relative(outputDirectory, file)}: image is missing an alt attribute.`);
    }
    if (!Number(getAttribute(image, "width")) || !Number(getAttribute(image, "height"))) {
      failures.push(`${path.relative(outputDirectory, file)}: image is missing intrinsic dimensions.`);
    }
    for (const attribute of ["src", "srcset"]) {
      const value = getAttribute(image, attribute);
      if (attribute === "srcset") {
        checkSrcset(value, file);
      } else {
        const target = resolveLocalUrl(value, file);
        if (target && !fs.existsSync(target)) {
          failures.push(`${path.relative(outputDirectory, file)}: missing image "${value}".`);
        }
      }
      DomUtils.findAll((node) => Boolean(getAttribute(node, "srcset")), document.children).forEach((node) => {
        checkSrcset(getAttribute(node, "srcset"), file);
      });
    }
  }

  const links = DomUtils.findAll((node) => node.name === "a", document.children);
  for (const link of links) {
    const target = resolveLocalUrl(getAttribute(link, "href"), file);
    if (target && !fs.existsSync(target)) {
      failures.push(`${path.relative(outputDirectory, file)}: broken internal link "${link.attribs.href}".`);
    }
    const imageAlt = DomUtils.findOne((node) => node.name === "img" && getAttribute(node, "alt"), [link]);
    if (!getAttribute(link, "aria-label") && !DomUtils.textContent(link).trim() && !imageAlt) {
      failures.push(`${path.relative(outputDirectory, file)}: link has no accessible name.`);
    }
  }

  const buttons = DomUtils.findAll((node) => node.name === "button", document.children);
  buttons.forEach((button) => {
    if (!getAttribute(button, "aria-label") && !DomUtils.textContent(button).trim()) {
      failures.push(`${path.relative(outputDirectory, file)}: button has no accessible name.`);
    }
  });
  const controls = DomUtils.findAll(
    (node) => ["input", "select", "textarea"].includes(node.name),
    document.children
  );
  controls.forEach((control) => {
    const id = getAttribute(control, "id");
    const hasLabel =
      getAttribute(control, "aria-label") ||
      (id && DomUtils.findOne((node) => node.name === "label" && getAttribute(node, "for") === id, document.children)) ||
      DomUtils.findOne((node) => node.name === "label" && node.children && node.children.includes(control), document.children);
    if (!hasLabel) failures.push(`${path.relative(outputDirectory, file)}: form control has no accessible label.`);
  });

  const headings = DomUtils.findAll((node) => /^h[1-6]$/.test(node.name || ""), document.children);
  const h1Count = headings.filter((heading) => heading.name === "h1").length;
  if (h1Count !== 1) failures.push(`${path.relative(outputDirectory, file)}: expected one h1, found ${h1Count}.`);
  let previousLevel = 0;
  headings.forEach((heading) => {
    const level = Number(heading.name.slice(1));
    if (previousLevel && level > previousLevel + 1) {
      failures.push(`${path.relative(outputDirectory, file)}: heading level skips from h${previousLevel} to h${level}.`);
    }
    previousLevel = level;
  });

  const canonical = DomUtils.findOne(
    (node) => node.name === "link" && getAttribute(node, "rel") === "canonical",
    document.children
  );
  if (!canonical || !getAttribute(canonical, "href")) {
    failures.push(`${path.relative(outputDirectory, file)}: missing canonical URL.`);
  }

  if (file.startsWith(path.join(outputDirectory, "artwork") + path.sep)) {
    const relativeArtworkPath = path.relative(path.join(outputDirectory, "artwork"), file);
    const artworkSlug = relativeArtworkPath.split(path.sep)[0];
    const artwork = records.find((record) => record.slug === artworkSlug);
    const primaryFigure = DomUtils.findOne(
      (node) => node.name === "figure" && String(getAttribute(node, "class") || "").split(/\s+/).includes("artwork-primary-image"),
      document.children
    );
    const primaryImage = primaryFigure && DomUtils.findOne((node) => node.name === "img", [primaryFigure]);
    const primaryAsset = artwork && artwork.assets.find((asset) => asset.role === "primary");
    if (!primaryImage || !primaryAsset || getAttribute(primaryImage, "alt") !== primaryAsset.alt) {
      failures.push(`${path.relative(outputDirectory, file)}: primary artwork image does not use its authored catalogue alt text.`);
    }
    const socialImage = DomUtils.findOne(
      (node) => node.name === "meta" && getAttribute(node, "property") === "og:image",
      document.children
    );
    const jsonLd = DomUtils.findOne(
      (node) => node.name === "script" && getAttribute(node, "type") === "application/ld+json",
      document.children
    );
    if (!socialImage || !getAttribute(socialImage, "content")) {
      failures.push(`${path.relative(outputDirectory, file)}: missing Open Graph artwork image.`);
    }
    if (!jsonLd) {
      failures.push(`${path.relative(outputDirectory, file)}: missing VisualArtwork structured data.`);
    } else {
      try {
        if (JSON.parse(DomUtils.textContent(jsonLd))["@type"] !== "VisualArtwork") {
          failures.push(`${path.relative(outputDirectory, file)}: structured data is not a VisualArtwork.`);
        }
      } catch {
        failures.push(`${path.relative(outputDirectory, file)}: invalid JSON-LD.`);
      }
    }
  }

  if (file.startsWith(path.join(outputDirectory, "posts") + path.sep)) {
    const postRoute = `/${path.posix.dirname(path.relative(outputDirectory, file))}/`;
    const artwork = records.find((record) => {
      const primaryAsset = record.assets.find((asset) => asset.role === "primary");
      return primaryAsset && `${path.posix.dirname(primaryAsset.path)}/` === postRoute;
    });
    if (artwork) {
      const sourcePath = path.resolve(process.cwd(), "src", `${path.posix.dirname(path.relative(outputDirectory, file))}/index.md`);
      const sourceContent = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : "";
      const suppressPrimaryImage = /^suppressPrimaryImage:\s*true\s*$/m.test(sourceContent);
      if (!suppressPrimaryImage) {
        const postFigure = DomUtils.findOne(
          (node) => node.name === "figure" && String(getAttribute(node, "class") || "").split(/\s+/).includes("post-image"),
          document.children
        );
        const postImage = postFigure && DomUtils.findOne((node) => node.name === "img", [postFigure]);
        const primaryAsset = artwork.assets.find((asset) => asset.role === "primary");
        if (!postImage || getAttribute(postImage, "alt") !== primaryAsset.alt) {
          failures.push(`${path.relative(outputDirectory, file)}: primary post image does not use its authored catalogue alt text.`);
        }
      }
    }
  }
}

const sitemapPath = path.join(outputDirectory, "sitemap.xml");
if (!fs.existsSync(sitemapPath)) {
  failures.push("sitemap.xml was not generated.");
} else {
  const sitemap = fs.readFileSync(sitemapPath, "utf8");
  const sitemapEntries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (new Set(sitemapEntries).size !== sitemapEntries.length) {
    failures.push("sitemap.xml contains duplicate routes.");
  }
  records.forEach((artwork) => {
    if (!sitemap.includes(`/artwork/${artwork.slug}/`)) {
      failures.push(`sitemap is missing artwork route /artwork/${artwork.slug}/.`);
    }
  });
  ["/archive/", "/collection/", "/constellations/"].forEach((route) => {
    if (!sitemap.includes(route)) failures.push(`sitemap is missing collection route ${route}.`);
  });
}

if (failures.length) {
  failures.forEach((failure) => console.error(`[site check] ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Checked ${htmlFiles.length} HTML pages, ${artworkPages.length} artwork routes, ${catalogueAssetCount} catalogue assets, taxonomy counts, local links, responsive images, headings, SEO metadata, and sitemap entries.`);
}
