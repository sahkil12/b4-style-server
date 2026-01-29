const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = 5000;
const { MongoClient } = require('mongodb');
// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gr8kgxz.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri);

async function run() {
     try {
          await client.connect();

          await client.db("admin").command({ ping: 1 });
          console.log("Pinged your deployment. You successfully connected to MongoDB!");
     } finally {
          // await client.close();
     }
}
run().catch(console.dir);

app.get("/", (req, res) => {
     res.send("B4 Style Backend is running 🚀");
});

app.get("/api/products", (req, res) => {
     res.json(products);
});

app.listen(port, () => {
     console.log(`Server running on ${port}`);
});
