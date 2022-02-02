const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
require('dotenv').config()
const app = express();


const server = http.createServer(app);

const io = new Server(server);





let webSocketConnectionsByUserID = {}
let webSocketConnectionsBySocketID = {}
const port = process.env.PORT


app.set('view engine', 'ejs');
app.get('/', (req, res) => {
    res.render("test")
});


app.get("/socket", (req, res) => {
    let userid = req.query.userid
    res.render("socket", { userid })
})

io.on('connection', (socket) => {

    socket.on('register', (userid) => {
        if (webSocketConnectionsByUserID[`${userid}`]) {
            console.log(`user ${userid} is already connected!`)
        } else {
            webSocketConnectionsByUserID[`${userid}`] = socket.id
            webSocketConnectionsBySocketID[`${socket.id}`] = userid

            console.log(`${userid} has joined!`)
        }
    })


    socket.on('disconnect', () => {
        let userId = webSocketConnectionsBySocketID[socket.id]
        delete (webSocketConnectionsByUserID[userId])
        delete (webSocketConnectionsBySocketID[socket.id])
        console.log(`user ${userId}  disconnected`);
    });


});

server.listen(port, () => {
    console.log(`listening on localhost:${port}`);
});
