// Maison Réve public landing page.
// Products come from the server (through Store, see js/api.js) once Store.ready has loaded them,
// so administrator changes show up here after the page is refreshed.
const categories = Store.categories;
let products = [];
const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH");
const img = (p) =>
  p.image ||
  (p.id <= 50
    ? "assets/products/product-" + String(p.id).padStart(2, "0") + ".png"
    : "assets/logo.png");

/* =========================================================
   OPENING EXPERIENCE
   ========================================================= */
function playOpening() {
  const opening = document.querySelector("#siteOpening");
  if (!opening) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.body.style.overflow = "hidden";
  document.body.classList.add("is-opening"); // pauses the hero background animation behind the overlay
  setTimeout(() => {
    opening.classList.add("done");
    document.body.style.overflow = "";
    document.body.classList.remove("is-opening");
    setTimeout(() => opening.remove(), 1100);
  }, reduced ? 700 : 3800); // opening plays ~3.8s, then fades out
}

// Run heavy work (building cards, decoding images) AFTER the opening has painted its first frames,
// so it never competes with the animation.
function afterFirstPaint(fn) {
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fn, 150)));
}

/* =========================================================
   MOST LOVED SCENTS — CIRCULAR CAROUSEL
   ========================================================= */
let topLoved = [];
let topIndex = 0;

function carouselPosition(offset) {
  return ["pos-center", "pos-right", "pos-far-right", "pos-far-left", "pos-left"][offset] || "pos-hidden";
}

function applyCarouselPositions() {
  const cards = [...document.querySelectorAll("#topFive .top-card")];
  cards.forEach((card, i) => {
    const offset = (i - topIndex + topLoved.length) % topLoved.length;
    card.classList.remove("pos-center", "pos-right", "pos-far-right", "pos-far-left", "pos-left", "pos-hidden");
    card.classList.add(carouselPosition(offset));
  });
  document.querySelectorAll("#topDots .carousel-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === topIndex);
  });
}

function renderTopFive() {
  topLoved = [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 5);
  topIndex = Math.min(topIndex, Math.max(topLoved.length - 1, 0));

  const stage = document.querySelector("#topFive");
  if (!stage) return;

  // Build the cards only when the data changes. Rotation itself only changes
  // CSS position classes so the five cards visibly travel around the circle.
  stage.innerHTML = topLoved
    .map(
      (p, i) =>
        `<article class="top-card pos-hidden" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${p.name}">
          <span class="rank">${String(i + 1).padStart(2, "0")}</span>
          <img class="top-img" src="${img(p)}" alt="${p.name}" decoding="async">
          <div class="top-info">
            <h3>${p.name}</h3>
            <p>${p.family} • ${p.category}</p>
            <span class="price">${peso(p.price)}</span>
            <small class="loved-sold">${Number(p.sold || 0).toLocaleString("en-PH")} sold</small>
          </div>
        </article>`,
    )
    .join("");

  stage.querySelectorAll(".top-card").forEach((card) => {
    const activate = () => {
      // Side cards glide to the centre first; the centre card opens its details.
      if (!card.classList.contains("pos-center")) {
        topIndex = topLoved.findIndex((x) => x.id === Number(card.dataset.id));
        return applyCarouselPositions();
      }
      open(Number(card.dataset.id));
    };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });

  const dots = document.querySelector("#topDots");
  if (dots) {
    dots.innerHTML = topLoved
      .map((p, i) => `<button type="button" class="carousel-dot ${i === topIndex ? "active" : ""}" data-index="${i}" aria-label="Show ${p.name}"></button>`)
      .join("");
    dots.querySelectorAll(".carousel-dot").forEach((dot) => {
      dot.addEventListener("click", () => {
        topIndex = Number(dot.dataset.index);
        applyCarouselPositions();
      });
    });
  }
  applyCarouselPositions();
}

function rotateTop(direction) {
  if (topLoved.length < 2) return;
  topIndex = (topIndex + direction + topLoved.length) % topLoved.length;
  applyCarouselPositions();
}

/* =========================================================
   PUBLIC PRODUCT COLLECTION
   ========================================================= */
function render(list = products) {
  document.querySelector("#count").textContent = list.length;
  document.querySelector("#empty").hidden = !!list.length;
  document.querySelector("#grid").innerHTML = list
    .map(
      (p) =>
        `<article class="product-card" data-id="${p.id}"><div class="image-wrap"><img class="product-img" src="${img(p)}" alt="${p.name} perfume bottle" loading="lazy" decoding="async"><span class="stock ${p.stock <= 6 ? "low" : ""}">${p.stock <= 6 ? "Only " : ""}${p.stock} stock${p.stock === 1 ? "" : "s"}</span></div><div class="info"><div class="family">${p.family} • ${p.category}</div><h3>${p.name}</h3><p class="desc">${p.description}</p><div class="bottom"><strong class="price">${peso(p.price)}</strong><span class="view">View details →</span></div></div></article>`,
    )
    .join("");
  document.querySelectorAll(".product-card").forEach((c) => {
    c.onclick = () => open(Number(c.dataset.id));
  });
}

function filter() {
  const q = document.querySelector("#search").value.toLowerCase();
  const s = document.querySelector("#sort").value;
  let list = products.filter((p) =>
    `${p.name} ${p.family} ${p.category} ${p.notes}`.toLowerCase().includes(q),
  );
  if (categories.includes(s)) list = list.filter((p) => p.category === s);
  if (s === "low") list.sort((a, b) => a.price - b.price);
  if (s === "high") list.sort((a, b) => b.price - a.price);
  if (s === "stock") list.sort((a, b) => a.stock - b.stock);
  render(list);
}

function open(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  document.querySelector("#mi").src = img(p);
  document.querySelector("#mi").alt = p.name;
  document.querySelector("#mc").textContent = p.category;
  document.querySelector("#mn").textContent = p.name;
  document.querySelector("#mf").textContent = `${p.family} fragrance • ${p.size}`;
  document.querySelector("#md").textContent = p.description;
  document.querySelector("#mnotes").textContent = p.notes;
  document.querySelector("#mp").textContent = peso(p.price);
  document.querySelector("#ms").textContent = p.size;
  document.querySelector("#mst").textContent = p.stock;
  document.querySelector("#modal").classList.add("show");
  document.body.style.overflow = "hidden";
}

function close() {
  document.querySelector("#modal").classList.remove("show");
  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
  playOpening(); // starts at once; it does not wait for the server
  Store.ready.then(() => {
    products = Store.getProducts();
    afterFirstPaint(() => {
      renderTopFive();
      render();
    });
  });

  document.querySelector("#topPrev")?.addEventListener("click", () => rotateTop(-1));
  document.querySelector("#topNext")?.addEventListener("click", () => rotateTop(1));

  document.querySelector("#search").addEventListener("input", filter);
  document.querySelector("#sort").addEventListener("change", filter);
  document.querySelector("#close").addEventListener("click", close);
  document.querySelector("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // SECRET LOGIN: exactly five clicks on the Maison Réve logo.
  let secretClicks = 0;
  let secretTimer = null;
  const secretLogo = document.querySelector("#secretLogo");

  // Each logo click releases a floating bubble holding a tiny perfume bottle.
  // The 5th click releases a small shower of bubbles, then opens private access.
  function releaseBubble(delay = 0, big = false) {
    const r = secretLogo.getBoundingClientRect();
    const b = document.createElement("span");
    b.className = "logo-bubble" + (big ? " big" : "");
    b.innerHTML = '<i class="mini-bottle"></i>';
    b.style.left = r.left + r.width / 2 + (Math.random() * 40 - 20) + "px";
    b.style.top = r.bottom - 6 + "px";
    b.style.setProperty("--dx", Math.round(Math.random() * 90 - 45) + "px");
    b.style.animationDelay = delay + "ms";
    document.body.appendChild(b);
    b.addEventListener("animationend", () => b.remove());
  }

  secretLogo.addEventListener("click", () => {
    secretClicks += 1;
    clearTimeout(secretTimer);
    if (secretClicks < 5) releaseBubble();
    else for (let i = 0; i < 6; i++) releaseBubble(i * 90, i % 2 === 0);
    secretTimer = setTimeout(() => {
      secretClicks = 0;
    }, 2500);
    if (secretClicks === 5) {
      secretClicks = 0;
      openLogin();
    }
  });

  secretLogo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      secretLogo.click();
    }
  });

  // ---------- FLOATING LOGIN PANEL ----------
  const lg = {
    overlay: document.querySelector("#lgOverlay"),
    form: document.querySelector("#lgForm"),
    email: document.querySelector("#lgEmail"),
    password: document.querySelector("#lgPassword"),
    otp: document.querySelector("#lgOtp"),
    status: document.querySelector("#lgOtpStatus"),
    error: document.querySelector("#lgError"),
  };
  const lgBackdrop = lg.overlay.querySelector(".lg-backdrop");
  let lgBusy = false;
  let lgSubmitting = false;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resetLoginForm() {
    lg.form.reset();
    lg.status.textContent = "";
    lg.status.className = "lg-otp-status";
    lg.error.textContent = "";
  }

  function openLogin() {
    if (lgBusy || lg.overlay.classList.contains("active")) return;
    lgBusy = true;
    const r = secretLogo.getBoundingClientRect();
    lg.overlay.style.setProperty("--ox", r.left + r.width / 2 + "px");
    lg.overlay.style.setProperty("--oy", r.top + r.height / 2 + "px");
    secretLogo.classList.add("pulse");
    lg.overlay.classList.remove("closing", "show");
    lg.overlay.classList.add("active", "opening");
    lg.overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      secretLogo.classList.remove("pulse");
      lg.overlay.classList.remove("opening");
      lg.overlay.classList.add("show");
      lgBusy = false;
      setTimeout(() => lg.email.focus(), reduceMotion ? 0 : 450);
    }, reduceMotion ? 0 : 1100);
  }

  function closeLogin() {
    if (lgBusy || !lg.overlay.classList.contains("show")) return;
    lg.overlay.classList.add("closing");
    setTimeout(() => {
      lg.overlay.classList.remove("active", "show", "closing", "opening");
      lg.overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      resetLoginForm();
    }, reduceMotion ? 0 : 350);
  }

  document.querySelector("#lgClose").addEventListener("click", closeLogin);
  lg.overlay.addEventListener("click", (e) => {
    if (e.target === lg.overlay || e.target === lgBackdrop) closeLogin();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLogin();
  });

  // The server emails a one-time code. The code is never shown here and never sent back to this page.
  const sendBtn = document.querySelector("#lgSendOtp");
  sendBtn.addEventListener("click", async () => {
    const email = lg.email.value.trim();
    if (!email) {
      lg.status.textContent = "Enter your administrator email first.";
      lg.status.className = "lg-otp-status bad";
      return;
    }
    sendBtn.disabled = true;
    lg.status.textContent = "Sending the code…";
    lg.status.className = "lg-otp-status";
    try {
      const r = await Store.sendOtp(email);
      lg.status.textContent = r.message;
      lg.status.className = "lg-otp-status good";
    } catch (err) {
      lg.status.textContent = err.message;
      lg.status.className = "lg-otp-status bad";
    } finally {
      sendBtn.disabled = false;
    }
  });

  lg.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (lgSubmitting) return;
    lg.error.textContent = "";
    lgSubmitting = true;
    const submit = lg.form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const account = await Store.login(lg.email.value, lg.password.value, lg.otp.value); // password + emailed code, checked by the server
      sessionStorage.removeItem("scentSummaryShown"); // the owner sees the earnings summary once per login
      playWelcome(account);
    } catch (err) {
      lg.error.textContent = err.message;
      lgSubmitting = false;
      if (submit) submit.disabled = false;
    }
  });

  function playWelcome(account) {
    const w = document.querySelector("#welcome");
    document.querySelector("#welcomeName").textContent = account.username || account.name;
    w.classList.add("active");
    w.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, reduceMotion ? 300 : 3000);
  }

  if (location.hash === "#login") {
    history.replaceState(null, "", location.pathname);
    openLogin();
  }

  const links = [...document.querySelectorAll(".header nav a")];
  const secs = ["home", "fragrance", "about"].map((id) => document.getElementById(id));
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((x) => x.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + visible.target.id));
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.2, 0.5] },
  );
  secs.forEach((s) => observer.observe(s));
});
