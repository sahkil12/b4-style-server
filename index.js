const express = require("express");
const cors = require("cors");
const Stripe = require('stripe');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
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
          const ordersCollection = db.collection("orders")

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
               const createdAt = new Date()

               if (quantity <= 0) {
                    return res.status(400).send({ message: "Invalid quantity" });
               }

               const product = await productsCollection.findOne({
                    _id: new ObjectId(productId)
               });

               if (!product) {
                    return res.status(404).send({ message: "Product not found" })
               }
               const existing = await cartsCollection.findOne({
                    userId,
                    productId,
                    size
               });

               const existingQty = existing?.quantity || 0;
               const totalQty = existingQty + quantity;
               // FINAL STOCK CHECK
               if (totalQty > product.stock) {
                    return res.status(400).send({
                         message: `Only ${product.stock - existingQty} items left in stock`
                    });
               }
               if (existing) {
                    await cartsCollection.updateOne(
                         { _id: existing._id },
                         { $set: { quantity: totalQty } }
                    );
               } else {
                    await cartsCollection.insertOne({
                         userId,
                         productId,
                         quantity,
                         size,
                         createdAt
                    });
               }

               res.send({ message: "Added To Cart" })
          })
          // get cart data by user
          app.get("/cart/:userId", async (req, res) => {
               const userId = req.params.userId;

               const cartItems = await cartsCollection.aggregate([
                    {
                         $match: { userId }
                    },
                    {
                         $lookup: {
                              from: "products",
                              let: { productId: "$productId" },
                              pipeline: [
                                   {
                                        $match: {
                                             $expr: {
                                                  $eq: ["$_id", { $toObjectId: "$$productId" }]
                                             }
                                        }
                                   }
                              ],
                              as: "product"
                         }
                    },
                    {
                         $unwind: "$product"
                    }
               ]).toArray();

               res.send(cartItems);
          });
          // increase / decrease cart quantity
          app.patch("/cart/quantity", async (req, res) => {
               const { cartItemId, type } = req.body;

               const item = await cartsCollection.findOne({
                    _id: new ObjectId(cartItemId)
               });
               if (!item) {
                    return res.status(404).send({ message: "Item not found" });
               }

               const product = await productsCollection.findOne({
                    _id: new ObjectId(item.productId)
               });

               let newQty = item.quantity;

               if (type === "inc" && newQty + 1 > product.stock) {
                    return res.status(400).send({ message: "Stock limit reached" });
               }
               // check invalid action
               if (!["inc", "dec"].includes(type)) {
                    return res.status(400).send({ message: "Invalid action" });
               }
               if (type === "inc") newQty += 1;
               if (type === "dec") newQty -= 1;

               if (newQty <= 0) {
                    await cartsCollection.deleteOne({
                         _id: new ObjectId(cartItemId)
                    });

                    return res.send({ message: "Item removed" });
               }

               await cartsCollection.updateOne(
                    { _id: new ObjectId(cartItemId) },
                    { $set: { quantity: newQty } }
               );

               res.send({ message: "Quantity updated" });
          });
          // remove cart 
          app.delete("/cart/:cartItemId", async (req, res) => {
               const { cartItemId } = req.params;

               await cartsCollection.deleteOne({
                    _id: new ObjectId(cartItemId)
               });
               res.send({ message: "Item removed from cart" });
          });
          // remove all cart 
          app.delete("/cart/clear/:userId", async (req, res) => {
               const { userId } = req.params;

               await cartsCollection.deleteMany({ userId });

               res.send({ message: "All Cart cleared" });
          });
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

               const products = await wishlistsCollection.aggregate([
                    {
                         $match: { userId }
                    },
                    {
                         $lookup: {
                              from: "products",
                              let: { productId: "$productId" },
                              pipeline: [
                                   {
                                        $match: {
                                             $expr: { $eq: ["$_id", { $toObjectId: "$$productId" }] }
                                        }
                                   }
                              ],
                              as: "product"
                         }
                    },
                    {
                         $unwind: "$product"
                    }
               ]).toArray()

               res.send(products);
          });
          // delete wish list
          app.delete("/wishlist/clear/:userId", async (req, res) => {
               const userId = req.params.userId;
               const result = await wishlistsCollection.deleteMany({ userId });

               res.send({
                    success: true,
                    deletedCount: result.deletedCount,
                    message: "Wishlist cleared successfully"
               });
          });
          // payment stripe implement
          app.post("/create-payment-intent", async (req, res) => {

               try {
                    const {
                         userId,
                         name,
                         email,
                         phone,
                         address,
                         city
                    } = req.body;

                    // delivery charge
                    const deliveryCharge = city === "Chittagong" ? 70 : 120;

                    const cartItems = await cartsCollection.aggregate([
                         { $match: { userId } },
                         {
                              $lookup: {
                                   from: "products",
                                   let: { productId: "$productId" },
                                   pipeline: [
                                        {
                                             $match: {
                                                  $expr: { $eq: ["$_id", { $toObjectId: "$$productId" }] }
                                             }
                                        }
                                   ],
                                   as: "product"
                              }
                         },
                         { $unwind: "$product" }
                    ]).toArray();

                    if (cartItems.length === 0) {
                         return res.status(400).send({ message: "Cart is empty" });
                    }
                    // 3️⃣ calculate total
                    let subtotal = 0;

                    const items = cartItems.map(item => {
                         const total = item.quantity * item.product.price;
                         subtotal += total;

                         return {
                              productId: item.productId,
                              title: item.product.title,
                              size: item.size,
                              quantity: item.quantity,
                              price: item.product.price,
                              totalProductAmount: total
                         };
                    });
                    // calculate total amount
                    const totalAmount = subtotal + deliveryCharge;
                    // 4️⃣ stripe payment intent
                    const paymentIntent = await stripe.paymentIntents.create({
                         amount: totalAmount * 100,
                         currency: "bdt",
                         payment_method_types: ["card"],
                         metadata: { userId }
                    });
                    // 5️⃣ save order (pending)
                    await ordersCollection.insertOne({
                         userId,
                         items,
                         subtotal,
                         deliveryCharge,
                         totalAmount,
                         paymentIntentId: paymentIntent.id,
                         paymentStatus: "pending",
                         orderStatus: "pending",
                         shippingAddress: {
                              name,
                              email,
                              phone,
                              address,
                              city
                         },
                         createdAt: new Date()
                    });

                    res.send({
                         clientSecret: paymentIntent.client_secret
                    });
               }
               catch (err) {
                    console.log(err);
                    res.status(500).send({ message: "Payment init failed" });
               }
          })
          // payment confirm
          app.post("/confirm-payment", async (req, res) => {
               const { paymentIntentId } = req.body;

               const order = await ordersCollection.findOne({ paymentIntentId });

               if (!order) {
                    return res.status(404).send({ message: "Order not found" });
               }

               await ordersCollection.updateOne(
                    { paymentIntentId },
                    {
                         $set: {
                              paymentStatus: "paid",
                              orderStatus: "processing",
                              paidAt: new Date()
                         }
                    }
               );
               // products quantity manage
               for (const item of order.items) {
                    await productsCollection.updateOne(
                         { _id: new ObjectId(item.productId) },
                         {
                              $inc: { stock: -item.quantity },
                         }
                    );
               }

               await cartsCollection.deleteMany({ userId: order.userId });

               res.send({ success: true });
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
