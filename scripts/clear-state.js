#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const targets = [
  path.join(dataDir, 'state.json'),
  path.join(dataDir, 'srs.db'),
  path.join(dataDir, 'srs.db-wal'),
  path.join(dataDir, 'srs.db-shm'),
];

for (const target of targets) {
  try {
    fs.rmSync(target, { force: true });
  } catch (err) {
    // Ignore removal errors; deploy should continue.
  }
}
