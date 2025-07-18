require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const inquirer = require("inquirer");

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const SESSION_FILE = path.join(__dirname, ".session");

const saveSessionId = (sessionId) => {
  fs.writeFileSync(SESSION_FILE, sessionId, "utf-8");
};

const loadSessionId = () => {
  try {
    return fs.readFileSync(SESSION_FILE, "utf-8");
  } catch {
    return null;
  }
};

const deleteSessionId = () => {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
  }
};

const handleSignup = async () => {
  const { username, password } = await inquirer.prompt([
    { type: "input", name: "username", message: "Username:" },
    { type: "password", name: "password", message: "Password:", mask: "*" },
  ]);

  try {
    const res = await axios.post(`${SERVER_URL}/signup`, { username, password });
    if (res.data.error) return console.log(`❌ Error: ${res.data.error}`);
    saveSessionId(res.data.sessionId);
    console.log("✅ Signed up successfully!");
  } catch (err) {
    console.error("❌ Request failed:", err.message);
  }
};

const handleLogin = async () => {
  const { username, password } = await inquirer.prompt([
    { type: "input", name: "username", message: "Username:" },
    { type: "password", name: "password", message: "Password:", mask: "*" },
  ]);

  try {
    const res = await axios.post(`${SERVER_URL}/login`, { username, password });
    if (res.data.error) return console.log(`❌ Error: ${res.data.error}`);
    saveSessionId(res.data.sessionId);
    console.log("✅ Logged in successfully!");
  } catch (err) {
    console.error("❌ Request failed:", err.message);
  }
};

const handleLogout = async () => {
  const sessionId = loadSessionId();
  if (!sessionId) return console.log("⚠️ Not logged in.");

  try {
    await axios.post(`${SERVER_URL}/logout`, {}, {
      headers: { "x-session-id": sessionId },
    });
    deleteSessionId();
    console.log("✅ Logged out successfully.");
  } catch (err) {
    console.error("❌ Request failed:", err.message);
  }
};

const handleStart = async () => {
  const sessionId = loadSessionId();
  if (!sessionId) return console.log("⚠️ Not logged in.");

  const { description } = await inquirer.prompt([
    { type: "input", name: "description", message: "Timer description:" },
  ]);

  try {
    await axios.post(`${SERVER_URL}/api/timers`, { description }, {
      headers: { "x-session-id": sessionId },
    });
    console.log("⏱️ Timer started.");
  } catch (err) {
    console.error("❌ Request failed:", err.message);
  }
};

const handleStop = async () => {
  const sessionId = loadSessionId();
  if (!sessionId) return console.log("⚠️ Not logged in.");

  try {
    const res = await axios.get(`${SERVER_URL}/api/timers?isActive=true`, {
      headers: { "x-session-id": sessionId },
    });

    const active = res.data[0];
    if (!active) {
      return console.log("⚠️ No active timer.");
    }

    await axios.post(`${SERVER_URL}/api/timers/${active.id}/stop`, {}, {
      headers: { "x-session-id": sessionId },
    });

    console.log("⏹️ Timer stopped.");
  } catch (err) {
    console.error("❌ Request failed:", err.message);
  }
};

const handleStatus = async () => {
  const sessionId = loadSessionId();
  if (!sessionId) return console.log("⚠️ Not logged in.");

  try {
    const res = await axios.get(`${SERVER_URL}/api/timers?isActive=true`, {
      headers: { "x-session-id": sessionId },
    });

    if (res.data.length === 0) {
      console.log("⏳ No active timer.");
    } else {
      const timer = res.data[0];
      console.log(`⏳ Active timer: ${timer.description}, running for ${(timer.progress / 1000).toFixed(1)} seconds`);
    }
  } catch (err) {
    console.error("❌ Request failed:", err.message);
  }
};

const command = process.argv[2];

switch (command) {
  case "signup":
    handleSignup();
    break;
  case "login":
    handleLogin();
    break;
  case "logout":
    handleLogout();
    break;
  case "start":
    handleStart();
    break;
  case "stop":
    handleStop();
    break;
  case "status":
    handleStatus();
    break;
  default:
    console.log("Usage: node index.js <signup|login|logout|start|stop|status>");
}
