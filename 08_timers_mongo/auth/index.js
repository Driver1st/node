require("dotenv").config();
const express = require("express");
const nunjucks = require("nunjucks");
const { nanoid } = require("nanoid");
const bcrypt = require("bcryptjs");
const cookieSession = require("cookie-session");
const db = require("./db");

const app = express();

nunjucks.configure("views", {
  autoescape: true,
  express: app,
  tags: {
    blockStart: "[%",
    blockEnd: "%]",
    variableStart: "[[",
    variableEnd: "]]",
    commentStart: "[#",
    commentEnd: "#]",
  },
});
app.set("view engine", "njk");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  cookieSession({
    name: "session",
    keys: ["secretKey123"],
    maxAge: 24 * 60 * 60 * 1000,
  })
);

const hash = (pwd) => bcrypt.hashSync(pwd, 10);
const checkPassword = (pwd, hash) => bcrypt.compareSync(pwd, hash);

app.use(async (req, res, next) => {
  const userId = req.session.userId;
  if (userId) {
    const user = await db.users.findOne({ id: userId });
    if (user) req.user = user;
  }
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).send("Unauthorized");
  next();
};

app.get("/", (req, res) => {
  res.render("index", {
    user: req.user,
    authError:
      req.query.authError === "true"
        ? "Wrong username or password"
        : req.query.authError,
  });
});

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Missing fields");

  const existingUser = await db.users.findOne({ username });
  if (existingUser) return res.status(400).send("Username already taken");

  const id = nanoid();
  await db.users.insertOne({
    id,
    username,
    password: hash(password),
  });

  req.session.userId = id;
  res.redirect("/");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await db.users.findOne({ username });
  if (!user || !checkPassword(password, user.password)) {
    return res.redirect("/?authError=true");
  }
  req.session.userId = user.id;
  res.redirect("/");
});

app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

app.get("/api/timers", requireAuth, async (req, res) => {
  const { isActive } = req.query;
  const now = Date.now();

  const filter = { user_id: req.user.id };
  if (isActive === "true") filter.is_active = true;
  else if (isActive === "false") filter.is_active = false;

  const timers = await db.timers
    .find(filter)
    .sort({ start: -1 })
    .toArray();

  const result = timers.map((t) => {
    if (t.is_active) {
      return { ...t, progress: now - t.start };
    }
    return t;
  });

  res.json(result);
});

app.post("/api/timers", requireAuth, async (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).send("Description required");

  const id = nanoid();
  const start = Date.now();
  const userId = req.user.id;

  await db.timers.insertOne({
    id,
    user_id: userId,
    description,
    start,
    is_active: true,
  });

  res.status(201).json({ id });
});

app.post("/api/timers/:id/stop", requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const now = Date.now();

  const timer = await db.timers.findOne({
    id,
    user_id: userId,
    is_active: true,
  });

  if (!timer) return res.status(404).send("Active timer not found");

  const duration = now - timer.start;

  await db.timers.updateOne(
    { id },
    {
      $set: {
        is_active: false,
        end: now,
        duration,
      },
    }
  );

  res.json({ ...timer, end: now, duration, is_active: false });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
