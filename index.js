const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
require('dotenv').config()
const app = express();
const redis = require("redis");



const server = http.createServer(app);

const io = new Server(server);

const publisher = redis.createClient({ password: "sOmE_sEcUrE_pAsS" })
const subscriber = publisher.duplicate();




let webSocketConnectionsByUserID = {}
let webSocketConnectionsBySocketID = {}
const port = process.env.PORT


app.set('view engine', 'ejs');
app.use(express.json());
app.get('/', (req, res) => {
    res.render("test")
});

app.post("/notify", async(req, res) => {
    let { receiverId, msg } = req.body
    let data = {
        msg, senderId: "notification from system", receiverId
    }
    if (receiverId === "") {
        return res.status(400).json({err:new Error("receiverId is not valid")})
    }else{
        try {
            await publisher.publish("chat", JSON.stringify(data))

        } catch (err) {
            console.log(err)
            return res.status(500).json({err})
        }
        return res.status(200).json({msg:"successfully published the message!"})
    }

})


app.get("/socket", (req, res) => {
    let userid = req.query.userid
    res.render("socket", { userid })
})






io.on('connection', (socket) => {

    socket.on('register', (userid) => {
        if (webSocketConnectionsByUserID[`${userid}`]) {
            console.log(`user ${userid} is already connected!`)
        } else {
            webSocketConnectionsByUserID[`${userid}`] = { socketid: socket.id, socket: socket }
            webSocketConnectionsBySocketID[`${socket.id}`] = userid

            console.log(`${userid} has joined!`)
        }
    })

    socket.on('message', async (msg, senderId, receiverId) => {

        if (webSocketConnectionsByUserID[`${receiverId}`]) {
            let receiverSocketId = (webSocketConnectionsByUserID[receiverId]).socketid

            socket.to(receiverSocketId).emit("receive-message", msg, senderId)

        } else {
            let data = {
                msg, senderId, receiverId
            }

            try {
                await publisher.publish("chat", JSON.stringify(data))

            } catch (err) {
                console.log(err)
            }


        }
    })

    socket.on('disconnect', () => {
        let userId = webSocketConnectionsBySocketID[socket.id]
        delete (webSocketConnectionsByUserID[`${userId}`])
        delete (webSocketConnectionsBySocketID[socket.id])
        console.log(`user ${userId}  disconnected`);
    });


});

Promise.all([subscriber.connect(), publisher.connect()]).then(async () => {
    server.listen(port, async () => {
        console.log(`listening on localhost:${port}`);
    });
    await subscriber.subscribe('chat', (message) => {
        const obj = JSON.parse(message);
        console.log(obj)
        if (webSocketConnectionsByUserID[`${obj.receiverId}`]) {

            let sid = (webSocketConnectionsByUserID[`${obj.receiverId}`]).socketid
            let socket = (webSocketConnectionsByUserID[`${obj.receiverId}`]).socket


            socket.emit("receive-message", obj.msg, obj.senderId)

        } else {
            console.log(`user with ${obj.receiverId} is not present`)
        }

    });



});
