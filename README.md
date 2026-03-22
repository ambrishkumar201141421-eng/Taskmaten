# 🚀 TaskMate — Campus Task Exchange

A full-stack micro-task exchange platform for college campuses.

---

## 📁 Project Structure

```
taskmate/
├── server.js              ← Express backend + Socket.IO
├── package.json           ← Dependencies
├── .env.example           ← Environment variables template
├── supabase_schema.sql    ← Database schema (run in Supabase)
└── public/
    ├── index.html         ← Landing page
    ├── dashboard.html     ← Main app dashboard
    ├── chat.html          ← Real-time chat UI
    └── profile.html       ← User profile page
```

---

## ⚡ Step-by-Step Setup (Free)

### Step 1 — Set Up Supabase (Free Database)

1. Go to [supabase.com](https://supabase.com) → Sign up free
2. Click **New Project** → name it `taskmate`
3. Go to **SQL Editor** → paste the entire `supabase_schema.sql` file → click **Run**
4. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key**
   - **service_role key**

---

### Step 2 — Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Supabase values:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-role-key
   JWT_SECRET=any-long-random-string-here
   PORT=4000
   FRONTEND_URL=http://localhost:3000
   ```

---

### Step 3 — Install & Run Locally

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Server starts at http://localhost:4000
# Open public/index.html in browser
```

---

### Step 4 — Push to GitHub

```bash
git init
git add .
git commit -m "TaskMate initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/taskmate.git
git push -u origin main
```

---

### Step 5 — Deploy Backend to Render (Free)

1. Go to [render.com](https://render.com) → Sign up with GitHub
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add Environment Variables (from your `.env`) in Render dashboard
6. Click **Deploy** → get URL like `https://taskmate-api.onrender.com`

---

### Step 6 — Deploy Frontend to Vercel (Free)

1. Update `API` variable in `dashboard.html`, `chat.html`, `profile.html`:
   ```javascript
   const API = 'https://taskmate-api.onrender.com/api';
   ```
2. Go to [vercel.com](https://vercel.com) → Import GitHub repo
3. Set **Output Directory** to `public`
4. Click **Deploy** → get URL like `https://taskmate.vercel.app`

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| GET | `/api/tasks` | List tasks (filterable) |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Task detail + offers |
| PATCH | `/api/tasks/:id/status` | Update task status |
| POST | `/api/offers` | Send an offer |
| PATCH | `/api/offers/:id/accept` | Accept an offer |
| GET | `/api/messages/:room_id` | Chat history |
| POST | `/api/ratings` | Rate a user |
| GET | `/api/users/:id` | Public user profile |
| GET | `/api/leaderboard` | Top helpers |
| GET | `/api/notifications` | User notifications |
| GET | `/api/stats` | Platform stats |

---

## 🔥 Real-time Events (Socket.IO)

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_user` | Client → Server | Join personal room |
| `join_room` | Client → Server | Join chat room |
| `send_message` | Client → Server | Send a message |
| `receive_message` | Server → Client | Incoming message |
| `new_task` | Server → Client | New task posted |
| `new_offer` | Server → Client | Offer received |
| `typing` | Client → Server | Typing indicator |

---

## 🌐 Free Hosting Stack

| Service | Purpose | Cost |
|---------|---------|------|
| [Supabase](https://supabase.com) | PostgreSQL Database | Free (500MB) |
| [Render](https://render.com) | Node.js Backend | Free tier |
| [Vercel](https://vercel.com) | Frontend Hosting | Free tier |
| [GitHub](https://github.com) | Code Repository | Free |

---

## ✅ Features Built

- 🔐 JWT Authentication with college email
- 📋 Full task CRUD with categories and urgency
- ⚡ Offer system (cash, food, notes, credits)
- 💬 Real-time chat with Socket.IO
- ⭐ Rating & reputation system
- 🏆 Campus leaderboard
- 🔔 Notifications system
- 🪙 TaskCoins credit system
- 📊 User profiles with task history
- 🔍 Search and category filters
