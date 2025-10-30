async function loadGames() {
  try {
    const response = await fetch("games.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unexpected response: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Games manifest must be an array");
    }

    return data;
  } catch (error) {
    console.error("Failed to load games manifest", error);
    return null;
  }
}

const FILTER_CATEGORIES = [
  { label: "Arcade", value: "arcade" },
  { label: "Classic", value: "classic" },
  { label: "Shooter", value: "shooter" },
  { label: "Endless", value: "endless" },
  { label: "Experimental", value: "experimental" },
  { label: "Relaxing", value: "relaxing" },
  { label: "Challenge", value: "challenge" },
];

const HAS_STRING_NORMALIZE = typeof String.prototype.normalize === "function";
// Use a basic combining mark range so the search logic works in browsers that
// don't support Unicode property escapes (e.g. older Safari builds).
const DIACRITIC_PATTERN = /[\u0300-\u036f]/g;

document.addEventListener("DOMContentLoaded", async () => {
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

  const games = await loadGames();

  if (!Array.isArray(games)) {
    status.textContent = "Unable to load games.";
    emptyState.hidden = false;
    const emptyTitle = emptyState.querySelector("h2");
    const emptyMessage = emptyState.querySelector("p");
    if (emptyTitle) {
      emptyTitle.textContent = "Games manifest unavailable";
    }
    if (emptyMessage) {
      emptyMessage.textContent = "Refresh the page or check the repository configuration to restore the library.";
    }
    grid.setAttribute("aria-busy", "false");
    return;
  }

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
    if (text == null) {
      return "";
    }

    const safeText = String(text);
    const lower = safeText.toLowerCase();

    if (!HAS_STRING_NORMALIZE) {
      return lower;
    }

    return safeText.normalize("NFD").replace(DIACRITIC_PATTERN, "").toLowerCase();
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

    const matches = games
      .filter((game) => matchesQuery(game, query) && matchesFilters(game))
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));

    status.textContent = matches.length === games.length
      ? `Showing all ${games.length} games`
      : `Showing ${matches.length} of ${games.length} games`;

    grid.setAttribute("aria-busy", "true");
    grid.textContent = "";

    if (matches.length === 0) {
      emptyState.hidden = false;
      grid.setAttribute("aria-busy", "false");
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
    grid.setAttribute("aria-busy", "false");
  }

  searchInput.addEventListener("input", render);
  render();
});
