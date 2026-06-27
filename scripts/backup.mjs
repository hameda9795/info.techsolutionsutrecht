// Full Firestore backup for the Factor accounting app.
// Usage: BACKUP_EMAIL=you@example.com BACKUP_PASSWORD=secret npm run backup
// Writes backups/factor-backup-<timestamp>.json with every collection.
//
// The Firestore rules require an authenticated user, so this script signs in
// with the Firebase Auth credentials supplied via environment variables.
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { writeFileSync, mkdirSync } from 'fs';

const firebaseConfig = {
  apiKey: 'AIzaSyAQRDcyzRF5H2qxYf_0MBLvsT1-20EpYxM',
  authDomain: 'infotech-7d952.firebaseapp.com',
  projectId: 'infotech-7d952',
  storageBucket: 'infotech-7d952.firebasestorage.app',
  messagingSenderId: '476650305411',
  appId: '1:476650305411:web:2fd706f755b28a8ba068b6',
};

const COLLECTIONS = [
  'clients',
  'projects',
  'documents',
  'payments',
  'purchaseInvoices',
  'btwPeriods',
  'counters',
  'invoices',
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const email = process.env.BACKUP_EMAIL;
const password = process.env.BACKUP_PASSWORD;
if (!email || !password) {
  console.error('Set BACKUP_EMAIL and BACKUP_PASSWORD environment variables to authenticate.');
  process.exit(1);
}
await signInWithEmailAndPassword(getAuth(app), email, password);

const data = {};
let total = 0;
for (const name of COLLECTIONS) {
  const snap = await getDocs(collection(db, name));
  data[name] = snap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  total += data[name].length;
}

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
mkdirSync('backups', { recursive: true });
const file = `backups/factor-backup-${stamp}.json`;
writeFileSync(
  file,
  JSON.stringify({ exportedAt: now.toISOString(), project: firebaseConfig.projectId, data }, null, 2),
  'utf8'
);
console.log(`Saved ${total} documents across ${COLLECTIONS.length} collections to ${file}`);
process.exit(0);
