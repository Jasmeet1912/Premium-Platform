const API_URL = "https://premium-backend-04xk.onrender.com";

const getApiBase = () => `${API_URL}/api`;

const API = getApiBase();

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  content: [],
  report: null
};

const $ = (id) => document.getElementById(id);

const elements = {
  sessionBadge: $("sessionBadge"),
  themeToggle: $("themeToggle"),
  logoutBtn: $("logoutBtn"),
  authHint: $("authHint"),
  subscribeBtn: $("subscribeBtn"),
  demoSubBtn: $("demoSubBtn"),
  content: $("content"),
  searchInput: $("searchInput"),
  categoryFilter: $("categoryFilter"),
  typeFilter: $("typeFilter"),
  accessFilter: $("accessFilter"),
  registerForm: $("registerForm"),
  loginForm: $("loginForm"),
  resetPasswordForm: $("resetPasswordForm"),
  contentForm: $("contentForm"),
  exportBtn: $("exportBtn"),
  creatorGuard: $("creatorGuard"),
  reportTable: $("reportTable"),
  toast: $("toast"),
  forgotPasswordBtn: $("forgotPasswordBtn"),
  cancelResetBtn: $("cancelResetBtn"),
  toggleLoginPassword: $("toggleLoginPassword"),
  toggleResetPassword: $("toggleResetPassword")
};

const currentPage = window.location.pathname.split("/").pop() || "index.html";
const authHeader = () => (state.token ? { Authorization: `Bearer ${state.token}` } : {});
const storedTheme = localStorage.getItem("theme") || "light";

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  if (elements.themeToggle) {
    elements.themeToggle.textContent = theme === "dark" ? "Light" : "Dark";
  }
};

const showToast = (message) => {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.add("hidden"), 3200);
};

const setPasswordVisibility = (inputId, button, visible) => {
  const input = $(inputId);
  if (!input || !button) return;
  input.type = visible ? "text" : "password";
  button.textContent = visible ? "Hide" : "Show";
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

const formatInr = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(amount || 0));

const renderSession = () => {
  const user = state.user;
  const label = user ? `${user.name} · ${user.role}${user.isSubscribed ? " · Premium" : ""}` : "Guest";

  if (elements.sessionBadge) elements.sessionBadge.textContent = label;
  if (elements.logoutBtn) elements.logoutBtn.classList.toggle("hidden", !user);
  if (elements.creatorGuard) {
    elements.creatorGuard.textContent =
      user && ["creator", "admin"].includes(user.role) ? "Publishing enabled" : "Login as creator to publish";
  }
  if (elements.authHint) {
    elements.authHint.textContent = user
      ? user.isSubscribed
        ? "Premium access is active. You can open gated content now."
        : "You are logged in. Upgrade to unlock premium assets."
      : "Creators can publish and export reports. Subscribers can unlock premium content.";
  }
};

const metric = (id, value) => {
  const node = $(id);
  if (node) node.textContent = value;
};

const updateCatalogMetrics = (items) => {
  metric("metricContent", items.length);
  metric("metricPremium", items.filter((item) => item.accessLevel === "premium").length);
  metric("metricCategories", new Set(items.map((item) => item.category)).size);
};

const getFilters = () => {
  if (!elements.searchInput) return "";
  const params = new URLSearchParams();
  if (elements.searchInput.value.trim()) params.set("q", elements.searchInput.value.trim());
  if (elements.categoryFilter?.value) params.set("category", elements.categoryFilter.value);
  if (elements.typeFilter?.value) params.set("type", elements.typeFilter.value);
  if (elements.accessFilter?.value) params.set("accessLevel", elements.accessFilter.value);
  return params.toString();
};

const renderContent = () => {
  if (!elements.content) return;

  if (!state.content.length) {
    elements.content.innerHTML =
      '<div class="content-card"><h3>No content yet</h3><p class="muted-copy">Publish the first article, video, or course to populate the marketplace.</p></div>';
    return;
  }

  elements.content.innerHTML = state.content
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
  if (!elements.content) return;
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
  if (!$("reportRevenue")) return;

  const report = state.report;
  if (!report) {
    $("reportRevenue").textContent = formatInr(0);
    $("reportViews").textContent = "0";
    $("reportSubscribers").textContent = "0";
    if (elements.reportTable) {
      elements.reportTable.className = "report-table empty-state";
      elements.reportTable.textContent = "Log in as a creator to view performance data.";
    }
    return;
  }

  $("reportRevenue").textContent = formatInr(report.summary.estimatedRevenue);
  $("reportViews").textContent = report.summary.totalViews;
  $("reportSubscribers").textContent = report.summary.activeSubscribers;

  if (elements.reportTable) {
    elements.reportTable.className = "report-table";
    elements.reportTable.innerHTML = `
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
  }
};

const loadReport = async () => {
  if (!elements.reportTable && !$("reportRevenue")) return;

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

const ensureAuth = (redirect = false) => {
  if (state.token) return true;
  showToast("Please log in first");
  if (redirect) {
    setTimeout(() => {
      window.location.href = "login-page.html";
    }, 400);
  }
  return false;
};

const register = async (event) => {
  event.preventDefault();
  const data = await api("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: $("registerName").value.trim(),
      email: $("registerEmail").value.trim(),
      password: $("registerPassword").value,
      role: $("registerRole").value
    })
  });
  setSession(data);
  showToast("Account created");
  setTimeout(() => {
    window.location.href = "profile.html";
  }, 350);
};

const login = async (event) => {
  event.preventDefault();
  const data = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: $("loginEmail").value.trim(),
      password: $("loginPassword").value
    })
  });
  setSession(data);
  showToast("Welcome back");
  setTimeout(() => {
    window.location.href = "profile.html";
  }, 350);
};

const resetPassword = async (event) => {
  event.preventDefault();
  const data = await api("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      email: $("resetEmail").value.trim(),
      newPassword: $("resetPassword").value
    })
  });

  showToast(data.message);
  elements.resetPasswordForm?.classList.add("hidden");
  elements.loginForm?.classList.remove("hidden");
  if ($("resetEmail")) $("resetEmail").value = "";
  if ($("resetPassword")) $("resetPassword").value = "";
};

const subscribe = async () => {
  if (!ensureAuth(true)) return;
  const data = await api("/payment/checkout", { method: "POST" });
  if (data.mode === "stripe" && data.url) {
    window.location.href = data.url;
    return;
  }
  showToast(data.message || "Stripe is unavailable. Use demo access instead.");
};

const activateDemoSubscription = async () => {
  if (!ensureAuth(true)) return;
  const data = await api("/payment/checkout/demo", { method: "POST" });
  state.user = data.user;
  localStorage.setItem("user", JSON.stringify(data.user));
  renderSession();
  showToast("Demo subscription activated");
  await Promise.all([loadCurrentUser(), loadContent(), loadReport()]);
};

const publishContent = async (event) => {
  event.preventDefault();
  if (!ensureAuth(true)) return;
  if (!state.user || !["creator", "admin"].includes(state.user.role)) {
    showToast("Creator access is required to publish");
    return;
  }

  await api("/content", {
    method: "POST",
    body: JSON.stringify({
      title: $("title").value.trim(),
      summary: $("summary").value.trim(),
      body: $("contentBody").value.trim(),
      type: $("type").value,
      category: $("category").value,
      accessLevel: $("accessLevel").value,
      durationMinutes: $("durationMinutes").value,
      lessonCount: $("lessonCount").value,
      tags: $("tags").value,
      thumbnailUrl: $("thumbnailUrl").value.trim(),
      videoUrl: $("videoUrl").value.trim()
    })
  });

  elements.contentForm.reset();
  $("durationMinutes").value = 15;
  $("lessonCount").value = 1;
  showToast("Content published");
  await Promise.all([loadCurrentUser(), loadReport()]);
};

window.likeContent = async (id) => {
  if (!ensureAuth(true)) return;
  await api(`/content/like/${id}`, { method: "POST" });
  showToast("Content liked");
  await Promise.all([loadContent(), loadReport()]);
};

window.commentOnContent = async (id) => {
  if (!ensureAuth(true)) return;
  const text = window.prompt("Add your comment");
  if (!text) return;
  await api(`/content/comment/${id}`, {
    method: "POST",
    body: JSON.stringify({ text })
  });
  showToast("Comment added");
};

window.trackEngagement = async (id, action) => {
  if (!ensureAuth(true)) return;
  await api(`/content/engagement/${id}`, {
    method: "POST",
    body: JSON.stringify({ action })
  });
  showToast(action === "complete" ? "Completion recorded" : "Engagement recorded");
  await Promise.all([loadContent(), loadReport()]);
};

const exportCsv = async () => {
  if (!ensureAuth(true)) return;
  const response = await fetch(`${API}/reports/export.csv`, { headers: { ...authHeader() } });
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
      await Promise.all([loadCurrentUser(), loadContent(), loadReport()]);
    } catch (error) {
      showToast(error.message);
    }
  }
};

const bindEvents = () => {
  let loginPasswordVisible = false;
  let resetPasswordVisible = false;

  elements.themeToggle?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });

  elements.toggleLoginPassword?.addEventListener("click", () => {
    loginPasswordVisible = !loginPasswordVisible;
    setPasswordVisibility("loginPassword", elements.toggleLoginPassword, loginPasswordVisible);
  });

  elements.toggleResetPassword?.addEventListener("click", () => {
    resetPasswordVisible = !resetPasswordVisible;
    setPasswordVisibility("resetPassword", elements.toggleResetPassword, resetPasswordVisible);
  });

  elements.forgotPasswordBtn?.addEventListener("click", () => {
    elements.loginForm?.classList.add("hidden");
    elements.resetPasswordForm?.classList.remove("hidden");
    if ($("resetEmail") && $("loginEmail")) {
      $("resetEmail").value = $("loginEmail").value.trim();
    }
  });

  elements.cancelResetBtn?.addEventListener("click", () => {
    elements.resetPasswordForm?.classList.add("hidden");
    elements.loginForm?.classList.remove("hidden");
  });

  elements.logoutBtn?.addEventListener("click", () => {
    clearSession();
    showToast("Logged out");
    if (currentPage.includes("profile")) {
      setTimeout(() => {
        window.location.href = "login-page.html";
      }, 250);
    } else {
      loadContent();
      loadReport();
    }
  });

  elements.registerForm?.addEventListener("submit", (event) => register(event).catch((error) => showToast(error.message)));
  elements.loginForm?.addEventListener("submit", (event) => login(event).catch((error) => showToast(error.message)));
  elements.resetPasswordForm?.addEventListener("submit", (event) => resetPassword(event).catch((error) => showToast(error.message)));
  elements.subscribeBtn?.addEventListener("click", () => subscribe().catch((error) => showToast(error.message)));
  elements.demoSubBtn?.addEventListener("click", () => activateDemoSubscription().catch((error) => showToast(error.message)));
  elements.contentForm?.addEventListener("submit", (event) => publishContent(event).catch((error) => showToast(error.message)));
  elements.exportBtn?.addEventListener("click", () => exportCsv().catch((error) => showToast(error.message)));

  [elements.searchInput, elements.categoryFilter, elements.typeFilter, elements.accessFilter]
    .filter(Boolean)
    .forEach((node) => node.addEventListener("input", () => loadContent().catch((error) => showToast(error.message))));
};

const init = async () => {
  applyTheme(storedTheme);
  bindEvents();
  renderSession();
  await loadCurrentUser();
  renderSession();
  await Promise.all([loadContent(), loadReport()]);
  await maybeConfirmCheckout();
};

init().catch((error) => showToast(error.message));
