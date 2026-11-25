const API_ENDPOINT = "https://script.google.com/macros/s/AKfycbwnBd6CdsFV1UIMJYaEkeiTypivKOJzEdpD6jCj51tumDQ083fIi5GX3sypz26B0ov4bA/exec";
const $ = id => document.getElementById(id);
let adminToken = sessionStorage.getItem("novaAdminToken") || "";
let productsCache = [];
let enquiriesCache = [];

document.addEventListener("DOMContentLoaded", () => {
  $("loginForm").addEventListener("submit", login);
  $("logoutButton").addEventListener("click", logout);
  $("addProductButton").addEventListener("click", () => openProductDialog());
  $("closeProductDialog").addEventListener("click", closeProductDialog);
  $("cancelProduct").addEventListener("click", closeProductDialog);
  $("productForm").addEventListener("submit", saveProduct);
  $("productSearch").addEventListener("input", renderProducts);
  $("refreshEnquiries").addEventListener("click", loadEnquiries);
  $("refreshCustomers").addEventListener("click", loadCustomers);
  document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => showView(b.dataset.go)));
  if (adminToken) enterApp();
});

async function api(action, data={}) {
  const response = await fetch(API_ENDPOINT, {
    method:"POST", mode:"cors", redirect:"follow",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({action, ...data})
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || "Request failed");
  return result;
}
async function login(e) {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const button = $("loginButton");
  $("loginMessage").textContent = "";
  button.disabled = true; button.textContent = "Signing in…";
  try {
    const result = await api("adminLogin", {username:String(form.get("username")).trim(),password:String(form.get("password"))});
    adminToken = result.token;
    sessionStorage.setItem("novaAdminToken", adminToken);
    sessionStorage.setItem("novaAdminName", result.username);
    e.currentTarget.reset();
    await enterApp();
  } catch(err) { $("loginMessage").textContent = err.message; }
  finally { button.disabled = false; button.textContent = "Sign in"; }
}
async function enterApp() {
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("adminName").textContent = sessionStorage.getItem("novaAdminName") || "Admin";
  try { await loadDashboard(); } catch(err) { if (String(err.message).includes("session")) logout(); else toast(err.message); }
}
async function logout() {
  try { if (adminToken) await api("adminLogout",{token:adminToken}); } catch(e) {}
  adminToken = ""; sessionStorage.removeItem("novaAdminToken"); sessionStorage.removeItem("novaAdminName");
  $("appView").classList.add("hidden"); $("loginView").classList.remove("hidden");
}
function showView(name) {
  ["overview","products","enquiries","customers"].forEach(v => $(v+"View").classList.toggle("hidden",v!==name));
  document.querySelectorAll(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("pageTitle").textContent = ({overview:"Overview",products:"Products",enquiries:"Enquiries",customers:"Customers"})[name];
  if (name==="products") loadProducts();
  if (name==="enquiries") loadEnquiries();
  if (name==="customers") loadCustomers();
}
async function loadDashboard() {
  const r = await api("adminDashboard",{token:adminToken});
  $("statProducts").textContent = r.stats.total_products || 0;
  $("statActive").textContent = r.stats.active_products || 0;
  $("statEnquiries").textContent = r.stats.total_enquiries || 0;
  $("statNew").textContent = r.stats.new_enquiries || 0;
  $("statCustomers").textContent = r.stats.total_customers || 0;
  $("recentEnquiries").innerHTML = (r.recent_enquiries||[]).map(e=>`<tr><td><strong>${esc(e.enquiry_no)}</strong></td><td>${esc(e.customer_name)}</td><td>${esc(e.company)}</td><td><span class="tag">${esc(e.status)}</span></td><td>${dateText(e.created_at)}</td></tr>`).join("") || `<tr><td colspan="5">No enquiries yet.</td></tr>`;
}
async function loadProducts() {
  const r = await api("adminListProducts",{token:adminToken});
  productsCache = r.products || []; renderProducts();
}
function renderProducts() {
  const q = $("productSearch").value.trim().toLowerCase();
  const list = productsCache.filter(p=>[p.name,p.sku,p.category].join(" ").toLowerCase().includes(q));
  $("productsTable").innerHTML = list.map(p=>`<tr>
    <td><strong>${esc(p.name)}</strong><br><small>${esc(p.short_description||"")}</small></td>
    <td>${esc(p.sku||"")}</td><td>${esc(p.category||"")}</td>
    <td><span class="tag ${String(p.status).toLowerCase()==="inactive"?"inactive":""}">${esc(p.status||"Active")}</span></td>
    <td><div class="row-actions"><button class="mini-btn" data-edit="${escAttr(p.id)}">Edit</button><button class="mini-btn danger" data-delete="${escAttr(p.id)}">Deactivate</button></div></td>
  </tr>`).join("") || `<tr><td colspan="5">No products found.</td></tr>`;
  $("productsTable").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openProductDialog(productsCache.find(p=>String(p.id)===b.dataset.edit))));
  $("productsTable").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deactivateProduct(b.dataset.delete)));
}
function openProductDialog(p={}) {
  const f=$("productForm"); f.reset();
  $("productDialogTitle").textContent = p.id ? "Edit product" : "Add product";
  ["id","name","sku","category","short_description","description","specifications","image_url","datasheet_url","unit","status"].forEach(k=>{if(f.elements[k]) f.elements[k].value=p[k]|| (k==="status"?"Active":"");});
  $("productMessage").textContent="";
  $("productDialog").classList.remove("hidden");
}
function closeProductDialog(){$("productDialog").classList.add("hidden");}
async function saveProduct(e) {
  e.preventDefault();
  const f=e.currentTarget, data=new FormData(f), product={};
  ["id","name","sku","category","short_description","description","specifications","image_url","datasheet_url","unit","status"].forEach(k=>product[k]=String(data.get(k)||"").trim());
  const b=$("saveProductButton"); b.disabled=true; b.textContent="Saving…";
  try { const r=await api("adminSaveProduct",{token:adminToken,product}); toast(r.message); closeProductDialog(); await loadProducts(); await loadDashboard(); }
  catch(err){$("productMessage").textContent=err.message;}
  finally{b.disabled=false;b.textContent="Save product";}
}
async function deactivateProduct(id) {
  if(!confirm("Deactivate this product? It will no longer appear on the public website.")) return;
  try {const r=await api("adminDeleteProduct",{token:adminToken,id});toast(r.message);await loadProducts();await loadDashboard();}
  catch(err){toast(err.message);}
}
async function loadEnquiries() {
  const r=await api("adminListEnquiries",{token:adminToken}); enquiriesCache=r.enquiries||[];
  $("enquiriesList").innerHTML=enquiriesCache.map(e=>{
    const items=(e.items||[]).map(i=>`${esc(i.product_name)} · ${esc(i.sku||"")} · Qty: ${esc(i.quantity)}`).join("<br>")||"No line items";
    return `<article class="enquiry-card">
      <div class="enquiry-top"><div><h3>${esc(e.enquiry_no)} <span class="tag">${esc(e.status)}</span></h3><p>${esc(e.customer.name)} · ${esc(e.customer.company)} · ${dateText(e.created_at)}</p></div>
      <select class="status-select" data-status="${escAttr(e.id)}"><option ${e.status==="New"?"selected":""}>New</option><option ${e.status==="Processing"?"selected":""}>Processing</option><option ${e.status==="Quoted"?"selected":""}>Quoted</option><option ${e.status==="Completed"?"selected":""}>Completed</option><option ${e.status==="Cancelled"?"selected":""}>Cancelled</option></select></div>
      <div class="enquiry-meta">${esc(e.customer.email)} · ${esc(e.customer.phone)}<br>${esc(e.customer.address||"")}</div>
      <div class="enquiry-body"><div class="enquiry-items"><strong>Requested items</strong><br>${items}${e.message?`<br><br><strong>Message:</strong> ${esc(e.message)}`:""}</div></div>
    </article>`;
  }).join("") || `<p class="muted">No enquiries found.</p>`;
  $("enquiriesList").querySelectorAll("[data-status]").forEach(s=>s.addEventListener("change",()=>updateStatus(s.dataset.status,s.value)));
}
async function updateStatus(id,status) {
  try {const r=await api("adminUpdateEnquiryStatus",{token:adminToken,id,status});toast(r.message);await loadDashboard();}
  catch(err){toast(err.message);await loadEnquiries();}
}
async function loadCustomers() {
  const r=await api("adminListCustomers",{token:adminToken});
  $("customersTable").innerHTML=(r.customers||[]).map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.company||"")}</td><td>${esc(c.email||"")}</td><td>${esc(c.phone||"")}</td><td>${esc(c.address||"")}</td><td>${dateText(c.created_at)}</td></tr>`).join("")||`<tr><td colspan="6">No customers found.</td></tr>`;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function escAttr(v){return esc(v);}
function dateText(v){if(!v)return "";const d=new Date(v);return isNaN(d)?esc(v):d.toLocaleString();}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500);}
