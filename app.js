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
  loadOwnedTalents();
  document.querySelector("#account-heading").textContent =
    `أهلاً بك ${user.user_metadata?.display_name || ""} في مواهب`;
  document.querySelector("#account-email").textContent = user.email || "";
  const verificationNote = document.querySelector("#email-status-note");
  const isEmailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
  if (verificationNote) {
    verificationNote.textContent = isEmailConfirmed
      ? "تم تأكيد بريدك الإلكتروني بنجاح ✓ يمكنك الآن إنشاء ملف موهبتك."
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

const categorySelect = document.querySelector("#talent-category");
const talentMessage = document.querySelector("#talent-message");
const createTalentButton = document.querySelector("#create-talent-button");

const talentCategoryOptions = [
  ["arts", "الفنون والرسم"],
  ["voice", "الأداء الصوتي والإنشاد"],
  ["acting-content", "التمثيل وصناعة المحتوى"],
  ["sports", "الرياضة والمهارات البدنية"],
  ["photography", "التصوير"],
  ["innovation", "الابتكار والاختراعات"],
  ["cooking-crafts", "الطبخ والحرف"],
  ["other", "مواهب أخرى"]
];

function loadTalentCategories() {
  if (!categorySelect) return;
  categorySelect.innerHTML = '<option value="">اختر مجال الموهبة</option>' +
    talentCategoryOptions.map(([slug, name]) =>
      `<option value="${slug}">${escapeHtml(name)}</option>`
    ).join("");
}

createTalentButton?.addEventListener("click", async () => {
  if (!client) return;
  const title = document.querySelector("#talent-title").value.trim();
  const categoryValue = categorySelect?.value || "";
  const description = document.querySelector("#talent-description").value.trim();
  if (!title || !categoryValue || !description) {
    talentMessage.textContent = "أكمل اسم الموهبة والمجال والوصف قبل الحفظ.";
    talentMessage.classList.add("error");
    return;
  }
  createTalentButton.disabled = true;
  talentMessage.classList.remove("error");
  talentMessage.textContent = "جارٍ حفظ ملف موهبتك...";
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new Error("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");
    const { data: category, error: categoryError } = await client
      .from("talent_categories")
      .select("id")
      .eq("slug", categoryValue)
      .eq("is_active", true)
      .maybeSingle();
    if (categoryError) throw categoryError;
    if (!category) throw new Error("هذا المجال غير متاح حالياً. اختر مجالاً آخر.");

    const { data: createdTalent, error } = await client.from("talents").insert({
      owner_id: userData.user.id,
      title,
      category_id: category.id,
      description,
      status: "pending"
    }).select("id").single();
    if (error) throw error;
    await loadOwnedTalents();
    if (mediaTalentSelect) mediaTalentSelect.value = createdTalent.id;
    document.querySelector("#talent-title").value = "";
    document.querySelector("#talent-description").value = "";
    categorySelect.value = "";
    talentMessage.textContent = "تم حفظ ملف موهبتك وإرساله للمراجعة. سيظهر في المعرض بعد اعتماده.";
  } catch (error) {
    talentMessage.textContent = error.message || "تعذر حفظ الملف. حاول مرة أخرى.";
    talentMessage.classList.add("error");
  } finally {
    createTalentButton.disabled = false;
  }
});

const mediaTalentSelect = document.querySelector("#media-talent-select");
const imageFileInput = document.querySelector("#talent-image-file");
const uploadImageButton = document.querySelector("#upload-image-button");
const mediaMessage = document.querySelector("#media-message");

async function loadOwnedTalents() {
  if (!client || !mediaTalentSelect) return;
  const list = document.querySelector("#my-talents-list");
  mediaTalentSelect.innerHTML = '<option value="">اختر ملف الموهبة</option>';
  if (list) list.textContent = "جارٍ تحميل مواهبك...";
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new Error("سجّل الدخول لعرض مواهبك.");
    const { data, error } = await client
      .from("talents")
      .select("id,title,description,status,created_at,talent_categories(name)")
      .eq("owner_id", userData.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      if (list) list.textContent = "لم تضف أي موهبة حتى الآن.";
      return;
    }
    data.forEach(talent => {
      const option = document.createElement("option");
      option.value = talent.id;
      option.textContent = talent.title;
      mediaTalentSelect.appendChild(option);
    });

    if (list) {
      list.replaceChildren();
      const statusLabels = {
        pending: "بانتظار المراجعة",
        published: "معتمدة ومنشورة",
        rejected: "تحتاج إلى تعديل",
        hidden: "مخفية"
      };
      data.forEach(talent => {
        const card = document.createElement("article");
        card.className = "my-talent-card";
        const heading = document.createElement("h5");
        heading.textContent = talent.title;
        const category = document.createElement("p");
        category.textContent = talent.talent_categories?.name || "مجال غير محدد";
        const status = document.createElement("span");
        status.className = "my-talent-status";
        status.textContent = statusLabels[talent.status] || "قيد المراجعة";
        card.append(heading, category, status);
        list.appendChild(card);
      });
    }
  } catch (error) {
    if (list) list.textContent = error.message || "تعذر تحميل مواهبك.";
    mediaMessage.textContent = error.message || "تعذر تحميل ملفاتك.";
    mediaMessage.classList.add("error");
  }
}

uploadImageButton?.addEventListener("click", async () => {
  if (!client) return;
  const talentId = mediaTalentSelect?.value;
  const file = imageFileInput?.files?.[0];
  mediaMessage.classList.remove("error");
  if (!talentId) {
    mediaMessage.textContent = "اختر ملف الموهبة أولاً.";
    mediaMessage.classList.add("error");
    return;
  }
  if (!file) {
    mediaMessage.textContent = "اختر صورة من جهازك أولاً.";
    mediaMessage.classList.add("error");
    return;
  }
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    mediaMessage.textContent = "الصيغ المسموحة: JPG أو PNG أو WEBP فقط.";
    mediaMessage.classList.add("error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    mediaMessage.textContent = "حجم الصورة أكبر من 5 ميجابايت.";
    mediaMessage.classList.add("error");
    return;
  }

  uploadImageButton.disabled = true;
  mediaMessage.textContent = "جارٍ رفع الصورة...";
  let uploadedPath = "";
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new Error("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    uploadedPath = userData.user.id + "/" + talentId + "/" + crypto.randomUUID() + "." + extension;
    const { error: uploadError } = await client.storage
      .from("talent-media")
      .upload(uploadedPath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });
    if (uploadError) throw uploadError;

    const { error: recordError } = await client.from("talent_media").insert({
      talent_id: talentId,
      owner_id: userData.user.id,
      media_type: "image",
      file_url: uploadedPath,
      scan_status: "pending"
    });
    if (recordError) {
      await client.storage.from("talent-media").remove([uploadedPath]);
      uploadedPath = "";
      throw recordError;
    }
    imageFileInput.value = "";
    mediaMessage.textContent = "تم رفع الصورة بنجاح وإرسالها للمراجعة. لن تظهر للزوار إلا بعد اعتمادها.";
  } catch (error) {
    mediaMessage.textContent = error.message || "تعذر رفع الصورة. حاول مرة أخرى.";
    mediaMessage.classList.add("error");
  } finally {
    uploadImageButton.disabled = false;
  }
});

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
loadTalentCategories();
refreshSession();


// تنقل صفحة الحساب كصفحة مستقلة داخل التطبيق.
function syncPageView() {
  document.body.classList.toggle("account-page-mode", window.location.hash === "#account");
}
window.addEventListener("hashchange", syncPageView);
syncPageView();
