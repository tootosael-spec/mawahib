const filters = document.querySelectorAll(".filter");
const grid = document.querySelector("#talentGrid");
const search = document.querySelector("#search");
const demoNote = document.querySelector(".demo-note");
let activeCategory = "الكل";

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
  grid.innerHTML = (rows || []).map((talent, index) => {
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

const client = window.supabase?.createClient(
  window.MAWAHIB_CONFIG.url,
  window.MAWAHIB_CONFIG.publishableKey
);

async function loadPublishedTalents() {
  if (!client) return;
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

const message = document.querySelector("#auth-message");
const formWrap = document.querySelector("#auth-form-wrap");
const accountState = document.querySelector("#account-state");
const displayName = document.querySelector("#display-name");
const emailInput = document.querySelector("#auth-email");
const passwordInput = document.querySelector("#auth-password");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function showAccount(user) {
  if (!user) {
    formWrap.hidden = false;
    accountState.hidden = true;
    return;
  }
  formWrap.hidden = true;
  accountState.hidden = false;
  document.querySelector("#account-heading").textContent =
    `أهلاً بك ${user.user_metadata?.display_name || ""} في مواهب`;
  document.querySelector("#account-email").textContent = user.email || "";
  const verificationNote = document.querySelector("#account-state p");
  const isEmailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
  if (verificationNote) {
    verificationNote.textContent = isEmailConfirmed
      ? "تم تأكيد بريدك الإلكتروني بنجاح ✓ حسابك جاهز لاستخدام مواهب. سنضيف في المرحلة التالية صفحة إنشاء ملف موهبتك."
      : "حسابك مسجل، لكن بريدك الإلكتروني لم يتأكد بعد. افتح رسالة التأكيد في بريدك الإلكتروني.";
  }
}

async function refreshSession() {
  if (!client) {
    showMessage("تعذر تحميل خدمة الحسابات. أعد تحميل الصفحة.", true);
    return;
  }
  const { data } = await client.auth.getSession();
  showAccount(data.session?.user || null);
}

document.querySelector("#signup-button")?.addEventListener("click", async () => {
  if (!client) return showMessage("تعذر الاتصال بخدمة الحسابات. تحقق من إعداد Supabase ثم أعد المحاولة.", true);
  const name = displayName.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!name || !email || password.length < 8) {
    showMessage("أدخل الاسم والبريد الإلكتروني وكلمة مرور من ٨ أحرف على الأقل.", true);
    return;
  }
  showMessage("جارٍ إنشاء الحساب...");
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { display_name: name }, emailRedirectTo: window.location.origin }
  });
  if (error) return showMessage(error.message, true);
  if (data.session) {
    showAccount(data.user);
    showMessage("تم إنشاء حسابك بنجاح.");
  } else {
    showMessage("تم إرسال رسالة تأكيد إلى بريدك الإلكتروني. افتحها لتفعيل الحساب ثم سجّل الدخول.");
  }
});

document.querySelector("#login-button")?.addEventListener("click", async () => {
  if (!client) return showMessage("تعذر الاتصال بخدمة الحسابات. تحقق من إعداد Supabase ثم أعد المحاولة.", true);
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return showMessage("أدخل البريد الإلكتروني وكلمة المرور.", true);
  showMessage("جارٍ تسجيل الدخول...");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return showMessage("تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.", true);
  showAccount(data.user);
  showMessage("تم تسجيل الدخول بنجاح.");
});

document.querySelector("#logout-button")?.addEventListener("click", async () => {
  if (!client) return showMessage("تعذر الاتصال بخدمة الحسابات.", true);
  const { error } = await client.auth.signOut();
  if (error) return showMessage("تعذر تسجيل الخروج. حاول مرة أخرى.", true);
  showAccount(null);
  showMessage("تم تسجيل الخروج.");
});

client?.auth.onAuthStateChange((_event, session) => showAccount(session?.user || null));
loadPublishedTalents();
refreshSession();
