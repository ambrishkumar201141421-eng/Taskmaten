// ═══════════════════════════════════════════════════════
//  TaskMate Backend — server.js
//  Express + Supabase + Socket.IO
// ═══════════════════════════════════════════════════════

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app    = express();
const server = http.createServer(app);

// ─── Supabase client (service role = full access) ──────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── Socket.IO ─────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

// ─── Middleware ────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());

// ─── Auth Middleware ───────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ══════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, campus } = req.body;
    if (!name || !email || !password || !campus)
      return res.status(400).json({ error: 'All fields are required' });

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users').select('id').eq('email', email).single();
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase
      .from('users')
      .insert({ name, email, password: hashed, campus, coins: 50 })
      .select('id, name, email, campus, coins, rating, total_tasks, avatar, bio, skills')
      .single();

    if (error) throw error;

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user, error } = await supabase
      .from('users').select('*').eq('email', email).single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    const { password: _, ...safeUser } = user;
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: safeUser, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me  — get current user profile
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, campus, coins, rating, total_tasks, avatar, bio, skills, created_at')
      .eq('id', req.user.id).single();
    if (error) throw error;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/profile — update profile
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { name, bio, skills, avatar } = req.body;
    const { data, error } = await supabase
      .from('users')
      .update({ name, bio, skills, avatar })
      .eq('id', req.user.id)
      .select('id, name, email, campus, coins, rating, total_tasks, avatar, bio, skills')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  TASK ROUTES
// ══════════════════════════════════════════════════════

// GET /api/tasks — list tasks (optionally filter by campus, category, status)
app.get('/api/tasks', async (req, res) => {
  try {
    const { campus, category, status = 'open', limit = 20, offset = 0 } = req.query;
    let query = supabase
      .from('tasks')
      .select(`*, users(id, name, avatar, rating, campus)`)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (campus)   query = query.eq('campus', campus);
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id — single task with offers
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const { data: task, error } = await supabase
      .from('tasks')
      .select(`*, users(id, name, avatar, rating, campus)`)
      .eq('id', req.params.id).single();
    if (error) throw error;

    const { data: offers } = await supabase
      .from('offers')
      .select(`*, users(id, name, avatar, rating)`)
      .eq('task_id', req.params.id)
      .order('created_at', { ascending: false });

    res.json({ ...task, offers: offers || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks — create task (auth required)
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { title, description, category, offer_type, offer_note, urgency } = req.body;
    if (!title || !description || !category)
      return res.status(400).json({ error: 'Title, description, and category are required' });

    // Get user's campus
    const { data: user } = await supabase
      .from('users').select('campus').eq('id', req.user.id).single();

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        user_id: req.user.id,
        title, description, category,
        offer_type: offer_type || ['open'],
        offer_note: offer_note || '',
        urgency: urgency || 'flexible',
        campus: user.campus
      })
      .select(`*, users(id, name, avatar, rating, campus)`)
      .single();

    if (error) throw error;

    // Notify campus users via socket
    io.emit('new_task', task);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/status — update task status
app.patch('/api/tasks/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('tasks').delete()
      .eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  OFFER ROUTES
// ══════════════════════════════════════════════════════

// POST /api/offers — send an offer on a task
app.post('/api/offers', authMiddleware, async (req, res) => {
  try {
    const { task_id, message, offer_value } = req.body;

    // Get task owner for notification
    const { data: task } = await supabase
      .from('tasks').select('user_id, title').eq('id', task_id).single();

    const { data: offer, error } = await supabase
      .from('offers')
      .insert({ task_id, sender_id: req.user.id, message, offer_value })
      .select(`*, users(id, name, avatar, rating)`)
      .single();
    if (error) throw error;

    // Create notification for task owner
    await supabase.from('notifications').insert({
      user_id: task.user_id,
      type: 'offer',
      title: 'New offer on your task!',
      body: `Someone offered to help with "${task.title}"`,
      link: `/tasks/${task_id}`
    });

    io.to(task.user_id).emit('new_offer', offer);
    res.status(201).json(offer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/offers/:id/accept
app.patch('/api/offers/:id/accept', authMiddleware, async (req, res) => {
  try {
    const { data: offer } = await supabase
      .from('offers').select('*, tasks(user_id)').eq('id', req.params.id).single();

    if (offer.tasks.user_id !== req.user.id)
      return res.status(403).json({ error: 'Not authorized' });

    await supabase.from('offers').update({ status: 'accepted' }).eq('id', req.params.id);
    await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', offer.task_id);

    await supabase.from('notifications').insert({
      user_id: offer.sender_id,
      type: 'offer',
      title: 'Your offer was accepted! 🎉',
      body: 'Start chatting to coordinate the task.',
      link: `/chat/${offer.task_id}`
    });

    res.json({ success: true, room_id: `${offer.task_id}_${req.user.id}_${offer.sender_id}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  CHAT / MESSAGE ROUTES
// ══════════════════════════════════════════════════════

// GET /api/messages/:room_id — load message history
app.get('/api/messages/:room_id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`*, users(id, name, avatar)`)
      .eq('room_id', req.params.room_id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chats — get all chat rooms for current user
app.get('/api/chats', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('room_id, created_at, content, sender_id')
      .or(`room_id.like.%_${req.user.id}_%,room_id.like.%_${req.user.id}`)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Deduplicate by room_id, keep latest
    const rooms = {};
    for (const m of data) {
      if (!rooms[m.room_id]) rooms[m.room_id] = m;
    }
    res.json(Object.values(rooms));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  RATING ROUTES
// ══════════════════════════════════════════════════════

// POST /api/ratings
app.post('/api/ratings', authMiddleware, async (req, res) => {
  try {
    const { task_id, rated_id, score, comment } = req.body;

    const { data, error } = await supabase
      .from('ratings')
      .insert({ task_id, rater_id: req.user.id, rated_id, score, comment })
      .select().single();
    if (error) throw error;

    // Recalculate average rating
    const { data: allRatings } = await supabase
      .from('ratings').select('score').eq('rated_id', rated_id);
    const avg = allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length;

    await supabase.from('users').update({
      rating: Math.round(avg * 100) / 100,
      total_tasks: allRatings.length
    }).eq('id', rated_id);

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  USER / LEADERBOARD ROUTES
// ══════════════════════════════════════════════════════

// GET /api/users/:id — public profile
app.get('/api/users/:id', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, campus, avatar, bio, skills, coins, rating, total_tasks, created_at')
      .eq('id', req.params.id).single();
    if (error) throw error;

    const { data: tasks } = await supabase
      .from('tasks').select('*').eq('user_id', req.params.id)
      .order('created_at', { ascending: false }).limit(10);

    const { data: reviews } = await supabase
      .from('ratings')
      .select(`*, users!rater_id(name, avatar)`)
      .eq('rated_id', req.params.id)
      .order('created_at', { ascending: false }).limit(5);

    res.json({ ...user, tasks: tasks || [], reviews: reviews || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leaderboard — top helpers on campus
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { campus } = req.query;
    let query = supabase
      .from('users')
      .select('id, name, avatar, campus, rating, total_tasks, skills, coins')
      .order('total_tasks', { ascending: false })
      .limit(10);
    if (campus) query = query.eq('campus', campus);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications — get user notifications
app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all
app.patch('/api/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await supabase.from('notifications')
      .update({ read: true }).eq('user_id', req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats — platform stats
app.get('/api/stats', async (req, res) => {
  try {
    const [{ count: tasks }, { count: users }, { count: done }] = await Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    ]);
    res.json({ total_tasks: tasks, total_users: users, completed_tasks: done });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ══════════════════════════════════════════════════════
//  SOCKET.IO — Real-time Chat
// ══════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // Join a personal room (user_id) for notifications
  socket.on('join_user', (userId) => {
    socket.join(userId);
    console.log(`👤 User ${userId} joined their room`);
  });

  // Join a chat room
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`💬 Socket joined room: ${roomId}`);
  });

  // Send message
  socket.on('send_message', async ({ room_id, sender_id, content }) => {
    try {
      const { data: msg } = await supabase
        .from('messages')
        .insert({ room_id, sender_id, content })
        .select(`*, users(id, name, avatar)`)
        .single();

      io.to(room_id).emit('receive_message', msg);
    } catch (err) {
      socket.emit('error', { message: 'Failed to save message' });
    }
  });

  // Typing indicator
  socket.on('typing', ({ room_id, user_name }) => {
    socket.to(room_id).emit('user_typing', { user_name });
  });

  socket.on('stop_typing', ({ room_id }) => {
    socket.to(room_id).emit('user_stop_typing');
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

// ─── Start Server ──────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🚀 TaskMate API running at http://localhost:${PORT}`);
  console.log(`📡 Socket.IO ready for real-time chat`);
  console.log(`🗄️  Supabase connected: ${process.env.SUPABASE_URL}\n`);
});
