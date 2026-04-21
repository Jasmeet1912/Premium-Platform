const API = "http://localhost:5000/api";

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  content: [],
  report: null
};

const el = {
  authForm: document.getElementById("authForm"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  subscribeBtn: document.getElementById("subscribeBtn"),
  demoSubBtn: document.getElementById("demoSubBtn"),
  exportBtn: document.getElementById("exportBtn"),
  contentForm: document.getElementById("contentForm"),
  content: document.getElementById("content"),
  reportTable: document.getElementById("reportTable"),
  searchInput: document.getElementById("searchInput"),
  categoryFilter: document.getElementById("categoryFilter"),
  typeFilter: document.getElementById("typeFilter"),
  accessFilter: document.getElementById("accessFilter"),
  sessionBadge: document.getElementById("sessionBadge"),
  creatorGuard: document.getElementById("creatorGuard"),
  toast: document.getElementById("toast"),
  authHint: document.getElementById("authHint")
};

const authHeader = () => (state.token ? { Authorization: `Bearer ${state.token}` } : {});

const showToast = (message) => {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.add("hidden"), 3200);
};

const setSession = ({ token, user }) => {
  state.token = token;
  state.user = user;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  renderSession();
};

const clearSession = () => {
  state.token = "";
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  renderSession();
};

const api = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(data.message || data || "Request failed");
  }

  return data;
};

const renderSession = () => {
  const user = state.user;
  const label = user ? `${user.name} · ${user.role}${user.isSubscribed ? " · Premium" : ""}` : "Guest";

  el.sessionBadge.textContent = label;
  el.logoutBtn.classList.toggle("hidden", !user);
  el.creatorGuard.textContent = user && ["creator", "admin"].includes(user.role)
    ? "Publishing enabled"
    : "Login as creator to publish";
  el.authHint.textContent = user
    ? user.isSubscribed
      ? "Premium access is active. You can open gated content now."
      : "You are logged in. Upgrade to unlock premium assets."
    : "Creators can publish and export reports. Subscribers can unlock premium content.";
};

const metric = (id, value) => {
  document.getElementById(id).textContent = value;
};

const updateCatalogMetrics = (items) => {
  metric("metricContent", items.length);
  metric("metricPremium", items.filter((item) => item.accessLevel === "premium").length);
  metric("metricCategories", new Set(items.map((item) => item.category)).size);
};

const getFilters = () => {
  const params = new URLSearchParams();
  if (el.searchInput.value.trim()) params.set("q", el.searchInput.value.trim());
  if (el.categoryFilter.value) params.set("category", el.categoryFilter.value);
  if (el.typeFilter.value) params.set("type", el.typeFilter.value);
  if (el.accessFilter.value) params.set("accessLevel", el.accessFilter.value);
  return params.toString();
};

const renderContent = () => {
  if (!state.content.length) {
    el.content.innerHTML = `<div class="content-card"><h3>No content yet</h3><p class="muted-copy">Publish the first article, video, or course to populate the marketplace.</p></div>`;
    return;
  }

  el.content.innerHTML = state.content
    .map((item) => {
      const image = item.thumbnailUrl ? `<img src="${item.thumbnailUrl}" alt="${item.title}">` : "";

      return `
        <article class="content-card ${item.fullAccess ? "" : "locked"}">
          ${image}
          <div class="content-meta">
            <span class="pill">${item.type}</span>
            <span class="pill">${item.category}</span>
            <span class="pill">${item.accessLevel}</span>
          </div>
          <div>
            <h3>${item.title}</h3>
            <p class="muted-copy">By ${item.creatorName}</p>
          </div>
          <p>${item.body}</p>
          <div class="content-meta">
            <span>${item.durationMinutes || 0} min</span>
            <span>${item.lessonCount || 0} lessons</span>
            <span>${item.metrics.views} views</span>
            <span>${item.metrics.likes} likes</span>
          </div>
          ${item.fullAccess && item.videoUrl ? `<a href="${item.videoUrl}" target="_blank" rel="noreferrer">Open video</a>` : ""}
          ${item.fullAccess ? "" : `<p class="muted-copy">${item.lockedReason}</p>`}
          <div class="content-actions">
            <button class="ghost-btn" type="button" onclick="trackEngagement('${item._id}', 'view')">View</button>
            <button class="ghost-btn" type="button" onclick="likeContent('${item._id}')">Like</button>
            <button class="ghost-btn" type="button" onclick="trackEngagement('${item._id}', 'complete')">Complete</button>
            <button class="ghost-btn" type="button" onclick="commentOnContent('${item._id}')">Comment</button>
          </div>
        </article>
      `;
    })
    .join("");
};

const loadContent = async () => {
  const query = getFilters();
  const response = await fetch(`${API}/content${query ? `?${query}` : ""}`, {
    headers: { ...authHeader() }
  });
  state.content = await response.json();
  updateCatalogMetrics(state.content);
  renderContent();
};

const loadCurrentUser = async () => {
  if (!state.token) return;

  try {
    state.user = await api("/auth/me", { method: "GET" });
    localStorage.setItem("user", JSON.stringify(state.user));
  } catch {
    clearSession();
  }
};

const renderReport = () => {
  const report = state.report;
  if (!report) {
    document.getElementById("reportRevenue").textContent = "$0.00";
    document.getElementById("reportViews").textContent = "0";
    document.getElementById("reportSubscribers").textContent = "0";
    el.reportTable.className = "report-table empty-state";
    el.reportTable.textContent = "Log in as a creator to view performance data.";
    return;
  }

  document.getElementById("reportRevenue").textContent = `$${Number(report.summary.estimatedRevenue).toFixed(2)}`;
  document.getElementById("reportViews").textContent = report.summary.totalViews;
  document.getElementById("reportSubscribers").textContent = report.summary.activeSubscribers;

  el.reportTable.className = "report-table";
  el.reportTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Type</th>
          <th>Category</th>
          <th>Views</th>
          <th>Likes</th>
          <th>Completions</th>
        </tr>
      </thead>
      <tbody>
        ${report.content
          .map(
            (item) => `
              <tr>
                <td>${item.title}</td>
                <td>${item.type}</td>
                <td>${item.category}</td>
                <td>${item.views}</td>
                <td>${item.likes}</td>
                <td>${item.completions}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
};

const loadReport = async () => {
  if (!state.user || !["creator", "admin"].includes(state.user.role)) {
    state.report = null;
    renderReport();
    return;
  }

  try {
    state.report = await api("/reports/overview", { method: "GET" });
  } catch (error) {
    state.report = null;
    showToast(error.message);
  }
  renderReport();
};

const register = async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    role: document.getElementById("role").value
  };

  const data = await api("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  setSession(data);
  showToast("Account created");
  await Promise.all([loadContent(), loadReport()]);
};

const login = async () => {
  const data = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    })
  });
  setSession(data);
  showToast("Welcome back");
  await Promise.all([loadContent(), loadReport()]);
};

const ensureAuth = () => {
  if (state.token) return true;
  showToast("Please log in first");
  return false;
};

const subscribe = async () => {
  if (!ensureAuth()) return;

  const data = await api("/payment/checkout", { method: "POST" });
  if (data.mode === "stripe" && data.url) {
    window.location.href = data.url;
    return;
  }

  showToast(data.message || "Stripe is unavailable. Use demo access instead.");
};

const activateDemoSubscription = async () => {
  if (!ensureAuth()) return;
  const data = await api("/payment/checkout/demo", { method: "POST" });
  state.user = data.user;
  localStorage.setItem("user", JSON.stringify(data.user));
  renderSession();
  showToast("Demo subscription activated");
  await loadContent();
};

const publishContent = async (event) => {
  event.preventDefault();
  if (!ensureAuth()) return;
  if (!state.user || !["creator", "admin"].includes(state.user.role)) {
    showToast("Creator access is required to publish");
    return;
  }

  await api("/content", {
    method: "POST",
    body: JSON.stringify({
      title: document.getElementById("title").value.trim(),
      summary: document.getElementById("summary").value.trim(),
      body: document.getElementById("contentBody").value.trim(),
      type: document.getElementById("type").value,
      category: document.getElementById("category").value,
      accessLevel: document.getElementById("accessLevel").value,
      durationMinutes: document.getElementById("durationMinutes").value,
      lessonCount: document.getElementById("lessonCount").value,
      tags: document.getElementById("tags").value,
      thumbnailUrl: document.getElementById("thumbnailUrl").value.trim(),
      videoUrl: document.getElementById("videoUrl").value.trim()
    })
  });

  el.contentForm.reset();
  document.getElementById("durationMinutes").value = 15;
  document.getElementById("lessonCount").value = 1;
  showToast("Content published");
  await Promise.all([loadContent(), loadReport(), loadCurrentUser()]);
};

window.likeContent = async (id) => {
  if (!ensureAuth()) return;
  await api(`/content/like/${id}`, { method: "POST" });
  showToast("Content liked");
  await Promise.all([loadContent(), loadReport()]);
};

window.commentOnContent = async (id) => {
  if (!ensureAuth()) return;
  const text = window.prompt("Add your comment");
  if (!text) return;
  await api(`/content/comment/${id}`, {
    method: "POST",
    body: JSON.stringify({ text })
  });
  showToast("Comment added");
};

window.trackEngagement = async (id, action) => {
  if (!ensureAuth()) return;
  await api(`/content/engagement/${id}`, {
    method: "POST",
    body: JSON.stringify({ action })
  });
  if (action === "view") showToast("View recorded");
  if (action === "complete") showToast("Completion recorded");
  await Promise.all([loadContent(), loadReport()]);
};

const exportCsv = async () => {
  if (!ensureAuth()) return;

  const response = await fetch(`${API}/reports/export.csv`, {
    headers: { ...authHeader() }
  });
  if (!response.ok) {
    const error = await response.json();
    showToast(error.message || "Export failed");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "creator-report.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const maybeConfirmCheckout = async () => {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("checkout");
  const sessionId = params.get("session_id");

  if (status === "cancelled") {
    showToast("Checkout was cancelled");
    return;
  }

  if (status === "success" && sessionId && state.token) {
    try {
      const data = await api("/payment/confirm", {
        method: "POST",
        body: JSON.stringify({ sessionId })
      });
      state.user = data.user;
      localStorage.setItem("user", JSON.stringify(data.user));
      renderSession();
      showToast("Subscription confirmed");
      window.history.replaceState({}, "", window.location.pathname);
      await loadContent();
    } catch (error) {
      showToast(error.message);
    }
  }
};

const bindEvents = () => {
  el.authForm.addEventListener("submit", (event) => register(event).catch((error) => showToast(error.message)));
  el.loginBtn.addEventListener("click", () => login().catch((error) => showToast(error.message)));
  el.logoutBtn.addEventListener("click", () => {
    clearSession();
    loadReport();
    loadContent();
    showToast("Logged out");
  });
  el.subscribeBtn.addEventListener("click", () => subscribe().catch((error) => showToast(error.message)));
  el.demoSubBtn.addEventListener("click", () => activateDemoSubscription().catch((error) => showToast(error.message)));
  el.contentForm.addEventListener("submit", (event) => publishContent(event).catch((error) => showToast(error.message)));
  el.exportBtn.addEventListener("click", exportCsv);

  [el.searchInput, el.categoryFilter, el.typeFilter, el.accessFilter].forEach((node) =>
    node.addEventListener("input", () => loadContent().catch((error) => showToast(error.message)))
  );
};

const init = async () => {
  bindEvents();
  renderSession();
  await loadCurrentUser();
  renderSession();
  await Promise.all([loadContent(), loadReport()]);
  await maybeConfirmCheckout();
};

init().catch((error) => showToast(error.message));
