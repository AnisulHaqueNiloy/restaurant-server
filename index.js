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
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { "AddBy.Email": email };
        console.log(query);
      }

      const cursor = restaurant.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/purchase", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { buyerEmail: email };
        console.log(query);
      }

      const cursor = purchase.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/topfoods", (req, res) => {
      const query = {}; // Optionally, add a query filter if needed
      restaurant
        .find(query) // Apply the query (currently empty, fetches all)
        .sort({ Count: -1 }) // Sort by 'count' in descending order
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

    // update...........

    app.put("/update/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const data = req.body;

      const {
        img,
        name,
        category,
        quantity,
        price,
        origin,
        username,
        email,
        description,
      } = data;

      const updated = {
        $set: {
          FoodImage: img,
          FoodName: name,
          Category: category,
          Description: description,
          Price: price,
          FoodOrigin: origin,
          Quantity: quantity,
          AddBy: {
            Name: username,
            Email: email,
          },
        },
      };

      try {
        const result = await restaurant.updateOne(filter, updated);

        // Return only relevant information for the frontend
        res.send({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error("Error updating the document:", error);
        res.status(500).send({ error: "Failed to update the document" });
      }
    });

    // purchase ...........

    app.post("/purchase/:id", async (req, res) => {
      const foodId = req.params.id;
      const purchaseItem = req.body;

      try {
        // Find the food item by ID
        const food = await restaurant.findOne({ _id: new ObjectId(foodId) });

        if (!food) {
          return res.status(404).send({ message: "Food item not found." });
        }

        // Check if the item is out of stock
        if (food.Quantity == 0) {
          return res
            .status(400)
            .send({ message: "This item is out of stock." });
        }

        // Check if the buyer is trying to purchase their own added food item
        if (food.AddedBy === purchaseItem.buyerEmail) {
          return res
            .status(400)
            .send({ message: "You cannot purchase your own added food item." });
        }

        // Check if the requested quantity exceeds the available quantity
        if (purchaseItem.quantity > food.Quantity) {
          return res.status(400).send({
            message: `Requested quantity exceeds available stock (${food.Quantity}).`,
          });
        }

        // Calculate the updated quantity
        const updatedQuantity = food.Quantity - purchaseItem.quantity;

        // Update the available quantity and increment the count in the database
        await restaurant.updateOne(
          { _id: new ObjectId(foodId) },
          {
            $set: { Quantity: updatedQuantity },
            $inc: { Count: 1 }, // Increment the Count field by 1
          }
        );

        // Add the purchase record

        purchaseItem.purchaseDate = Date.now(); // Automatically add purchase date
        const purchaseResult = await purchase.insertOne(purchaseItem);

        res.status(201).send({
          message: "Purchase successful!",
          purchaseResult,
          updatedQuantity,
        });
      } catch (error) {
        console.error("Error during purchase:", error);
        res.status(500).send({
          message: "Something went wrong. Please try again later.",
        });
      }
    });

    // search ..........
    app.get("/search-foods", async (req, res) => {
      const search = req.query.search || ""; // Get the search query from the URL
      const query = {
        $or: [
          { FoodName: { $regex: search, $options: "i" } }, // Case-insensitive search in FoodName
          { Category: { $regex: search, $options: "i" } }, // Case-insensitive search in Category
          { FoodOrigin: { $regex: search, $options: "i" } }, // Case-insensitive search in FoodOrigin
        ],
      };

      try {
        const foods = await restaurant.find(query).toArray(); // Fetch matching foods
        res.send(foods); // Send the results to the client
      } catch (error) {
        console.error("Error while searching for foods:", error);
        res.status(500).send({ error: "Failed to search for foods" });
      }
    });

    // delete..........
    app.delete("/foods-delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await purchase.deleteOne(query);
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
