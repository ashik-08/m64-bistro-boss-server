const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const paymentsCollection = database.collection("payments");

    // jwt auth related api
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        console.log("from /jwt -- user:", user);
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "2h",
        });
        console.log("from /jwt -- token:", token);
        res.send({ token });
        // res
        //   .cookie("token", token, {
        //     httpOnly: true,
        //     secure: process.env.NODE_ENV === "production" ? true : false,
        //     sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        //   })
        //   .send({ success: true });
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // token middleware function
    const verifyToken = async (req, res, next) => {
      try {
        console.log("Value of token in middleware: ", req.headers);
        if (!req.headers.authorization) {
          return res
            .status(401)
            .send({ auth: false, message: "Not authorized" });
        }
        const token = req.headers.authorization.split(" ")[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          // error
          if (err) {
            console.log(err);
            return res.status(401).send({ message: "Unauthorized" });
          }
          // if token is valid then it would be decoded
          console.log("Value in the token: ", decoded);
          req.decoded = decoded;
          next();
        });
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const isAdmin = user?.role === "admin";
        if (!isAdmin) {
          return res.status(403).send({ message: "Forbidden" });
        }
        next();
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    };

    // get user from user collection
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // get user role from user collection
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (email !== req.decoded?.email) {
          return res.status(403).send({ message: "Forbidden" });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        let admin = false;
        if (user?.role === "admin") {
          admin = true;
        }
        res.send({ admin });
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

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
        const result = await usersCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // update a user role
    app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updatedUser = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(query, updatedUser);
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // delete a user from collection
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(query);
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

    // get single menu item
    app.get("/menu/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await menuCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // post to menu collection
    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const menuItem = req.body;
        // query to find all menu item in the collection
        const query = await menuCollection.find().toArray();
        // check if this item already exist
        const found = query.find(
          (search) =>
            search.name === menuItem.name &&
            search.category === menuItem.category &&
            search.price === menuItem.price
        );
        if (found) {
          return res.send({ message: "Already exists" });
        }
        const result = await menuCollection.insertOne(menuItem);
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // update food item to db from Update Item
    app.patch("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateQuery = {
          $set: {
            name: req.body.name,
            recipe: req.body.recipe,
            image: req.body.image,
            category: req.body.category,
            price: req.body.price,
          },
        };
        const result = await menuCollection.updateOne(filter, updateQuery);
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // delete a menu item from collection
    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await menuCollection.deleteOne(query);
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
    app.get("/carts", verifyToken, async (req, res) => {
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
    app.post("/carts", verifyToken, async (req, res) => {
      try {
        const cartItem = req.body;
        const result = await cartsCollection.insertOne(cartItem);
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // delete a cart item from collection
    app.delete("/carts/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await cartsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // payment intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      try {
        const { price } = req.body;
        console.log(price);
        const amount = parseInt(price * 100);
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
          // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional
          // because Stripe enables its functionality by default.
          // automatic_payment_methods: {
          //   enabled: true,
          // },
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // get payment information
    app.get("/payments/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (email !== req.decoded?.email) {
          return res.status(403).send({ message: "Forbidden" });
        }
        const query = { email: email };
        const result = await paymentsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // post payment information to collection
    app.post("/payments", verifyToken, async (req, res) => {
      try {
        const payment = req.body;
        const paymentResult = await paymentsCollection.insertOne(payment);
        // delete each cart from database
        const query = {
          _id: { $in: payment.cartIds.map((id) => new ObjectId(id)) },
        };
        const deleteResult = await cartsCollection.deleteMany(query);
        res.send({ paymentResult, deleteResult });
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // using aggregate pipeline
    // admin dashboard
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const query = { role: { $ne: "admin" } };
        const customers = await usersCollection.countDocuments(query);
        const products = await menuCollection.estimatedDocumentCount();
        const orders = await paymentsCollection.estimatedDocumentCount();
        const result = await paymentsCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalRevenue: {
                  $sum: "$amount",
                },
              },
            },
          ])
          .toArray();
        const totalRevenue = result[0]?.totalRevenue || 0;
        res.send({ customers, products, orders, totalRevenue });
      } catch (error) {
        console.log(error);
        return res.send({ error: true, message: error.message });
      }
    });

    // for graphs and charts
    app.get("/order-stats", verifyToken, verifyAdmin, async (req, res) => {
      try {
        // const id =
        const result = await paymentsCollection
          .aggregate([
            {
              $unwind: "$menuIds",
            },
            {
              $lookup: {
                from: "menu",
                let: { menuId: { $toObjectId: "$menuIds" } },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$_id", "$$menuId"],
                      },
                    },
                  },
                ],
                as: "menuItem",
              },
            },
            {
              $unwind: "$menuItem",
            },
            {
              $group: {
                _id: "$menuItem.category",
                quantity: {
                  $sum: 1,
                },
                revenue: {
                  $sum: "$menuItem.price",
                },
              },
            },
            {
              $project: {
                _id: 0,
                category: "$_id",
                quantity: 1,
                revenue: 1,
              },
            },
          ])
          .toArray();
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
