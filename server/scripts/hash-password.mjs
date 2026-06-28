// Usage: node scripts/hash-password.mjs "mijn-nieuwe-wachtwoord"
// Prints a bcrypt hash to paste into AUTH_PASSWORD_HASH in .env. The plaintext
// password is never stored anywhere — only this hash.
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Gebruik: node scripts/hash-password.mjs "<wachtwoord>"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(hash);
