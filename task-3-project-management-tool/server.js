const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path = require("path");

const app = express();
const adapter = new FileSync(path.join(__dirname, "db.json"));
const db = low(adapter);
db.defaults({ users: [], projects: [], tasks: [] }).write();

if (db.get("users").value().length === 0) {
  const users = [
    { id: "pm1", name: "Project Admin", email: "admin@example.com", passwordHash: bcrypt.hashSync("password123", 10) },
    { id: "pm2", name: "Design Member", email: "designer@example.com", passwordHash: bcrypt.hashSync("password123", 10) }
  ];
  db.set("users", users).write();
  db.set("projects", [
    {
      id: "proj1",
      name: "Website Redesign",
      description: "Improve the company website UI and organize launch tasks.",
      ownerId: "pm1",
      members: ["pm1", "pm2"],
      createdAt: new Date().toLocaleString("en-IN")
    }
  ]).write();
  db.set("tasks", [
    {
      id: "task1",
      projectId: "proj1",
      title: "Create homepage wireframe",
      description: "Prepare the initial homepage layout and content structure.",
      status: "todo",
      assignedTo: "pm2",
      comments: [{ id: "t1c1", userId: "pm1", text: "Please finish the first draft by tomorrow." }]
    },
    {
      id: "task2",
      projectId: "proj1",
      title: "Setup deployment checklist",
      description: "Create a checklist for staging and production release.",
      status: "in-progress",
      assignedTo: "pm1",
      comments: []
    }
  ]).write();
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "codealpha-project-management-secret",
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

function userName(id) {
  const user = db.get("users").find({ id }).value();
  return user ? user.name : "Unassigned";
}

function navigation(req) {
  const user = currentUser(req);
  return `
    <div class="navbar">
      <div class="container nav-inner">
        <a class="brand" href="/">CodeAlpha Projects</a>
        <div class="nav-links">
          <a href="/">Dashboard</a>
        </div>
        <div class="actions">
          ${user
            ? `<span class="chip">${escapeHtml(user.name)}</span><a class="btn secondary" href="/logout">Logout</a>`
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
    ${navigation(req)}
    <main class="container">
      ${flash ? `<div class="flash">${escapeHtml(flash)}</div>` : ""}
      ${content}
    </main>
  </body>
  </html>`;
}

app.get("/", (req, res) => {
  const user = currentUser(req);
  const projects = db.get("projects").value().slice().reverse();
  const users = db.get("users").value();

  const projectCards = projects.map((project) => `
    <div class="project-row">
      <h3><a href="/projects/${project.id}">${escapeHtml(project.name)}</a></h3>
      <p>${escapeHtml(project.description)}</p>
      <p class="meta">Owner: ${escapeHtml(userName(project.ownerId))}</p>
      <p class="meta">Members: ${project.members.map(userName).map(escapeHtml).join(", ")}</p>
    </div>
  `).join("");

  const sidebar = user ? `
    <div class="card">
      <h3>Create Project</h3>
      <form method="POST" action="/projects">
        <input name="name" placeholder="Project name" required />
        <textarea name="description" placeholder="Project description" required></textarea>
        <input name="members" placeholder="Add member emails separated by comma" />
        <button type="submit">Create Project</button>
      </form>
    </div>
  ` : `
    <div class="card">
      <h3>Task Overview</h3>
      <p class="meta">Collaborative project board with projects, task cards, assignments, and comments.</p>
      <a class="btn" href="/register">Create Account</a>
    </div>
  `;

  const content = `
    <section class="hero">
      <h1>Project Management Tool</h1>
      <p>Create group projects, assign tasks, comment inside task cards, and manage project boards like Trello or Asana.</p>
    </section>
    <section class="grid">
      <div>
        ${sidebar}
        <div class="card">
          <h3>Team Members</h3>
          ${users.map((member) => `<p>${escapeHtml(member.name)} <span class="meta">(${escapeHtml(member.email)})</span></p>`).join("")}
        </div>
      </div>
      <div class="card">
        <h2>Projects</h2>
        ${projectCards || "<p class='meta'>No projects yet.</p>"}
      </div>
    </section>
  `;

  res.send(layout("CodeAlpha Projects", content, req));
});

app.get("/register", (req, res) => {
  res.send(layout("Register", `
    <section class="card" style="max-width:520px;margin:40px auto;">
      <h2>Create Account</h2>
      <form method="POST" action="/register">
        <input name="name" placeholder="Full name" required />
        <input type="email" name="email" placeholder="Email address" required />
        <input type="password" name="password" placeholder="Password" required minlength="6" />
        <button type="submit">Register</button>
      </form>
    </section>
  `, req));
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const existing = db.get("users").find({ email: String(email).toLowerCase() }).value();
  if (existing) {
    return res.send(layout("Register", `
      <section class="card" style="max-width:520px;margin:40px auto;">
        <h2>Create Account</h2>
        <form method="POST" action="/register">
          <input name="name" value="${escapeHtml(name)}" placeholder="Full name" required />
          <input type="email" name="email" value="${escapeHtml(email)}" placeholder="Email address" required />
          <input type="password" name="password" placeholder="Password" required minlength="6" />
          <button type="submit">Register</button>
        </form>
      </section>
    `, req, "Email already exists."));
  }
  const user = {
    id: createId("user"),
    name,
    email: String(email).toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10)
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
      <p class="meta">Demo user: admin@example.com / password123</p>
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

app.post("/projects", requireAuth, (req, res) => {
  const user = currentUser(req);
  const memberEmails = (req.body.members || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const matchedMembers = db.get("users").filter((member) => memberEmails.includes(member.email)).map("id").value();
  const members = Array.from(new Set([user.id, ...matchedMembers]));

  db.get("projects").push({
    id: createId("project"),
    name: req.body.name,
    description: req.body.description,
    ownerId: user.id,
    members,
    createdAt: new Date().toLocaleString("en-IN")
  }).write();

  res.redirect("/");
});

app.get("/projects/:id", requireAuth, (req, res) => {
  const project = db.get("projects").find({ id: req.params.id }).value();
  if (!project) {
    return res.status(404).send(layout("Not Found", "<section class='card'><h2>Project not found.</h2></section>", req));
  }
  const members = project.members.map((id) => db.get("users").find({ id }).value()).filter(Boolean);
  const tasks = db.get("tasks").filter({ projectId: project.id }).value();
  const todo = tasks.filter((task) => task.status === "todo");
  const inProgress = tasks.filter((task) => task.status === "in-progress");
  const done = tasks.filter((task) => task.status === "done");

  const renderTask = (task) => `
    <div class="task-card">
      <span class="chip">${escapeHtml(userName(task.assignedTo))}</span>
      <h4>${escapeHtml(task.title)}</h4>
      <p>${escapeHtml(task.description)}</p>
      <p class="meta">Assigned to: ${escapeHtml(userName(task.assignedTo))}</p>
      <form method="POST" action="/tasks/${task.id}/status">
        <select name="status">
          <option value="todo" ${task.status === "todo" ? "selected" : ""}>To Do</option>
          <option value="in-progress" ${task.status === "in-progress" ? "selected" : ""}>In Progress</option>
          <option value="done" ${task.status === "done" ? "selected" : ""}>Done</option>
        </select>
        <button type="submit">Update Status</button>
      </form>
      <form method="POST" action="/tasks/${task.id}/comments">
        <input name="text" placeholder="Write a comment" required />
        <button type="submit">Add Comment</button>
      </form>
      ${task.comments.map((comment) => `
        <div class="comment">
          <strong>${escapeHtml(userName(comment.userId))}:</strong> ${escapeHtml(comment.text)}
        </div>
      `).join("")}
    </div>
  `;

  const content = `
    <section class="hero">
      <h1>${escapeHtml(project.name)}</h1>
      <p>${escapeHtml(project.description)}</p>
      <p>Members: ${members.map((member) => escapeHtml(member.name)).join(", ")}</p>
    </section>
    <section class="grid">
      <div>
        <div class="card">
          <h3>Create Task</h3>
          <form method="POST" action="/projects/${project.id}/tasks">
            <input name="title" placeholder="Task title" required />
            <textarea name="description" placeholder="Task description" required></textarea>
            <select name="assignedTo" required>
              ${members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}
            </select>
            <button type="submit">Add Task</button>
          </form>
        </div>
      </div>
      <div class="card">
        <h2>Project Board</h2>
        <div class="board">
          <div class="column">
            <h3>To Do</h3>
            ${todo.map(renderTask).join("") || "<p class='meta'>No tasks.</p>"}
          </div>
          <div class="column">
            <h3>In Progress</h3>
            ${inProgress.map(renderTask).join("") || "<p class='meta'>No tasks.</p>"}
          </div>
          <div class="column">
            <h3>Done</h3>
            ${done.map(renderTask).join("") || "<p class='meta'>No tasks.</p>"}
          </div>
        </div>
      </div>
    </section>
  `;

  res.send(layout(project.name, content, req));
});

app.post("/projects/:id/tasks", requireAuth, (req, res) => {
  db.get("tasks").push({
    id: createId("task"),
    projectId: req.params.id,
    title: req.body.title,
    description: req.body.description,
    status: "todo",
    assignedTo: req.body.assignedTo,
    comments: []
  }).write();
  res.redirect(`/projects/${req.params.id}`);
});

app.post("/tasks/:id/status", requireAuth, (req, res) => {
  const task = db.get("tasks").find({ id: req.params.id }).value();
  if (!task) return res.redirect("/");
  db.get("tasks").find({ id: task.id }).assign({ status: req.body.status }).write();
  res.redirect(`/projects/${task.projectId}`);
});

app.post("/tasks/:id/comments", requireAuth, (req, res) => {
  const task = db.get("tasks").find({ id: req.params.id }).value();
  if (!task) return res.redirect("/");
  db.get("tasks").find({ id: task.id }).get("comments").push({
    id: createId("comment"),
    userId: currentUser(req).id,
    text: req.body.text
  }).write();
  res.redirect(`/projects/${task.projectId}`);
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Task 3 server running at http://localhost:${PORT}`);
});

