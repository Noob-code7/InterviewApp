import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function setup() {
  await mongoose.connect('mongodb://localhost:27017/interviewapp');
  const hash = await bcrypt.hash('Password123!', 10);
  await mongoose.connection.db.collection('users').updateOne(
    { email: 'test@example.com' },
    { $set: { email: 'test@example.com', name: 'Live Tester', password: hash, role: 'user', verified: true } },
    { upsert: true }
  );
  console.log('Test user test@example.com configured successfully with Password123!');
  await mongoose.disconnect();
}

setup();
