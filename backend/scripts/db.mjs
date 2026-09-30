#!/usr/bin/env node
// Runs a private PostgreSQL server for local development and tests.
// The Postgres programs come from the embedded-postgres npm package, so nothing
// has to be installed on the machine.
//
// Data lives in ~/.neighbors-kitchen/pgdata (override with LOCAL_PG_DATA_DIR). It is kept
// outside the project on purpose: folder-sync tools such as iCloud Drive (which syncs
// ~/Documents) must never touch the files of a running database.
//
//   node scripts/db.mjs start    start the server (first run also creates it)
//   node scripts/db.mjs stop     stop the server
//   node scripts/db.mjs status   show whether it is running

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const dataDir = process.env.LOCAL_PG_DATA_DIR ?? path.join(os.homedir(), '.neighbors-kitchen', 'pgdata');
const logFile = path.join(path.dirname(dataDir), 'postgres.log');
const port = Number(process.env.LOCAL_PG_PORT ?? 5433);
const databases = ['neighbors_kitchen', 'neighbors_kitchen_test'];

const platform = process.platform === 'win32' ? 'windows' : process.platform;
const { pg_ctl: pgCtl, initdb } = await import(`@embedded-postgres/${platform}-${process.arch}`);

function isRunning() {
  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) return false;
  return spawnSync(pgCtl, ['status', '-D', dataDir], { stdio: 'ignore' }).status === 0;
}

async function createMissingDatabases() {
  const client = new pg.Client({ host: 'localhost', port, user: 'postgres', database: 'postgres' });
  await client.connect();
  try {
    for (const name of databases) {
      const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
      if (rowCount === 0) {
        await client.query(`CREATE DATABASE "${name}"`);
        console.log(`Created database ${name}`);
      }
    }
  } finally {
    await client.end();
  }
}

async function start() {
  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log(`Creating local PostgreSQL data directory in ${dataDir}...`);
    mkdirSync(path.dirname(dataDir), { recursive: true });
    execFileSync(initdb, ['-D', dataDir, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--no-locale'], {
      stdio: 'ignore',
    });
  }
  if (isRunning()) {
    console.log(`PostgreSQL is already running on port ${port}`);
  } else {
    // Listen on localhost only, and skip the Unix socket so nothing is written outside the project.
    const serverOptions = `-p ${port} -c listen_addresses=localhost -c unix_socket_directories=''`;
    execFileSync(pgCtl, ['start', '-D', dataDir, '-l', logFile, '-w', '-o', serverOptions], { stdio: 'ignore' });
    console.log(`PostgreSQL started on port ${port}`);
  }
  await createMissingDatabases();
}

function stop() {
  if (!isRunning()) {
    console.log('PostgreSQL is not running');
    return;
  }
  execFileSync(pgCtl, ['stop', '-D', dataDir, '-m', 'fast'], { stdio: 'ignore' });
  console.log('PostgreSQL stopped');
}

const command = process.argv[2];
if (command === 'start') await start();
else if (command === 'stop') stop();
else if (command === 'status') console.log(isRunning() ? `PostgreSQL is running on port ${port}` : 'PostgreSQL is not running');
else {
  console.error('Usage: node scripts/db.mjs <start|stop|status>');
  process.exit(1);
}
