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
    products = Store.getProducts().filter((p) => p.active !== false); // archived (inactive) products are not shown here
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
  const loginElements = {
    overlay: document.querySelector("#lgOverlay"),
    form: document.querySelector("#lgForm"),
    email: document.querySelector("#lgEmail"),
    password: document.querySelector("#lgPassword"),
    otp: document.querySelector("#lgOtp"),
    status: document.querySelector("#lgOtpStatus"),
    error: document.querySelector("#lgError"),
    resetView: document.querySelector("#lgResetView"),
    resetForm: document.querySelector("#lgResetForm"),
    resetEmail: document.querySelector("#lgResetEmail"),
    resetOtp: document.querySelector("#lgResetOtp"),
    resetStatus: document.querySelector("#lgResetOtpStatus"),
    newPassword: document.querySelector("#lgNewPassword"),
    confirmPassword: document.querySelector("#lgConfirmPassword"),
    resetError: document.querySelector("#lgResetError"),
  };
  const signInView = document.querySelector("#lgSignInView");
  const loginTitle = document.querySelector("#lgTitle");
  const loginSubtitle = document.querySelector("#lgSub");
  const loginBackdrop = loginElements.overlay.querySelector(".lg-backdrop");
  const passwordToggles = [...loginElements.overlay.querySelectorAll(".lg-password-toggle")];
  let loginIsBusy = false;
  let loginIsSubmitting = false;
  const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Clears both forms and puts the login panel back in its starting state.
  function resetLoginForm() {
    loginElements.form.reset();
    loginElements.resetForm.reset();
    passwordToggles.forEach((toggle) => {
      const input = document.getElementById(toggle.getAttribute("aria-controls"));
      input.type = "password";
      toggle.textContent = "Show";
      toggle.setAttribute("aria-label", "Show password");
      toggle.setAttribute("aria-pressed", "false");
    });
    loginElements.resetView.hidden = true;
    signInView.hidden = false;
    loginTitle.textContent = "Welcome back.";
    loginSubtitle.textContent = "Enter your administrator email and password, then verify the one-time code.";
    loginElements.status.textContent = "";
    loginElements.status.className = "lg-otp-status";
    loginElements.error.textContent = "";
    loginElements.resetStatus.textContent = "";
    loginElements.resetStatus.className = "lg-otp-status";
    loginElements.resetError.textContent = "";
  }

  // Switches the panel from sign-in to password reset and carries over the email.
  function showPasswordReset() {
    loginElements.resetEmail.value = loginElements.email.value.trim();
    loginElements.error.textContent = "";
    signInView.hidden = true;
    loginElements.resetView.hidden = false;
    loginTitle.textContent = "Reset your password.";
    loginSubtitle.textContent = "We’ll email a one-time code to your administrator address.";
    loginElements.resetEmail.focus();
  }

  // Returns to sign-in and puts the reset email into the email field.
  function showSignIn() {
    loginElements.email.value = loginElements.resetEmail.value.trim();
    loginElements.resetView.hidden = true;
    signInView.hidden = false;
    loginTitle.textContent = "Welcome back.";
    loginSubtitle.textContent = "Enter your administrator email and password, then verify the one-time code.";
    loginElements.password.focus();
  }

  // Opens the login panel with an animation and focuses the email field.
  function openLogin() {
    if (loginIsBusy || loginElements.overlay.classList.contains("active")) return;
    loginIsBusy = true;
    const logoPosition = secretLogo.getBoundingClientRect();
    loginElements.overlay.style.setProperty("--ox", logoPosition.left + logoPosition.width / 2 + "px");
    loginElements.overlay.style.setProperty("--oy", logoPosition.top + logoPosition.height / 2 + "px");
    secretLogo.classList.add("pulse");
    loginElements.overlay.classList.remove("closing", "show");
    loginElements.overlay.classList.add("active", "opening");
    loginElements.overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      secretLogo.classList.remove("pulse");
      loginElements.overlay.classList.remove("opening");
      loginElements.overlay.classList.add("show");
      loginIsBusy = false;
      setTimeout(() => loginElements.email.focus(), shouldReduceMotion ? 0 : 450);
    }, shouldReduceMotion ? 0 : 1100);
  }

  // Closes the login panel, restores scrolling, and clears its forms.
  function closeLogin() {
    if (loginIsBusy || !loginElements.overlay.classList.contains("show")) return;
    loginElements.overlay.classList.add("closing");
    setTimeout(() => {
      loginElements.overlay.classList.remove("active", "show", "closing", "opening");
      loginElements.overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      resetLoginForm();
    }, shouldReduceMotion ? 0 : 350);
  }

  document.querySelector("#lgClose").addEventListener("click", closeLogin);
  document.querySelector("#lgForgotPassword").addEventListener("click", showPasswordReset);
  document.querySelector("#lgBackToSignIn").addEventListener("click", showSignIn);
  // Shows or hides the password field when its button is clicked.
  passwordToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = document.getElementById(toggle.getAttribute("aria-controls"));
      const isVisible = input.type === "text";
      input.type = isVisible ? "password" : "text";
      toggle.textContent = isVisible ? "Show" : "Hide";
      toggle.setAttribute("aria-label", `${isVisible ? "Show" : "Hide"} password`);
      toggle.setAttribute("aria-pressed", String(!isVisible));
    });
  });
  loginElements.overlay.addEventListener("click", (e) => {
    if (e.target === loginElements.overlay || e.target === loginBackdrop) closeLogin();
  });
  // Lets the user close the login panel with the Escape key.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLogin();
  });

  // The server emails a one-time code. The code is never shown here and never sent back to this page.
  const sendBtn = document.querySelector("#lgSendOtp");
  // Requests a sign-in code and displays the result in the login panel.
  sendBtn.addEventListener("click", async () => {
    const email = loginElements.email.value.trim();
    if (!email) {
      loginElements.status.textContent = "Enter your administrator email first.";
      loginElements.status.className = "lg-otp-status bad";
      return;
    }
    sendBtn.disabled = true;
    loginElements.status.textContent = "Sending the code…";
    loginElements.status.className = "lg-otp-status";
    try {
      const r = await Store.sendOtp(email);
      loginElements.status.textContent = r.message;
      loginElements.status.className = "lg-otp-status good";
    } catch (err) {
      loginElements.status.textContent = err.message;
      loginElements.status.className = "lg-otp-status bad";
    } finally {
      sendBtn.disabled = false;
    }
  });

  // Requests a password-reset code and displays the result in the reset panel.
  document.querySelector("#lgSendResetOtp").addEventListener("click", async (e) => {
    const button = e.currentTarget;
    const email = loginElements.resetEmail.value.trim();
    if (!email) {
      loginElements.resetStatus.textContent = "Enter your administrator email first.";
      loginElements.resetStatus.className = "lg-otp-status bad";
      return;
    }
    button.disabled = true;
    loginElements.resetStatus.textContent = "Sending the code…";
    loginElements.resetStatus.className = "lg-otp-status";
    try {
      const r = await Store.sendResetOtp(email);
      loginElements.resetStatus.textContent = r.message;
      loginElements.resetStatus.className = "lg-otp-status good";
    } catch (err) {
      loginElements.resetStatus.textContent = err.message;
      loginElements.resetStatus.className = "lg-otp-status bad";
    } finally {
      button.disabled = false;
    }
  });

  // Checks the new passwords, then asks the server to update the account password.
  loginElements.resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginElements.resetError.textContent = "";
    if (loginElements.newPassword.value !== loginElements.confirmPassword.value) {
      loginElements.resetError.textContent = "The passwords do not match.";
      return;
    }
    const submit = loginElements.resetForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const r = await Store.resetPassword(
        loginElements.resetEmail.value.trim(),
        loginElements.resetOtp.value.trim(),
        loginElements.newPassword.value,
      );
      showSignIn();
      loginElements.password.value = "";
      loginElements.otp.value = "";
      loginElements.status.textContent = r.message;
      loginElements.status.className = "lg-otp-status good";
    } catch (err) {
      loginElements.resetError.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  });

  // Sends the sign-in details and one-time code to the server for verification.
  loginElements.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (loginIsSubmitting) return;
    loginElements.error.textContent = "";
    loginIsSubmitting = true;
    const submit = loginElements.form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const account = await Store.login(
        loginElements.email.value,
        loginElements.password.value,
        loginElements.otp.value,
      );
      sessionStorage.removeItem("scentSummaryShown"); // the owner sees the earnings summary once per login
      playWelcome(account);
    } catch (err) {
      loginElements.error.textContent = err.message;
      loginIsSubmitting = false;
      if (submit) submit.disabled = false;
    }
  });

  // Shows the user's name, then takes them to the dashboard.
  function playWelcome(account) {
    const w = document.querySelector("#welcome");
    document.querySelector("#welcomeName").textContent = account.username || account.name;
    w.classList.add("active");
    w.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, shouldReduceMotion ? 300 : 3000);
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
