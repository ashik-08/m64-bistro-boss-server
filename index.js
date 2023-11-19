const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // connect to the database & access it's collections
    const database = client.db("bistro-boss");
    const usersCollection = database.collection("users");
    const menuCollection = database.collection("menu");
    const reviewsCollection = database.collection("reviews");
    const cartsCollection = database.collection("carts");

    // add a user to collection
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        // query to find all users in the collection
        const query = { email: user.email };
        // check if there already exist an user
        const isExist = await usersCollection.findOne(query);
        if (isExist) {
          return res.send({ message: "Already exists" });
        }
        const result = await usersCollection.insertOne(user, {
          writeConcern: { w: "majority" },
        });
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // get menu collection
    app.get("/menu", async (req, res) => {
      try {
        const result = await menuCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // get reviews collection
    app.get("/reviews", async (req, res) => {
      try {
        const result = await reviewsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // get carts collection
    app.get("/carts", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email: email };
        const result = await cartsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // post new item to carts collection
    app.post("/carts", async (req, res) => {
      try {
        const cartItem = req.body;
        console.log(cartItem);
        const result = await cartsCollection.insertOne(cartItem, {
          writeConcern: { w: "majority" },
        });
        console.log(result);
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // delete a cart item from collection
    app.delete("/carts/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await cartsCollection.deleteOne(query, {
          writeConcern: { w: "majority" },
        });
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BistroBoss server is running!");
});

app.listen(port, () => {
  console.log(`Server started on ${port}`);
});
