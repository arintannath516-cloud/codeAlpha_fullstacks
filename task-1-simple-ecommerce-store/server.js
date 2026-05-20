const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path = require("path");

const app = express();
const adapter = new FileSync(path.join(__dirname, "db.json"));
const db = low(adapter);

db.defaults({ users: [], products: [], orders: [] }).write();

if (db.get("products").value().length === 0) {
  db.set("products", [
    {
      id: "p1",
      name: "Noise Cancelling Headphones",
      price: 2999,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
      shortDescription: "Immersive sound with comfortable over-ear design.",
      description: "Premium wireless headphones with deep bass, soft ear cushions, and up to 25 hours of battery backup."
    },
    {
      id: "p2",
      name: "Smart Fitness Watch",
      price: 2499,
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
      shortDescription: "Track your health and productivity every day.",
      description: "A stylish smartwatch with heart-rate tracking, sleep monitoring, step counter, and message alerts."
    },
    {
      id: "p3",
      name: "Laptop Backpack",
      price: 1499,
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
      shortDescription: "Strong, water-resistant bag with modern storage.",
      description: "Durable backpack designed for students and professionals, with padded laptop protection and multiple pockets."
    },
    {
      id: "p4",
      name: "Portable Bluetooth Speaker",
      price: 1799,
      image: "https://images.unsplash.com/photo-1589003077984-894e133dabab?auto=format&fit=crop&w=800&q=80",
      shortDescription: "Powerful audio in a compact body.",
      description: "Portable speaker with crisp audio, Bluetooth 5.0, built-in mic, and long-lasting rechargeable battery."
    }
  ]).write();
}

app.set("view engine", "html");
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "codealpha-ecommerce-secret",
    resave: false,
    saveUninitialized: false
  })
);

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCurrentUser(req) {
  if (!req.session.userId) return null;
  return db.get("users").find({ id: req.session.userId }).value() || null;
}

function getCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

function nav(user, cartCount) {
  return `
    <div class="navbar">
      <div class="container nav-inner">
        <a class="brand" href="/">CodeAlpha Store</a>
        <div class="nav-links">
          <a href="/">Products</a>
          <a href="/cart">Cart (${cartCount})</a>
          ${user ? `<a href="/orders">My Orders</a>` : ""}
        </div>
        <div class="nav-actions">
          ${user
            ? `<span class="badge">Hi, ${escapeHtml(user.name)}</span><a class="btn secondary" href="/logout">Logout</a>`
            : `<a class="btn secondary" href="/login">Login</a><a class="btn" href="/register">Register</a>`}
        </div>
      </div>
    </div>
  `;
}

function layout(title, content, req, options = {}) {
  const user = getCurrentUser(req);
  const cartCount = getCart(req).reduce((sum, item) => sum + item.quantity, 0);
  const flash = options.flash
    ? `<div class="flash ${options.error ? "error" : ""}">${escapeHtml(options.flash)}</div>`
    : "";
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    ${nav(user, cartCount)}
    <main class="container">
      ${flash}
      ${content}
    </main>
    <footer>CodeAlpha Task 1 - Simple E-commerce Store</footer>
  </body>
  </html>`;
}

function requireAuth(req, res, next) {
  if (!getCurrentUser(req)) {
    return res.redirect("/login");
  }
  next();
}

app.get("/", (req, res) => {
  const products = db.get("products").value();
  const productCards = products
    .map(
      (product) => `
      <div class="card">
        <img class="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
        <h3>${escapeHtml(product.name)}</h3>
        <p class="meta">${escapeHtml(product.shortDescription)}</p>
        <p class="price">${formatCurrency(product.price)}</p>
        <div class="nav-actions">
          <a class="btn secondary" href="/products/${product.id}">View Details</a>
          <form action="/cart/add" method="POST">
            <input type="hidden" name="productId" value="${product.id}" />
            <button type="submit">Add to Cart</button>
          </form>
        </div>
      </div>
    `
    )
    .join("");

  const content = `
    <section class="hero">
      <div class="hero-card">
        <h1>Simple E-commerce Store</h1>
        <p>Browse products, view details, manage your cart, and place orders with user login support.</p>
      </div>
    </section>
    <section class="grid">${productCards}</section>
  `;
  res.send(layout("CodeAlpha Store", content, req));
});

app.get("/products/:id", (req, res) => {
  const product = db.get("products").find({ id: req.params.id }).value();
  if (!product) {
    return res.status(404).send(layout("Not Found", "<div class='form-card'><h2>Product not found.</h2></div>", req, { flash: "Product not found.", error: true }));
  }
  const content = `
    <section class="detail-layout">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
      <div>
        <span class="badge">Product Details</span>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="price">${formatCurrency(product.price)}</p>
        <p>${escapeHtml(product.description)}</p>
        <form action="/cart/add" method="POST">
          <input type="hidden" name="productId" value="${product.id}" />
          <button type="submit">Add to Cart</button>
        </form>
      </div>
    </section>
  `;
  res.send(layout(product.name, content, req));
});

app.get("/register", (req, res) => {
  const content = `
    <section class="form-card">
      <h2>Create Account</h2>
      <form method="POST" action="/register">
        <input name="name" placeholder="Full name" required />
        <input type="email" name="email" placeholder="Email address" required />
        <input type="password" name="password" placeholder="Password" required minlength="6" />
        <button type="submit">Register</button>
      </form>
    </section>
  `;
  res.send(layout("Register", content, req));
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const existingUser = db.get("users").find({ email: String(email).toLowerCase() }).value();
  if (existingUser) {
    return res.send(layout("Register", `
      <section class="form-card">
        <h2>Create Account</h2>
        <form method="POST" action="/register">
          <input name="name" value="${escapeHtml(name)}" placeholder="Full name" required />
          <input type="email" name="email" value="${escapeHtml(email)}" placeholder="Email address" required />
          <input type="password" name="password" placeholder="Password" required minlength="6" />
          <button type="submit">Register</button>
        </form>
      </section>
    `, req, { flash: "Email already exists.", error: true }));
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: createId("user"), name, email: String(email).toLowerCase(), passwordHash };
  db.get("users").push(user).write();
  req.session.userId = user.id;
  res.redirect("/");
});

app.get("/login", (req, res) => {
  const content = `
    <section class="form-card">
      <h2>Login</h2>
      <form method="POST" action="/login">
        <input type="email" name="email" placeholder="Email address" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
    </section>
  `;
  res.send(layout("Login", content, req));
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.get("users").find({ email: String(email).toLowerCase() }).value();
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.send(layout("Login", `
      <section class="form-card">
        <h2>Login</h2>
        <form method="POST" action="/login">
          <input type="email" name="email" value="${escapeHtml(email)}" placeholder="Email address" required />
          <input type="password" name="password" placeholder="Password" required />
          <button type="submit">Login</button>
        </form>
      </section>
    `, req, { flash: "Invalid email or password.", error: true }));
  }
  req.session.userId = user.id;
  res.redirect("/");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.post("/cart/add", (req, res) => {
  const { productId } = req.body;
  const product = db.get("products").find({ id: productId }).value();
  if (!product) return res.redirect("/");
  const cart = getCart(req);
  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ productId, quantity: 1 });
  }
  req.session.cart = cart;
  res.redirect("/cart");
});

app.post("/cart/update", (req, res) => {
  const { productId, quantity } = req.body;
  const qty = Math.max(0, Number(quantity) || 0);
  let cart = getCart(req);
  if (qty === 0) {
    cart = cart.filter((item) => item.productId !== productId);
  } else {
    cart = cart.map((item) => item.productId === productId ? { ...item, quantity: qty } : item);
  }
  req.session.cart = cart;
  res.redirect("/cart");
});

app.get("/cart", (req, res) => {
  const cart = getCart(req);
  const items = cart.map((item) => {
    const product = db.get("products").find({ id: item.productId }).value();
    return product ? { ...item, product, subtotal: product.price * item.quantity } : null;
  }).filter(Boolean);

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const itemHtml = items.length
    ? items.map((item) => `
        <div class="cart-item">
          <h3>${escapeHtml(item.product.name)}</h3>
          <p class="meta">${escapeHtml(item.product.shortDescription)}</p>
          <p>${formatCurrency(item.product.price)} x ${item.quantity} = <strong>${formatCurrency(item.subtotal)}</strong></p>
          <form method="POST" action="/cart/update">
            <input type="hidden" name="productId" value="${item.product.id}" />
            <input type="number" name="quantity" min="0" value="${item.quantity}" />
            <button type="submit">Update Cart</button>
          </form>
        </div>
      `).join("")
    : `<div class="empty">Your cart is empty. Add products from the home page.</div>`;

  const content = `
    <section class="cart-layout">
      <h1>Shopping Cart</h1>
      ${itemHtml}
      <h3>Total: ${formatCurrency(total)}</h3>
      ${items.length ? `
        <form method="POST" action="/checkout">
          <button type="submit">Place Order</button>
        </form>
      ` : ""}
    </section>
  `;
  res.send(layout("Cart", content, req));
});

app.post("/checkout", requireAuth, (req, res) => {
  const cart = getCart(req);
  if (cart.length === 0) return res.redirect("/cart");
  const user = getCurrentUser(req);
  const items = cart.map((item) => {
    const product = db.get("products").find({ id: item.productId }).value();
    return product ? { productId: product.id, name: product.name, price: product.price, quantity: item.quantity } : null;
  }).filter(Boolean);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  db.get("orders").push({
    id: createId("order"),
    userId: user.id,
    items,
    total,
    status: "Order Confirmed",
    createdAt: new Date().toLocaleString("en-IN")
  }).write();
  req.session.cart = [];
  res.redirect("/orders");
});

app.get("/orders", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const orders = db.get("orders").filter({ userId: user.id }).value().reverse();
  const content = `
    <section class="form-card">
      <h1>My Orders</h1>
      ${orders.length ? orders.map((order) => `
        <div class="order-card">
          <div class="badge">${escapeHtml(order.status)}</div>
          <h3>Order ID: ${escapeHtml(order.id)}</h3>
          <p class="meta">Placed on ${escapeHtml(order.createdAt)}</p>
          <ul>
            ${order.items.map((item) => `<li>${escapeHtml(item.name)} - ${item.quantity} x ${formatCurrency(item.price)}</li>`).join("")}
          </ul>
          <p><strong>Total: ${formatCurrency(order.total)}</strong></p>
        </div>
      `).join("") : `<div class="empty">No orders found yet.</div>`}
    </section>
  `;
  res.send(layout("My Orders", content, req));
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Task 1 server running at http://localhost:${PORT}`);
});

