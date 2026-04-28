

# Auth & Verification Flow — Implementation Plan

## Goal
Make signing in to Dock effortless and trustworthy:
1. One-click **Continue with Google** on both login and signup.
2. Polished **email + password signup** with mandatory email verification.
3. A **branded verification email** with a clear "Verify Email" button.
4. After clicking the link, users land back on Dock's **login page with a success message**.
5. Same level of polish for any future invite emails.

---

## 1. "Continue with Google" (Login + Signup)

### What you'll see
- A new **"Continue with Google"** button at the top of both `/login` and `/signup`, above the email/password form.
- A subtle "or" divider between Google and the email form.
- Google logo + clean white pill button matching Dock's light-blue aesthetic.
- Click → Google popup → redirect back to `/dashboard` (already signed in, no email verification step needed for Google accounts since Google has already verified them).

### How it works internally
- Use Lovable Cloud's **managed Google OAuth** — no Google Cloud Console setup, no API keys for you to manage. Lovable handles everything.
- A new helper file `src/integrations/lovable/index.ts` will be auto-generated and provide `lovable.auth.signInWithOAuth("google", { redirect_uri })`.
- Add a `signInWithGoogle()` method to `src/lib/auth-context.tsx` that calls the Lovable OAuth helper.
- The existing `_authenticated` route guard automatically picks up the new session — no other plumbing required.

---

## 2. Email + Password Signup with Mandatory Verification

### What changes for users
- After they fill in email + password and hit **Create account**, the form is **replaced** with a confirmation card:
  - 📬 illustration / icon
  - Headline: **"Check your inbox"**
  - Body: "We've sent a verification link to **user@example.com**. Click the link to activate your account."
  - Secondary action: "Resend verification email" (with a 60-second cooldown to prevent spam).
  - Tertiary link: "Wrong email? Start over."
- If they try to sign in **before** verifying:
  - The login attempt fails with the message **"Please verify your email first. Check your inbox for the verification link."**
  - A **Resend verification email** button appears inline so they don't have to bounce around.

### How it works internally
- Enable **"Confirm email"** in the Lovable Cloud auth settings (currently disabled — turning this on means new sign-ups must click the link before they can sign in).
- Update `signUp()` in `auth-context.tsx` to set `emailRedirectTo: ${window.location.origin}/login?verified=true`.
- Update `src/routes/signup.tsx` to:
  - Track `submitted` state.
  - On successful signup, swap the form for the "Check your inbox" card.
  - Wire up `supabase.auth.resend({ type: 'signup', email })` for the resend button with a 60s cooldown timer.
- Update `src/routes/login.tsx`:
  - Detect `?verified=true` in the URL search params and show a green success banner: **"✅ Your email has been successfully verified. Please log in."**
  - When `signIn()` fails with `email_not_confirmed`, render a "Resend verification email" inline action under the form.

---

## 3. Branded Verification Email

### What recipients get
- Email **From**: `Dock <noreply@<your-domain>>` (your verified domain).
- Subject: **"Verify your Dock account"**.
- Body — clean, white background, Dock's sky-blue accents:
  - Centered Dock anchor logo at the top.
  - Heading: **"Welcome to Dock ⚓"**.
  - Subhead: "Your universal drop zone is almost ready. Confirm your email to start saving things."
  - Big rounded **Verify Email** button (primary blue gradient, ~48px tall).
  - Fallback plain-text link below the button.
  - Footer: "If you didn't sign up for Dock, you can safely ignore this email."

### How it works internally
This requires Lovable's auth-email infrastructure:

1. **Setup prerequisite** — you'll need to set up a sender domain (one-time, takes a few minutes via the in-app dialog). Lovable then handles DNS, sending, queuing, retries, suppression, and bounce tracking automatically.
2. Lovable scaffolds the auth email templates (signup confirmation, magic link, password recovery, email change, invite, etc.) as React Email components in `src/lib/email-templates/auth/`.
3. We then **restyle the signup confirmation template** with Dock's brand: Inter font, sky-blue button, anchor logo, white background.
4. The same scaffolding gives us templates for password recovery, magic links, and **invites** — so they all share the same polished look without extra work later.

If you decide you don't want to set up a sender domain yet, Lovable still sends verification emails using its default sender (`@notify.lovable.app`) — it just won't be branded as Dock.

---

## 4. Post-Verification Redirect

- The **Verify Email** button in the email links to:
  `https://your-domain/auth/callback?type=signup&token=...&next=/login?verified=true`
- Lovable Cloud's auth callback handler validates the token, marks the email as confirmed, then redirects to `/login?verified=true`.
- `/login` reads `verified=true` from the URL and renders the success banner described in section 2.
- The user signs in normally → lands on `/dashboard`.

No new route file is needed — the redirect target is just `/login` with a query param.

---

## 5. Invite Flow Consistency

You don't have an invite feature yet, but planning for it:

- The same auth-email scaffolding from section 3 includes an **invite template** — if/when you add team invites, it'll automatically use the same Dock branding (anchor logo, sky-blue button, Inter font).
- Invite emails would say "**You've been invited to join [Workspace] on Dock**" with an **Accept invite** button → goes through the same verification → redirect to `/login?invited=true` flow.
- We're not building the invite UI in this round — just making sure the email template is ready.

---

## Files Touched

**New / regenerated**
- `src/integrations/lovable/index.ts` — auto-generated by Lovable's social-auth tool
- `src/components/auth/GoogleButton.tsx` — reusable "Continue with Google" button
- `src/lib/email-templates/auth/*.tsx` — 6 auth email templates (Lovable scaffolds, we restyle 1–2)

**Modified**
- `src/lib/auth-context.tsx` — add `signInWithGoogle`, fix `signUp` redirect URL
- `src/routes/login.tsx` — Google button + "verified" success banner + email-not-confirmed handling
- `src/routes/signup.tsx` — Google button + "Check your inbox" confirmation state + resend cooldown

**Cloud config (no code)**
- Enable Google as a sign-in method
- Enable "Confirm email" in auth settings
- (Optional but recommended) configure sender domain for branded emails

---

## Order of Implementation
1. Wire up Google OAuth + add buttons to login & signup. ✅ Quick win — works immediately.
2. Turn on email confirmation in auth settings + update signup/login flows to handle the new state. ✅ Self-contained.
3. **Stop and ask you**: do you want to set up a custom sender domain for branded emails, or stick with Lovable's default sender for now? (The flow works either way; it's a polish/branding decision.)
4. If yes → set up domain → scaffold + restyle email templates.
5. Verify end-to-end: signup → email arrives → click → login page success banner → sign in → dashboard.

