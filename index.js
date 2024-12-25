const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(express.json());
const corsOptions = {
  origin: "http://localhost:5173", // Your frontend origin
  methods: "GET,POST,PUT,DELETE",
};
app.use(cors(corsOptions));
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3zxuw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    app.post("/foods", async (req, res) => {
      const newFood = req.body;
      const result = await restaurant.insertOne(newFood);
      res.send(result);
    });

    app.get("/allfoods", async (req, res) => {
      const cursor = restaurant.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/topfoods", (req, res) => {
      const query = {}; // Optionally, add a query filter if needed
      restaurant
        .find(query) // Apply the query (currently empty, fetches all)
        .sort({ count: -1 }) // Sort by 'count' in descending order
        .limit(6) // Limit to the top 6
        .toArray() // Convert the cursor to an array
        .then((topFoods) => {
          res.send(topFoods); // Send the top 6 items as a response
        });
    });

    // single product .............
    app.get("/foods-detail/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await restaurant.findOne(query);
      res.send(result);
    });

    // purchase ...........
    app.post("/purchase/:id", async (req, res) => {
      const purchaseItem = req.body;
      purchase.date = Date.now(); // Automatically add purchase date
      const result = await purchase.insertOne(purchaseItem);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("restaurant server");
});

app.listen(port, () => {
  console.log("server is running");
});
