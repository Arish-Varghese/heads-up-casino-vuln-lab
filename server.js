const express = require('express');
const session = require('express-session');
const db = require('./db');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: false
}));

// Signup page
app.get('/signup', (req, res) => {
  res.render('signup');
});

// Signup form submission
app.post('/signup', (req, res) => {
//   console.log("Form Data Received:", req);
  const { username, password } = req.body;
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, password);
  res.redirect('/login');
});

// Login page
app.get('/login', (req, res) => {
  res.render('login');
});

// Login form submission
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
  if (user) {
    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin;
    res.redirect('/dashboard');
  } else {
    res.send('Invalid username or password. <a href="/login">Try again</a>');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Dashboard - requires login
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.render('dashboard', { user, result: req.query.result, amount: req.query.amount });
});

// Place a bet
app.post('/bet', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const { choice, amount } = req.body;
  const betAmount = parseInt(amount);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

  const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = outcome === choice;
  const newBalance = won ? user.balance + betAmount : user.balance - betAmount;

  db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, user.id);

  db.prepare('INSERT INTO bets (user_id, amount, choice, result, timestamp) VALUES (?, ?, ?, ?, ?)')
    .run(user.id, betAmount, choice, won ? 'win' : 'loss', new Date().toISOString());

  res.redirect(`/dashboard?result=${won ? 'win' : 'loss'}&amount=${betAmount}`);
});

// Bet history
app.get('/history', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const bets = db.prepare('SELECT * FROM bets WHERE user_id = ?').all(req.session.userId);
  res.render('history', { bets, user });
});

// Admin panel
app.get('/admin', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  if (!req.session.isAdmin) return res.send('Access denied. Admins only.');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const users = db.prepare('SELECT * FROM users').all();
  res.render('admin', { users, user });
});

// Admin: update a user's balance
app.post('/admin/update-balance', (req, res) => {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.send('Access denied.');
  }
  const { userId, newBalance } = req.body;
  db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(parseInt(newBalance), userId);
  res.redirect('/admin');
});

// View a user's profile - VULNERABLE: trusts the URL id with no ownership check
app.get('/profile/:id', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.render('profile', { user });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});