# FriendList

A shared dashboard for friends to collaboratively manage activities, food spots, and adventures. Built with Next.js, Tailwind CSS, Supabase, and Grok AI.

## Features

- **Shared Password Authentication** - Simple login for private friend groups
- **Real-time Collaborative List** - Add, complete, and delete items with live updates
- **Category System** - Organize items as Activity, Food, Travel, Entertainment, Shopping, or Other
- **Grok AI Chat** - Built-in AI assistant for recommendations and help
- **Auto-Categorization** - Let AI automatically categorize your items
- **Social Link Analysis** - Paste TikTok/Instagram links for AI analysis
- **Premium UI** - Minimalist, responsive design with smooth animations

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL with real-time)
- **AI**: Grok AI (xAI)
- **Animations**: Framer Motion
- **Icons**: Lucide React

## Setup

### 1. Clone and Install

```bash
cd shareBoard
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **SQL Editor** and run this query to create the items table:

```sql
CREATE TABLE items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  link TEXT,
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE items;

-- Enable RLS (optional but recommended)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users (since we use shared password auth)
CREATE POLICY "Allow all operations" ON items FOR ALL USING (true);
```

3. Go to **Project Settings > API** and copy:
   - Project URL
   - `anon` public key

### 3. Get Grok API Key

1. Go to [x.ai](https://x.ai) and sign up for API access
2. Generate an API key from the dashboard

### 4. Configure Environment Variables

Create a `.env.local` file:

```env
# Shared password for authentication
NEXT_PUBLIC_SHARED_PASSWORD=your_secret_password

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Grok AI
GROK_API_KEY=your_grok_api_key
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/friendlist)

### Manual Deploy

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and create a new project
3. Import your GitHub repository
4. Add environment variables:
   - `NEXT_PUBLIC_SHARED_PASSWORD`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GROK_API_KEY`
5. Deploy!

## Project Structure

```
shareBoard/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Login page
│   ├── globals.css         # Global styles
│   ├── dashboard/
│   │   └── page.tsx        # Main dashboard
│   └── api/
│       └── grok/
│           └── route.ts    # Grok API endpoint
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── navbar.tsx          # Navigation bar
│   ├── item-card.tsx       # List item card
│   ├── add-item-form.tsx   # Add item form
│   └── chat-sidebar.tsx    # Grok chat sidebar
├── lib/
│   ├── utils.ts            # Utilities
│   ├── supabase.ts         # Supabase client
│   └── grok.ts             # Grok AI helpers
└── package.json
```

## Security Notice

This app uses a simple shared password system designed for private use among trusted friends. **Do not use this authentication pattern for public applications.** For production apps with user accounts, implement proper authentication (e.g., Supabase Auth, NextAuth.js).

## License

MIT
