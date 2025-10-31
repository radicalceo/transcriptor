# Vercel Deployment Guide

This guide will help you deploy your Meeting Copilot application to Vercel with PostgreSQL database support.

## Prerequisites

- A [Vercel account](https://vercel.com/signup)
- Your codebase pushed to a Git repository (GitHub, GitLab, or Bitbucket)
- API keys for Anthropic (Claude) and OpenAI

## Step-by-Step Deployment

### 1. Initial Vercel Setup

1. **Import Your Project**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project"
   - Import your Git repository
   - Vercel will auto-detect Next.js settings

2. **Configure Build Settings**
   - Framework Preset: **Next.js**
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

### 2. Add Vercel Postgres Database

1. **Create Database**
   - In your project dashboard, go to the **Storage** tab
   - Click **Create Database**
   - Select **Postgres** (powered by Neon)
   - Choose a database name (e.g., `transcriptor-db`)
   - Select a region close to your users
   - Click **Create**

2. **Connect Database**
   - Vercel will automatically add the following environment variables:
     - `POSTGRES_URL` - Full connection string
     - `POSTGRES_PRISMA_URL` - Optimized for Prisma (connection pooling)
     - `POSTGRES_URL_NON_POOLING` - Direct connection (for migrations)

3. **Use Prisma-Optimized URL**
   - Go to **Settings** → **Environment Variables**
   - Add a new variable:
     - Name: `DATABASE_URL`
     - Value: Reference `POSTGRES_PRISMA_URL` or use the connection string from Vercel Postgres dashboard
   - Make sure it's available for all environments (Production, Preview, Development)

### 3. Configure Environment Variables

Add all required environment variables in **Settings** → **Environment Variables**:

```bash
# Database (automatically set when you add Vercel Postgres)
DATABASE_URL=${POSTGRES_PRISMA_URL}

# Anthropic API Key (Required)
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here

# OpenAI API Key (Required)
OPENAI_API_KEY=sk-your-actual-key-here
```

**Important Notes:**
- Never commit API keys to your repository
- Set environment variables for all environments (Production, Preview, Development)
- For `DATABASE_URL`, you can use the `POSTGRES_PRISMA_URL` that Vercel provides automatically

### 4. Run Database Migrations

After your first deployment, you need to initialize the database schema:

#### Option A: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Link your local project to Vercel project
vercel link

# Pull environment variables
vercel env pull .env.local

# Run migrations using the pulled credentials
npx prisma migrate deploy
```

#### Option B: Via Vercel Dashboard

1. Go to your project on Vercel
2. Navigate to **Settings** → **Functions**
3. Add a temporary build command that runs migrations:
   ```bash
   npx prisma migrate deploy && npm run build
   ```
4. Redeploy the project
5. After successful deployment, revert the build command to `npm run build`

#### Option C: Using Vercel's Postgres Dashboard

1. Go to **Storage** → Your Postgres database
2. Click on the **Query** tab
3. Copy the contents of `prisma/migrations/20251030000000_init_postgresql/migration.sql`
4. Paste and execute the SQL

### 5. Deploy

Once everything is configured:

1. Push your code to your Git repository
2. Vercel will automatically deploy
3. Monitor the build logs for any errors
4. Your app will be live at `https://your-project.vercel.app`

## Post-Deployment

### Verify Database Connection

After deployment, test your application:

1. Visit your deployed URL
2. Try starting a meeting
3. Check if data is being saved correctly
4. Test the transcription and summary features

### Monitor Logs

- Go to your Vercel project dashboard
- Click on **Logs** to see runtime logs
- Check for any database connection errors

## Local Development with Vercel Postgres

You can use the production database for local development (not recommended for sensitive data) or set up a local PostgreSQL instance:

### Option 1: Use Vercel Postgres Locally

```bash
# Pull environment variables from Vercel
vercel env pull .env.local

# Run your development server
npm run dev
```

### Option 2: Local PostgreSQL Instance

1. Install PostgreSQL locally:
   ```bash
   # macOS (using Homebrew)
   brew install postgresql@16
   brew services start postgresql@16

   # Ubuntu/Debian
   sudo apt-get install postgresql
   sudo service postgresql start
   ```

2. Create a local database:
   ```bash
   createdb transcriptor
   ```

3. Update `.env.local`:
   ```bash
   DATABASE_URL="postgresql://localhost:5432/transcriptor"
   ```

4. Run migrations:
   ```bash
   npx prisma migrate dev
   ```

## Troubleshooting

### Build Fails: "Prisma Client Not Generated"

**Solution**: Add postinstall script to `package.json`:

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### Error: "Can't reach database server"

**Causes:**
- `DATABASE_URL` not set correctly
- Database not created in Vercel
- Wrong connection string format

**Solution:**
- Verify `DATABASE_URL` in environment variables
- Use `POSTGRES_PRISMA_URL` for better connection pooling
- Check Vercel Postgres dashboard for correct connection string

### Error: "Prepared statement already exists"

This happens with connection pooling.

**Solution**: Use `POSTGRES_PRISMA_URL` instead of `POSTGRES_URL` for Prisma, as it handles connection pooling correctly.

### Migrations Not Applied

**Solution**: Manually run migrations:

```bash
vercel env pull .env.local
npx prisma migrate deploy
```

Or use the Vercel Postgres Query tab to run the SQL directly.

## Continuous Deployment

Once set up, your app will automatically redeploy when you push to your main branch:

1. Make changes locally
2. Commit and push to Git
3. Vercel automatically builds and deploys
4. Your changes go live in ~2-3 minutes

## Database Management

### View Data

1. Go to **Storage** → Your Postgres database
2. Click **Data** tab to browse tables
3. Or use the **Query** tab to run SQL

### Backup Database

Vercel Postgres (Neon) provides automatic backups. To export data:

```bash
# Using Vercel CLI
vercel env pull .env.local
pg_dump $DATABASE_URL > backup.sql
```

### Reset Database

```bash
npx prisma migrate reset
```

**Warning**: This will delete all data!

## Performance Optimization

### Enable Connection Pooling

Already enabled when using `POSTGRES_PRISMA_URL` ✅

### Configure Prisma

No additional configuration needed for basic usage. For advanced scenarios, see `doc/guidelines/database.md`.

## Cost Estimate

**Vercel Postgres (Neon) Free Tier:**
- 512 MB storage
- 1 database per project
- Shared compute
- Good for development and small apps

**Paid Tiers:**
- Start at $20/month for production workloads
- See [Vercel Pricing](https://vercel.com/pricing/storage)

## Security Best Practices

1. ✅ Never commit `.env` files with real credentials
2. ✅ Use Vercel's environment variables for secrets
3. ✅ Enable Vercel's DDoS protection
4. ✅ Use HTTPS only (enabled by default)
5. ✅ Regularly rotate API keys
6. ✅ Use separate databases for production and preview

## Next Steps

- [ ] Set up custom domain
- [ ] Configure preview deployments
- [ ] Add monitoring and analytics
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure cache headers for better performance

## Resources

- [Vercel Docs](https://vercel.com/docs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Review this guide's troubleshooting section
3. Consult [Vercel Support](https://vercel.com/support)
4. Check [Prisma Discord](https://pris.ly/discord)
