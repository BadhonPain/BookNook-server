const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

let client;
let database;

async function connectToDatabase() {
  if (!client) {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is required to start the BookNook API.');
    }

    client = new MongoClient(MONGODB_URI);
    await client.connect();
    database = client.db(process.env.MONGODB_DATABASE || 'booknook');
  }

  return database;
}

async function getCollection(collectionName) {
  const db = await connectToDatabase();
  return db.collection(collectionName);
}

function getDb() {
  if (!database) {
    throw new Error('Database is not connected yet.');
  }

  return database;
}

async function ensureIndexes() {
  const borrows = await getCollection('borrows');
  await borrows.createIndex(
    { bookId: 1, userEmail: 1 },
    {
      name: 'one_active_borrow_per_user_and_book',
      unique: true,
      partialFilterExpression: { returned: false },
    },
  );
}

module.exports = {
  connectToDatabase,
  ensureIndexes,
  getCollection,
  getDb,
  ObjectId,
};
