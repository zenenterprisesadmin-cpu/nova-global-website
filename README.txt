NOVA GLOBAL ENTERPRISES - GITHUB PAGES VERSION
Static HTML + CSS + JavaScript + Google Sheets Apps Script API.
No XAMPP, PHP, or MySQL required.

FILES
- index.html
- assets/style.css
- assets/app.js
- Code.gs (paste into bound Google Apps Script)
- README.txt

STEP 1 - GOOGLE SHEET
1. Create/open the spreadsheet named NOVA B2B DATABASE.
2. Extensions > Apps Script.
3. Replace editor contents with Code.gs from this package.
4. Save.
5. Run initializeNOVA() once and approve permissions.
6. Add products in the Products sheet. Use these columns:
   id, sku, name, category, short_description, description, specifications,
   image_url, datasheet_url, unit, status, created_at, updated_at
   Set status to Active. Use unique id values such as NOVA-001.
   Put public HTTPS image/datasheet links in their respective columns.

STEP 2 - DEPLOY APPS SCRIPT
1. Deploy > New deployment > Web app.
2. Execute as: Me.
3. Who has access: Anyone.
4. Deploy and copy the URL ending /exec.
5. In assets/app.js replace:
   PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE
   with your actual /exec URL.
6. Save app.js.

STEP 3 - GITHUB PAGES
1. Sign in to GitHub and create a new public repository, e.g. nova-global-website.
2. Upload index.html, Code.gs, README.txt and the assets folder.
   (Code.gs/README are for reference; only index.html and assets are required on the live site.)
3. Repository > Settings > Pages.
4. Under Build and deployment choose Deploy from a branch.
5. Branch: main; folder: /(root); Save.
6. Wait for deployment, then open the GitHub Pages URL shown there.

IMPORTANT API NOTES
- This frontend calls Apps Script directly using POST with Content-Type text/plain.
- Code.gs only exposes three public actions: listProducts, listCategories, submitEnquiry.
- Do not put admin credentials or secret keys in public GitHub files.
- Do not add admin actions to the public API switch.
- Google Apps Script deployment is public; validate and monitor submissions. Before production add CAPTCHA or another anti-spam control and rate limiting.
- If browser console reports a CORS/redirect error, redeploy Apps Script as a Web App with access Anyone and test the /exec URL. Google Apps Script cross-origin behavior can vary by deployment/account. If CORS still blocks the browser, use a server-side proxy or a Google-hosted frontend instead of exposing secrets in client-side code.
- The frontend is an enquiry catalogue, not an online payment checkout.
