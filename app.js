
/************************************************************
 * NOVA GLOBAL ENTERPRISES
 * B2B WEBSITE - COMPLETE APP.JS
 *
 * Backend: Google Apps Script
 * Database: Google Sheets
 ************************************************************/

const API_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwnBd6CdsFV1UIMJYaEkeiTypivKOJzEdpD6jCj51tumDQ083fIi5GX3sypz26B0ov4bA/exec";

/* =========================================================
   GLOBAL STATE
========================================================= */

const $ = id => document.getElementById(id);

const state = {
  products: [],
  categories: [],
  cart: JSON.parse(localStorage.getItem("novaEnquiryCart") || "[]"),
  search: "",
  category: ""
};

/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  $("year").textContent = new Date().getFullYear();

  // Search
  $("searchInput").addEventListener("input", event => {
    state.search = event.target.value.trim().toLowerCase();
    renderProducts();
  });

  // Category filter
  $("categoryFilter").addEventListener("change", event => {
    state.category = event.target.value;
    renderProducts();
  });

  // Cart controls
  $("openCart").addEventListener("click", openCart);
  $("heroEnquiry").addEventListener("click", openCart);
  $("closeCart").addEventListener("click", closeCart);
  $("drawerBackdrop").addEventListener("click", closeCart);

  // Product modal
  $("closeModal").addEventListener("click", closeProductModal);

  $("productModal").addEventListener("click", event => {
    if (event.target === $("productModal")) {
      closeProductModal();
    }
  });

  // Enquiry form
  $("enquiryForm").addEventListener("submit", submitEnquiry);

  // Mobile navigation
  $("menuToggle").addEventListener("click", () => {
    $("mainNav").classList.toggle("open");
  });

  document.querySelectorAll("#mainNav a").forEach(link => {
    link.addEventListener("click", () => {
      $("mainNav").classList.remove("open");
    });
  });

  // Initial UI
  updateCartCount();
  renderCart();

  // Load products
  loadCatalogue();

});


/* =========================================================
   GOOGLE APPS SCRIPT API
========================================================= */

async function api(action, data = {}) {

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    mode: "cors",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      ...data
    })
  });

  if (!response.ok) {
    throw new Error("API connection failed. HTTP " + response.status);
  }

  const result = await response.json();

  if (result.success === false) {
    throw new Error(result.message || "API request failed.");
  }

  return result;
}


/* =========================================================
   LOAD PRODUCTS AND CATEGORIES
========================================================= */

async function loadCatalogue() {

  $("loadingState").classList.remove("hidden");
  $("errorState").classList.add("hidden");
  $("productGrid").innerHTML = "";
  $("emptyState").classList.add("hidden");

  try {

    const [productResponse, categoryResponse] = await Promise.all([
      api("listProducts"),
      api("listCategories")
    ]);

    // Supports API response:
    // { success:true, data:[...] }
    // { success:true, products:[...] }

    state.products = Array.isArray(productResponse.products)
      ? productResponse.products
      : Array.isArray(productResponse.data)
        ? productResponse.data
        : [];

    state.categories = Array.isArray(categoryResponse.categories)
      ? categoryResponse.categories
      : Array.isArray(categoryResponse.data)
        ? categoryResponse.data
        : [];

    // Only Active products
    state.products = state.products.filter(product =>
      String(product.status || "Active").toLowerCase() === "active"
    );

    fillCategories();
    renderProducts();

  } catch (error) {

    console.error("Catalogue loading error:", error);

    $("errorState").textContent =
      "Unable to load products. " + error.message;

    $("errorState").classList.remove("hidden");

  } finally {

    $("loadingState").classList.add("hidden");

  }

}


/* =========================================================
   CATEGORY DROPDOWN
========================================================= */

function fillCategories() {

  const select = $("categoryFilter");

  const currentValue = state.category;

  const categories = [
    ...new Set([
      ...state.categories.map(item =>
        typeof item === "string" ? item : item.name
      ),
      ...state.products.map(item => item.category)
    ])
  ]
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b));

  select.innerHTML = '<option value="">All categories</option>';

  categories.forEach(category => {

    const option = document.createElement("option");

    option.value = category;
    option.textContent = category;

    select.appendChild(option);

  });

  select.value = categories.includes(currentValue) ? currentValue : "";

  if (!select.value) {
    state.category = "";
  }

}


/* =========================================================
   RENDER PRODUCT CARDS
========================================================= */

function renderProducts() {

  const grid = $("productGrid");

  const search = state.search;

  const filteredProducts = state.products.filter(product => {

    const searchableText = [
      product.name,
      product.sku,
      product.category,
      product.short_description,
      product.description,
      product.specifications
    ].join(" ").toLowerCase();

    const matchesSearch = searchableText.includes(search);

    const matchesCategory =
      !state.category || product.category === state.category;

    return matchesSearch && matchesCategory;

  });

  grid.innerHTML = "";

  if (filteredProducts.length === 0) {

    $("emptyState").classList.remove("hidden");

    return;

  }

  $("emptyState").classList.add("hidden");

  filteredProducts.forEach(product => {

    const card = document.createElement("article");

    card.className = "product-card";

    const image = safeImageUrl(product.image_url);

    card.innerHTML = `

      <div class="product-image">

        ${
          image
            ? `<img src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
            : ""
        }

        <div class="image-placeholder"
             style="${image ? "display:none" : "display:flex"}">
          <span>▦</span>
        </div>

      </div>

      <div class="product-info">

        <span class="product-category">
          ${escapeHTML(product.category || "General")}
        </span>

        <h3>${escapeHTML(product.name)}</h3>

        <p class="product-description">
          ${escapeHTML(product.short_description || "")}
        </p>

        <div class="product-sku">
          SKU: ${escapeHTML(product.sku || "-")}
        </div>

        <div class="product-actions">

          <button class="btn-outline"
                  type="button"
                  data-action="details">
            View Details
          </button>

          <button class="btn primary"
                  type="button"
                  data-action="add">
            + Add Enquiry
          </button>

        </div>

      </div>

    `;

    card.querySelector('[data-action="details"]')
      .addEventListener("click", () => openProductModal(product));

    card.querySelector('[data-action="add"]')
      .addEventListener("click", () => addToCart(product));

    grid.appendChild(card);

  });

}


/* =========================================================
   PRODUCT DETAILS MODAL
========================================================= */

function openProductModal(product) {

  const image = safeImageUrl(product.image_url);

  const datasheet = safeLinkUrl(product.datasheet_url);

  $("modalContent").innerHTML = `

    <div class="modal-product">

      ${
        image
          ? `<img class="modal-product-image"
                  src="${escapeHTML(image)}"
                  alt="${escapeHTML(product.name)}"
                  onerror="this.style.display='none'">`
          : ""
      }

      <span class="eyebrow">
        ${escapeHTML(product.category || "Product")}
      </span>

      <h2>${escapeHTML(product.name)}</h2>

      <p>${escapeHTML(product.description || product.short_description || "")}</p>

      <div class="modal-specifications">

        <h4>Product Information</h4>

        <p><strong>SKU:</strong> ${escapeHTML(product.sku || "-")}</p>

        <p><strong>Category:</strong> ${escapeHTML(product.category || "-")}</p>

        <p><strong>Unit:</strong> ${escapeHTML(product.unit || "-")}</p>

        <p><strong>Specifications:</strong></p>

        <div class="specification-text">
          ${escapeHTML(product.specifications || "Specifications not available.")}
        </div>

      </div>

      ${
        datasheet
          ? `<a class="btn-outline datasheet-link"
                href="${escapeHTML(datasheet)}"
                target="_blank"
                rel="noopener noreferrer">
                View Datasheet
             </a>`
          : ""
      }

      <button class="btn primary full"
              id="modalAddEnquiry">
        + Add to Enquiry
      </button>

    </div>

  `;

  $("modalAddEnquiry").addEventListener("click", () => {

    addToCart(product);

    closeProductModal();

  });

  $("productModal").classList.remove("hidden");

}


function closeProductModal() {

  $("productModal").classList.add("hidden");

}


/* =========================================================
   ADD PRODUCT TO ENQUIRY CART
========================================================= */

function addToCart(product) {

  const existing = state.cart.find(item =>
    String(item.product_id) === String(product.id)
  );

  if (existing) {

    existing.quantity += 1;

  } else {

    state.cart.push({

      product_id: product.id,

      product_name: product.name,

      sku: product.sku || "",

      unit: product.unit || "",

      quantity: 1,

      notes: ""

    });

  }

  saveCart();

  renderCart();

  updateCartCount();

  showToast("Product added to your enquiry list.");

}


/* =========================================================
   SAVE CART
========================================================= */

function saveCart() {

  localStorage.setItem(
    "novaEnquiryCart",
    JSON.stringify(state.cart)
  );

}


/* =========================================================
   UPDATE CART COUNT
========================================================= */

function updateCartCount() {

  const count = state.cart.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );

  $("cartCount").textContent = count;

}


/* =========================================================
   RENDER CART ITEMS
========================================================= */

function renderCart() {

  const container = $("cartItems");

  if (state.cart.length === 0) {

    container.innerHTML = `
      <p class="muted">Your enquiry list is empty.</p>
    `;

    updateCartCount();

    return;

  }

  container.innerHTML = state.cart.map((item, index) => `

    <div class="cart-item">

      <div class="cart-item-info">

        <strong>${escapeHTML(item.product_name)}</strong>

        <small>SKU: ${escapeHTML(item.sku || "-")}</small>

      </div>

      <div class="cart-item-controls">

        <button type="button"
                data-minus="${index}"
                aria-label="Decrease quantity">−</button>

        <input type="number"
               min="1"
               max="999999"
               value="${Number(item.quantity) || 1}"
               data-quantity="${index}"
               aria-label="Quantity">

        <button type="button"
                data-plus="${index}"
                aria-label="Increase quantity">+</button>

        <button type="button"
                class="remove-item"
                data-remove="${index}">
          ×
        </button>

      </div>

    </div>

  `).join("");

  // Quantity minus
  container.querySelectorAll("[data-minus]").forEach(button => {

    button.addEventListener("click", () => {

      const index = Number(button.dataset.minus);

      state.cart[index].quantity = Math.max(
        1,
        Number(state.cart[index].quantity) - 1
      );

      saveCart();
      renderCart();

    });

  });

  // Quantity plus
  container.querySelectorAll("[data-plus]").forEach(button => {

    button.addEventListener("click", () => {

      const index = Number(button.dataset.plus);

      state.cart[index].quantity =
        Number(state.cart[index].quantity) + 1;

      saveCart();
      renderCart();

    });

  });

  // Direct quantity input
  container.querySelectorAll("[data-quantity]").forEach(input => {

    input.addEventListener("change", () => {

      const index = Number(input.dataset.quantity);

      state.cart[index].quantity = Math.min(
        999999,
        Math.max(1, Number(input.value) || 1)
      );

      saveCart();
      renderCart();

    });

  });

  // Remove item
  container.querySelectorAll("[data-remove]").forEach(button => {

    button.addEventListener("click", () => {

      const index = Number(button.dataset.remove);

      state.cart.splice(index, 1);

      saveCart();
      renderCart();

      showToast("Product removed.");

    });

  });

  updateCartCount();

}


/* =========================================================
   OPEN / CLOSE ENQUIRY DRAWER
========================================================= */

function openCart() {

  $("enquiryDrawer").classList.add("open");

  $("drawerBackdrop").classList.add("show");

  renderCart();

}


function closeCart() {

  $("enquiryDrawer").classList.remove("open");

  $("drawerBackdrop").classList.remove("show");

}


/* =========================================================
   SUBMIT ENQUIRY
========================================================= */

async function submitEnquiry(event) {

  event.preventDefault();

  if (state.cart.length === 0) {

    $("formMessage").textContent =
      "Please add at least one product to your enquiry list.";

    return;

  }

  const form = event.currentTarget;

  const formData = new FormData(form);

  const customer = {

    name: String(formData.get("name") || "").trim(),

    company: String(formData.get("company") || "").trim(),

    email: String(formData.get("email") || "").trim(),

    phone: String(formData.get("phone") || "").trim(),

    address: String(formData.get("address") || "").trim()

  };

  const message = String(
    formData.get("message") || ""
  ).trim();

  if (!customer.name || !customer.email || !customer.phone) {

    $("formMessage").textContent =
      "Please complete all required contact details.";

    return;

  }

  const button = $("submitEnquiry");

  button.disabled = true;

  button.textContent = "Submitting...";

  $("formMessage").textContent = "";

  try {

    const payload = {

      customer: customer,

      items: state.cart.map(item => ({

        product_id: item.product_id,

        product_name: item.product_name,

        sku: item.sku,

        unit: item.unit,

        quantity: Number(item.quantity),

        notes: item.notes || ""

      })),

      message: message

    };

    const result = await api("submitEnquiry", payload);

    if (result.success === false) {
      throw new Error(result.message || "Enquiry submission failed.");
    }

    state.cart = [];

    saveCart();

    renderCart();

    updateCartCount();

    form.reset();

    $("formMessage").textContent =
      result.message || "Your enquiry has been submitted successfully.";

    showToast("Enquiry submitted successfully!");

    setTimeout(() => {

      closeCart();

      $("formMessage").textContent =
        "Your enquiry will be recorded in our system.";

    }, 2500);

  } catch (error) {

    console.error("Enquiry submission error:", error);

    $("formMessage").textContent =
      "Unable to submit enquiry: " + error.message;

  } finally {

    button.disabled = false;

    button.textContent = "Submit Enquiry";

  }

}


/* =========================================================
   SAFE IMAGE URL
========================================================= */

function safeImageUrl(value) {

  if (!value) return "";

  try {

    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    return url.href;

  } catch (error) {

    return "";

  }

}


/* =========================================================
   SAFE LINK URL
========================================================= */

function safeLinkUrl(value) {

  if (!value) return "";

  try {

    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    return url.href;

  } catch (error) {

    return "";

  }

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(value) {

  return String(value ?? "").replace(/[&<>"']/g, character => ({

    "&": "&amp;",

    "<": "&lt;",

    ">": "&gt;",

    '"': "&quot;",

    "'": "&#39;"

  })[character]);

}


/* =========================================================
   TOAST MESSAGE
========================================================= */

function showToast(message) {

  const toast = $("toast");

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {

    toast.classList.remove("show");

  }, 2500);

}


/* =========================================================
   END OF NOVA APP.JS
========================================================= */
