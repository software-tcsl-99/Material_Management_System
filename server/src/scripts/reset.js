/**
 * Reset Script - Drops all collections
 * Run: npm run reset
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const resetDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const collections = await mongoose.connection.db.listCollections().toArray();

    for (const collection of collections) {
      await mongoose.connection.db.dropCollection(collection.name);
      console.log(`  ✗ Dropped: ${collection.name}`);
    }

    console.log('\n══════════════════════════════════════════');
    console.log('🗑️  Database reset complete!');
    console.log('══════════════════════════════════════════');
    console.log('All collections have been dropped.');
    console.log('Run "npm run seed" to re-seed data.\n');

    process.exit(0);
  } catch (error) {
    console.error('Reset error:', error);
    process.exit(1);
  }
};

resetDB();
