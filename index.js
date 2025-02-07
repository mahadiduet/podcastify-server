const express = require('express')
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require("jsonwebtoken");
require('dotenv').config();
const { ObjectId } = require('mongodb');



const app = express()
app.use(express.json());
const port = 5000
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://podcastify-598b9.web.app'
    ],
    credentials: true
}));

app.get('/', (req, res) => {
    res.send('Server is running...........!')
})


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://podcastify:XkLFI6W2yCRQ4MoQ@cluster0.lyuai16.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const podcastCollection = client.db("podcastify").collection("podcast");
        const playlistCollection = client.db("podcastify").collection("playlist");
        const userCollection = client.db("podcastify").collection("users");

        // jwt related api
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "5h",
            });
            res.send({ token });
        });

        // middlewares
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "unauthorized access" });
            }
            const token = req.headers.authorization?.split(" ")[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "unauthorized  access" });
                }
                req.decoded = decoded;
                next();
            });
        };

        // Get All Music
        app.get('/podcast', async (req, res) => {
            try {
                const data = await podcastCollection.find().sort({ _id: -1 }).limit(9).toArray();
                res.status(200).send(data);
            } catch (error) {
                console.error("Error fetching podcasts:", error);
                res.status(500).send({ message: "Failed to fetch podcasts" });
            }
        });

        app.get('/manage-podcast', async (req, res) => {
            const { userEmail, page = 0, limit = 5 } = req.query;

            if (!userEmail) {
                return res.status(400).send({ message: "Email is required" });
            }

            const skip = page * limit;

            try {
                const podcasts = await podcastCollection.find({ userEmail: userEmail })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray();

                console.log("Podcasts Retrieved:", podcasts);  // Log the podcasts retrieved

                const total = await podcastCollection.countDocuments({ userEmail: userEmail });

                res.status(200).send({ podcasts, total });
            } catch (error) {
                console.error("Error fetching podcasts:", error);
                res.status(500).send({ message: "Failed to fetch podcasts" });
            }
        });

        // Upload Podcast
        app.post('/upload', async (req, res) => {
            try {
                const { title, musician, description, coverImage, audioFile, releaseDate, category, userEmail, tags } = req.body;

                let tagsArray = [];
                if (Array.isArray(tags)) {
                    tagsArray = tags;
                } else if (typeof tags === 'string') {
                    tagsArray = tags.split(',').map(tag => tag.trim());
                }

                const musicData = {
                    title,
                    musician,
                    description,
                    coverImageUrl: coverImage,
                    audioFileUrl: audioFile,
                    releaseDate: new Date(releaseDate),
                    category,
                    userEmail,
                    tags: tagsArray
                };
                const result = await podcastCollection.insertOne(musicData);
                res.status(200).send({ message: 'Music uploaded successfully', data: result });
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to upload podcast' });
            }
        });

        // Delete Music
        app.delete('/podcast/:id', async (req, res) => {
            try {
                console.log(req.params.id);
                const music_id = new ObjectId(req.params.id);
                console.log('Object ID:', music_id);
                const query = { _id: music_id };
                const result = await podcastCollection.deleteOne(query);
                if (!result) return res.status(404).send('Music not found');
                res.send({ message: 'Music deleted successfully' });
            } catch (error) {
                res.status(500).send('Server error');
            }
        });

        // Get Specific Music
        app.get("/podcast/:id", async (req, res) => {
            const podcastId = req.params.id;
            console.log(podcastId);
            try {
                const podcast = await podcastCollection.findOne({ _id: new ObjectId(podcastId) });
                if (!podcast) {
                    return res.status(404).json({ error: "Podcast not found" });
                }
                res.json(podcast);
            } catch (error) {
                console.error("Error fetching podcast:", error);
                res.status(500).json({ error: "Server error" });
            }
        });

        // Update Podcast
        app.put('/podcast/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const filter = { _id: new ObjectId(id) };
                const options = { upsert: true };
                const { title, musician, description, coverImage, audioFile, releaseDate, category, userEmail, tags } = req.body;

                let tagsArray = [];
                if (Array.isArray(tags)) {
                    tagsArray = tags;
                } else if (typeof tags === 'string') {
                    tagsArray = tags.split(',').map(tag => tag.trim());
                }

                const musicData = {
                    title,
                    musician,
                    description,
                    coverImageUrl: coverImage,
                    audioFileUrl: audioFile,
                    releaseDate: new Date(releaseDate),
                    category,
                    userEmail,
                    tags: tagsArray
                };
                // console.log(musicData);
                const updateData = {
                    $set: musicData
                };
                // console.log(updateData);
                const result = await podcastCollection.updateOne(filter, updateData, options);
                res.send(result);

            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to upload podcast' });
            }
        })

        // Playlist Start

        // Added playlist
        app.post('/playlist', async (req, res) => {
            try {
                const { music_id, title, user_email } = req.body;

                const query = {
                    user_email: user_email,
                    music_id: music_id
                };

                const existingPlaylist = await playlistCollection.findOne(query);

                if (existingPlaylist) {
                    return res.send({ message: "Podcast already exists in playlist.", insertedId: null });
                }

                const playlistData = {
                    user_email,
                    music_id,
                    title
                };
                const result = await playlistCollection.insertOne(playlistData);
                res.status(200).send({ message: 'Playlist Added successfully', data: result });
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to add playlist' });
            }
        });

        // Manage playlist
        app.get('/manage-playlist', async (req, res) => {
            const { userEmail, page = 0, limit = 5 } = req.query;

            if (!userEmail) {
                return res.status(400).send({ message: "Email is required" });
            }

            const skip = page * limit;

            try {
                const playlist = await playlistCollection.find({ user_email: userEmail })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray();


                const total = await playlistCollection.countDocuments({ user_email: userEmail });

                res.status(200).send({ playlist, total });
            } catch (error) {
                console.error("Error fetching playlist:", error);
                res.status(500).send({ message: "Failed to fetch playlist" });
            }
        });

        // Delete playlist item
        app.delete('/playlist/:id', async (req, res) => {
            try {
                const item_id = new ObjectId(req.params.id);
                const query = { _id: item_id };
                const result = await playlistCollection.deleteOne(query);
                if (!result) return res.status(404).send('Playlist Item not found');
                res.send({ message: 'PLaylist podcast deleted successfully' });
            } catch (error) {
                res.status(500).send('Server error');
            }
        });


        // Playlist End

        // all users data get
        app.get("/users", async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // Request Podcaster
        app.get("/request-podcaster", async (req, res) => {
            const query = { flag: true };
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });

        // get single user data
        app.get("/users/email/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }; // Querying by email
            const result = await userCollection.findOne(query);

            if (result) {
                res.send(result);
            } else {
                res.status(404).send({ message: "User not found" });
            }
        });

        // Update user data by email
        app.put("/users/email/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const { name, username, phoneNumber } = req.body;
            const query = { email: email };

            const update = {
                $set: {
                    name: name,
                    username: username,
                    phoneNumber: phoneNumber,
                },
            };

            try {
                const result = await userCollection.updateOne(query, update);
                if (result.modifiedCount > 0) {
                    res.status(200).send({ message: "User updated successfully" });
                } else {
                    res
                        .status(404)
                        .send({ message: "User not found or no changes made" });
                }
            } catch (error) {
                res.status(500).send({ error: "Error updating user" });
            }
        });

        // Podcast Request accept or decline
        app.put("/users/request/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const { flag, role } = req.body;
            const query = { email: email };

            const update = {
                $set: {
                    flag: flag,
                    role: role,
                },
            };
            try {
                const result = await userCollection.updateOne(query, update);
                if (result.modifiedCount > 0) {
                    res.status(200).send({ message: "User updated successfully" });
                } else {
                    res
                        .status(404)
                        .send({ message: "User not found or no changes made" });
                }
            } catch (error) {
                res.status(500).send({ error: "Error updating user" });
            }
        });

        // users data save to database when a user login
        app.post("/users", async (req, res) => {
            const user = req.body;
            // /* console.log("User data:", user); */
            const query = { email: user?.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User already exists", insertedId: null });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})