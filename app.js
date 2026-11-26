const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".talent-card");
const search = document.querySelector("#search");
let activeCategory = "الكل";
function updateGallery() {
  const term = (search.value || "").trim().toLowerCase();
  cards.forEach(card => {
    const categoryMatch = activeCategory === "الكل" || card.dataset.category === activeCategory;
    const text = (card.dataset.name + " " + card.dataset.category + " " + card.innerText).toLowerCase();
    card.hidden = !(categoryMatch && text.includes(term));
  });
}
filters.forEach(button => button.addEventListener("click", () => {
  activeCategory = button.dataset.category;
  filters.forEach(item => item.classList.toggle("active", item === button));
  updateGallery();
}));
search.addEventListener("input", updateGallery);
document.querySelector("#year").textContent = new Date().getFullYear();