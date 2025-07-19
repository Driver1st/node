require("dotenv").config();
const express = require("express");
const { nanoid } = require("nanoid");
const bcrypt = require("bcryptjs");
const db = require("./db");
const { WebSocketServer } = require("ws");
const http = require("http");

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

  sendAllTimers(userId);
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

  sendAllTimers(userId);
});


const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

const userSockets = new Map();

wss.on("connection", (ws, request) => {
  console.log("WS connected");

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "auth") {
        const sessionId = data.sessionId;
        const session = await db.sessions.findOne({ id: sessionId });
        if (!session) return ws.close();

        const userId = session.user_id;
        ws.userId = userId;

        if (!userSockets.has(userId)) {
          userSockets.set(userId, []);
        }
        userSockets.get(userId).push(ws);

        console.log(`WS auth success for user ${userId}`);

        sendAllTimers(userId);
      }
    } catch (err) {
      console.error(err);
    }
  });

  ws.on("close", () => {
    if (ws.userId && userSockets.has(ws.userId)) {
      userSockets.set(
        ws.userId,
        userSockets.get(ws.userId).filter((s) => s !== ws)
      );
    }
  });
});

async function sendAllTimers(userId) {
  const timers = await db.timers.find({ user_id: userId }).toArray();
  const now = Date.now();
  const enriched = timers.map((t) =>
    t.is_active ? { ...t, progress: now - t.start } : t
  );
  const payload = JSON.stringify({ type: "all_timers", timers: enriched });

  (userSockets.get(userId) || []).forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  });
}

setInterval(async () => {
  for (const [userId, sockets] of userSockets.entries()) {
    const activeTimers = await db.timers.find({
      user_id: userId,
      is_active: true,
    }).toArray();

    const now = Date.now();
    const enriched = activeTimers.map((t) => ({
      ...t,
      progress: now - t.start,
    }));

    const payload = JSON.stringify({ type: "active_timers", timers: enriched });

    sockets.forEach((ws) => {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    });
  }
}, 1000);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`API + WS server listening on http://localhost:${port}`);
});


