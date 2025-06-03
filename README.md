# Docs Feedback Widget

A lightweight feedback collection widget for Docusaurus documentation sites. Users can select text and leave comments that are stored in Supabase.

## Setup

### 1. Set up Supabase

1. Create a new Supabase project at https://supabase.com
2. Run the SQL commands in `supabase-setup.sql` in the SQL editor
3. Copy your project URL and anon key from Project Settings > API

### 2. Build the Widget

```bash
# Install dependencies
npm install

# Create .env file with your Supabase credentials
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Build the widget
npm run build
```

### 3. Integrate with Docusaurus

Add this single line to your Docusaurus site's custom HTML (in `docusaurus.config.js`):

```js
module.exports = {
  // ... other config
  scripts: [
    {
      src: 'https://your-cdn.com/widget.iife.js', // or '/widget.iife.js' if hosted locally
      async: true,
    },
  ],
};
```

Or add directly to your theme's HTML:

```html
<script src="/path/to/widget.iife.js" async></script>
```

**That's it!** No CSS file needed - everything is bundled into the single JavaScript file.

### 4. Deploy

1. Upload `dist/widget.iife.js` to your CDN or static hosting
2. The widget will automatically initialize on page load
3. Configure environment variables for production:
   - Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` in the built file
   - Or rebuild with `.env` file containing your credentials

## Features

- ✅ **One-line integration** - Just add a script tag
- ✅ **No CSS required** - All styles are inline
- ✅ Telegram username authentication
- ✅ Text selection and commenting
- ✅ Visual indicators for commented sections
- ✅ Persistent storage with Supabase
- ✅ Lightweight (~35KB gzipped)

## Admin Dashboard

To view collected feedback, query your Supabase database:

```sql
SELECT * FROM feedback_comments ORDER BY created_at DESC;
```

Or build a simple admin UI using the Supabase JS client.