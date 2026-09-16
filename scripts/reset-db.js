import { rmSync } from 'node:fs';
import { dbPath, initializeDatabase, openDatabase, seedDatabase } from '../src/db.js';

rmSync(dbPath, { force: true });
const db = openDatabase();
initializeDatabase(db);
seedDatabase(db);
db.close();
console.log('Asteria Bank data was reset.');
