const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path = require("path");

const app = express();
const adapter = new FileSync(path.join(__dirname, "db.json"));
const db = low(adapter);
db.defaults({ users: [], posts: [] }).write();

if (db.get("users").value().length === 0) {
  const seedUsers = [
    { id: "u1", name: "Aarav Singh", email: "aarav@example.com", bio: "Frontend learner and UI explorer.", passwordHash: bcrypt.hashSync("password123", 10), followers: [], following: [] },
    { id: "u2", name: "Sara Khan", email: "sara@example.com", bio: "I enjoy backend logic and clean APIs.", passwordHash: bcrypt.hashSync("password123", 10), followers: [], following: [] }
  ];
  db.set("users", seedUsers).write();
  db.set("posts", [
    {
      id: "post1",
      userId: "u1",
      content: "Built my first responsive landing page today and learned a lot about spacing and contrast.",
      likes: [],
      comments: [
        { id: "c1", userId: "u2", text: "Nice work. Keep sharing your progress." }
      ],
      createdAt: new Date().toLocaleString("en-IN")
    }
  ]).write();
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "codealpha-social-secret",
    resave: false,
    saveUninitialized: false
  })
);

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function currentUser(req) {
  return req.session.userId ? db.get("users").find({ id: req.session.userId }).value() : null;
}

function requireAuth(req, res, next) {
  if (!currentUser(req)) return res.redirect("/login");
  next();
}

function findUser(id) {
  return db.get("users").find({ id }).value();
}

function nav(req) {
  const user = currentUser(req);
  return `
    <div class="navbar">
      <div class="container nav-inner">
        <a class="brand" href="/">CodeAlpha Social</a>
        <div class="nav-links">
          <a href="/">Feed</a>
          ${user ? `<a href="/profile/${user.id}">My Profile</a>` : ""}
        </div>
        <div class="actions">
          ${user
            ? `<span class="tag">${escapeHtml(user.name)}</span><a class="btn secondary" href="/logout">Logout</a>`
            : `<a class="btn secondary" href="/login">Login</a><a class="btn" href="/register">Register</a>`}
        </div>
      </div>
    </div>
  `;
}

function layout(title, content, req, flash = "") {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    ${nav(req)}
    <main class="container">
      ${flash ? `<div class="flash">${escapeHtml(flash)}</div>` : ""}
      ${content}
    </main>
  </body>
  </html>`;
}

function renderProfileCard(user) {
  return `
    <div class="card">
      <div class="profile-name">${escapeHtml(user.name)}</div>
      <p class="muted">${escapeHtml(user.email)}</p>
      <p>${escapeHtml(user.bio || "No bio added yet.")}</p>
      <div class="list">
        <div><strong>${user.followers.length}</strong> Followers</div>
        <div><strong>${user.following.length}</strong> Following</div>
      </div>
    </div>
  `;
}

app.get("/", (req, res) => {
  const user = currentUser(req);
  const users = db.get("users").value();
  const posts = db.get("posts").value().slice().reverse();
  const suggestions = user ? users.filter((person) => person.id !== user.id) : users;

  const feed = posts.map((post) => {
    const author = findUser(post.userId);
    const liked = user ? post.likes.includes(user.id) : false;
    return `
      <div class="post">
        <div class="post-head">
          <div>
            <strong><a href="/profile/${author.id}">${escapeHtml(author.name)}</a></strong>
            <div class="muted">${escapeHtml(post.createdAt)}</div>
          </div>
          <span class="tag">${post.likes.length} Likes</span>
        </div>
        <p>${escapeHtml(post.content)}</p>
        ${user ? `
          <div class="actions">
            <form method="POST" action="/posts/${post.id}/like">
              <button type="submit">${liked ? "Unlike" : "Like"}</button>
            </form>
          </div>
          <form method="POST" action="/posts/${post.id}/comment">
            <input name="text" placeholder="Write a comment" required />
            <button type="submit">Comment</button>
          </form>
        ` : `<p class="muted">Login to like or comment.</p>`}
        <div>
          ${post.comments.map((comment) => {
            const commentUser = findUser(comment.userId);
            return `<div class="comment"><strong>${escapeHtml(commentUser ? commentUser.name : "User")}:</strong> ${escapeHtml(comment.text)}</div>`;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");

  const left = `
    <div class="card">
      <h3>About This Task</h3>
      <p class="muted">Mini social media app with profiles, posts, comments, likes, and follow system.</p>
    </div>
    ${user ? `
      ${renderProfileCard(user)}
      <div class="card">
        <h3>Create Post</h3>
        <form method="POST" action="/posts">
          <textarea name="content" placeholder="Share something with your network" required></textarea>
          <button type="submit">Publish Post</button>
        </form>
      </div>
    ` : `
      <div class="card">
        <h3>Join the Platform</h3>
        <p class="muted">Create an account to publish posts and follow other users.</p>
        <a class="btn" href="/register">Create Account</a>
      </div>
    `}
    <div class="card">
      <h3>People</h3>
      <div class="list">
        ${suggestions.map((person) => `
          <div class="user-row">
            <div>
              <strong><a href="/profile/${person.id}">${escapeHtml(person.name)}</a></strong>
              <div class="muted">${escapeHtml(person.bio || "")}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  const content = `
    <section class="hero">
      <h1>Social Media Platform</h1>
      <p>Create posts, comment on updates, like content, and follow people in this mini social network.</p>
    </section>
    <section class="layout">
      <div>${left}</div>
      <div class="card">
        <h2>Community Feed</h2>
        ${feed || "<p class='muted'>No posts yet.</p>"}
      </div>
    </section>
  `;

  res.send(layout("CodeAlpha Social", content, req));
});

app.get("/register", (req, res) => {
  res.send(layout("Register", `
    <section class="card" style="max-width:520px;margin:40px auto;">
      <h2>Create Account</h2>
      <form method="POST" action="/register">
        <input name="name" placeholder="Full name" required />
        <input type="email" name="email" placeholder="Email address" required />
        <textarea name="bio" placeholder="Short bio"></textarea>
        <input type="password" name="password" placeholder="Password" required minlength="6" />
        <button type="submit">Register</button>
      </form>
    </section>
  `, req));
});

app.post("/register", async (req, res) => {
  const { name, email, bio, password } = req.body;
  const existing = db.get("users").find({ email: String(email).toLowerCase() }).value();
  if (existing) {
    return res.send(layout("Register", `
      <section class="card" style="max-width:520px;margin:40px auto;">
        <h2>Create Account</h2>
        <form method="POST" action="/register">
          <input name="name" value="${escapeHtml(name)}" placeholder="Full name" required />
          <input type="email" name="email" value="${escapeHtml(email)}" placeholder="Email address" required />
          <textarea name="bio" placeholder="Short bio">${escapeHtml(bio)}</textarea>
          <input type="password" name="password" placeholder="Password" required minlength="6" />
          <button type="submit">Register</button>
        </form>
      </section>
    `, req, "Email already registered."));
  }
  const user = {
    id: createId("user"),
    name,
    email: String(email).toLowerCase(),
    bio,
    passwordHash: await bcrypt.hash(password, 10),
    followers: [],
    following: []
  };
  db.get("users").push(user).write();
  req.session.userId = user.id;
  res.redirect("/");
});

app.get("/login", (req, res) => {
  res.send(layout("Login", `
    <section class="card" style="max-width:520px;margin:40px auto;">
      <h2>Login</h2>
      <form method="POST" action="/login">
        <input type="email" name="email" placeholder="Email address" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
      <p class="muted">Demo user: aarav@example.com / password123</p>
    </section>
  `, req));
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.get("users").find({ email: String(email).toLowerCase() }).value();
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.send(layout("Login", `
      <section class="card" style="max-width:520px;margin:40px auto;">
        <h2>Login</h2>
        <form method="POST" action="/login">
          <input type="email" name="email" value="${escapeHtml(email)}" placeholder="Email address" required />
          <input type="password" name="password" placeholder="Password" required />
          <button type="submit">Login</button>
        </form>
      </section>
    `, req, "Invalid login details."));
  }
  req.session.userId = user.id;
  res.redirect("/");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/profile/:id", (req, res) => {
  const user = currentUser(req);
  const profile = findUser(req.params.id);
  if (!profile) {
    return res.status(404).send(layout("Not Found", "<section class='card'><h2>User not found.</h2></section>", req));
  }
  const isFollowing = user ? user.following.includes(profile.id) : false;
  const posts = db.get("posts").filter({ userId: profile.id }).value().slice().reverse();
  const content = `
    <section class="hero">
      <h1>${escapeHtml(profile.name)}</h1>
      <p>${escapeHtml(profile.bio || "No bio added.")}</p>
    </section>
    <section class="layout">
      <div>
        ${renderProfileCard(profile)}
        ${user && user.id !== profile.id ? `
          <div class="card">
            <form method="POST" action="/profile/${profile.id}/follow">
              <button type="submit">${isFollowing ? "Unfollow" : "Follow"}</button>
            </form>
          </div>
        ` : ""}
      </div>
      <div class="card">
        <h2>Posts by ${escapeHtml(profile.name)}</h2>
        ${posts.length ? posts.map((post) => `
          <div class="post">
            <div class="muted">${escapeHtml(post.createdAt)}</div>
            <p>${escapeHtml(post.content)}</p>
            <span class="tag">${post.likes.length} Likes</span>
          </div>
        `).join("") : "<p class='muted'>No posts yet.</p>"}
      </div>
    </section>
  `;
  res.send(layout(profile.name, content, req));
});

app.post("/profile/:id/follow", requireAuth, (req, res) => {
  const user = currentUser(req);
  const profile = findUser(req.params.id);
  if (!profile || profile.id === user.id) return res.redirect("/");
  const isFollowing = user.following.includes(profile.id);
  if (isFollowing) {
    db.get("users").find({ id: user.id }).get("following").remove((id) => id === profile.id).write();
    db.get("users").find({ id: profile.id }).get("followers").remove((id) => id === user.id).write();
  } else {
    db.get("users").find({ id: user.id }).get("following").push(profile.id).write();
    db.get("users").find({ id: profile.id }).get("followers").push(user.id).write();
  }
  res.redirect(`/profile/${profile.id}`);
});

app.post("/posts", requireAuth, (req, res) => {
  db.get("posts").push({
    id: createId("post"),
    userId: currentUser(req).id,
    content: req.body.content,
    likes: [],
    comments: [],
    createdAt: new Date().toLocaleString("en-IN")
  }).write();
  res.redirect("/");
});

app.post("/posts/:id/like", requireAuth, (req, res) => {
  const user = currentUser(req);
  const post = db.get("posts").find({ id: req.params.id }).value();
  if (!post) return res.redirect("/");
  const alreadyLiked = post.likes.includes(user.id);
  if (alreadyLiked) {
    db.get("posts").find({ id: post.id }).get("likes").remove((id) => id === user.id).write();
  } else {
    db.get("posts").find({ id: post.id }).get("likes").push(user.id).write();
  }
  res.redirect("/");
});

app.post("/posts/:id/comment", requireAuth, (req, res) => {
  db.get("posts").find({ id: req.params.id }).get("comments").push({
    id: createId("comment"),
    userId: currentUser(req).id,
    text: req.body.text
  }).write();
  res.redirect("/");
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Task 2 server running at http://localhost:${PORT}`);
});

