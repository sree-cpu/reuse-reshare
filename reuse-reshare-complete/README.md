# Reuse & Reshare

College campus sharing platform built with React, Vite and Supabase.

## Setup

1. Open the folder in VS Code.
2. Open Terminal.
3. Run `npm install`.
4. Create a file named `.env` in the project root.
5. Copy the two values from `.env.example` into `.env`.
6. In Supabase SQL Editor, run `supabase/schema.sql`.
7. Create the admin account in Supabase Authentication using the admin email/password you choose.
8. In the `profiles` table, change that user's `role` to `admin`.
9. Run `npm run dev`.

Never put an admin password in frontend JavaScript. The publishable Supabase key is intended for frontend use; database Row Level Security is what protects the data.
