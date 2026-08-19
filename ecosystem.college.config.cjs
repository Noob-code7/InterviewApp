/**
 * PM2 process configuration for the COLLEGE LAN / self-hosted deployment.
 *
 * This file is college-specific infrastructure. The universal application code
 * stays environment-driven; all service-specific values (Mongo URI, rate limits,
 * analysis concurrency, frontend serving, ports) are read by each app from its
 * own `.env` file at runtime (dotenv). Paths below default to common Windows
 * install locations and can be overridden via environment variables.
 *
 * Usage: pm2 startOrRestart ecosystem.college.config.cjs && pm2 save
 *
 * Reboot recovery: install pm2-windows-startup once (`pm2-startup install`),
 * then `pm2 save` after every deploy so PM2 restores all apps on boot.
 */
'use strict';

const path = require('path');

const ROOT = __dirname;
const DATA_DIR = process.env.MONGO_DBPATH || path.join(ROOT, 'college-data', 'db');
const LOG_DIR = path.join(path.dirname(DATA_DIR), 'logs');
const MONGOD_EXE =
  process.env.MONGOD_EXE ||
  'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe';

const common = {
  autorestart: true,
  restart_delay: 5000,
  max_restarts: 50,
  kill_timeout: 15000,
  max_memory_restart: '4G',
};

module.exports = {
  apps: [
    {
      name: 'college-mongod',
      script: MONGOD_EXE,
      interpreter: 'none',
      args: [
        '--dbpath', DATA_DIR,
        '--logpath', path.join(LOG_DIR, 'mongod.log'),
        '--bind_ip', '127.0.0.1',
        '--port', process.env.MONGO_PORT || '27017',
      ],
      cwd: ROOT,
      ...common,
    },
    {
      name: 'college-backend',
      script: 'server.js',
      cwd: path.join(ROOT, 'backend'),
      interpreter: 'node',
      ...common,
    },
    {
      name: 'college-face',
      script: 'main.py',
      cwd: path.join(ROOT, 'ai-services', 'face-service'),
      interpreter: process.env.PYTHON_EXE || 'python',
      ...common,
    },
    {
      name: 'college-voice',
      script: 'main.py',
      cwd: path.join(ROOT, 'ai-services', 'voice-service'),
      interpreter: process.env.PYTHON_EXE || 'python',
      ...common,
    },
    {
      name: 'college-nlp',
      script: 'main.py',
      cwd: path.join(ROOT, 'ai-services', 'nlp-service'),
      interpreter: process.env.PYTHON_EXE || 'python',
      ...common,
    },
  ],
};
