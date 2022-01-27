import express from 'express';

const app = express();
app.use(express.json());

const results = [];

app.post('/teste', (req, res) => {
    const result = req.body;
    results.push(result)
    res.sendStatus(201);
});

app.get('/teste', (req, res) => {
    res.status(200).send(results);
});

app.listen(5000, ()=> (
    console.log('SERVER ON'))
);