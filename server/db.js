const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI);
const dbName = "timersdb";

let db;

async function connect() {
  if (!db) {
    await client.connect();
    db = client.db(dbName);
  }
  return db;
}

module.exports = new Proxy(
  {},
  {
    get: (_, collection) => {
      return {
        insertOne: async (doc) => (await connect()).collection(collection).insertOne(doc),
        findOne: async (query) => (await connect()).collection(collection).findOne(query),
        find: (query) => (connect()).then((db) => db.collection(collection).find(query)),
        updateOne: async (filter, update) =>
          (await connect()).collection(collection).updateOne(filter, update),
      };
    },
  }
);
