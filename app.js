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

const sampleTalents = [
  { id: "sample-design", title: "مصمم هوية بصرية", description: "تصميم شعارات وهويات بصرية للمشاريع الصغيرة.", sampleServices: "تصميم شعار • هوية بصرية • منشورات تسويقية", talent_categories: { name: "الفنون والرسم" }, isDemo: true },
  { id: "sample-photo", title: "مصور منتجات", description: "تصوير احترافي للمنتجات والمتاجر الإلكترونية.", sampleServices: "تصوير منتجات • صور إعلانية • تنسيق جلسات تصوير", talent_categories: { name: "التصوير" }, isDemo: true },
  { id: "sample-voice", title: "معلّق صوتي", description: "تقديم تسجيلات صوتية للإعلانات والمقاطع التعريفية.", sampleServices: "تعليق إعلاني • مقدمة فيديو • تسجيل نصوص", talent_categories: { name: "الأداء الصوتي والإنشاد" }, isDemo: true },
  { id: "sample-crafts", title: "صانع أعمال يدوية", description: "ابتكار هدايا وقطع يدوية بتفاصيل مميزة.", sampleServices: "هدايا مخصصة • تغليف إبداعي • قطع ديكور", talent_categories: { name: "الطبخ والحرف" }, isDemo: true }
];

function renderTalents(rows) {
  if (!grid) return;
  const displayRows = [...(rows || []), ...sampleTalents];
  grid.innerHTML = displayRows.map((talent, index) => {
    const category = talent.talent_categories?.name || "مواهب أخرى";
    const shortCategory = categoryAliases[category] || category;
    const palettes = ["art-pink", "art-blue", "art-gold", "art-green"];
    const symbols = ["✿", "◉", "♫", "✧"];
    const artwork = talent.cover_url
      ? `<img src="${escapeHtml(talent.cover_url)}" alt="" loading="lazy">`
      : `<span>${symbols[index % symbols.length]}</span><small>${escapeHtml(category)}</small>`;
    const sampleLabel = talent.isDemo ? '<span class="sample-label">نموذج تجريبي</span>' : "";
    return `<article class="talent-card" data-talent-id="${escapeHtml(talent.id)}" data-category="${escapeHtml(shortCategory)}" data-name="${escapeHtml(talent.title)}" tabindex="0" role="button" aria-label="عرض موهبة ${escapeHtml(talent.title)}">
      <div class="talent-art ${palettes[index % palettes.length]}">${artwork}${sampleLabel}</div>
      <div class="talent-info"><div><h3>${escapeHtml(talent.title)}</h3><p>${escapeHtml(talent.description || "موهبة تستحق المشاهدة")}</p></div><span class="talent-icon">✦</span></div>
      <div class="talent-community-inline" aria-label="التفاعل والتعليقات"></div>
    </article>`;
  }).join("");
  if (demoNote) demoNote.hidden = false;
  applyFilters();
  displayRows.forEach(talent => {
    if (talent.isDemo) return;
    const card = [...grid.querySelectorAll(".talent-card")].find(item => item.dataset.talentId === talent.id);
    const target = card?.querySelector(".talent-community-inline");
    if (target) renderTalentCommunity(talent, target, true);
  });
}

function applyFilters() {
  if (!grid) return;
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
const yearElement = document.querySelector("#year");
if (yearElement) yearElement.textContent = new Date().getFullYear();

const client = window.supabase?.createClient(
  window.MAWAHIB_CONFIG.url,
  window.MAWAHIB_CONFIG.publishableKey
);

async function loadPublishedTalents() {
  if (!client || !grid) return;
  const { data, error } = await client
    .from("talents")
    .select("id,owner_id,title,description,cover_url,created_at,talent_categories(name)")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Mawahib database:", error.message);
    return;
  }
  if (data) {
    const ids = data.map(item => item.id);
    if (ids.length) {
      const { data: media, error: mediaError } = await client
        .from("talent_media")
        .select("talent_id,file_url")
        .in("talent_id", ids)
        .eq("media_type", "video")
        .eq("scan_status", "approved");
      if (mediaError) console.error("Approved talent videos:", mediaError.message);
      const byTalent = new Map();
      (media || []).forEach(item => {
        if (!byTalent.has(item.talent_id)) byTalent.set(item.talent_id, []);
        byTalent.get(item.talent_id).push(item.file_url);
      });
      data.forEach(item => { item.approvedVideos = byTalent.get(item.id) || []; });
    }
    publishedTalentRows = data;
    renderTalents(data);
  }
}


const talentDetail = document.querySelector("#talent-detail");
const detailTitle = document.querySelector("#detail-title");
const detailDescription = document.querySelector("#detail-description");
const detailVideos = document.querySelector("#detail-videos");
const detailContact = document.querySelector("#detail-contact");
const detailContactTrigger = document.querySelector("#detail-contact-trigger");
detailContactTrigger?.addEventListener("click", () => {
  detailContact?.scrollIntoView({ behavior: "smooth", block: "start" });
  detailContact?.querySelector("textarea")?.focus({ preventScroll: true });
});
const detailCommunity = document.querySelector("#detail-community");
let publishedTalentRows = [];

function showTalentDetail(talentId) {
  const talent = [...publishedTalentRows, ...sampleTalents].find(item => item.id === talentId);
  if (!talent || !talentDetail) return;
  detailTitle.textContent = talent.title;
  detailDescription.textContent = talent.description || "موهبة تستحق المشاهدة.";
  if (detailContactTrigger) detailContactTrigger.hidden = Boolean(talent.isDemo || !talent.owner_id);
  detailVideos.replaceChildren();
  if (detailContact) {
    detailContact.replaceChildren();
    if (!talent.isDemo && talent.owner_id) {
      const heading = document.createElement("h3");
      heading.textContent = "تواصل معي";
      const hint = document.createElement("p");
      hint.className = "detail-empty";
      hint.textContent = "اكتب طلبك وسيصل إلى صاحب الموهبة داخل مواهب. يلزم تسجيل الدخول لإرسال الطلب.";
      const field = document.createElement("textarea");
      field.maxLength = 2000;
      field.rows = 4;
      field.placeholder = "مثلاً: أحتاج تصميم شعار لمشروعي...";
      field.setAttribute("aria-label", "تفاصيل طلب الخدمة");
      const send = document.createElement("button");
      send.type = "button";
      send.className = "button";
      send.textContent = "إرسال طلب الخدمة";
      const status = document.createElement("p");
      status.className = "auth-message";
      send.addEventListener("click", async () => {
        const body = field.value.trim();
        if (body.length < 2) {
          status.textContent = "اكتب تفاصيل الطلب أولاً.";
          status.classList.add("error");
          return;
        }
        send.disabled = true;
        status.classList.remove("error");
        status.textContent = "جارٍ إرسال طلبك...";
        try {
          const { data: userData, error: userError } = await client.auth.getUser();
          if (userError || !userData.user) {
            status.textContent = "سجّل الدخول أولاً لإرسال طلبك.";
            const login = document.createElement("a");
            login.href = "account.html#account";
            login.className = "text-link";
            login.textContent = "الانتقال إلى تسجيل الدخول";
            status.appendChild(document.createTextNode(" "));
            status.appendChild(login);
            return;
          }
          if (userData.user.id === talent.owner_id) {
            throw new Error("لا يمكنك إرسال طلب إلى ملف موهبتك.");
          }
          let { data: conversation, error: conversationError } = await client
            .from("talent_conversations")
            .select("id")
            .eq("talent_id", talent.id)
            .eq("client_id", userData.user.id)
            .eq("talent_owner_id", talent.owner_id)
            .eq("status", "open")
            .limit(1)
            .maybeSingle();
          if (conversationError) throw conversationError;
          if (!conversation) {
            const created = await client.from("talent_conversations").insert({
              talent_id: talent.id,
              client_id: userData.user.id,
              talent_owner_id: talent.owner_id
            }).select("id").single();
            if (created.error) throw created.error;
            conversation = created.data;
          }
          const { error: messageError } = await client.from("talent_messages").insert({
            conversation_id: conversation.id,
            sender_id: userData.user.id,
            body
          });
          if (messageError) throw messageError;
          field.value = "";
          status.textContent = "وصل طلبك بنجاح. يمكنك متابعة الرد من صفحة «موهبتي».";
        } catch (error) {
          status.textContent = error.message || "تعذر إرسال الطلب. حاول مرة أخرى.";
          status.classList.add("error");
        } finally {
          send.disabled = false;
        }
      });
      detailContact.append(heading, hint, field, send, status);
    }
  }
  if (talent.isDemo) {
    const sample = document.createElement("p");
    sample.className = "detail-empty";
    sample.textContent = "خدمات نموذجية: " + talent.sampleServices + ". هذا الملف تجريبي للتوضيح فقط، وليس حساباً لشخص حقيقي.";
    detailVideos.appendChild(sample);
  }
  const links = (talent.approvedVideos || []).filter(value => {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      return url.protocol === "https:" && [
        "youtube.com","m.youtube.com","youtu.be","tiktok.com","vm.tiktok.com",
        "vt.tiktok.com","instagram.com","facebook.com","fb.watch"
      ].includes(host);
    } catch { return false; }
  });
  if (!links.length && !talent.isDemo) {
    const note = document.createElement("p");
    note.className = "detail-empty";
    note.textContent = "لا توجد فيديوهات معتمدة لهذه الموهبة حتى الآن.";
    detailVideos.appendChild(note);
  } else {
    links.forEach((url, index) => {
      const link = document.createElement("a");
      link.className = "button";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `مشاهدة الفيديو ${index + 1}`;
      detailVideos.appendChild(link);
    });
  }
  renderTalentCommunity(talent);
  talentDetail.hidden = false;
  document.body.classList.add("detail-open");
}


function getCommunityVisitorId() {
  const key = "mawahib_community_visitor";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

async function renderTalentCommunity(talent, target = detailCommunity, inline = false) {
  if (!target) return;
  target.replaceChildren();
  if (talent.isDemo || !client) {
    const note = document.createElement("p");
    note.className = "detail-empty";
    note.textContent = "التفاعل والتعليقات متاحة على ملفات المواهب المنشورة فقط.";
    target.appendChild(note);
    return;
  }

  const visitorId = getCommunityVisitorId();
  const section = document.createElement("section");
  section.className = "community-section";
  const reactionHeading = document.createElement("h3");
  reactionHeading.textContent = "رأيك يهمنا";
  const reactionRow = document.createElement("div");
  reactionRow.className = "reaction-row";
  const likeButton = document.createElement("button");
  const dislikeButton = document.createElement("button");
  likeButton.type = dislikeButton.type = "button";
  likeButton.className = dislikeButton.className = "reaction-button";
  likeButton.dataset.communityAction = "like";
  dislikeButton.dataset.communityAction = "dislike";
  const likeCount = document.createElement("span");
  const dislikeCount = document.createElement("span");
  likeCount.className = dislikeCount.className = "reaction-count";
  const likeIcon = document.createElement("span");
  const dislikeIcon = document.createElement("span");
  likeIcon.className = dislikeIcon.className = "reaction-icon";
  likeIcon.textContent = "♥";
  dislikeIcon.textContent = "▾";
  likeButton.append(likeIcon, document.createTextNode(" إعجاب "), likeCount);
  dislikeButton.append(dislikeIcon, document.createTextNode(" غير مناسب "), dislikeCount);
  reactionRow.append(likeButton, dislikeButton);
  const status = document.createElement("p");
  status.className = "auth-message";

  const refreshReactions = async () => {
    const [likes, dislikes, myLike, myDislike] = await Promise.all([
      client.from("talent_likes").select("id", { count: "exact", head: true }).eq("talent_id", talent.id),
      client.from("talent_dislikes").select("id", { count: "exact", head: true }).eq("talent_id", talent.id),
      client.from("talent_likes").select("id").eq("talent_id", talent.id).eq("visitor_id", visitorId).maybeSingle(),
      client.from("talent_dislikes").select("id").eq("talent_id", talent.id).eq("visitor_id", visitorId).maybeSingle()
    ]);
    if (likes.error || dislikes.error || myLike.error || myDislike.error) {
      throw likes.error || dislikes.error || myLike.error || myDislike.error;
    }
    likeCount.textContent = String(likes.count || 0);
    dislikeCount.textContent = String(dislikes.count || 0);
    likeButton.classList.toggle("selected", Boolean(myLike.data));
    dislikeButton.classList.toggle("selected", Boolean(myDislike.data));
  };

  const setReaction = async (kind) => {
    const button = kind === "like" ? likeButton : dislikeButton;
    const oppositeTable = kind === "like" ? "talent_dislikes" : "talent_likes";
    const table = kind === "like" ? "talent_likes" : "talent_dislikes";
    button.disabled = true;
    likeButton.disabled = true;
    dislikeButton.disabled = true;
    try {
      const [current, opposite] = await Promise.all([
        client.from(table).select("id").eq("talent_id", talent.id).eq("visitor_id", visitorId).maybeSingle(),
        client.from(oppositeTable).select("id").eq("talent_id", talent.id).eq("visitor_id", visitorId).maybeSingle()
      ]);
      if (current.error || opposite.error) throw current.error || opposite.error;

      if (opposite.data) {
        const { error } = await client.from(oppositeTable).delete()
          .eq("talent_id", talent.id).eq("visitor_id", visitorId);
        if (error) throw error;
      }

      if (current.data && !opposite.data) {
        const { error } = await client.from(table).delete()
          .eq("talent_id", talent.id).eq("visitor_id", visitorId);
        if (error) throw error;
        status.textContent = "تم إلغاء تفاعلك.";
      } else if (!current.data) {
        const { error } = await client.from(table).insert({
          talent_id: talent.id,
          visitor_id: visitorId,
          user_id: null
        });
        if (error) throw error;
        status.textContent = "شكراً لمشاركتك رأيك.";
      } else {
        status.textContent = "تم تحديث تفاعلك.";
      }
      status.classList.remove("error");
      await refreshReactions();
    } catch (error) {
      status.textContent = error.message || "تعذر تسجيل تفاعلك.";
      status.classList.add("error");
    } finally {
      button.disabled = false;
      likeButton.disabled = false;
      dislikeButton.disabled = false;
    }
  };
  likeButton.addEventListener("click", () => setReaction("like"));
  dislikeButton.addEventListener("click", () => setReaction("dislike"));
  const commentsModal = document.createElement("div");
  commentsModal.className = "community-comments-modal";
  commentsModal.setAttribute("role", "dialog");
  commentsModal.setAttribute("aria-modal", "true");
  commentsModal.setAttribute("aria-label", "تعليقات الموهبة");
  const commentsBackdrop = document.createElement("button");
  commentsBackdrop.type = "button";
  commentsBackdrop.className = "community-comments-backdrop";
  commentsBackdrop.setAttribute("aria-label", "إغلاق التعليقات");
  const commentsDialog = document.createElement("div");
  commentsDialog.className = "community-comments-dialog";
  const commentsModalHeader = document.createElement("div");
  commentsModalHeader.className = "community-comments-modal-header";
  const commentsModalTitle = document.createElement("strong");
  commentsModalTitle.textContent = "آراء المجتمع";
  const commentsClose = document.createElement("button");
  commentsClose.type = "button";
  commentsClose.className = "community-comments-close";
  commentsClose.setAttribute("aria-label", "إغلاق");
  commentsClose.textContent = "×";
  commentsModalHeader.append(commentsModalTitle, commentsClose);
  const commentsPanel = document.createElement("div");
  commentsPanel.className = "community-comments-panel";
  const closeCommentsModal = () => {
    commentsModal.remove();
    document.body.classList.remove("comments-modal-open");
  };
  commentsClose.addEventListener("click", closeCommentsModal);
  commentsBackdrop.addEventListener("click", closeCommentsModal);
  commentsDialog.append(commentsModalHeader, commentsPanel);
  commentsModal.append(commentsBackdrop, commentsDialog);
  const commentsToggle = document.createElement("button");
  commentsToggle.type = "button";
  commentsToggle.className = "comments-toggle";
  commentsToggle.dataset.communityAction = "comments";
  const commentsCount = document.createElement("span");
  commentsCount.className = "comments-count";
  commentsCount.textContent = "0";
  commentsToggle.append("💬 التعليقات ", commentsCount);
  commentsToggle.addEventListener("click", event => {
    event.stopPropagation();
    if (!document.body.contains(commentsModal)) {
      document.body.appendChild(commentsModal);
      document.body.classList.add("comments-modal-open");
      commentsClose.focus();
    }
  });
  const commentsHeading = document.createElement("h3");
  commentsHeading.textContent = "آراء المجتمع";
  const commentsList = document.createElement("div");
  commentsList.className = "community-comments";
  const loadComments = async () => {
    commentsList.replaceChildren();
    const { data, error } = await client.from("talent_comments")
      .select("id,body,created_at")
      .eq("talent_id", talent.id).eq("status", "published")
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    commentsCount.textContent = String(data?.length || 0);
    if (!data?.length) {
      const empty = document.createElement("p");
      empty.className = "detail-empty";
      empty.textContent = "لا توجد تعليقات حتى الآن. كن أول من يعلّق.";
      commentsList.appendChild(empty);
      return;
    }
    data.forEach(comment => {
      const item = document.createElement("article");
      item.className = "community-comment";
      const author = document.createElement("strong");
      author.textContent = "زائر";
      const body = document.createElement("p");
      body.textContent = comment.body;
      const date = document.createElement("small");
      date.textContent = new Date(comment.created_at).toLocaleDateString("ar-SA");
      const report = document.createElement("button");
      report.type = "button";
      report.className = "report-toggle comment-report";
      report.textContent = "⚑ إبلاغ عن التعليق";
      const reportStatus = document.createElement("small");
      report.addEventListener("click", async () => {
        if (report.disabled) return;
        report.disabled = true;
        try {
          const { error: reportError } = await client.from("talent_reports").insert({
            comment_id: comment.id,
            reporter_id: null,
            reason: "تعليق مشبوه أو مسيء",
            details: ""
          });
          if (reportError) throw reportError;
          reportStatus.textContent = "تم استلام البلاغ، شكراً لك.";
        } catch (error) {
          report.disabled = false;
          reportStatus.textContent = error.message || "تعذر إرسال البلاغ.";
        }
      });
      item.append(author, body, date, report, reportStatus);
      commentsList.appendChild(item);
    });
  };

  const commentInput = document.createElement("textarea");
  commentInput.rows = 3;
  commentInput.maxLength = 1000;
  commentInput.placeholder = "اكتب تعليقك (حتى 1000 حرف)...";
  commentInput.setAttribute("aria-label", "اكتب تعليقك");
  const commentButton = document.createElement("button");
  commentButton.type = "button";
  commentButton.className = "button";
  commentButton.textContent = "إرسال التعليق";
  const commentStatus = document.createElement("p");
  commentStatus.className = "auth-message";
  commentButton.addEventListener("click", async () => {
    const body = commentInput.value.trim();
    if (!body) {
      commentStatus.textContent = "اكتب تعليقك أولاً.";
      commentStatus.classList.add("error");
      return;
    }
    commentButton.disabled = true;
    try {
      const { error } = await client.from("talent_comments").insert({
        talent_id: talent.id,
        user_id: null,
        visitor_id: visitorId,
        body,
        status: "published"
      });
      if (error) {
        if (error.message?.includes("COMMENT_BLOCKED")) {
          throw new Error("تم حذف التعليق تلقائياً لأنه يحتوي على كلمات جنسية أو مؤذية.");
        }
        throw error;
      }
      commentInput.value = "";
      commentStatus.classList.remove("error");
      commentStatus.textContent = "تم نشر تعليقك.";
      await loadComments();
    } catch (error) {
      commentStatus.textContent = error.message || "تعذر إرسال التعليق.";
      commentStatus.classList.add("error");
    } finally {
      commentButton.disabled = false;
    }
  });
  commentsPanel.append(commentsHeading, commentsList, commentInput, commentButton, commentStatus);
  section.append(reactionHeading, reactionRow, status, commentsToggle);
  target.appendChild(section);

  try {
    await refreshReactions();
    await loadComments();
  } catch (error) {
    status.textContent = "تعذر تحميل بعض التفاعلات. حاول تحديث الصفحة.";
    status.classList.add("error");
  }
}

function closeTalentDetail() {
  if (!talentDetail) return;
  talentDetail.hidden = true;
  document.body.classList.remove("detail-open");
}

grid?.addEventListener("click", event => {
  const card = event.target.closest(".talent-card");
  if (!card) return;
  if (event.target.closest(".talent-community-inline")) return;
  showTalentDetail(card.dataset.talentId);
});
grid?.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest(".talent-community-inline")) return;
  const card = event.target.closest(".talent-card");
  if (card) {
    event.preventDefault();
    showTalentDetail(card.dataset.talentId);
  }
});
talentDetail?.querySelectorAll("[data-close-detail]").forEach(button =>
  button.addEventListener("click", closeTalentDetail)
);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    document.querySelectorAll(".community-comments-modal").forEach(modal => modal.remove());
    document.body.classList.remove("comments-modal-open");
    closeTalentDetail();
  }
});

const message = document.querySelector("#auth-message");
const formWrap = document.querySelector("#auth-form-wrap");
const accountState = document.querySelector("#account-state");
const displayName = document.querySelector("#display-name");
const emailInput = document.querySelector("#auth-email");
const passwordInput = document.querySelector("#auth-password");

function showMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function showAccount(user) {
  if (!formWrap || !accountState) return;
  if (!user) {
    formWrap.hidden = false;
    accountState.hidden = true;
    return;
  }
  formWrap.hidden = true;
  accountState.hidden = false;
  loadOwnedTalents();
  loadConversations();
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
  if (!formWrap || !accountState) return;
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
    }).select("id,status").single();
    if (error) throw error;
    await loadOwnedTalents();
    if (mediaTalentSelect) mediaTalentSelect.value = createdTalent.id;
    document.querySelector("#talent-title").value = "";
    document.querySelector("#talent-description").value = "";
    categorySelect.value = "";
    talentMessage.textContent = createdTalent.status === "published"
      ? "اجتاز ملف موهبتك الفحص التلقائي ونُشر في المعرض ✓"
      : "تم حفظ ملف موهبتك. رصد الفحص التلقائي مؤشرات تحتاج مراجعة إضافية قبل النشر.";
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

if (formWrap && accountState) {
  client?.auth.onAuthStateChange((_event, session) => showAccount(session?.user || null));
}
renderTalents([]);
loadPublishedTalents();
loadTalentCategories();
refreshSession();


// تنقل صفحة الحساب كصفحة مستقلة داخل التطبيق.
function syncPageView() {
  document.body.classList.toggle("account-page-mode", window.location.hash === "#account");
}
window.addEventListener("hashchange", syncPageView);
syncPageView();


const videoUrlInput = document.querySelector("#media-video-url");
const addVideoLinkButton = document.querySelector("#add-video-link-button");
const videoMessage = document.querySelector("#video-message");

function getSupportedSocialVideoUrl(value) {
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("أدخل رابط فيديو صحيحاً يبدأ بـ https://");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("لأمان حسابك، استخدم رابطاً آمناً يبدأ بـ https://");
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\\./, "");
  const supportedHosts = [
    "youtube.com", "m.youtube.com", "youtu.be",
    "tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
    "instagram.com",
    "facebook.com", "fb.watch"
  ];
  const isSupported = supportedHosts.includes(host);
  if (!isSupported) {
    throw new Error("الرابط غير مدعوم. استخدم YouTube أو TikTok أو Instagram أو Facebook.");
  }
  return parsed.href;
}

addVideoLinkButton?.addEventListener("click", async () => {
  if (!client) return;
  const talentId = mediaTalentSelect?.value;
  const rawUrl = videoUrlInput?.value || "";
  const report = (text, isError = false) => {
    if (!videoMessage) return;
    videoMessage.textContent = text;
    videoMessage.classList.toggle("error", isError);
  };
  if (!talentId) return report("اختر ملف الموهبة أولاً.", true);

  let videoUrl;
  try {
    videoUrl = getSupportedSocialVideoUrl(rawUrl);
  } catch (error) {
    return report(error.message, true);
  }

  addVideoLinkButton.disabled = true;
  report("جارٍ إرسال رابط الفيديو للمراجعة...");
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new Error("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");

    const { data: existing, error: lookupError } = await client
      .from("talent_media")
      .select("id")
      .eq("talent_id", talentId)
      .eq("owner_id", userData.user.id)
      .eq("file_url", videoUrl)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) throw new Error("سبق أن أرسلت هذا الرابط لهذه الموهبة.");

    const { error: recordError } = await client.from("talent_media").insert({
      talent_id: talentId,
      owner_id: userData.user.id,
      media_type: "video",
      file_url: videoUrl,
      scan_status: "pending"
    });
    if (recordError) throw recordError;

    videoUrlInput.value = "";
    report("تم إرسال رابط الفيديو للمراجعة. لن يظهر للزوار إلا بعد اعتماد الرابط والموهبة.");
  } catch (error) {
    report(error.message || "تعذر إرسال الرابط. حاول مرة أخرى.", true);
  } finally {
    addVideoLinkButton.disabled = false;
  }
});


// صندوق الرسائل الداخلي — لا يستطيع قراءة الرسائل إلا طرفا المحادثة.
let activeConversationId = null;
const conversationsList = document.querySelector("#conversations-list");
const conversationView = document.querySelector("#conversation-view");
const conversationMessages = document.querySelector("#conversation-messages");
const conversationHeading = document.querySelector("#conversation-heading");
const replyInput = document.querySelector("#reply-message");
const replyButton = document.querySelector("#send-reply-button");
const replyStatus = document.querySelector("#reply-message-status");

async function loadConversations() {
  if (!client || !conversationsList) return;
  conversationsList.textContent = "جارٍ تحميل الرسائل...";
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new Error("سجّل الدخول لعرض رسائلك.");
    const { data, error } = await client
      .from("talent_conversations")
      .select("id,talent_id,client_id,talent_owner_id,created_at,talents(title)")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    conversationsList.replaceChildren();
    if (!data?.length) {
      conversationsList.textContent = "لا توجد رسائل أو طلبات حتى الآن.";
      return;
    }
    data.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "conversation-list-item";
      const isOwner = item.talent_owner_id === userData.user.id;
      button.textContent = (item.talents?.title || "طلب خدمة") +
        (isOwner ? " — طلب وارد" : " — طلب أرسلته");
      button.addEventListener("click", () => openConversation(item.id));
      conversationsList.appendChild(button);
    });
  } catch (error) {
    conversationsList.textContent = error.message || "تعذر تحميل الرسائل.";
  }
}

async function openConversation(conversationId) {
  if (!client || !conversationMessages) return;
  activeConversationId = conversationId;
  conversationView.hidden = false;
  conversationMessages.textContent = "جارٍ تحميل المحادثة...";
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new Error("انتهت جلسة الدخول.");
    const { data: conversation, error: conversationError } = await client
      .from("talent_conversations")
      .select("id,talent_id,client_id,talent_owner_id,talents(title)")
      .eq("id", conversationId)
      .single();
    if (conversationError) throw conversationError;
    conversationHeading.textContent = "المحادثة: " + (conversation.talents?.title || "طلب خدمة");
    const { data, error } = await client
      .from("talent_messages")
      .select("id,sender_id,body,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    conversationMessages.replaceChildren();
    (data || []).forEach(item => {
      const bubble = document.createElement("div");
      bubble.className = "conversation-bubble" +
        (item.sender_id === userData.user.id ? " mine" : " theirs");
      const body = document.createElement("p");
      body.textContent = item.body;
      const time = document.createElement("small");
      time.textContent = new Date(item.created_at).toLocaleString("ar-SA");
      bubble.append(body, time);
      conversationMessages.appendChild(bubble);
    });
    conversationMessages.scrollTop = conversationMessages.scrollHeight;
  } catch (error) {
    conversationMessages.textContent = error.message || "تعذر تحميل المحادثة.";
  }
}

document.querySelector("#refresh-conversations-button")?.addEventListener("click", loadConversations);
replyButton?.addEventListener("click", async () => {
  const body = replyInput?.value.trim() || "";
  if (!activeConversationId || body.length < 1) {
    if (replyStatus) replyStatus.textContent = "اكتب رسالتك أولاً.";
    return;
  }
  replyButton.disabled = true;
  if (replyStatus) replyStatus.textContent = "جارٍ إرسال الرد...";
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new Error("انتهت جلسة الدخول.");
    const { error } = await client.from("talent_messages").insert({
      conversation_id: activeConversationId,
      sender_id: userData.user.id,
      body
    });
    if (error) throw error;
    replyInput.value = "";
    if (replyStatus) replyStatus.textContent = "تم إرسال الرد.";
    await openConversation(activeConversationId);
    await loadConversations();
  } catch (error) {
    if (replyStatus) {
      replyStatus.textContent = error.message || "تعذر إرسال الرد.";
      replyStatus.classList.add("error");
    }
  } finally {
    replyButton.disabled = false;
  }
});
