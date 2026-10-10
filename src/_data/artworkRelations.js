function termIds(artwork, field) {
  return (artwork[field] || [])
    .map((term) => (typeof term === "string" ? term : term.id))
    .filter(Boolean);
}

function relatedArtworks(artworks, current, explicitLimit = 4, semanticLimit = 4) {
  const seen = new Set([current.slug]);
  const explicit = [];
  (current.relationships || []).forEach((relationship) => {
    if (explicit.length >= explicitLimit || seen.has(relationship.target_slug)) return;
    const target = artworks.find((item) => item.slug === relationship.target_slug);
    if (!target) return;
    explicit.push({ artwork: target, relationshipType: relationship.type });
    seen.add(target.slug);
  });

  const currentMotifs = new Set(termIds(current, "motifs"));
  const currentThemes = new Set(termIds(current, "themes"));
  const semantic = artworks
    .filter((item) => !seen.has(item.slug))
    .map((item) => {
      const sharedTerms = [
        ...termIds(item, "motifs").filter((term) => currentMotifs.has(term)),
        ...termIds(item, "themes").filter((term) => currentThemes.has(term)),
      ];
      return sharedTerms.length ? { artwork: item, sharedTerms, score: sharedTerms.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.artwork.slug.localeCompare(b.artwork.slug))
    .slice(0, semanticLimit);

  return { explicit, semantic };
}

module.exports = { relatedArtworks };
