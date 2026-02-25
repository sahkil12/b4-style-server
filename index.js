const express = require("express");
const cors = require("cors");
const Stripe = require('stripe');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ObjectId } = require('mongodb');

const verifyToken = require("./verifyToken")

// middleware
app.use(cors({
     origin: [
          "http://localhost:5173",
          "https://b4-style.vercel.app"
     ],
     credentials: true
}));
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
          const usersCollections = db.collection("users")

          // admin verify 
          const verifyAdmin = async (req, res, next) => {
               const userEmail = req.user.email
               const user = await usersCollections.findOne({
                    email: userEmail
               })
               // admin check 
               if (!user || user.role !== "admin") {
                    return res.status(403).send({
                         message: "Access denied (Admin only)"
                    })
               }
               next()
          }

          app.get("/", async (req, res) => {
               res.send("B4 Style Backend is running 🚀");
          });
          // products post api
          app.post("/products", verifyToken, verifyAdmin, async (req, res) => {
               try {
                    const product = req.body;
                    const result =
                         await productsCollection.insertOne(product);
                    res.send(result);
               }
               catch {
                    res.status(500).send({
                         message: "Failed"
                    });
               }
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
                    // if (category) query.category = category;
                    if (category) {
                         query.category = new RegExp(`^${category}$`, 'i');
                    }
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
                         .toArray()
                    res.send(products);
               }
               catch (err) {
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
          // delete product
          app.delete("/products/:id", verifyToken, verifyAdmin, async (req, res) => {
               try {
                    const id = req.params.id
                    // check valid ObjectId
                    if (!ObjectId.isValid(id)) {

                         return res.status(400).send({
                              message: "Invalid Product ID"
                         });
                    }
                    const query = { _id: new ObjectId(id) }
                    const result = await productsCollection.deleteOne(query)
                    res.send({
                         success: true,
                         message: "Product Delete Successfully",
                         deletedCount: result.deletedCount
                    })
               }
               catch {
                    res.status(500).send({
                         success: false,
                         message: "product delete failed"
                    })
               }
          })
          // user routes
          app.post("/users", async (req, res) => {
               try {
                    const { email, name } = req.body
                    // check duplicate user
                    const existingUser = await usersCollections.findOne({ email })

                    if (existingUser) {
                         return res.status(200).json({
                              message: 'User already exists',
                         });
                    }

                    const newUser = {
                         email,
                         name,
                         role: "user",
                         createAt: new Date()
                    }
                    const result = await usersCollections.insertOne(newUser)

                    res.status(201).json({
                         message: "User Created",
                         insertId: result.insertedId,
                         role: "user"
                    })
               }
               catch (error) {
                    res.status(500).json({ message: error.message });
               }
          })
          // user role with email
          app.get("/users/role/:email", verifyToken, async (req, res) => {
               try {
                    const email = req.params.email
                    // email check 
                    if (!email) {
                         return res.status(400).send({ message: "Email is required" });
                    }

                    const user = await usersCollections.findOne({ email })
                    // 
                    if (!user) {
                         return res.status(404).send({ message: "User not found!" })
                    }
                    res.send({
                         role: user.role
                    })
               }
               catch (error) {
                    res.status(500).send({
                         message: "Failed to fetch user role",
                         error: error.message
                    });
               }
          })
          // admin all route 
          app.get("/admin/stats", verifyToken, verifyAdmin, async (req, res) => {
               try {
                    // total users
                    const totalUsers = await usersCollections.countDocuments({
                         role: "user"
                    });
                    // total admins
                    const totalAdmins = await usersCollections.countDocuments({
                         role: "admin"
                    });
                    // total products
                    const totalProducts = await productsCollection.countDocuments();
                    // total orders
                    const totalOrders = await ordersCollection.countDocuments();
                    // total revenue (only paid orders)
                    const revenueResult = await ordersCollection.aggregate([
                         {
                              $match: {
                                   paymentStatus: "paid"
                              }
                         },
                         {
                              $group: {
                                   _id: null,
                                   totalRevenue: {
                                        $sum: "$totalAmount"
                                   }
                              }
                         }
                    ]).toArray();

                    const totalRevenue =
                         revenueResult.length > 0
                              ? revenueResult[0].totalRevenue
                              : 0;
                    // latest 5 orders
                    const latestOrders = await ordersCollection
                         .find()
                         .sort({ createdAt: -1 })
                         .limit(5)
                         .toArray();
                    // FINAL RESPONSE
                    res.send({
                         totalUsers,
                         totalAdmins,
                         totalProducts,
                         totalOrders,
                         totalRevenue,
                         latestOrders
                    });
               }
               catch (error) {

                    console.log(error);

                    res.status(500).send({
                         message: "Failed to load admin stats"
                    });
               }
          });
          // Weekly admin status
          app.get("/admin/weekly-stats", verifyToken, verifyAdmin, async (req, res) => {

               try {
                    const result = await ordersCollection.aggregate([
                         {
                              $match: {
                                   paymentStatus: "paid"
                              }
                         },
                         {
                              $group: {
                                   _id: {
                                        year: { $year: "$createdAt" },
                                        week: { $week: "$createdAt" }
                                   },
                                   weeklyRevenue: {
                                        $sum: "$totalAmount"
                                   },
                                   weeklyOrders: {
                                        $sum: 1
                                   }
                              }
                         },
                         {
                              $sort: {
                                   "_id.year": 1,
                                   "_id.week": 1
                              }
                         },
                         {
                              $limit: 7
                         }
                    ]).toArray();

                    const formatted = result.map(item => ({
                         week: `Week ${item._id.week}`,
                         revenue: item.weeklyRevenue,
                         orders: item.weeklyOrders
                    }));
                    res.send(formatted);
               }
               catch (err) {
                    res.status(500).send({
                         message: "Weekly stats failed"
                    });
               }
          });
          // add to cart
          app.post("/cart", verifyToken, async (req, res) => {
               const userId = req.user.uid;
               const { productId, quantity, size } = req.body
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
          app.get("/cart", verifyToken, async (req, res) => {
               const userId = req.user.uid;

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
          app.patch("/cart/quantity", verifyToken, async (req, res) => {
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
          // remove all cart 
          app.delete("/cart/clear", verifyToken, async (req, res) => {
               try {
                    const userId = req.user.uid;
                    const result = await cartsCollection.deleteMany({ userId });

                    res.status(200).send({
                         message: "Cart cleared successfully",
                         deletedCount: result.deletedCount
                    });

               } catch (error) {
                    res.status(500).send({ message: "Failed to clear cart" });
               }
          });
          // remove cart 
          app.delete("/cart/:cartItemId", verifyToken, async (req, res) => {
               const { cartItemId } = req.params;

               await cartsCollection.deleteOne({
                    _id: new ObjectId(cartItemId)
               });
               res.send({ message: "Item removed from cart" });
          });
          // Wishlist add
          app.post("/wishlist", verifyToken, async (req, res) => {
               const userId = req.user.uid;

               const { productId } = req.body;
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
          app.delete("/wishlist", verifyToken, async (req, res) => {
               const userId = req.user.uid;
               const { productId } = req.body || {};

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
          app.get("/wishlist", verifyToken, async (req, res) => {
               const userId = req.user.uid;

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
          app.delete("/wishlist/clear", verifyToken, async (req, res) => {
               const userId = req.user.uid;

               const result = await wishlistsCollection.deleteMany({ userId });

               res.send({
                    success: true,
                    deletedCount: result.deletedCount,
                    message: "Wishlist cleared successfully"
               });
          });
          // payment stripe implement
          app.post("/create-payment-intent", verifyToken, async (req, res) => {
               try {
                    const userId = req.user.uid;
                    const {
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
                    // calculate total
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
                    // stripe payment intent
                    const paymentIntent = await stripe.paymentIntents.create({
                         amount: totalAmount * 100,
                         currency: "bdt",
                         payment_method_types: ["card"],
                         metadata: { userId }
                    });
                    // save order (pending)
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
                    res.status(500).send({ message: "Payment init failed" });
               }
          })
          // payment confirm
          app.post("/confirm-payment", verifyToken, async (req, res) => {
               const { paymentIntentId } = req.body;

               const order = await ordersCollection.findOne({ paymentIntentId });

               if (order.userId !== req.user.uid) {
                    return res.status(403).send({ message: "Forbidden" });
               }

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
