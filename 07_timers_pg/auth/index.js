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
    const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (rows[0]) {
      req.user = rows[0];
    }
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
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
  });
});

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Missing username or password");

  const exists = await db.query("SELECT 1 FROM users WHERE username = $1", [username]);
  if (exists.rowCount > 0) return res.status(400).send("Username already taken");

  const id = nanoid();
  await db.query(
    "INSERT INTO users (id, username, password) VALUES ($1, $2, $3)",
    [id, username, hash(password)]
  );
  req.session.userId = id;
  res.redirect("/");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await db.query("SELECT * FROM users WHERE username = $1", [username]);
  const user = rows[0];
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
  const userId = req.user.id;
  const now = Date.now();

  let result = [];
  if (isActive === "true") {
    const { rows } = await db.query(
      "SELECT * FROM timers WHERE user_id = $1 AND is_active = TRUE",
      [userId]
    );
    result = rows.map((t) => ({
      ...t,
      progress: now - t.start,
    }));
  } else if (isActive === "false") {
    const { rows } = await db.query(
      "SELECT * FROM timers WHERE user_id = $1 AND is_active = FALSE ORDER BY start DESC",
      [userId]
    );
    result = rows;
  } else {
    const { rows } = await db.query("SELECT * FROM timers WHERE user_id = $1", [userId]);
    result = rows;
  }

  res.json(result);
});

app.post("/api/timers", requireAuth, async (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).send("Description required");

  const id = nanoid();
  const start = Date.now();
  const userId = req.user.id;

  await db.query(
    `INSERT INTO timers (id, user_id, description, start, is_active)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [id, userId, description, start]
  );

  res.status(201).json({ id });
});

app.post("/api/timers/:id/stop", requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const end = Date.now();

  const { rows } = await db.query(
    "SELECT * FROM timers WHERE id = $1 AND user_id = $2 AND is_active = TRUE",
    [id, userId]
  );
  const timer = rows[0];

  if (!timer) return res.status(404).send("Active timer not found");

  const duration = end - timer.start;

  await db.query(
    `UPDATE timers
     SET is_active = FALSE, end = $1, duration = $2
     WHERE id = $3`,
    [end, duration, id]
  );

  res.json({ ...timer, end, duration, is_active: false });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
