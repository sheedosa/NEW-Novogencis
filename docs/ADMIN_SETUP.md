# Admin account setup

Admin (clinician) accounts are **not** created from the running app. They are
provisioned manually so that no admin-bestowing logic ever lives in client code.

Firestore rules enforce this: any client-side attempt to write a `users` doc
with `role: 'admin'` (or any `adminType`) will be rejected.

## First-time clinic setup (one-off)

The very first admin must be created by a person with access to the Firebase
project console.

1. Have the clinician sign up through the public assessment flow with their
   real email + a strong password they control. This creates:
   - A Firebase Auth user.
   - A Firestore `users/{uid}` document with `role: 'client'`.
2. In the Firebase Console → Authentication → Users, copy the new user's UID.
3. In the Firebase Console → Firestore → `users/{uid}`, edit the document:
   - Set `role` to `admin`.
   - Add field `adminType` (string) with one of: `technical`, `doctor-male`,
     `doctor-female`.
4. The clinician can now sign in and access the admin portal.

Step 1 deliberately uses the public flow so the password is set by the person
who owns the account — it is never typed or stored anywhere by an operator.

## Adding further admins (after the first admin exists)

Once at least one admin is active, additional admins can be promoted the same
way (steps 1–3). A future enhancement is to expose an in-portal "Promote user
to admin" action gated by `isAdmin()`; until that exists, console promotion
remains the only path.

## What you should never do

- **Do not** commit admin email allowlists, default passwords, or
  bootstrap scripts to the repository.
- **Do not** add client-side code that sets `role: 'admin'` on signup or
  login.
- **Do not** share admin credentials between clinicians. Every admin gets
  their own account so audit logs attribute actions correctly.
