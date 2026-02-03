const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient } = require('mongodb');
// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gr8kgxz.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri);

async function run() {
     try {
          await client.connect();

          const db = client.db("B4_Style");
          const productsCollection = db.collection("products");

          app.get("/", async (req, res) => {
               res.send("B4 Style Backend is running 🚀");
          });

          app.get("/products", async (req, res) => {
               const query = {};
               
               if (req.query.isNew) {
                    query.isNew = req.query.isNew === "true"
               }
               if (req.query.isBestSeller) {
                    query.isBestSeller = req.query.isBestSeller === "true"
               }
               if (req.query.category) {
                    query.category = req.query.category;
               }
               const products = await productsCollection.find(query).toArray();
               res.send(products);
          });
          // ping test
          await client.db("admin").command({ ping: 1 });
          console.log("Ping success 🚀");
     } finally {
          // await client.close();
     }
}
run().catch(console.dir);

app.listen(port, () => {
     console.log(`Server running on ${port}`);
});
