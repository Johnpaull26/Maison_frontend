/* =========================================================
   SCENT — data layer (talks to the backend API)
   ---------------------------------------------------------
   Every page talks to ONE object, `Store`. Reading is instant: the data is loaded once when the page
   opens (Store.ready) and kept in a small cache. Changing data (sales, products, accounts, ...) goes
   to the server first and the cache is refreshed from the server's answer, so the server is always the
   source of truth (stock, prices, permissions and totals are decided there, never in the browser).

   API address: "/api" on the same site (Netlify forwards /api/* to the Render server, see
   frontend/_redirects). To call a server on another address directly, set this BEFORE api.js loads:
       <script>window.SCENT_API_BASE = "https://your-service.onrender.com/api";</script>
   ========================================================= */
(function (global) {
  "use strict";

  const BASE = String(global.SCENT_API_BASE || "/api").replace(/\/+$/, "");
  const CROSS_SITE = /^https?:\/\//i.test(BASE);

  // UI constants (not database data): used by dropdowns and badges.
  const LOW_STOCK = 6; // a product is "low stock" at this many units or fewer
  const families = ["Floral", "Woody", "Fresh", "Oriental", "Citrus", "Fruity", "Powdery", "Amber", "Musk", "Aromatic"];
  const categories = ["Female", "Male", "Unisex", "Preferred by Both"];

  // Pure UI helper: turns a stock number into a badge key + label.
  function availability(stock) {
    if (stock <= 0) return { key: "out", label: "Out of stock" };
    if (stock <= LOW_STOCK) return { key: "low", label: "Low stock" };
    return { key: "high", label: "High stock" };
  }

  const cache = { me: null, products: [], transactions: [], accounts: [], targets: { daily: 0, weekly: 0, monthly: 0 }, notifications: [] };

  /* ---------- HTTP ---------- */
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status || 0; // 0 = the server could not be reached
    }
    get retryable() {
      return !this.status || [502, 503, 504].includes(this.status);
    }
  }

  async function api(method, path, body) {
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        credentials: "include",
        headers: { "X-Requested-With": "scent", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError("Cannot reach the server. Check your internet connection and try again.", 0);
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* empty or non-JSON answer */
    }
    if (!res.ok) throw new ApiError((data && data.message) || `The server answered with an error (${res.status}).`, res.status);
    return data;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // A sleeping free-tier server needs up to a minute to wake up, so the very first request is retried.
  async function firstRequest(path) {
    let last;
    for (let i = 0; i < 12; i++) {
      try {
        return await api("GET", path);
      } catch (e) {
        if (!(e instanceof ApiError) || !e.retryable) throw e;
        last = e;
        await sleep(i < 2 ? 1500 : 5000);
      }
    }
    throw last;
  }

  /* ---------- "connecting…" banner ---------- */
  function banner() {
    let el = null;
    let timer = null;
    const make = () => {
      el = document.createElement("div");
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:100000;max-width:min(92vw,520px);padding:12px 18px;" +
        "background:#211c18;color:#f7f3ed;border-left:4px solid #b89b72;box-shadow:0 12px 40px rgba(0,0,0,.35);font:15px/1.5 'Segoe UI',Arial,sans-serif;text-align:center";
      document.body.appendChild(el);
    };
    return {
      waiting() {
        timer = setTimeout(() => {
          if (!el) make();
          el.textContent = "Connecting to the server… The first visit after a quiet period can take up to a minute.";
        }, 1800);
      },
      done() {
        clearTimeout(timer);
        if (el) el.remove();
      },
      failed(message) {
        clearTimeout(timer);
        if (!el) make();
        el.innerHTML = "";
        el.append(message + " ");
        const b = document.createElement("button");
        b.textContent = "Try again";
        b.style.cssText = "margin-left:8px;padding:5px 12px;border:1px solid #b89b72;background:#b89b72;color:#211c18;font:inherit;cursor:pointer";
        b.onclick = () => location.reload();
        el.append(b);
      },
    };
  }

  /* ---------- cache helpers ---------- */
  const fixProduct = (p) => (CROSS_SITE && p.image && p.image.startsWith("/api/") ? { ...p, image: BASE + p.image.slice(4) } : p);
  const isOwner = () => !!(cache.me && cache.me.owner);

  const reload = {
    products: async () => { cache.products = (await api("GET", "/products")).map(fixProduct); },
    transactions: async () => { cache.transactions = await api("GET", "/transactions"); },
    accounts: async () => { cache.accounts = await api("GET", "/accounts"); },
    targets: async () => { cache.targets = await api("GET", "/targets"); },
    notifications: async () => { cache.notifications = await api("GET", "/notifications"); },
  };

  async function init() {
    const ui = banner();
    ui.waiting();
    try {
      const s = await firstRequest("/auth/me"); // also wakes the server
      cache.me = s.account;
      const jobs = [reload.products()];
      if (cache.me) {
        jobs.push(reload.transactions(), reload.accounts());
        if (isOwner()) jobs.push(reload.targets(), reload.notifications());
      }
      await Promise.all(jobs);
      ui.done();
    } catch (e) {
      ui.failed(e.message || "Could not load the data.");
      throw e;
    }
  }

  /* ---------- the Store ---------- */
  const Store = {
    LOW_STOCK, families, categories, availability,
    ApiError,
    ready: null, // promise: resolves when the first data has been loaded

    /* ---- session ---- */
    me: () => cache.me,
    async refreshSession() { cache.me = (await api("GET", "/auth/me")).account; return cache.me; },
    sendOtp: (email) => api("POST", "/auth/send-otp", { email }), // the server emails a code; it is never sent back here
    async login(email, password, otp) {
      cache.me = (await api("POST", "/auth/login", { email, password, otp })).account;
      return cache.me;
    },
    async logout() {
      try { await api("POST", "/auth/logout", {}); } catch { /* the cookie expires anyway */ }
      cache.me = null;
    },

    /* ---- products (everyone can read; administrators change) ---- */
    getProducts: () => cache.products,
    reloadProducts: reload.products,
    async createProduct(fields) { await api("POST", "/products", fields); await reload.products(); },
    async updateProduct(id, fields) { await api("PUT", `/products/${id}`, fields); await reload.products(); },
    async deleteProducts(ids) { await api("POST", "/products/delete", { ids }); await reload.products(); },

    /* ---- sales ---- */
    getTransactions: () => cache.transactions, // one row per product line, voided rows included
    // items: [{ pid, qty }]. The server checks stock, uses ITS prices, and answers with the finished order.
    async checkout(items, customer) {
      const order = await api("POST", "/checkout", { items, customer });
      await Promise.all([reload.products(), reload.transactions()]);
      return order;
    },
    async voidOrder(orderId, { reason, note, restock }) {
      await api("POST", `/orders/${encodeURIComponent(orderId)}/void`, { reason, note, restock });
      await Promise.all([reload.products(), reload.transactions()]);
    },

    /* ---- accounts (everyone can view; only the owner changes) ---- */
    getAccounts: () => cache.accounts,
    async createAccount(fields) { await api("POST", "/accounts", fields); await reload.accounts(); },
    async updateAccount(id, fields) {
      await api("PUT", `/accounts/${id}`, fields);
      await Promise.all([reload.accounts(), Store.refreshSession()]);
    },
    async deleteAccount(id) { await api("DELETE", `/accounts/${id}`); await reload.accounts(); },

    /* ---- Earning Notification (owner only) ---- */
    getTargets: () => cache.targets,
    async saveTargets(targets) {
      const r = await api("PUT", "/targets", targets); // the server also checks the new targets against today's sales
      cache.targets = r.targets;
      return r;
    },
    getNotifications: () => cache.notifications,
    // reloads the list; `fresh` = notifications that were not here before (for the "target reached" message)
    async refreshNotifications() {
      const known = new Set(cache.notifications.map((n) => n.id));
      await reload.notifications();
      return { list: cache.notifications, fresh: cache.notifications.filter((n) => !known.has(n.id)) };
    },
    async markRead(id) {
      cache.notifications = cache.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      await api("PATCH", `/notifications/${id}/read`, {});
    },
    async markAllRead() {
      cache.notifications = cache.notifications.map((n) => ({ ...n, read: true }));
      await api("PATCH", "/notifications/read-all", {});
    },
    async clearNotifications() {
      cache.notifications = [];
      await api("DELETE", "/notifications");
    },
  };

  Store.ready = init();
  Store.ready.catch(() => {}); // the banner already tells the user; avoid an "unhandled rejection" message
  global.Store = Store;
})(window);
