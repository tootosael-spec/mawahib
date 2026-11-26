const filters = document.querySelectorAll(".filter");
const grid = document.querySelector("#talentGrid");
const search = document.querySelector("#search");
const demoNote = document.querySelector(".demo-note");
let activeCategory = "الكل";
let liveCards = [];

const categoryAliases = {
  "الفنون والرسم": "الفنون",
  "الأداء الصوتي والإنشاد": "الأداء الصوتي",
  "التمثيل وصناعة المحتوى": "الفنون",
  "الرياضة والمهارات البدنية": "الرياضة",
  "التصوير": "التصوير",
  "الابتكار والاختراعات": "الابتكار",
  "الطبخ والحرف": "الحرف",
  "مواهب أخرى": "الكل"
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function renderTalents(rows) {
  liveCards = rows || [];
  grid.innerHTML = liveCards.map((talent, index) => {
    const category = talent.talent_categories?.name || "مواهب أخرى";
    const shortCategory = categoryAliases[category] || category;
    const palettes = ["art-pink", "art-blue", "art-gold", "art-green"];
    const symbols = ["✿", "◉", "♫", "✧"];
    const artwork = talent.cover_url
      ? `<img src="${escapeHtml(talent.cover_url)}" alt="" loading="lazy">`
      : `<span>${symbols[index % symbols.length]}</span><small>${escapeHtml(category)}</small>`;
    return `<article class="talent-card" data-category="${escapeHtml(shortCategory)}" data-name="${escapeHtml(talent.title)}">
      <div class="talent-art ${palettes[index % palettes.length]}">${artwork}</div>
      <div class="talent-info"><div><h3>${escapeHtml(talent.title)}</h3><p>${escapeHtml(talent.description || "موهبة تستحق المشاهدة")}</p></div><span class="talent-icon">✦</span></div>
    </article>`;
  }).join("");
  if (demoNote) demoNote.hidden = true;
  applyFilters();
}

function applyFilters() {
  const term = (search?.value || "").trim().toLowerCase();
  grid.querySelectorAll(".talent-card").forEach(card => {
    const categoryMatch = activeCategory === "الكل" || card.dataset.category === activeCategory;
    const text = (card.dataset.name + " " + card.dataset.category + " " + card.innerText).toLowerCase();
    card.hidden = !(categoryMatch && text.includes(term));
  });
}

filters.forEach(button => button.addEventListener("click", () => {
  activeCategory = button.dataset.category;
  filters.forEach(item => item.classList.toggle("active", item === button));
  applyFilters();
}));
search?.addEventListener("input", applyFilters);
document.querySelector("#year").textContent = new Date().getFullYear();

async function loadPublishedTalents() {
  if (!window.supabase || !window.MAWAHIB_CONFIG) return;
  const client = window.supabase.createClient(
    window.MAWAHIB_CONFIG.url,
    window.MAWAHIB_CONFIG.publishableKey
  );
  const { data, error } = await client
    .from("talents")
    .select("id,title,description,cover_url,created_at,talent_categories(name)")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Mawahib database:", error.message);
    return;
  }
  if (data) renderTalents(data);
}

loadPublishedTalents();
