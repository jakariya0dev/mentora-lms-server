require("dotenv").config();
const { MongoClient } = require("mongodb");
const MONGO_URI = process.env.MONGODB_URI;

let client;
let db;

const connectDB = async () => {
  if (!client || !client.topology?.isConnected()) {
    client = new MongoClient(MONGO_URI, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });
    // await client.connect();
    db = client.db("mentora");
    console.log("✅ MongoDB connected Mentora");
  }
  return db;
};

module.exports = connectDB;
