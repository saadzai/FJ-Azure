# Fashion Jewellers — Project Guide

This guide is written for someone new to the project. It explains what the application does, how its pieces fit together, how to run it locally, and how to follow a typical customer request through the code.

## 1. The project in one minute

Fashion Jewellers is an online jewellery store with three kinds of users:

- **Customers** browse products, create accounts, manage a cart, place orders, and write reviews.
- **Employees** use staff tools according to their job role, such as inventory, sales, or social media.
- **Administrators** manage the store and view reports.

The project has three main parts:

1. **React website** in `client/`: the pages and buttons a person sees in their browser.
2. **Express API** in `server/`: the rules and operations behind those pages.
3. **PostgreSQL database**: the saved products, accounts, carts, orders, and other business data.

For example, when a customer adds a ring to their cart, the browser sends a request to the API. The API checks the customer and available stock, updates the database, and sends the updated cart back to the browser.

## 2. A few terms in plain English

| Term | Meaning in this project |
| --- | --- |
| Frontend / client | The React application running in the browser. |
| Backend / server | The Node.js and Express application that provides the API. |
| API | A set of URLs the frontend calls to read or change data. |
| Database | PostgreSQL, where the lasting application data is stored. |
| Route | A page URL in the website, or an API URL handled by the server. The word is used for both, so check whether the route is in `client/` or `server/`. |
| Component | A reusable piece of a React page, such as a navigation bar or product card. |
| Context | Shared frontend state, such as the signed-in customer or current cart. |
| Service | Backend code that performs business operations and talks to the database. |
| Middleware | Express code that runs before a route, often to verify a login or role. |
| JWT / token | A signed login credential sent with API requests that need authentication. |

## 3. How a request moves through the app

The usual direction is:

```text
Person
  ↓ clicks or submits a form
React page / component (client/src)
  ↓ calls the shared Axios API client
Express route (server/src/routes)
  ↓ checks login/role and calls a service
Service (server/src/services)
  ↓ runs SQL through the PostgreSQL connection pool
PostgreSQL database
  ↑ result travels back through the same layers
React updates what is shown on screen
```

The frontend API client is `client/src/services/api.js`. Its base URL is `http://localhost:5000/api/v1` unless `VITE_API_URL` is set. It also attaches the appropriate saved login token to requests.

The backend starts in `server/src/index.js`. It mounts the route files, serves local files from `/uploads`, connects to PostgreSQL, and initializes a few supporting tables/columns.

## 4. Repository map

```text
client/
  src/
    App.jsx                 Website page routes and shared providers
    main.jsx                React entry point
    components/             Reusable UI pieces and layouts
    context/                Shared login, cart, and toast state
    portals/
      public/               Home, catalog, product details, login, registration
      customer/             Cart and customer profile/order history
      admin/                Administrator pages
      employee/             Employee pages
      common/               Reports shared by staff portals
    services/               API client and live-update client
server/
  src/
    index.js                Express application and startup
    routes/                 HTTP endpoints
    services/               Business rules and database operations
    middleware/             Authentication, role checks, image upload
    db/                     PostgreSQL pool and startup schema helpers
    config/                 Third-party service configuration
    utils/                  Shared helpers, errors, IDs, event broadcasting
  test/                     Integration and migration-related test scripts
  uploads/                  Local product images and temporary uploads
db/
  setup_postgres.sql        Fresh-database schema and starter data
  migrations/               SQL changes for an existing database
```

Other useful files:

- `client/package.json` contains frontend commands and dependencies.
- `server/package.json` contains backend commands and dependencies.
- `server/.env.example` lists the backend configuration values.
- `client/vite.config.js` configures the Vite development server and its `/api` proxy.

## 5. The website pages

The browser routes are registered in `client/src/App.jsx`.

| URL | Purpose |
| --- | --- |
| `/` | Store home page |
| `/products` | Product catalog |
| `/products/:id` | Details and reviews for one product; `:id` is replaced by a product ID such as `P001` |
| `/login`, `/register` | Customer login and registration |
| `/cart`, `/me` | Customer cart and profile/order history |
| `/admin/login` | Administrator login |
| `/admin` and `/admin/...` | Admin dashboard, products, orders, customers, suppliers, employees, and reports |
| `/employee/login` | Employee login |
| `/employee/:username/...` | Employee dashboard and role-specific tools |

The `PublicLayout`, `AdminLayout`, and `EmployeeDashboardLayout` provide the shared page structure for each portal. `ProductCard` and the components in `components/common/` are examples of UI reused in more than one page.

`App.jsx` also wraps the app in providers. These providers make shared features available to many pages:

- `AuthContext` holds customer login state.
- `AdminAuthContext` and `EmployeeAuthContext` keep staff login state separate.
- `CartContext` loads and updates the signed-in customer's cart.
- `ToastContext` displays success and error messages.

## 6. The backend and API

An API route is an HTTP method plus a URL. For example, `GET /api/v1/products` asks for products, while `POST /api/v1/cart/items` changes the current customer's cart.

Most JSON API responses use this shape:

```json
{
  "success": true,
  "data": {},
  "message": "A human-readable result"
}
```

If something goes wrong, the server generally returns `success: false` and a message. The global error handler is in `server/src/index.js`.

### Main API groups

The complete route registration is in `server/src/index.js`; the matching handlers are in `server/src/routes/`.

| Base URL | What it handles |
| --- | --- |
| `/api/v1/auth` | Login, customer registration, and logout |
| `/api/v1/products` | Product listing, search, product details, reviews, and staff product management |
| `/api/v1/categories`, `/api/v1/materials` | Catalog filter options |
| `/api/v1/cart` | Customer cart |
| `/api/v1/orders` | Customer checkout, order history, invoices, and status changes |
| `/api/v1/customers` | The signed-in customer's profile and password |
| `/api/v1/admin/customers`, `/api/v1/admin/employees`, `/api/v1/admin/suppliers` | Admin management of these records |
| `/api/v1/admin/orders`, `/api/v1/admin/payments`, `/api/v1/admin/stats` | Order, payment, and dashboard data |
| `/api/v1/reviews` | Submit a customer review |
| `/api/v1/sales-report` | Staff sales reports |
| `/api/v1/social` | Social-post workflow for the Social Media Manager |
| `/api/v1/competitors` | Competitor records and analysis reports |
| `/api/v1/sync/events` | Server-Sent Events used for selected live updates |
| `/api/v1/health` | Basic server health check |

Some endpoints have compatibility aliases (for example, competitor and social routes). When adding or changing an endpoint, check both its route file and its mount in `server/src/index.js`.

### Where backend work belongs

The common pattern is:

1. A route in `server/src/routes/` reads request parameters/body and selects the required middleware.
2. Middleware such as `authMiddleware` verifies the JWT. `roleMiddleware` checks broad roles like `customer` or `admin`; `employeeRoleMiddleware` checks a job title such as `Inventory Manager`.
3. A service in `server/src/services/` applies the business rules and runs parameterized SQL using `server/src/db/pool.js`.
4. The route returns the result as JSON.

For example, the product routes delegate catalog queries to `ProductService`. Product creation and editing require an administrator or an Inventory Manager, while catalog reads are public.

## 7. Database overview

The fresh database setup is `db/setup_postgres.sql`. It creates the main tables and inserts starter data (including categories, materials, roles, employees, customers, suppliers, products, reviews, and payment methods).

Some important relationships:

- A **product** belongs to a category, material, type, and supplier.
- A **customer** can have a cart and many orders and reviews.
- A **cart** contains products through the `holds` table.
- An **order** contains its purchased products through `record_items`; its payment is recorded in `payment`.
- An **employee** has a role from `role_type`.
- Social posting uses `post_approval`; competitor analysis uses `competitors` and `competitor_reports`.

The SQL file also sets up ID sequences, so new records can receive IDs such as `P011` or `SUP006`. The server startup helpers create or verify some newer schema elements, but they do not replace the main database setup.

For a **new local database**, run `setup_postgres.sql` once. The files in `db/migrations/` are for changing an existing database; do not blindly run every migration on top of a fresh setup. Check the target database and migration contents first.

## 8. Run the project on your computer

You need Node.js with npm and a running PostgreSQL server. The SQL command-line tools `createdb` and `psql` are useful for creating and initializing the database.

### Step 1: Get the code and create the database

In PowerShell:

```powershell
git clone https://github.com/m-binarif/Fashion-Jewellery.git
Set-Location .\Fashion-Jewellery

createdb -U postgres fashion_jewellery_db
psql -U postgres -d fashion_jewellery_db -f .\db\setup_postgres.sql
```

If `createdb` reports that the database already exists, use that database only if you intend to keep its data. The setup SQL creates and seeds the schema; it is intended for a fresh database.

If PostgreSQL uses a different username, password, or port on your computer, use those values in the next step. PostgreSQL may prompt for the database password.

### Step 2: Configure and start the backend

```powershell
Set-Location .\server
Copy-Item .env.example .env
```

Open `server/.env` and set at least:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` to match your local PostgreSQL setup.
- `JWT_SECRET` to a long, private value used to sign login tokens.
- `FRONTEND_ORIGINS` to `http://localhost:5173` for the default Vite address.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` for the administrator account. The password value must be a **bcrypt hash**, not a plain-text password.

Optional integrations have their own settings in the template:

- Cloudinary settings are used for hosted product images.
- `N8N_INSTAGRAM_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` are used by the social-post workflow.
- `GROQ_API_KEY` is used for competitor analysis.

Keep your real `.env` private; it is ignored by Git. Do not copy real credentials into source code or commit them.

Then, in the same `server` PowerShell window:

```powershell
npm install
npm run dev
```

The API listens on port `5000` by default. Check that it is responding by visiting `http://localhost:5000/api/v1/health`. The backend console also reports whether it connected to PostgreSQL.

### Step 3: Start the frontend

Open a **second** PowerShell window at the repository root:

```powershell
Set-Location .\client
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.

The frontend uses `VITE_API_URL` if set; otherwise it calls `http://localhost:5000/api/v1`. The Vite proxy in `client/vite.config.js` also forwards `/api` requests to the backend.

## 9. Example: follow a customer shopping flow

This example shows the same steps the website performs: register, read products, add an item, and check the cart. Run it against a local development database. The registration request creates a real customer record.

In PowerShell, while the backend is running:

```powershell
$baseUrl = "http://localhost:5000/api/v1"

# Create a customer account. Use an email not already in the database.
$registration = Invoke-RestMethod `
  -Method Post `
  -Uri "$baseUrl/auth/register" `
  -ContentType "application/json" `
  -Body (@{
    fullName = "Example Customer"
    email = "example.customer@example.test"
    password = "Choose-A-Local-Password"
    phone = "555-0100"
    country = "Pakistan"
    address = "1 Example Street"
  } | ConvertTo-Json)

$token = $registration.data.token

# Browse products. This request is public and does not need the token.
$products = Invoke-RestMethod -Method Get -Uri "$baseUrl/products?category=Rings"
$products.data.products

# Add one product to this customer's cart.
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod `
  -Method Post `
  -Uri "$baseUrl/cart/items" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ productId = "P001"; quantity = 1 } | ConvertTo-Json)

# Read the cart.
Invoke-RestMethod -Method Get -Uri "$baseUrl/cart" -Headers $headers
```

The cart service checks that the product exists, is active, and has enough stock. It saves the selected quantity in the database and calculates the subtotal from the product prices.

To place an order, the frontend sends the shipping address and a payment method ID to `POST /api/v1/orders`. For example, `PM003` is the seeded Cash on Delivery method. Checkout validates the cart and payment method, checks stock again, creates the order/items/payment in a database transaction, reduces stock, and empties the cart. **Checkout changes database data and reduces stock**, so only try it with data you are comfortable changing.

## 10. Login and permissions

The login endpoint is shared, but the three portals keep their sessions separate:

- Customers use `token` in browser `localStorage`.
- Admins use `admin_token` in `localStorage`.
- Employees use `employee_token` in browser `sessionStorage`, with username-specific copies to support their employee URL.

The API client chooses which token to attach based on the current page URL. The backend independently verifies the token and checks permissions. Hiding a button in the frontend is not the security check; the API middleware is.

An administrator is configured through environment variables. Employees and customers are stored in the database. The starter SQL includes sample records with password hashes, but this guide does not assume or publish their plain-text passwords.

## 11. Images, live updates, and optional integrations

- **Product images:** The server accepts JPG, JPEG, PNG, and WEBP uploads up to 5 MB. Uploads are staged under `server/uploads/temp`; product image handling can send them to Cloudinary. Existing local sample images are served from `/uploads`.
- **Live updates:** `client/src/services/realtime.js` subscribes to Server-Sent Events from `/api/v1/sync/events`. Routes broadcast selected events such as changed orders or products so open staff pages can refresh.
- **Social posting:** The Social Media Manager pages call the backend social routes, which can trigger an n8n webhook. The webhook URL and shared secret are configured in `server/.env`.
- **Competitor analysis:** The backend stores competitor entries and generated reports in PostgreSQL and can call external reader/AI services. Configure the relevant API key before using that feature.
- **Invoices:** The order invoice endpoint returns an HTML invoice that the browser can print or save as PDF.

The core store can be explored without configuring every optional integration, but features that depend on an external service need valid service settings.

## 12. Tests and useful commands

Run these from the appropriate folder:

```powershell
# Frontend production build
Set-Location .\client
npm run build

# Backend integration tests included in the package script
Set-Location ..\server
npm test
```

`npm test` runs the Cloudinary, n8n webhook, and sales-report integration test scripts listed in `server/package.json`. Other test files are present in `server/test/`, but are not included in that npm script.

Other backend scripts:

| Command | Purpose |
| --- | --- |
| `npm run start` | Start the API without the development file watcher |
| `npm run dev` | Start the API with Nodemon |
| `npm run migrate:cleanup` | Run the cleanup migration script |
| `npm run migrate:images` | Migrate product images to Cloudinary |
| `npm run migrate:competitors` | Run the competitor-table migration script |

Read a migration script and confirm your database has a backup before running it against data you need to keep.

## 13. Where to make common changes

| If you want to… | Start looking here |
| --- | --- |
| Change which website page opens at a URL | `client/src/App.jsx` |
| Change a customer-facing page | `client/src/portals/public/` or `client/src/portals/customer/` |
| Change admin or employee tools | `client/src/portals/admin/` or `client/src/portals/employee/` |
| Change shared login/cart behavior | `client/src/context/` |
| Change how the browser calls the API | `client/src/services/api.js` |
| Add or change an API endpoint | The relevant file in `server/src/routes/`, plus its mount in `server/src/index.js` |
| Change business rules or SQL | The relevant file in `server/src/services/` |
| Change authentication or permissions | `server/src/middleware/auth.js` and the relevant route |
| Change the database structure | `db/setup_postgres.sql` for fresh installs and a new migration for existing databases |
| Change upload or image handling | `server/src/middleware/upload.js`, `server/src/utils/cloudinary.js`, and product routes |

When changing a feature, trace it from the page to the API route to its service and database query. That makes it easier to find the right file and avoid putting database logic in a React component.

## 14. Common problems

| Symptom | Things to check |
| --- | --- |
| Website opens, but API requests fail | Is the backend running on port `5000`? Does `VITE_API_URL` point to the right API? |
| Backend reports a database connection failure | Is PostgreSQL running? Does the database exist? Do the `DB_*` values in `server/.env` match it? Was `setup_postgres.sql` applied? |
| Browser reports a CORS error | Confirm `FRONTEND_ORIGINS` includes the exact frontend URL, including scheme and port. Restart the backend after editing `.env`. |
| Login fails for every account | Check `JWT_SECRET`, account active status, email/username, and password. Admin login uses the configured bcrypt hash; it is not a plain-text password setting. |
| Product images are missing | Check the product's `image_url`, whether the file exists under `server/uploads`, and any Cloudinary configuration used by that product. |
| Staff page says access is forbidden | The signed-in account may have the wrong role. Some tools require a specific employee role, not just any employee login. |
| Social or competitor feature fails | Check the integration's configured URL/API key and whether the external service is running/available. |

For backend problems, start with the server terminal: database and API errors are logged there. For frontend problems, open the browser developer tools and inspect the Console and Network tabs.

## 15. Prepare and deploy the backend to Azure

These steps target **Azure App Service on Linux** for the Node.js API. The frontend and PostgreSQL database are separate deployments. Keep production credentials and customer data out of Git.

### Before creating the Azure app

1. Create an **Azure Database for PostgreSQL Flexible Server** in a region near the App Service. Decide how the database will be reached: preferably private networking/VNet integration, or a firewall rule restricted to the App Service's outbound IP addresses. Do not open the database to every IP address.
2. Create the production database and database user. Give the app only the database permissions it needs.
3. Review `db/setup_postgres.sql` before applying it. It inserts sample customers, employees, suppliers, products, and reviews; do not copy this demo data into a real store. Use a clean production dataset and take a backup before applying schema changes.
4. Create a **Linux App Service** using the Node.js 24 LTS runtime and a 64-bit plan. The server package supports Node.js 22 through 24; use 24 for the Azure runtime.

### Configure App Service settings

In the App Service's **Settings → Environment variables** (or **Configuration → Application settings**), add the following settings. Azure settings are environment variables; do not upload `server/.env`.

| Setting | Value |
| --- | --- |
| `PORT` | Do not set manually; App Service supplies this. The server listens on it. |
| `DB_HOST` | Hostname of the PostgreSQL Flexible Server |
| `DB_PORT` | `5432` unless the database is configured differently |
| `DB_USER` | Production database user |
| `DB_PASSWORD` | Production database password |
| `DB_NAME` | Production database name |
| `DB_SSL` | `true` |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true`; keep certificate verification enabled |
| `JWT_SECRET` | A randomly generated secret with at least 32 characters |
| `JWT_EXPIRES_IN` | For example, `24h` |
| `ADMIN_EMAIL` | The production administrator email |
| `ADMIN_PASSWORD_HASH` | A bcrypt hash of a strong administrator password, never the plain-text password |
| `ADMIN_NAME` | The administrator display name |
| `FRONTEND_ORIGINS` | The exact deployed frontend origin(s), comma-separated, e.g. `https://shop.example.com,https://www.example.com` |
| `NODE_ENV` | `production` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` when using ZIP deployment so Azure installs production dependencies |

Use the `DB_*` names above, not a single `DATABASE_URL`; the current connection pool reads the individual settings. `DB_SSL=false` in `server/.env.example` is only for local development. Azure PostgreSQL should use TLS with certificate verification enabled.

Generate a JWT secret locally without putting it into source control:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create a bcrypt hash using a trusted local password-hashing tool or a secure one-off script, and store the hash in App Service settings. Never commit the generated secret or the production `.env`.

Only add optional integration settings if you have deployed those services too:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` for hosted product images. App Service local storage is instance/deployment-dependent and is not a reliable store for customer uploads; use Cloudinary or another durable object-storage service.
- `N8N_INSTAGRAM_WEBHOOK_URL` and a unique `N8N_WEBHOOK_SECRET` for a reachable n8n deployment. The local URL in `.env.example` is not reachable from Azure.
- `GROQ_API_KEY` for competitor analysis.

### Deploy the server directory

The Node package is under `server/`, not the repository root. The deployed package must have `package.json` and `package-lock.json` at its root so Azure can install the correct dependencies and run `npm start`.

One ZIP deployment option, from PowerShell at the repository root:

```powershell
Set-Location .\server
Compress-Archive -Path .\src, .\uploads, .\package.json, .\package-lock.json -DestinationPath ..\fashion-jewellers-api.zip -Force
Set-Location ..

az webapp deploy `
  --resource-group <resource-group> `
  --name <app-service-name> `
  --src-path .\fashion-jewellers-api.zip `
  --type zip
```

Do not include `.env` or `node_modules` in the archive. Configure the App Service startup command as `npm start` if it is not detected automatically. After deployment, check **Log stream** for startup errors and open:

```text
https://<app-service-name>.azurewebsites.net/api/v1/health
```

The health endpoint verifies the database connection and returns HTTP 503 when it cannot reach PostgreSQL. Configure the App Service Health check path to `/api/v1/health`.

### Connect the frontend

Deploy the React frontend separately. Set `VITE_API_URL` to the full backend API base URL, for example:

```text
https://<app-service-name>.azurewebsites.net/api/v1
```

`VITE_API_URL` is used when the frontend is built, so rebuild and redeploy the client after changing it. Also ensure the frontend's public HTTPS origin is listed in the backend's `FRONTEND_ORIGINS`; include every legitimate origin explicitly rather than using `*`.

### Verify before going live

- The health endpoint returns HTTP 200 and App Service logs show the PostgreSQL connection and schema checks succeeded.
- Login, product listing, image display, cart, checkout, and staff permissions work against the production database.
- The production admin password hash and JWT secret are unique, strong, and stored only in App Service settings.
- The PostgreSQL firewall/private networking does not expose the database broadly.
- Product images use durable external storage; social and competitor features have their external services configured or are left unused.
- Remove demo records and confirm backups, logging, and database recovery before accepting real customer orders.

See Microsoft's [Node.js guidance for Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs) for current runtime and deployment settings.
