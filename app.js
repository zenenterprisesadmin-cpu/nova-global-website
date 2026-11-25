
/************************************************************
 * NOVA GLOBAL ENTERPRISES
 * PUBLIC B2B WEBSITE - APP.JS
 * Google Sheets + Google Apps Script API
 ************************************************************/

const API_ENDPOINT = "https://script.google.com/macros/s/AKfycbwnBd6CdsFV1UIMJYaEkeiTypivKOJzEdpD6jCj51tumDQ083fIi5GX3sypz26B0ov4bA/exec";

let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem("novaEnquiryCart") || "[]");

const $ = id => document.getElementById(id);

/* =========================================================
   INITIALIZE WEBSITE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    $("year").textContent = new Date().getFullYear();

    $("menuToggle")?.addEventListener("click", toggleMenu);

    $("openCart")?.addEventListener("click", openCart);
    $("heroEnquiry")?.addEventListener("click", openCart);
    $("closeCart")?.addEventListener("click", closeCart);
    $("drawerBackdrop")?.addEventListener("click", closeCart);

    $("searchInput")?.addEventListener("input", renderProducts);

    $("categoryFilter")?.addEventListener("change", renderProducts);

    $("closeModal")?.addEventListener("click", closeProductModal);

    $("productModal")?.addEventListener("click", e => {
        if (e.target === $("productModal")) {
            closeProductModal();
        }
    });

    $("enquiryForm")?.addEventListener("submit", submitEnquiry);

    document.querySelectorAll("#mainNav a").forEach(link => {
        link.addEventListener("click", () => {
            $("mainNav")?.classList.remove("open");
        });
    });

    renderCart();

    loadProducts();
});


/* =========================================================
   API REQUEST
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
            action: action,
            ...data
        })
    });

    if (!response.ok) {
        throw new Error("Server error: " + response.status);
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || "API request failed");
    }

    return result;
}


/* =========================================================
   LOAD PRODUCTS FROM GOOGLE SHEETS
========================================================= */

async function loadProducts() {

    const loading = $("loadingState");
    const error = $("errorState");

    loading?.classList.remove("hidden");
    error?.classList.add("hidden");

    if ($("productGrid")) {
        $("productGrid").innerHTML = "";
    }

    try {

        const result = await api("listProducts");

        /*
         * Supports API responses:
         * { success:true, data:[...] }
         * { success:true, products:[...] }
         */

        const records = Array.isArray(result.data)
            ? result.data
            : Array.isArray(result.products)
                ? result.products
                : [];

        products = records.filter(product =>
            String(product.status || "Active").trim().toLowerCase() === "active"
        );

        products = products.map(product => ({
            id: product.id || "",
            sku: product.sku || "",
            name: product.name || "Unnamed Product",
            category: product.category || "General",
            short_description: product.short_description || "",
            description: product.description || "",
            specifications: product.specifications || "",
            image_url: product.image_url || "",
            datasheet_url: product.datasheet_url || "",
            unit: product.unit || "",
            status: product.status || "Active"
        }));

        buildCategories();

        renderProducts();

    } catch (errorMessage) {

        console.error("Product loading error:", errorMessage);

        if (error) {
            error.textContent =
                "Unable to load products. Please refresh the page and try again.";

            error.classList.remove("hidden");
        }

    } finally {

        loading?.classList.add("hidden");

    }
}


/* =========================================================
   CATEGORY FILTER
========================================================= */

function buildCategories() {

    const select = $("categoryFilter");

    if (!select) return;

    categories = [
        ...new Set(
            products
                .map(p => p.category)
                .filter(Boolean)
        )
    ].sort();

    select.innerHTML =
        '<option value="">All categories</option>';

    categories.forEach(category => {

        const option = document.createElement("option");

        option.value = category;
        option.textContent = category;

        select.appendChild(option);

    });
}


/* =========================================================
   RENDER PRODUCTS
========================================================= */

function renderProducts() {

    const grid = $("productGrid");
    const empty = $("emptyState");

    if (!grid) return;

    const search = ($("searchInput")?.value || "")
        .trim()
        .toLowerCase();

    const selectedCategory =
        $("categoryFilter")?.value || "";

    const filtered = products.filter(product => {

        const searchable = [
            product.name,
            product.sku,
            product.category,
            product.short_description,
            product.description,
            product.specifications
        ].join(" ").toLowerCase();

        const matchesSearch = searchable.includes(search);

        const matchesCategory =
            !selectedCategory ||
            product.category === selectedCategory;

        return matchesSearch && matchesCategory;

    });

    grid.innerHTML = "";

    if (filtered.length === 0) {

        empty?.classList.remove("hidden");

        return;

    }

    empty?.classList.add("hidden");

    filtered.forEach(product => {

        const card = document.createElement("article");

        card.className = "product-card";

        const image = safeImage(product.image_url);

        card.innerHTML = `
            <div class="product-image">
                ${
                    image
                    ? `<img src="${escAttr(image)}"
                            alt="${escAttr(product.name)}"
                            loading="lazy"
                            onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                       <div class="image-placeholder" style="display:none">NOVA</div>`
                    : `<div class="image-placeholder">NOVA</div>`
                }
            </div>

            <div class="product-info">

                <span class="product-category">
                    ${esc(product.category)}
                </span>

                <h3>${esc(product.name)}</h3>

                <p class="product-sku">
                    SKU: ${esc(product.sku)}
                </p>

                <p class="product-description">
                    ${esc(product.short_description)}
                </p>

                <div class="product-actions">

                    <button
                        class="btn light"
                        type="button"
                        data-details="${escAttr(product.id)}">
                        View Details
                    </button>

                    <button
                        class="btn primary"
                        type="button"
                        data-add="${escAttr(product.id)}">
                        Add to Enquiry
                    </button>

                </div>

            </div>
        `;

        grid.appendChild(card);

    });

    grid.querySelectorAll("[data-details]").forEach(button => {

        button.addEventListener("click", () => {
            const product = products.find(
                p => String(p.id) === button.dataset.details
            );

            if (product) openProductModal(product);
        });

    });

    grid.querySelectorAll("[data-add]").forEach(button => {

        button.addEventListener("click", () => {
            addToCart(button.dataset.add);
        });

    });

}


/* =========================================================
   PRODUCT DETAILS MODAL
========================================================= */

function openProductModal(product) {

    const modal = $("productModal");
    const content = $("modalContent");

    if (!modal || !content) return;

    const image = safeImage(product.image_url);

    content.innerHTML = `

        <div class="modal-product">

            ${
                image
                ? `<img class="modal-product-image"
                        src="${escAttr(image)}"
                        alt="${escAttr(product.name)}">`
                : `<div class="image-placeholder">NOVA</div>`
            }

            <div class="modal-product-info">

                <span class="eyebrow">
                    ${esc(product.category)}
                </span>

                <h2>${esc(product.name)}</h2>

                <p>SKU: ${esc(product.sku)}</p>

                <p>${esc(product.description)}</p>

                <h4>Technical Specifications</h4>

                <div class="product-specifications">
                    ${formatSpecifications(product.specifications)}
                </div>

                ${
                    product.datasheet_url
                    ? `<a class="btn light"
                          href="${escAttr(safeLink(product.datasheet_url))}"
                          target="_blank"
                          rel="noopener noreferrer">
                          View Datasheet
                       </a>`
                    : ""
                }

                <button
                    class="btn primary"
                    type="button"
                    id="modalAddToCart">
                    Add to Enquiry
                </button>

            </div>

        </div>

    `;

    $("modalAddToCart")?.addEventListener("click", () => {
        addToCart(product.id);
        closeProductModal();
    });

    modal.classList.remove("hidden");

}


function closeProductModal() {

    $("productModal")?.classList.add("hidden");

}


/* =========================================================
   ADD PRODUCT TO ENQUIRY CART
========================================================= */

function addToCart(productId) {

    const product = products.find(
        p => String(p.id) === String(productId)
    );

    if (!product) {
        showToast("Product not found");
        return;
    }

    const existing = cart.find(
        item => String(item.product_id) === String(product.id)
    );

    if (existing) {

        existing.quantity += 1;

    } else {

        cart.push({

            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            quantity: 1

        });

    }

    saveCart();

    renderCart();

    showToast("Product added to enquiry list");

}


/* =========================================================
   SAVE CART
========================================================= */

function saveCart() {

    localStorage.setItem(
        "novaEnquiryCart",
        JSON.stringify(cart)
    );

}


/* =========================================================
   RENDER CART
========================================================= */

function renderCart() {

    const container = $("cartItems");

    const count = $("cartCount");

    const totalItems = cart.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
    );

    if (count) {
        count.textContent = totalItems;
    }

    if (!container) return;

    if (cart.length === 0) {

        container.innerHTML =
            '<p class="muted">Your enquiry list is empty.</p>';

        return;

    }

    container.innerHTML = "";

    cart.forEach((item, index) => {

        const div = document.createElement("div");

        div.className = "cart-item";

        div.innerHTML = `

            <div class="cart-item-info">

                <strong>${esc(item.product_name)}</strong>

                <small>SKU: ${esc(item.sku)}</small>

                <div class="quantity-control">

                    <button type="button"
                        data-minus="${index}">−</button>

                    <input
                        type="number"
                        min="1"
                        max="999999"
                        value="${Number(item.quantity)}"
                        data-quantity="${index}">

                    <button type="button"
                        data-plus="${index}">+</button>

                </div>

            </div>

            <button
                class="remove-cart-item"
                type="button"
                data-remove="${index}">
                Remove
            </button>

        `;

        container.appendChild(div);

    });

    container.querySelectorAll("[data-minus]").forEach(button => {

        button.addEventListener("click", () => {
            changeQuantity(Number(button.dataset.minus), -1);
        });

    });

    container.querySelectorAll("[data-plus]").forEach(button => {

        button.addEventListener("click", () => {
            changeQuantity(Number(button.dataset.plus), 1);
        });

    });

    container.querySelectorAll("[data-remove]").forEach(button => {

        button.addEventListener("click", () => {
            removeCartItem(Number(button.dataset.remove));
        });

    });

    container.querySelectorAll("[data-quantity]").forEach(input => {

        input.addEventListener("change", () => {

            const index = Number(input.dataset.quantity);

            const quantity = Math.max(
                1,
                Math.min(999999, Number(input.value) || 1)
            );

            cart[index].quantity = quantity;

            saveCart();

            renderCart();

        });

    });

}


/* =========================================================
   CHANGE QUANTITY
========================================================= */

function changeQuantity(index, amount) {

    if (!cart[index]) return;

    cart[index].quantity = Math.max(
        1,
        Number(cart[index].quantity) + amount
    );

    saveCart();

    renderCart();

}


/* =========================================================
   REMOVE CART ITEM
========================================================= */

function removeCartItem(index) {

    if (!cart[index]) return;

    cart.splice(index, 1);

    saveCart();

    renderCart();

    showToast("Product removed");

}


/* =========================================================
   OPEN / CLOSE ENQUIRY DRAWER
========================================================= */

function openCart() {

    $("enquiryDrawer")?.classList.add("open");

    $("drawerBackdrop")?.classList.add("open");

    renderCart();

}


function closeCart() {

    $("enquiryDrawer")?.classList.remove("open");

    $("drawerBackdrop")?.classList.remove("open");

}


/* =========================================================
   SUBMIT ENQUIRY TO GOOGLE SHEETS
========================================================= */

async function submitEnquiry(event) {

    event.preventDefault();

    if (cart.length === 0) {

        showToast("Please add products to your enquiry list");

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

        showToast("Please fill all required fields");

        return;

    }

    const button = $("submitEnquiry");

    const messageBox = $("formMessage");

    button.disabled = true;

    button.textContent = "Submitting...";

    try {

        const result = await api("submitEnquiry", {

            customer: customer,

            items: cart.map(item => ({
                product_id: item.product_id,
                product_name: item.product_name,
                sku: item.sku,
                quantity: Number(item.quantity)
            })),

            message: message

        });

        showToast(
            result.message || "Enquiry submitted successfully"
        );

        cart = [];

        saveCart();

        renderCart();

        form.reset();

        if (messageBox) {
            messageBox.textContent =
                "Your enquiry has been submitted successfully.";
        }

    } catch (error) {

        console.error("Enquiry submission error:", error);

        if (messageBox) {
            messageBox.textContent =
                error.message || "Unable to submit enquiry. Please try again.";
        }

        showToast("Enquiry submission failed");

    } finally {

        button.disabled = false;

        button.textContent = "Submit Enquiry";

    }

}


/* =========================================================
   MOBILE NAVIGATION
========================================================= */

function toggleMenu() {

    $("mainNav")?.classList.toggle("open");

}


/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function esc(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]
    );

}


function escAttr(value) {

    return esc(value);

}


function safeImage(url) {

    const value = String(url || "").trim();

    if (!value) return "";

    try {

        const parsed = new URL(value);

        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
            return parsed.href;
        }

    } catch (error) {

        return "";

    }

    return "";

}


function safeLink(url) {

    return safeImage(url);

}


function formatSpecifications(value) {

    const text = String(value || "").trim();

    if (!text) {
        return "<p>Specifications not available.</p>";
    }

    return text.split(/\r?\n/).map(line => {

        const parts = line.split(":");

        if (parts.length > 1) {

            const heading = parts.shift().trim();

            const detail = parts.join(":").trim();

            return `
                <p>
                    <strong>${esc(heading)}:</strong>
                    ${esc(detail)}
                </p>
            `;

        }

        return `<p>${esc(line)}</p>`;

    }).join("");

}


/* =========================================================
   TOAST MESSAGE
========================================================= */

function showToast(message) {

    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(window.novaToastTimer);

    window.novaToastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}
