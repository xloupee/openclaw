#!/usr/bin/env npx tsx
/**
 * Proactive Session Reset
 *
 * Monitors the main session and automatically resets it after configured idle time.
 * Directly modifies the session store (same as /reset command).
 *
 * Reads config from ~/.openclaw/openclaw.json:
 *   session.proactiveResetMinutes - idle minutes before auto-reset (default: 1)
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CHECK_INTERVAL_MS = 10_000; // Check every 10 seconds
const SESSION_KEY = process.env.SESSION_KEY || "agent:main:main";

// Paths
const CONFIG_PATH =
  process.env.CONFIG_PATH ||
  path.join(process.env.HOME || "/root", ".openclaw/openclaw.json");
const SESSIONS_PATH =
  process.env.SESSIONS_PATH ||
  path.join(process.env.HOME || "/root", ".openclaw/agents/main/sessions/sessions.json");

function loadIdleMinutes(): number {
  if (process.env.IDLE_MINUTES) {
    return Number(process.env.IDLE_MINUTES) || 1;
  }
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, "utf-8");
      const config = JSON.parse(content);
      const minutes = config?.session?.proactiveResetMinutes;
      if (typeof minutes === "number" && minutes > 0) {
        return minutes;
      }
    }
  } catch (err) {
    console.warn(`[proactive-reset] Warning: Could not read config: ${err}`);
  }
  return 1;
}

const IDLE_MINUTES = loadIdleMinutes();
const IDLE_MS = IDLE_MINUTES * 60 * 1000;

let lastResetAt = 0;
let lastKnownUpdatedAt = 0;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [proactive-reset] ${msg}`);
}

function loadSessions(): Record<string, any> | null {
  try {
    if (!fs.existsSync(SESSIONS_PATH)) {
      return null;
    }
    const content = fs.readFileSync(SESSIONS_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    log(`Error reading sessions: ${err}`);
    return null;
  }
}

function saveSessions(sessions: Record<string, any>): boolean {
  try {
    fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2), "utf-8");
    return true;
  } catch (err) {
    log(`Error writing sessions: ${err}`);
    return false;
  }
}

function resetSession(): boolean {
  const sessions = loadSessions();
  if (!sessions) {
    log("Could not load sessions file");
    return false;
  }

  const entry = sessions[SESSION_KEY];
  if (!entry) {
    log(`Session ${SESSION_KEY} not found`);
    return false;
  }

  // Create new session entry (same as sessions.reset in gateway)
  const now = Date.now();
  const newEntry = {
    sessionId: randomUUID(),
    updatedAt: now,
    systemSent: false,
    abortedLastRun: false,
    // Preserve some settings
    thinkingLevel: entry.thinkingLevel,
    verboseLevel: entry.verboseLevel,
    reasoningLevel: entry.reasoningLevel,
    responseUsage: entry.responseUsage,
    model: entry.model,
    contextTokens: entry.contextTokens,
    sendPolicy: entry.sendPolicy,
    label: entry.label,
    lastChannel: entry.lastChannel,
    lastTo: entry.lastTo,
    skillsSnapshot: entry.skillsSnapshot,
    // Reset token counts
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  sessions[SESSION_KEY] = newEntry;

  if (saveSessions(sessions)) {
    log(`Session reset successfully (new ID: ${newEntry.sessionId.slice(0, 8)}...)`);
    return true;
  }
  return false;
}

function checkAndReset() {
  const sessions = loadSessions();
  if (!sessions) return;

  const entry = sessions[SESSION_KEY];
  if (!entry?.updatedAt) return;

  const updatedAt = entry.updatedAt;
  const now = Date.now();
  const idleMs = now - updatedAt;

  // Only reset if:
  // 1. Session has been idle for longer than threshold
  // 2. There was activity since our last reset (avoid infinite loop)
  // 3. We haven't just reset (debounce)
  if (idleMs >= IDLE_MS && updatedAt > lastResetAt && now - lastResetAt > IDLE_MS) {
    log(`Session idle for ${Math.round(idleMs / 1000)}s (threshold: ${IDLE_MINUTES}min). Resetting...`);
    if (resetSession()) {
      lastResetAt = now;
    }
  } else if (updatedAt !== lastKnownUpdatedAt) {
    if (lastKnownUpdatedAt > 0) {
      log(`Activity detected. Idle timer reset.`);
    }
    lastKnownUpdatedAt = updatedAt;
  }
}

function main() {
  log(`Starting proactive reset monitor`);
  log(`  Config: ${CONFIG_PATH}`);
  log(`  Sessions: ${SESSIONS_PATH}`);
  log(`  Session key: ${SESSION_KEY}`);
  log(`  Idle threshold: ${IDLE_MINUTES} minute(s)`);
  log(`  Check interval: ${CHECK_INTERVAL_MS / 1000}s`);

  const sessions = loadSessions();
  if (sessions?.[SESSION_KEY]?.updatedAt) {
    lastKnownUpdatedAt = sessions[SESSION_KEY].updatedAt;
    lastResetAt = sessions[SESSION_KEY].updatedAt;
    log(`Initial session updatedAt: ${new Date(lastKnownUpdatedAt).toISOString()}`);
  }

  setInterval(checkAndReset, CHECK_INTERVAL_MS);
  log(`Monitor running. Press Ctrl+C to stop.`);
}

main();
