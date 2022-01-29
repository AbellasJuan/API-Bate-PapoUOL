import express, { json } from 'express';
import cors from 'cors';
import { MongoClient } from "mongodb";
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();
const app = express();
app.use(json());
app.use(cors());

const participantSchema = joi.object({
    name: joi.string().required(),
});

const messagesSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.valid('message','private_message').required()
});

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
    db = mongoClient.db("batePapoUOL");
});

app.post('/participants', async (req, res) => {
    try {
        const { name } = req.body;

        const alreadyRegistered = await db.collection('participants').findOne({ name: name });

        if (alreadyRegistered) {
            return res.status(409).send("Nome de usuário já existente")
        }

        const validation = participantSchema.validate(req.body, { abortEarly: false });

        if (validation.error) {
            return res.status(422).send(validation.error.details.map(error => error.message));
        }

        const time = dayjs().locale('pt-br').format('HH:mm:ss');

        await db.collection('participants').insertOne(
            { 
                "name": name,
                "lastStatus": Date.now() 
            }
        );

        await db.collection('messages').insertOne(
            { 
                "from": name,
                "to": "Todos",
                "text": "entra na sala...",
                "type": "message", 
                "time": time 
            }
        );

        res.sendStatus(201);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/participants', async (req, res) => {
    try {
       
        const participants = await db.collection('participants').find({}).toArray();

        res.status(200).send(participants);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/messages', async (req, res) => {

    try{
        const { to, text, type } = req.body;
        const { user } = req.headers;

        const participantRegistered = await db.collection('participants').findOne({ name: user });
    
        if(!participantRegistered){
            return res.status(422).send('O usuário "'+ user + '" não está cadastrado!');
        }    
        
        const validation = messagesSchema.validate(req.body, { abortEarly: false });

        if (validation.error) {
            return res.status(422).send(validation.error.details.map(error => error.message));
        }

        const time = dayjs().locale('pt-br').format('HH:mm:ss');

        await db.collection('messages').insertOne(
            { 
                "from": user,
                "to": to,
                "text": text,
                "type": type,
                "time": time 
            }
        );

        res.sendStatus(201);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
})

app.listen(5000, ()=> (
    console.log('SERVER ON'))
);