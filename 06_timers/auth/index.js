const express = require("express");
const nunjucks = require("nunjucks");
const { nanoid } = require("nanoid");
const bcrypt = require("bcryptjs");
const cookieSession = require("cookie-session");

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

const DB = {
  users: [
    {
      _id: nanoid(),
      username: "admin",
      password: hash("pwd007"),
    },
  ],
  timers: [],
};

app.use((req, res, next) => {
  const userId = req.session.userId;
  if (userId) {
    req.user = DB.users.find((u) => u._id === userId);
  }
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).send("Unauthorized");
  }
  next();
};

app.get("/", (req, res) => {
  res.render("index", {
    user: req.user,
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
  });
});

app.post("/signup", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.status(400).send("Missing username or password");

  if (DB.users.some((u) => u.username === username)) return res.status(400).send("Username already taken");

  const user = {
    _id: nanoid(),
    username,
    password: hash(password),
  };

  DB.users.push(user);
  req.session.userId = user._id;

  res.redirect("/");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = DB.users.find((u) => u.username === username);

  if (!user || !checkPassword(password, user.password)) {
    return res.redirect("/?authError=true");
  }

  req.session.userId = user._id;
  res.redirect("/");
});

app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

app.get("/api/timers", requireAuth, (req, res) => {
  const isActive = req.query.isActive;
  const now = Date.now();

  const userTimers = DB.timers.filter((t) => t.userId === req.user._id);

  let result = userTimers;

  if (isActive === "true") {
    result = userTimers
      .filter((t) => t.isActive)
      .map((t) => ({
        ...t,
        progress: now - t.start,
      }));
  } else if (isActive === "false") {
    result = userTimers.filter((t) => !t.isActive);
  }

  res.json(result);
});

app.post("/api/timers", requireAuth, (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).send("Description required");

  const timer = {
    id: nanoid(),
    description,
    start: Date.now(),
    isActive: true,
    userId: req.user._id,
  };

  DB.timers.push(timer);
  res.status(201).json(timer);
});

app.post("/api/timers/:id/stop", requireAuth, (req, res) => {
  const { id } = req.params;
  const timer = DB.timers.find((t) => t.id === id && t.userId === req.user._id && t.isActive);

  if (!timer) return res.status(404).send("Active timer not found");

  timer.end = Date.now();
  timer.duration = timer.end - timer.start;
  timer.isActive = false;

  res.json(timer);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
