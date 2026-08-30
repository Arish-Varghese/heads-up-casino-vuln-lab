const Database = require('better-sqlite3');
const db = new Database('casino.db');

// Create users table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 1000,
    is_admin INTEGER NOT NULL DEFAULT 0
  )
`);

// Create bets table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    choice TEXT NOT NULL,
    result TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Seed one admin user if none exists (username: admin, password: admin123)
const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  db.prepare('INSERT INTO users (username, password, balance, is_admin) VALUES (?, ?, ?, ?)')
    .run('admin', 'admin123', 5000, 1);
  console.log('Admin user created: admin / admin123');
}

module.exports = db;