const express = require('express')
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken')

const { MongoClient, ServerApiVersion, ObjectId, ChangeStream } = require('mongodb')
const app = express()
const port = process.env.PORT || 3000

// console.log(process.env);

// firebase admin SDK
const admin = require('firebase-admin')

// const serviceAccount = require('./smart-deals-akm-firebase-adminsdk.json')

// index.js
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

// middleware
app.use(cors())
app.use(express.json())

const logger = (req, res, next) => {
  console.log('logging info')
  next()
}

const verifyFirebaseToken = async (req, res, next) => {
  console.log('in the verify middleware', req.headers.authorization)

  const authorization = req.headers.authorization

  if (!authorization) {
    // do to allow to go
    return res.status(401).send({ message: 'unauthorized access' })
  }

  const token = authorization.split(' ')[1]
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }

  // verify id token
  try {
    const userInfo = await admin.auth().verifyIdToken(token)
    req.token_email = userInfo.email
    console.log('after token validation', userInfo)
    next()
  } catch {
    console.log('invalid token')
    return res.status(401).send({ message: 'unauthorized access' })
  }
}

const verifyJWTToken = (req, res, next) => {
  console.log('in middleware', req.headers)
  const authorization = req.headers.authorization
  if (!authorization) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  const token = authorization.split(' ')[1]
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }

    // put it in the right place
    console.log('after decoded', decoded)
    req.token_email = decoded.email
    next()
  })
}

// const uri =
//   'mongodb+srv://smartdb:zysUKD6k3S0ON7Jb@first-cloud.j7wkmls.mongodb.net/?appName=first-cloud';

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@first-cloud.j7wkmls.mongodb.net/?appName=first-cloud`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

app.get('/', (req, res) => {
  res.send('smart server running')
})

async function run() {
  try {
    await client.connect()

    const db = client.db('smart_db')
    const productsColl = db.collection('products')
    const bidsColl = db.collection('bids')
    const usersColl = db.collection('users')

    // jwt related APIs
    app.post('/getToken', (req, res) => {
      const loggedUser = req.body
      const token = jwt.sign(loggedUser, process.env.JWT_SECRET, { expiresIn: '1h' })
      res.send({ token: token })
    })

    // USERS API
    app.post('/users', async (req, res) => {
      const newUser = req.body

      // identifying existing user
      const email = req.body.email
      const query = { email: email }
      const existingUser = await usersColl.findOne(query)

      if (existingUser) {
        res.send({ message: 'user already exist!' })
      } else {
        const result = await usersColl.insertOne(newUser)
        res.send(result)
      }
    })

    // PRODUCTS APIs
    app.get('/products', async (req, res) => {
      // const cursor = productsColl
      //   .find()
      //   .sort({ price_min: 1 }) // -1 for decending
      //   .limit(5)
      //   .skip(2)
      //   .project({ title: 1, price_min: 1, price_max: 1, image: 1 }); // _id: 0 for no id

      console.log(req.query)
      const email = req.query.email
      const query = {}
      if (email) {
        query.email = email
      }

      const cursor = productsColl.find(query)

      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/latest-products', async (req, res) => {
      const cursor = productsColl.find().sort({ created_at: -1 }).limit(6)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: id } // _id: new ObjectId(id)
      const result = await productsColl.findOne(query)
      res.send(result)
    })

    app.post('/products', verifyFirebaseToken, async (req, res) => {
      console.log('headers in the post', req.headers)
      const newProduct = req.body
      const result = await productsColl.insertOne(newProduct)
      res.send(result)
    })

    app.patch('/products/:id', async (req, res) => {
      const id = req.params.id
      const updatedProduct = req.body
      const query = { _id: new ObjectId(id) }
      const update = {
        // $set: updatedProduct,
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price,
        },
      }
      const result = await productsColl.updateOne(query, update)
      res.send(result)
    })

    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await productsColl.deleteOne(query)
      res.send(result)
    })

    // bids related API

    app.get('/bids', verifyFirebaseToken, async (req, res) => {
      const email = req.query.email
      const query = {}
      if (email) {
        query.buyer_email = email

        if (email !== req.token_email) {
          return res.status(403).send({ message: 'forbidden access' })
        }
      }

      const cursor = bidsColl.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })

    // --------------------------------------------------
    // app.get('/bids', verifyJWTToken, async (req, res) => {
    //   // console.log('headers', req.headers);
    //   const email = req.query.email;
    //   const query = {};
    //   if (email) {
    //     query.buyer_email = email;
    //   }

    //   // verify user have access to see this data
    //   if (email !== req.token_email) {
    //     return res.status(403).send({ message: 'forbidden access' });
    //   }

    //   const cursor = bidsColl.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    // bids with firebase token verify
    // app.get('/bids', logger, verifyFirebaseToken, async (req, res) => {
    //   // console.log('headers', req.headers);
    //   const email = req.query.email;
    //   const query = {};
    //   if (email) {
    //     if (email !== req.token_email) {
    //       return res.status(403).send({ message: 'Forbidden access' });
    //     }

    //     query.buyer_email = email;
    //   }
    //   const cursor = bidsColl.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    // for all bids
    app.get('/bids', async (req, res) => {
      const cursor = bidsColl
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/products/bids/:productId', async (req, res) => {
      const productId = req.params.productId
      const query = { product: productId }
      const cursor = bidsColl.find(query).sort({ bid_price: -1 })
      const result = await cursor.toArray()
      res.send(result)
    })

    // app.get('/products/bids/:productId', verifyFirebaseToken, async (req, res) => {
    //   const productId = req.params.productId;
    //   const query = { product: productId };
    //   const cursor = bidsColl.find(query).sort({ bid_price: -1 });
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    app.post('/bids', async (req, res) => {
      const newBid = req.body
      const result = await bidsColl.insertOne(newBid)
      res.send(result)
    })

    app.delete('/bids/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await bidsColl.deleteOne(query)
      res.send(result)
    })

    // await client.db('admin').command({ ping: 1 })
    console.log('connected to MongoDB')
  } finally {
    //
  }
}

run().catch(console.dir)

app.listen(port, () => {
  console.log(`smart server is running on port: ${port}`)
})

// -------------- console after connect ----------------
// client
//   .connect()
//   .then(() => {
//     app.listen(port, () => {
//       console.log(`smart server is running now on port: ${port}`);
//     });
//   })
//   .catch(console.dir);
