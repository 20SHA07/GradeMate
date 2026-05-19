# GradeMate Email Delivery Checklist

Use this checklist when Supabase signup or verification emails do not arrive.

## Student Checks

- Check spam, junk, promotions, and quarantine folders.
- Wait a minute before retrying; email providers can delay first delivery.
- Do not resend many times in a row, because Supabase may rate limit requests.
- Open the verification email in the same browser used for signup when possible.
- If the link says it expired or was opened in another browser, go back to login
  and request a new verification email.
- Continue as guest if you need to use GradeMate immediately.

## Supabase Checks

- Confirm **Authentication > Providers > Email** is enabled.
- Confirm email confirmation is intentionally enabled or disabled.
- Confirm the Site URL is `https://20sha07.github.io/GradeMate`.
- Confirm these redirect URLs are allowed:
  - `https://20sha07.github.io/GradeMate/auth/callback`
  - `https://20sha07.github.io/GradeMate/workspace`
  - `https://20sha07.github.io/GradeMate/dashboard`
  - `https://20sha07.github.io/GradeMate/simple`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3001/auth/callback`
  - `http://localhost:3000/workspace`
  - `http://localhost:3001/workspace`
- Confirm Supabase email templates are enabled and not accidentally blank.
- Configure custom SMTP for production delivery.

## SMTP Providers

Supabase built-in email is fine for early testing, but production delivery is
more reliable with a real SMTP provider. Good options include:

- Resend
- Brevo
- SendGrid
- Postmark

## Friend-Test Shortcut

For a small private friend test, you can temporarily disable **Confirm email** in
Supabase under **Authentication > Providers > Email**. Signup will create usable
accounts immediately.

Only use this for a private test group. Re-enable email confirmation before a
broader public launch.
