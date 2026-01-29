const express = require("express");
const cors = require("cors");

const app = express();
const port = 5000;

// middleware
app.use(cors());
app.use(express.json());

// 🔹 Demo products (later MongoDB দিয়ে replace করবে)
const products = [
  {
    id: 1,
    title: "Oversized T-Shirt",
    category: "T-SHIRTS",
    price: 850,
    image: "https://i.ibb.co/example1.jpg"
  },
  {
    id: 2,
    title: "Black Hoodie",
    category: "HOODIES",
    price: 1650,
    image: "https://i.ibb.co/example2.jpg"
  },
  {
    id: 3,
    title: "Drop Shoulder Tee",
    category: "T-SHIRTS",
    price: 950,
    image: "https://i.ibb.co/example3.jpg"
  }
];

// 🔹 Root test
app.get("/", (req, res) => {
  res.send("B4 Style Backend is running 🚀");
});

// 🔹 Get all products
app.get("/api/products", (req, res) => {
  res.json(products);
});

// 🔹 Get single product by id
app.get("/api/products/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const product = products.find(p => p.id === id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.json(product);
});

// 🔹 Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
