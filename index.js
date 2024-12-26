const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://restaurant-management-anisulhaque.netlify.app",
    ],
    credentials: true,
  })
);
app.use(cookieParser());

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res
      .status(401)
      .send({ success: false, message: "Unauthorized access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ success: false, message: "Unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3zxuw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// MongoDB Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();

    const restaurant = client.db("Restaurant").collection("Foods");
    const purchase = client.db("Restaurant").collection("Purchase");

    // Generate JWT token
    app.post("/token", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true, token });
    });

    // Logout user
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true, message: "Logged out successfully" });
    });

    // Add new food item
    app.post("/foods", async (req, res) => {
      try {
        const newFood = req.body;
        const result = await restaurant.insertOne(newFood);
        res.status(201).send({ success: true, data: result });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to add food item" });
      }
    });

    // Get all foods or filter by email
    app.get("/allfoods", async (req, res) => {
      const email = req.query.email;
      const query = email ? { "AddBy.Email": email } : {};

      try {
        const result = await restaurant.find(query).toArray();
        res.send({ success: true, data: result });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch foods" });
      }
    });

    // Get foods added by a logged-in user
    app.get("/myfoods", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (req.user.email !== email) {
        return res.status(403).send({ success: false, message: "Forbidden" });
      }

      try {
        const result = await restaurant
          .find({ "AddBy.Email": email })
          .toArray();
        res.send({ success: true, data: result });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch foods" });
      }
    });

    // Get food details by ID
    app.get("/foods-detail/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const result = await restaurant.findOne({ _id: new ObjectId(id) });
        res.send({ success: true, data: result });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch food details" });
      }
    });

    // Update food item
    app.put("/update/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;

      const updated = {
        $set: {
          FoodImage: data.img,
          FoodName: data.name,
          Category: data.category,
          Description: data.description,
          Price: data.price,
          FoodOrigin: data.origin,
          Quantity: data.quantity,
          AddBy: {
            Name: data.username,
            Email: data.email,
          },
        },
      };

      try {
        const result = await restaurant.updateOne(
          { _id: new ObjectId(id) },
          updated
        );
        res.send({ success: true, modifiedCount: result.modifiedCount });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to update food item" });
      }
    });

    // Purchase food item
    app.post("/purchase/:id", async (req, res) => {
      const foodId = req.params.id;
      const purchaseItem = req.body;

      try {
        const food = await restaurant.findOne({ _id: new ObjectId(foodId) });

        if (!food) {
          return res
            .status(404)
            .send({ success: false, message: "Food item not found" });
        }

        if (food.Quantity < purchaseItem.quantity) {
          return res.status(400).send({
            success: false,
            message: `Requested quantity exceeds available stock (${food.Quantity}).`,
          });
        }

        const updatedQuantity = food.Quantity - purchaseItem.quantity;

        await restaurant.updateOne(
          { _id: new ObjectId(foodId) },
          { $set: { Quantity: updatedQuantity }, $inc: { Count: 1 } }
        );

        purchaseItem.purchaseDate = new Date();
        const purchaseResult = await purchase.insertOne(purchaseItem);

        res
          .status(201)
          .send({ success: true, purchaseResult, updatedQuantity });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to complete purchase" });
      }
    });

    // Search for foods
    app.get("/search-foods", async (req, res) => {
      const search = req.query.search || "";
      const query = {
        $or: [
          { FoodName: { $regex: search, $options: "i" } },
          { Category: { $regex: search, $options: "i" } },
          { FoodOrigin: { $regex: search, $options: "i" } },
        ],
      };

      try {
        const result = await restaurant.find(query).toArray();
        res.send({ success: true, data: result });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to search for foods" });
      }
    });

    // Delete food item
    app.delete("/foods-delete/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const result = await restaurant.deleteOne({ _id: new ObjectId(id) });
        res.send({ success: true, deletedCount: result.deletedCount });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Failed to delete food item" });
      }
    });
  } finally {
    // Ensures the client will close when finished or an error occurs
  }
}
run().catch((error) => console.error("Error connecting to database:", error));

// Root route
app.get("/", (req, res) => {
  res.send("Restaurant server is running");
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
