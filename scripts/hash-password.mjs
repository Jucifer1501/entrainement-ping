#!/usr/bin/env node
import crypto from 'node:crypto';

const password = process.argv[2];
const email = process.argv[3];
const name = process.argv[4];

if (!password) {
  console.error(
    'Usage : npm run hash-password -- "<mot-de-passe>" ["email@exemple.fr"] ["Nom"]'
  );
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const derived = crypto.scryptSync(password, salt, 64).toString('hex');
const hash = `scrypt$${salt}$${derived}`;

console.log('\nHash sécurisé (scrypt) :');
console.log(hash);

if (email) {
  const entry = {
    email: email.trim().toLowerCase(),
    name: (name || email.split('@')[0] || 'Lecteur').trim(),
    passwordHash: hash,
  };
  console.log('\nExemple à coller dans AUTH_USERS_JSON :');
  console.log(JSON.stringify([entry]));
}
console.log('');
