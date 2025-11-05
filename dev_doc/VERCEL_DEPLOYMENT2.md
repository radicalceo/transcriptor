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

   **Note**: The project includes a `.npmrc` file with `legacy-peer-deps=true` to resolve peer dependency conflicts between React 19 (Next.js 15) and NextAuth.js v4. This is automatically used by Vercel during deployment.

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

# NextAuth Configuration (Required for authentication)
NEXTAUTH_SECRET=your-generated-secret-here
NEXTAUTH_URL=https://your-app.vercel.app

# Google OAuth (Optional - only if you want Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Important Notes:**
- Never commit API keys to your repository
- Set environment variables for all environments (Production, Preview, Development)
- For `DATABASE_URL`, you can use the `POSTGRES_PRISMA_URL` that Vercel provides automatically

#### Generate NEXTAUTH_SECRET

Generate a secure random secret for NextAuth:

```bash
# On macOS/Linux
openssl rand -base64 32

# Or use this online tool
# https://generate-secret.vercel.app/32
```

Copy the generated string and use it as your `NEXTAUTH_SECRET` value.

#### Configure NEXTAUTH_URL

- **Production**: Set to your production URL (e.g., `https://your-app.vercel.app`)
- **Preview**: Set to `https://your-preview-url.vercel.app` or use dynamic value
- **Development**: Set to `http://localhost:3000`

**Note**: Vercel automatically sets the correct URL for preview deployments if you use the system environment variable `VERCEL_URL`.

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

### 5. Configure Google OAuth (Optional)

If you want to enable Google login in addition to email/password authentication, follow these steps:

#### 5.1. Create Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google+ API**
   - Go to **APIs & Services** → **Library**
   - Search for "Google+ API" and enable it

3. **Create OAuth Credentials**
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Choose **Web application**
   - Configure the OAuth consent screen if prompted

4. **Configure Authorized URLs**

   Add the following URLs:

   **Authorized JavaScript origins:**
   ```
   https://your-app.vercel.app
   http://localhost:3000  (for local development)
   ```

   **Authorized redirect URIs:**
   ```
   https://your-app.vercel.app/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google  (for local development)
   ```

5. **Get Your Credentials**
   - Copy the **Client ID** and **Client Secret**
   - Add them to Vercel environment variables:
     - `GOOGLE_CLIENT_ID=your-client-id`
     - `GOOGLE_CLIENT_SECRET=your-client-secret`

#### 5.2. Test Google Login

After deploying with Google OAuth configured:

1. Visit your app's login page
2. Click "Sign in with Google"
3. Complete the Google authorization flow
4. Verify the user is created in your database

**Note**: Users can sign in with either:
- Email/password (credentials authentication)
- Google OAuth
- Both methods can coexist for the same email address

### 6. Deploy

Once everything is configured:

1. Push your code to your Git repository
2. Vercel will automatically deploy
3. Monitor the build logs for any errors
4. Your app will be live at `https://your-project.vercel.app`

## Post-Deployment

### Verify Authentication

After deployment, test the authentication system:

1. **Test User Registration**
   - Visit your deployed URL
   - Click "Sign Up" or "Create Account"
   - Register with email/password
   - Verify you receive a confirmation email (if configured)

2. **Test Login**
   - Log in with your created account
   - Test the "Remember me" functionality
   - Test logout and login again

3. **Test Google OAuth (if configured)**
   - Click "Sign in with Google"
   - Complete the authorization flow
   - Verify successful login

4. **Check Database**
   - Go to Vercel → Storage → Your Database → Data tab
   - Verify the User table has your account
   - Check that the session is created properly

### Verify Database Connection

After authentication works, test the application features:

1. Start a new meeting
2. Try the live transcription
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

### Build Fails: "Conflicting peer dependency: react"

**Error Message:**
```
npm error Conflicting peer dependency: react@18.3.1
npm error peer react@"^17.0.2 || ^18" from next-auth@4.24.10
```

**Cause:**
- Next.js 15 uses React 19
- NextAuth.js v4 officially supports React 17 and 18 only
- However, NextAuth v4 works fine with React 19

**Solution:**

The project includes a `.npmrc` file with `legacy-peer-deps=true` to resolve this conflict. Make sure this file is committed to your repository:

```bash
# Check if .npmrc exists
cat .npmrc

# Should output: legacy-peer-deps=true
```

If the file is missing, create it:
```bash
echo "legacy-peer-deps=true" > .npmrc
git add .npmrc
git commit -m "Add .npmrc for peer dependency resolution"
git push
```

Vercel will automatically use this configuration during deployment.

**Alternative Solutions:**

1. **Upgrade to NextAuth.js v5** (Auth.js) - requires code migration
2. **Downgrade to Next.js 14** - not recommended, loses new features

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

### Authentication Issues

#### Error: "NEXTAUTH_SECRET environment variable is not set"

**Solution**:
- Generate a secret: `openssl rand -base64 32`
- Add `NEXTAUTH_SECRET` to Vercel environment variables
- Redeploy the application

#### Error: "NEXTAUTH_URL environment variable is not set"

**Solution**:
- Add `NEXTAUTH_URL` with your deployment URL (e.g., `https://your-app.vercel.app`)
- Make sure it matches your actual deployment URL
- For preview deployments, you can use `${VERCEL_URL}` or set it dynamically

#### Google OAuth Error: "redirect_uri_mismatch"

**Causes:**
- Redirect URI not configured in Google Cloud Console
- Wrong URL format in Google OAuth settings

**Solution:**
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth client
3. Add to Authorized redirect URIs:
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```
4. Make sure the URL exactly matches your deployment URL

#### Session/Login Issues: "Unable to get session"

**Causes:**
- Database connection issues
- Missing User/Account/Session tables
- Incorrect Prisma schema

**Solution:**
1. Verify database migrations are applied:
   ```bash
   npx prisma migrate deploy
   ```
2. Check Vercel logs for database errors
3. Verify `DATABASE_URL` is correctly set
4. Check that the User, Account, Session, and VerificationToken tables exist in the database

#### Users Can't Sign Up with Email/Password

**Causes:**
- bcryptjs not installed
- Database write permissions
- Missing email validation

**Solution:**
1. Verify bcryptjs is in dependencies:
   ```bash
   npm install bcryptjs
   ```
2. Check Vercel logs for specific errors
3. Verify database accepts writes
4. Check password hashing works correctly

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

### General Security

1. ✅ Never commit `.env` files with real credentials
2. ✅ Use Vercel's environment variables for secrets
3. ✅ Enable Vercel's DDoS protection
4. ✅ Use HTTPS only (enabled by default)
5. ✅ Regularly rotate API keys
6. ✅ Use separate databases for production and preview

### Authentication Security

1. ✅ **NEXTAUTH_SECRET**: Use a strong, random secret (minimum 32 characters)
   - Generate with: `openssl rand -base64 32`
   - Never reuse secrets between environments
   - Rotate periodically (every 90 days recommended)

2. ✅ **Password Security**:
   - Passwords are hashed using bcrypt (10 rounds)
   - Never store plain text passwords
   - Enforce minimum password length in your UI

3. ✅ **OAuth Security**:
   - Keep Google Client Secret secure
   - Only add trusted redirect URIs
   - Review OAuth consent screen regularly

4. ✅ **Session Security**:
   - Sessions use JWT strategy (stateless)
   - Configure appropriate session expiry
   - Implement logout functionality properly

5. ✅ **Database Access**:
   - Limit database user permissions
   - Use connection pooling for better security
   - Monitor for suspicious query patterns

## Next Steps

### Deployment
- [ ] Set up custom domain
- [ ] Configure preview deployments
- [ ] Add monitoring and analytics
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure cache headers for better performance

### Authentication
- [ ] Configure email verification (optional)
- [ ] Set up password reset emails
- [ ] Add additional OAuth providers (GitHub, LinkedIn, etc.)
- [ ] Implement two-factor authentication (2FA)
- [ ] Configure session timeout policies
- [ ] Set up admin role management

## Resources

### General Deployment
- [Vercel Docs](https://vercel.com/docs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

### Authentication
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [NextAuth.js with Prisma](https://next-auth.js.org/adapters/prisma)
- [Google OAuth Setup](https://console.cloud.google.com/)
- [NextAuth.js Environment Variables](https://next-auth.js.org/configuration/options#environment-variables)

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Review this guide's troubleshooting section
3. Consult [Vercel Support](https://vercel.com/support)
4. Check [Prisma Discord](https://pris.ly/discord)
