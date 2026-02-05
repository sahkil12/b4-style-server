const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ObjectId } = require('mongodb');
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
          const cartsCollection = db.collection("carts")
          const wishlistsCollection = db.collection("wishlists")

          app.get("/", async (req, res) => {
               res.send("B4 Style Backend is running 🚀");
          });
          // get products 
          app.get("/products", async (req, res) => {
               try {
                    const query = {};
                    const {
                         category,
                         size,
                         search,
                         sort = "newest",
                         isNew,
                         isBestSeller
                    } = req.query;

                    // Category
                    if (category) query.category = category;
                    // Size
                    if (size) {
                         query.sizes = size;
                    }
                    // Search (title)
                    if (search) {
                         query.$or = [
                              { title: { $regex: search, $options: "i" } },
                              { category: { $regex: search, $options: "i" } },
                         ]
                    }
                    if (isNew) {
                         query.isNew = isNew === "true";
                    }
                    if (isBestSeller) {
                         query.isBestSeller = isBestSeller === "true";
                    }
                    // sort
                    let sortQuery = { createdAt: -1 };
                    if (sort === "priceLow") {
                         sortQuery = { price: 1 }
                    };
                    if (sort === "priceHigh") {
                         sortQuery = { price: -1 }
                    };
                    const products = await productsCollection
                         .find(query)
                         .sort(sortQuery)
                         .limit(search ? 16 : 0)
                         .toArray()
                    res.send(products);
               }
               catch (err) {
                    console.log(err);
                    res.status(500).send({ message: "Failed to fetch products" });
               }
          });
          //get product with id
          app.get("/products/:id", async (req, res) => {
               const id = req.params.id
               const query = { _id: new ObjectId(id) }
               const product = await productsCollection.findOne(query)

               res.send(product)
          })
          // add to cart
          app.post("/cart", async (req, res) => {
               const { userId, productId, quantity, size } = req.body

               const existing = await cartsCollection.findOne({ userId, productId, size });
               if (existing) {
                    await cartsCollection.updateOne({ _id: existing._id }, { $inc: { quantity } })
               }
               else {
                    await cartsCollection.insertOne({ userId, productId, quantity, size });
               }
               res.send({ message: "Added To Cart" })
          })
          // Wishlist add
          app.post("/wishlist", async (req, res) => {
               const { userId, productId } = req.body;
               const exists = await wishlistsCollection.findOne({ userId, productId });
               if (exists) {
                    return res.send({ message: "Already in wishlist" })
               }
               if (!exists) {
                    await wishlistsCollection.insertOne({ userId, productId });
               }
               res.send({ message: "Added to wishlist" });
          });
          // remove from wishlist
          app.delete("/wishlist", async (req, res) => {
               const { userId, productId } = req.body || {};

               if (!userId || !productId) {
                    return res.status(400).send({ message: "Invalid data" });
               }
               const result = await wishlistsCollection.deleteOne({
                    userId,
                    productId
               });
               if (result.deletedCount > 0) {
                    return res.send({ message: "Removed from wishlist" });
               }
               res.send({ message: "Item not found" });
          });

          // get wishlist by user
          app.get("/wishlist/:userId", async (req, res) => {
               const userId = req.params.userId;
               const result = await wishlistsCollection.find({ userId }).toArray();
               res.send(result);
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
