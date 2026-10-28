# Union Bank Passbook Print
Firebase customer record management starter. Print is clearly marked as a customer information copy, not an official bank-issued passbook.

## Firebase setup
1. Firebase Console → Authentication → Sign-in method → enable Email/Password.
2. Create Firestore Database and publish `firestore.rules`.
3. Authentication → Users: create the first Admin user.
4. Copy its UID. Firestore → create document in `users` collection with document ID equal to that UID and fields `role: "admin"`, `email: "admin email"`.
5. Create retailer users in Authentication and matching `users/{UID}` documents with `role: "retailer"`.
6. Deploy via GitHub Pages or Firebase Hosting; add the hosting domain under Authentication → Settings → Authorized domains.

## Files
- index.html — login, customer form, records and information-copy print
- styles.css — responsive and print styles
- app.js — Firebase Authentication and Firestore logic
- firestore.rules — Admin/Retailer access controls

## Security
Never let a user assign their own role. Each retailer can read only their own records; Admin can read all. Customer account numbers and addresses are sensitive—restrict access and test rules before real use. This is a starter project; test before production.
