const express = require('express');
const mysql = require('mysql2');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'polling_app'
});

connection.connect(err => {
    if (err) throw err;
    console.log('Database connected!');
});

// REST API
app.get('/polls', (req, res) => {
    connection.query('SELECT * FROM polls', (error, results) => {
        if (error) throw error;
        res.json(results);
    });
});

app.post('/polls', (req, res) => {
    const { question, option1, option2 } = req.body;
    connection.query('INSERT INTO polls (question, option1, option2) VALUES (?, ?, ?)', [question, option1, option2], (error, results) => {
        if (error) throw error;
        res.json({ id: results.insertId });
        broadcastPollResults();
    });
});

app.post('/vote', (req, res) => {
    const { pollId, option } = req.body;
    const column = option === 'option1' ? 'votes1' : 'votes2';
    connection.query(`UPDATE polls SET ${column} = ${column} + 1 WHERE id = ?`, [pollId], (error) => {
        if (error) throw error;
        res.sendStatus(200);
        broadcastPollResults();
    });
});

app.delete('/polls/:id', (req, res) => {
    const { id } = req.params;
    connection.query('DELETE FROM polls WHERE id = ?', [id], (error) => {
        if (error) throw error;
        res.sendStatus(200);
        broadcastPollResults();
    });
});

app.get('/poll-visibility', (req, res) => {
    connection.query('SELECT COUNT(*) AS pollCount FROM polls', (error, results) => {
        if (error) throw error;
        const pollCreated = results[0].pollCount > 0;
        res.json({ pollCreated });
    });
});

//Melaukan setup pada webscoket
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', ws => {
    ws.on('message', message => {
        console.log('received: %s', message);
    });
});

const broadcastPollResults = () => {
    connection.query('SELECT * FROM polls', (error, results) => {
        if (error) throw error;
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(results));
            }
        });
    });
};

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
