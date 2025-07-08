require("dotenv").config();
const express = require("express");
const { nanoid } = require("nanoid");
const bcrypt = require("bcryptjs");
const db = require("./db");


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const hash = (pwd) => bcrypt.hashSync(pwd, 10);
const checkPassword = (pwd, hash) => bcrypt.compareSync(pwd, hash);

app.use(async (req, res, next) => {
  const sessionId = req.headers["x-session-id"] || req.query.sessionId;
  if (sessionId) {
    const session = await db.sessions.findOne({ id: sessionId });
    if (session) {
      const user = await db.users.findOne({ id: session.user_id });
      if (user) req.user = user;
    }
  }
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
};

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ error: "Missing fields" });

  const existingUser = await db.users.findOne({ username });
  if (existingUser) return res.json({ error: "Username already taken" });

  const id = nanoid();
  await db.users.insertOne({
    id,
    username,
    password: hash(password),
  });

  const sessionId = nanoid();
  await db.sessions.insertOne({
    id: sessionId,
    user_id: id,
  });

  res.json({ sessionId });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await db.users.findOne({ username });
  if (!user || !checkPassword(password, user.password)) {
    return res.json({ error: "Wrong username or password" });
  }

  const sessionId = nanoid();
  await db.sessions.insertOne({
    id: sessionId,
    user_id: user.id,
  });

  res.json({ sessionId });
});

app.post("/logout", async (req, res) => {
  const sessionId = req.headers["x-session-id"] || req.query.sessionId;
  if (sessionId) {
    await db.sessions.deleteOne({ id: sessionId });
  }
  res.json({});
});

app.get("/api/timers", requireAuth, async (req, res) => {
  const { isActive } = req.query;
  const now = Date.now();

  const filter = { user_id: req.user.id };
  if (isActive === "true") filter.is_active = true;
  else if (isActive === "false") filter.is_active = false;

  const timers = await db.timers.find(filter).sort({ start: -1 }).toArray();

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

  if (!timer) return res.status(404).json({ error: "Active timer not found" });

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
  console.log(`API server listening on http://localhost:${port}`);
});
