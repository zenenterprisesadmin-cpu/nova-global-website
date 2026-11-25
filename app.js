// Paste your deployed Google Apps Script Web App URL ending in /exec.
const API_ENDPOINT = "https://script.google.com/macros/s/AKfycbwnBd6CdsFV1UIMJYaEkeiTypivKOJzEdpD6jCj51tumDQ083fIi5GX3sypz26B0ov4bA/exec";
const state = { products: [], categories: [], cart: JSON.parse(localStorage.getItem("novaEnquiryCart") || "[]") };
const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("year").textContent = new Date().getFullYear();
  $("menuToggle").addEventListener("click", () => $("mainNav").classList.toggle("show"));
  $("openCart").addEventListener("click", openCart);
  $("heroEnquiry").addEventListener("click", openCart);
  $("closeCart").addEventListener("click", closeCart);
  $("drawerBackdrop").addEventListener("click", closeCart);
  $("closeModal").addEventListener("click", closeProductModal);
  $("productModal").addEventListener("click", e => { if (e.target === $("productModal")) closeProductModal(); });
  $("searchInput").addEventListener("input", renderProducts);
  $("categoryFilter").addEventListener("change", renderProducts);
  $("enquiryForm").addEventListener("submit", submitEnquiry);
  updateCartUI();
  loadCatalogue();
});

async function api(action, data = {}) {
  if (!API_ENDPOINT.startsWith("https://script.google.com/")) {
    throw new Error("Please set API_ENDPOINT in assets/app.js to your Apps Script /exec URL.");
  }
  // text/plain avoids the browser's JSON preflight request. Apps Script reads e.postData.contents.
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    mode: "cors",
    redirect: "follow",
    headers: {"Content-Type":"text/plain;charset=utf-8"},
    body: JSON.stringify({action, ...data})
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || "Request failed");
  return result;
}

async function loadCatalogue() {
  $("loadingState").classList.remove("hidden");
  $("errorState").classList.add("hidden");
  try {
    const [p, c] = await Promise.all([api("listProducts"), api("listCategories")]);
    state.products = Array.isArray(p.products) ? p.products : [];
    state.categories = Array.isArray(c.categories) ? c.categories : [];
    fillCategories();
    renderProducts();
  } catch (err) {
    $("errorState").textContent = "Unable to load products. " + err.message + " Please check the API setup.";
    $("errorState").classList.remove("hidden");
  } finally { $("loadingState").classList.add("hidden"); }
}

function fillCategories() {
  const select = $("categoryFilter");
  const current = select.value;
  select.innerHTML = '<option value="">All categories</option>';
  const names = [...new Set([
    ...state.categories.map(x => x.name),
    ...state.products.map(x => x.category)
  ].filter(Boolean))].sort();
  names.forEach(name => {
    const option = document.createElement("option");
    option.value = name; option.textContent = name; select.appendChild(option);
  });
  select.value = names.includes(current) ? current : "";
}

function renderProducts() {
  const query = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const filtered = state.products.filter(p => {
    const haystack = [p.name,p.sku,p.category,p.short_description,p.description].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (!category || p.category === category);
  });
  const grid = $("productGrid"); grid.innerHTML = "";
  $("emptyState").classList.toggle("hidden", filtered.length > 0);
  filtered.forEach(product => {
    const card = document.createElement("article"); card.className = "product-card";
    const image = safeUrl(product.image_url);
    card.innerHTML = `
      <div class="product-image">${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(product.name || "Product")}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=&quot;image-placeholder&quot;>▦</span>'">` : '<span class="image-placeholder">▦</span>'}</div>
      <div class="product-info">
        <span class="product-category">${escapeHtml(product.category || "General")}</span>
        <h3>${escapeHtml(product.name || "Unnamed product")}</h3>
        <p>${escapeHtml(product.short_description || product.description || "Contact us for product details and specifications.")}</p>
        <div class="product-meta">${product.sku ? "SKU: " + escapeHtml(product.sku) : ""}${product.unit ? " · Unit: " + escapeHtml(product.unit) : ""}</div>
        <div class="product-actions"><button type="button" data-view="${escapeAttr(product.id)}">View Details</button><button class="add" type="button" data-add="${escapeAttr(product.id)}">+ Add Enquiry</button></div>
      </div>`;
    grid.appendChild(card);
  });
  grid.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => addToCart(btn.dataset.add)));
  grid.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => showProduct(btn.dataset.view)));
}

function showProduct(id) {
  const p = state.products.find(x => String(x.id) === String(id)); if (!p) return;
  const image = safeUrl(p.image_url);
  $("modalContent").innerHTML = `<div class="modal-product">
    ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(p.name)}">` : '<div class="product-image"><span class="image-placeholder">▦</span></div>'}
    <div><span class="product-category">${escapeHtml(p.category || "General")}</span><h2>${escapeHtml(p.name || "")}</h2>
    <p>${escapeHtml(p.description || p.short_description || "Contact us for more details.")}</p>
    ${p.sku ? `<p><b>SKU:</b> ${escapeHtml(p.sku)}</p>` : ""}
    ${p.specifications ? `<h4>Technical specifications</h4><div class="specs">${escapeHtml(p.specifications)}</div>` : ""}
    ${safeUrl(p.datasheet_url) ? `<p><a class="text-link" href="${escapeAttr(safeUrl(p.datasheet_url))}" target="_blank" rel="noopener">View datasheet ↗</a></p>` : ""}
    <button class="btn primary" id="modalAdd">Add to Enquiry</button></div></div>`;
  $("productModal").classList.remove("hidden");
  $("modalAdd").addEventListener("click", () => { addToCart(id); closeProductModal(); openCart(); });
}
function closeProductModal(){ $("productModal").classList.add("hidden"); }

function addToCart(id) {
  const p = state.products.find(x => String(x.id) === String(id)); if (!p) return;
  const found = state.cart.find(x => String(x.product_id) === String(id));
  if (found) found.quantity += 1;
  else state.cart.push({product_id:p.id,product_name:p.name,sku:p.sku || "",unit:p.unit || "",quantity:1});
  saveCart(); toast("Added to your enquiry list");
}
function saveCart(){localStorage.setItem("novaEnquiryCart",JSON.stringify(state.cart));updateCartUI();}
function updateCartUI(){
  $("cartCount").textContent = state.cart.reduce((n,x)=>n+Number(x.quantity||0),0);
  const box=$("cartItems");box.innerHTML="";
  if(!state.cart.length){box.innerHTML='<p class="muted">Your enquiry list is empty. Add products from the catalogue.</p>';return;}
  state.cart.forEach((item,index)=>{
    const row=document.createElement("div");row.className="cart-row";
    row.innerHTML=`<div><strong>${escapeHtml(item.product_name)}</strong><small>${item.sku ? "SKU: "+escapeHtml(item.sku)+" · " : ""}${escapeHtml(item.unit || "Unit")}</small><button class="remove-item" data-remove="${index}">Remove</button></div>
      <div class="qty-controls"><button data-dec="${index}">−</button><span>${Number(item.quantity)}</span><button data-inc="${index}">+</button></div>`;
    box.appendChild(row);
  });
  box.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{state.cart.splice(Number(b.dataset.remove),1);saveCart();}));
  box.querySelectorAll("[data-inc]").forEach(b=>b.addEventListener("click",()=>{state.cart[Number(b.dataset.inc)].quantity++;saveCart();}));
  box.querySelectorAll("[data-dec]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.dec);state.cart[i].quantity=Math.max(1,state.cart[i].quantity-1);saveCart();}));
}
function openCart(){$("enquiryDrawer").classList.add("open");$("drawerBackdrop").classList.add("open");$("mainNav").classList.remove("show");}
function closeCart(){$("enquiryDrawer").classList.remove("open");$("drawerBackdrop").classList.remove("open");}

async function submitEnquiry(event) {
  event.preventDefault();
  if (!state.cart.length) { toast("Please add at least one product first"); return; }
  const form = event.currentTarget, data = new FormData(form);
  const customer = {name:data.get("name").trim(),company:data.get("company").trim(),email:data.get("email").trim(),phone:data.get("phone").trim(),address:data.get("address").trim()};
  const message = data.get("message").trim();
  const button=$("submitEnquiry"), note=$("formMessage");
  button.disabled=true;button.textContent="Submitting…";note.textContent="Please wait while we submit your enquiry.";
  try {
    const result=await api("submitEnquiry",{customer,message,items:state.cart});
    state.cart=[];saveCart();form.reset();
    note.textContent=`Thank you. Your enquiry number is ${result.enquiry_no || ""}. Our team will contact you.`;
    toast("Enquiry submitted successfully");
  } catch(err) { note.textContent="Could not submit: "+err.message; }
  finally {button.disabled=false;button.textContent="Submit Enquiry";}
}

function safeUrl(value) {
  if (!value) return "";
  try { const u = new URL(String(value), window.location.href); return ["https:","http:"].includes(u.protocol) ? u.href : ""; } catch { return ""; }
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function escapeAttr(v){return escapeHtml(v);}
let toastTimer;
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2300);}
