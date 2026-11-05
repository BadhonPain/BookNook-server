
const { MongoClient, ObjectId } = require('mongodb');

let client;
let database;
let connectionPromise;
let indexesPromise;

async function connectToDatabase() {
  if (database) return database;

  if (!connectionPromise) {
    connectionPromise = (async () => {
      const uri = process.env.MONGODB_URI;

      if (!uri) {
        throw new Error('MONGODB_URI is required.');
      }

      const newClient = new MongoClient(uri);

      try {
        await newClient.connect();

        client = newClient;
        database = newClient.db(
          process.env.MONGODB_DATABASE || 'booknook'
        );

        return database;
      } catch (error) {
        await newClient.close().catch(() => {});
        throw error;
      }
    })().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  return connectionPromise;
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
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const borrows = await getCollection('borrows');
      const readerPreferences = await getCollection('readerPreferences');

      await borrows.createIndex(
        { userEmail: 1, borrowDate: -1 },
        { name: 'reader_borrow_history' }
      );

      await borrows.createIndex(
        { bookId: 1, userEmail: 1 },
        {
          name: 'one_active_borrow_per_user_and_book',
          unique: true,
          partialFilterExpression: { returned: false }
        }
      );

      await readerPreferences.createIndex(
        { userEmail: 1 },
        { name: 'one_preferences_record_per_reader', unique: true }
      );
    })().catch((error) => {
      indexesPromise = null;
      throw error;
    });
  }

  return indexesPromise;
}

module.exports = {
  connectToDatabase,
  ensureIndexes,
  getCollection,
  getDb,
  ObjectId
};
