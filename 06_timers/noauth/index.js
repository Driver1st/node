const express = require("express");
const nunjucks = require("nunjucks");
const { nanoid } = require("nanoid");

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
app.use(express.static("public"));

const DB = {
  timers: [],
};

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/api/timers", (req, res) => {
  const isActive = req.query.isActive;
  const now = Date.now();

  let result = DB.timers;

  if (isActive === "true") {
    result = DB.timers.filter((t) => t.isActive).map((t) => ({
      ...t,
      progress: now - t.start,
    }));
  } else if (isActive === "false") {
    result = DB.timers.filter((t) => !t.isActive);
  }

  res.json(result);
});

app.post("/api/timers", (req, res) => {
  const { description } = req.body;
  if (!description) {
    return res.status(400).send("Description is required");
  }

  const timer = {
    id: nanoid(),
    description,
    start: Date.now(),
    isActive: true,
  };

  DB.timers.push(timer);
  res.status(201).json(timer);
});

app.post("/api/timers/:id/stop", (req, res) => {
  const { id } = req.params;
  const timer = DB.timers.find((t) => t.id === id && t.isActive);

  if (!timer) {
    return res.status(404).send("Active timer not found");
  }

  timer.end = Date.now();
  timer.duration = timer.end - timer.start;
  timer.isActive = false;

  res.status(200).json(timer);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
