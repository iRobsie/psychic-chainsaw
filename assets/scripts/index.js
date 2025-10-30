const GAMES = [
  {
    slug: "pong",
    title: "Pong",
    href: "pong.html",
    description: "Face off against a reactive AI paddle in this faithful yet polished rendition of the arcade classic.",
    meta: ["Arcade", "Single player", "Keyboard"],
    tags: ["arcade", "classic", "quick", "sports"],
  },
  {
    slug: "breakout",
    title: "Breakout",
    href: "breakout.html",
    description: "Clear cascading waves of bricks with satisfying paddle control, power‑ups, and punchy particle FX.",
    meta: ["Arcade", "Reflex", "Keyboard"],
    tags: ["arcade", "classic", "brick-breaker"],
  },
  {
    slug: "snake",
    title: "Snake",
    href: "snake.html",
    description: "Grow the neon serpent, collect food, and survive as the grid fills with your own twisting tail.",
    meta: ["Arcade", "Endless", "Keyboard"],
    tags: ["arcade", "classic", "endless"],
  },
  {
    slug: "space-invaders",
    title: "Space Invaders",
    href: "space_invaders.html",
    description: "Defend Earth from descending alien squadrons with responsive shooting and smooth scaling difficulty.",
    meta: ["Shooter", "Retro", "Keyboard"],
    tags: ["shooter", "classic", "arcade"],
  },
  {
    slug: "bullet-hell",
    title: "Bullet Hell",
    href: "bullet_hell.html",
    description: "Dodge intricate bullet patterns and weave through mesmerizing particle storms to chase high scores.",
    meta: ["Shooter", "Endless", "Hard"],
    tags: ["shooter", "endless", "challenge"],
  },
  {
    slug: "procedural-snake",
    title: "Procedural Snake",
    href: "procedural_snake.html",
    description: "A modernized take on Snake with combo systems, magnetic boosts, and adaptive procedural level beats.",
    meta: ["Arcade", "Score chase", "Keyboard"],
    tags: ["arcade", "endless", "advanced"],
  },
  {
    slug: "space-trippin",
    title: "Space Trippin",
    href: "space_trippin.html",
    description: "Ride a synthwave hyperspace tunnel, dodge debris, and chase chill vibes in this experimental runner.",
    meta: ["Runner", "Endless", "Mouse"],
    tags: ["runner", "experimental", "endless"],
  },
  {
    slug: "tinycraft",
    title: "TinyCraft",
    href: "tinycraft.html",
    description: "A mini survival sandbox with crafting, exploration, and bite-sized progression loops.",
    meta: ["Simulation", "Creative", "Keyboard"],
    tags: ["strategy", "creative", "relaxing"],
  },
];

const FILTER_CATEGORIES = [
  { label: "Arcade", value: "arcade" },
  { label: "Classic", value: "classic" },
  { label: "Shooter", value: "shooter" },
  { label: "Endless", value: "endless" },
  { label: "Experimental", value: "experimental" },
  { label: "Relaxing", value: "relaxing" },
  { label: "Challenge", value: "challenge" },
];

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.querySelector("[data-role=game-grid]");
  const status = document.querySelector("[data-role=result-count]");
  const emptyState = document.querySelector("[data-role=empty-state]");
  const template = document.querySelector("#game-card-template");
  const filterRow = document.querySelector("[data-role=filter-row]");
  const searchInput = document.querySelector("#game-search");

  if (!grid || !status || !emptyState || !template || !filterRow || !searchInput) {
    console.warn("Game library UI failed to initialise: missing DOM nodes");
    return;
  }

  FILTER_CATEGORIES.forEach(({ label, value }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    button.textContent = label;
    button.setAttribute("data-filter", value);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => toggleFilter(value, button));
    filterRow.appendChild(button);
  });

  const activeFilters = new Set();

  function toggleFilter(value, button) {
    if (activeFilters.has(value)) {
      activeFilters.delete(value);
      button.setAttribute("aria-pressed", "false");
    } else {
      activeFilters.add(value);
      button.setAttribute("aria-pressed", "true");
    }

    render();
    button.blur();
  }

  function normalise(text) {
    return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  }

  function matchesQuery(game, query) {
    if (!query) return true;
    const haystack = normalise(`${game.title} ${game.description} ${game.tags.join(" ")}`);
    return haystack.includes(query);
  }

  function matchesFilters(game) {
    if (activeFilters.size === 0) return true;
    return [...activeFilters].every((tag) => game.tags.includes(tag));
  }

  function renderMeta(list, game) {
    list.textContent = "";
    game.meta.forEach((item) => {
      const li = document.createElement("li");
      li.className = "meta-pill";
      li.textContent = item;
      list.appendChild(li);
    });
  }

  function render() {
    const query = normalise(searchInput.value.trim());

    const matches = GAMES.filter((game) => matchesQuery(game, query) && matchesFilters(game))
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));

    status.textContent = matches.length === GAMES.length
      ? `Showing all ${GAMES.length} games`
      : `Showing ${matches.length} of ${GAMES.length} games`;

    grid.textContent = "";

    if (matches.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    const fragment = document.createDocumentFragment();

    matches.forEach((game) => {
      const instance = template.content.cloneNode(true);
      const card = instance.querySelector(".game-card");
      const title = instance.querySelector("[data-role=title]");
      const description = instance.querySelector("[data-role=description]");
      const meta = instance.querySelector("[data-role=meta]");
      const link = instance.querySelector("[data-role=link]");

      if (!card || !title || !description || !meta || !link) {
        return;
      }

      card.setAttribute("data-tags", game.tags.join(","));
      title.textContent = game.title;
      description.textContent = game.description;
      renderMeta(meta, game);
      link.href = game.href;
      link.textContent = "Play now";
      link.setAttribute("aria-label", `Play ${game.title}`);

      fragment.appendChild(instance);
    });

    grid.appendChild(fragment);
  }

  searchInput.addEventListener("input", render);
  render();
});
