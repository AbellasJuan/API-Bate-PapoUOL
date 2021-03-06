import express, { json } from 'express';
import cors from 'cors';
import { MongoClient, ObjectId} from "mongodb";
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';
import { stripHtml } from 'string-strip-html';

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
        const { name } = req.body;
        const newName = stripHtml(name).result.trim();
        
    try {
        const alreadyRegistered = await db.collection('participants').findOne({ name: newName });

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
                "name": newName,
                "lastStatus": Date.now() 
            }
        );

        await db.collection('messages').insertOne(
            { 
                "from": newName,
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
        const { to, text, type } = req.body;
        const { user } = req.headers;
        const newUser = stripHtml(user).result.trim();

    try{
        const participantRegistered = await db.collection('participants').findOne({ name: newUser });
    
        if(!participantRegistered){
            return res.status(422).send('O usuário "'+ newUser + '" não está cadastrado!');
        }    
        
        const validation = messagesSchema.validate(req.body, { abortEarly: false });

        if (validation.error) {
            return res.status(422).send(validation.error.details.map(error => error.message));
        }

        const time = dayjs().locale('pt-br').format('HH:mm:ss');

        await db.collection('messages').insertOne(
            { 
                "from": newUser,
                "to": stripHtml(to).result.trim(),
                "text": stripHtml(text).result.trim(),
                "type": type,
                "time": time 
            }
        );
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/messages', async (req, res) => {
        const { user } = req.headers; 
        const { limit } = req.query;
        const newUser = stripHtml(user).result.trim();

    try {
        if(!user){
            return res.status(404).send('Insira um usuário!')
        }

        const validParticipant = await db.collection('participants').findOne({ name: newUser});
        if(!validParticipant){
            return res.status(404).send('Insira um usuário válido!')
        }
        
        const messages = await db.collection('messages').find({}).toArray();
              
        function validateMessage(message){
            if(message.type === "message" || message.type === "status" || message.from === newUser || message.to === newUser){
                
                return true;
            }
        };
    
        const allowedMessages = messages.filter(validateMessage);

        if(limit){
            const especificNumberOftMessages = [...allowedMessages].slice(-limit); 
            return res.status(200).send(especificNumberOftMessages);
        }

        res.status(200).send(allowedMessages);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/status', async (req, res) =>{  
    const { user } = req.headers;
    const newUser = stripHtml(user).result.trim();

    try {  
        const validParticipant = await db.collection('participants').findOne({ name: newUser});
        
        if(!validParticipant || !user ){
            return res.sendStatus(404);
        }

        await db.collection('participants').updateOne(
            { name: newUser },
            { $set: { lastStatus: Date.now() }}
        );

        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.delete('/messages/:id', async (req, res) => {
    const { user } = req.headers;
    const { id } = req.params;
    const newUser = stripHtml(user).result.trim();
  
    try {    
        const messageToBeDeleted = await db.collection("messages").findOne({ _id: new ObjectId(id) });

        if(messageToBeDeleted.from !== newUser){
            return res.sendStatus(401);
        }

        if(!messageToBeDeleted){
            return res.sendStatus(404);
        }

        await db.collection("messages").deleteOne({ _id: new ObjectId(id) });
        res.sendStatus(200);
    }  catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

async function removeInactiveParticipants(){
    const participants = await db.collection('participants').find({}).toArray();
    const time = dayjs().locale('pt-br').format('HH:mm:ss');
    
    participants.forEach( async (participant) => {
        if(Date.now() - participant.lastStatus > 10000){
            await db.collection("messages").insertOne(
                {
                    from: participant.name,
                    to: "Todos",
                    text: "sai da sala...",
                    type: "status",
                    time: time
                }
            );

            await db.collection("participants").deleteOne(
                { 
                    _id: new ObjectId(participant._id)
                }
            )
        };
    });
};

setInterval(removeInactiveParticipants, 15000);

app.listen(5000);