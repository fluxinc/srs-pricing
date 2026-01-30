'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
let Database;
try {
  Database = require('better-sqlite3');
} catch (err) {
  Database = null;
}

const app = express();

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'srs.db');
const STATE_PATH = process.env.STATE_PATH || path.join(path.dirname(DB_PATH), 'state.json');

const dataDir = path.dirname(DB_PATH);
fs.mkdirSync(dataDir, { recursive: true });

let db = null;
let getSettingStmt = null;
let setSettingStmt = null;
let useFileStore = false;

function readStateFile() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function writeStateFile(state) {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('Failed to write state file', err);
  }
}

function initSqlite() {
  if (!Database) return false;
  try {
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);
    getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    setSettingStmt = db.prepare('INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt');
    return true;
  } catch (err) {
    console.warn('SQLite unavailable, falling back to JSON file storage.', err.message);
    return false;
  }
}

useFileStore = !initSqlite();

function getSetting(key, fallback) {
  if (useFileStore) {
    const state = readStateFile();
    return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : fallback;
  }
  const row = getSettingStmt.get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch (err) {
    console.warn('Failed to parse setting', key, err);
    return fallback;
  }
}

function setSetting(key, value) {
  if (useFileStore) {
    const state = readStateFile();
    state[key] = value || {};
    writeStateFile(state);
    return;
  }
  const json = JSON.stringify(value || {});
  setSettingStmt.run(key, json, Date.now());
}

app.use(express.json({ limit: '256kb' }));

app.get('/api/state', (req, res) => {
  const config = getSetting('config', {});
  const ui = getSetting('ui', {});
  res.json({ config, ui });
});

app.put('/api/state', (req, res) => {
  const config = req.body && req.body.config ? req.body.config : {};
  const ui = req.body && req.body.ui ? req.body.ui : {};
  setSetting('config', config);
  setSetting('ui', ui);
  res.json({ ok: true });
});

app.get('/api/config', (req, res) => {
  res.json(getSetting('config', {}));
});

app.put('/api/config', (req, res) => {
  setSetting('config', req.body || {});
  res.json({ ok: true });
});

app.get('/api/ui', (req, res) => {
  res.json(getSetting('ui', {}));
});

app.put('/api/ui', (req, res) => {
  setSetting('ui', req.body || {});
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/lock-password', (req, res) => {
  const password = process.env.LOCK_PASSWORD || 'fluxmargins';
  res.json({ password });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/margins', (req, res) => {
  res.sendFile(path.join(__dirname, 'margins.html'));
});

app.get('/config.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'config.js'));
});

app.get('/pricing.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'pricing.js'));
});

app.get('/logo.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'logo.png'));
});

app.listen(PORT, () => {
  console.log(`SRS pricing app listening on port ${PORT}`);
});
