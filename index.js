const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

const uri =
  'mongodb+srv://smartdb:zysUKD6k3S0ON7Jb@first-cloud.j7wkmls.mongodb.net/?appName=first-cloud';

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get('/', (req, res) => {
  res.send('smart server running');
});

async function run() {
  try {
    await client.connect();

    const db = client.db('smart_db');
    const productsColl = db.collection('products');

    app.get('/products', async (req, res) => {
      const cursor = productsColl.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsColl.findOne(query);
      res.send(result);
    });

    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      const result = await productsColl.insertOne(newProduct);
      res.send(result);
    });

    app.patch('/products/:id', async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        // $set: updatedProduct,
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price,
        },
      };
      const result = await productsColl.updateOne(query, update);
      res.send(result);
    });

    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsColl.deleteOne(query);
      res.send(result);
    });

    await client.db('admin').command({ ping: 1 });
    console.log('connected to MongoDB');
  } finally {
    //
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`smart server is running on port: ${port}`);
});

// -------------- console after connect ----------------
// client
//   .connect()
//   .then(() => {
//     app.listen(port, () => {
//       console.log(`smart server is running now on port: ${port}`);
//     });
//   })
//   .catch(console.dir);
