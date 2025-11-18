# Deploying Neighbors-Kitchen

Your Neighbors-Kitchen landing page is ready to deploy! Here are the easiest ways to get it live on the internet:

## Option 1: Deploy with Vercel (Recommended - Easiest!)

Vercel is perfect for React/Vite apps and deploys directly from your GitHub repository.

### Steps:

1. **Go to [vercel.com](https://vercel.com)** and sign up/log in with your GitHub account

2. **Click "Add New Project"** or "Import Project"

3. **Import your GitHub repository:**
   - Select `joe-bera/Neighbors-Kitchen` from your repositories
   - Click "Import"

4. **Configure the project:**
   - Framework Preset: Vite (should auto-detect)
   - Root Directory: `frontend` (click "Edit" and set this)
   - Build Command: `npm run build` (should auto-fill)
   - Output Directory: `dist` (should auto-fill)
   - Install Command: `npm install` (should auto-fill)

5. **Click "Deploy"**

That's it! Vercel will build and deploy your site. You'll get a live URL like:
`https://neighbors-kitchen-xxx.vercel.app`

### Auto-Deploy on Push
Once connected, Vercel automatically redeploys whenever you push to your GitHub repository!

---

## Option 2: Deploy with Netlify

Netlify is another excellent option with similar features to Vercel.

### Steps:

1. **Go to [netlify.com](https://netlify.com)** and sign up/log in with GitHub

2. **Click "Add new site" → "Import an existing project"**

3. **Connect to GitHub** and select `joe-bera/Neighbors-Kitchen`

4. **Configure build settings:**
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`

5. **Click "Deploy site"**

You'll get a live URL like: `https://neighbors-kitchen-xxx.netlify.app`

---

## Option 3: Deploy with GitHub Pages

GitHub Pages is free and works great for static sites.

### Steps:

1. **Install gh-pages package** (in your local terminal):
   ```bash
   cd frontend
   npm install --save-dev gh-pages
   ```

2. **Add to `frontend/package.json`**:
   ```json
   {
     "homepage": "https://joe-bera.github.io/Neighbors-Kitchen",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

4. **Enable GitHub Pages:**
   - Go to your repo settings
   - Pages → Source → select `gh-pages` branch
   - Save

Your site will be live at: `https://joe-bera.github.io/Neighbors-Kitchen`

---

## Recommended: Vercel

**We recommend Vercel** because:
- ✅ Easiest setup (3 clicks!)
- ✅ Automatic deployments on git push
- ✅ Preview deployments for pull requests
- ✅ Free SSL certificates
- ✅ Global CDN
- ✅ Perfect for React/Vite apps
- ✅ Free tier is generous

---

## What You'll See

Once deployed, you'll see your beautiful Neighbors-Kitchen landing page with:
- 🍳 Purple gradient hero section
- 👨‍🍳 Feature cards showcasing platform benefits
- 📋 "How It Works" section
- 📞 Call-to-action buttons
- 📄 Professional footer

---

## Need Help?

If you run into any issues:
1. Check that your repository is pushed to GitHub
2. Make sure the branch you're deploying has the latest code
3. Verify the build settings match the instructions above
4. Check the deployment logs for any error messages

Happy deploying! 🚀
