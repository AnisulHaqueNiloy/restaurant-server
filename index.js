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

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3zxuw.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const restaurant = client.db("Restaurant").collection("Foods");
    const purchase = client.db("Restaurant").collection("Purchase");

    app.post("/token", (req, res) => {
      const user = req.body;
      if (!user.email) {
        return res.status(400).send({ message: "Email is required." });
      }

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/foods", async (req, res) => {
      try {
        const newFood = req.body;
        const result = await restaurant.insertOne(newFood);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to add food item." });
      }
    });

    app.get("/allfoods", async (req, res) => {
      try {
        const email = req.query.email;
        const query = email ? { "AddBy.Email": email } : {};
        const foods = await restaurant.find(query).toArray();
        res.send(foods);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch foods." });
      }
    });

    app.get("/myfoods", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (req.user.email !== email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const foods = await restaurant.find({ "AddBy.Email": email }).toArray();
      res.send(foods);
    });

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
        const foods = await restaurant.find(query).toArray();
        res.send(foods);
      } catch (error) {
        res.status(500).send({ error: "Search failed." });
      }
    });

    // ... Other routes remain the same ...
  } finally {
    // client will be closed in production when not needed
  }
}
run().catch(console.dir);

app.listen(port, () => console.log(`Server running on port ${port}`));
