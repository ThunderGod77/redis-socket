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

//lets system notify the user
app.post("/notify", async(req, res) => {
    let { receiverId, msg } = req.body
    
    if (receiverId === "") {
        return res.status(400).json({err:new Error("receiverId is not valid")})
    }else{
        let data = {
            msg, senderId: "notification from system", receiverId
        }
        //publishes the message to redis
        try {
            await publisher.publish("chat", JSON.stringify(data))

        } catch (err) {
            console.log(err)
            return res.status(500).json({err})
        }
        return res.status(200).json({msg:"successfully published the message!"})
    }

})

//actual page with socket.io connection
app.get("/socket", (req, res) => {
    let userid = req.query.userid
    res.render("socket", { userid })
})






io.on('connection', (socket) => {

    //to register the client on backend
    socket.on('register', (userid) => {
        if (webSocketConnectionsByUserID[`${userid}`]) {
            console.log(`user ${userid} is already connected!`)
            socket.emit("receive-error")
        } else {
            webSocketConnectionsByUserID[`${userid}`] = { socketid: socket.id, socket: socket }
            //allows us to remove user by socket id when user disconnects
            webSocketConnectionsBySocketID[`${socket.id}`] = userid

            console.log(`${userid} has joined!`)
        }
    })

    socket.on('message', async (msg, senderId, receiverId) => {
        //checks if receiver belongs to the server...if not publishes the message to redis
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
        //checks if receiver exists on this server
        if (webSocketConnectionsByUserID[`${obj.receiverId}`]) {

            
            let socket = (webSocketConnectionsByUserID[`${obj.receiverId}`]).socket


            socket.emit("receive-message", obj.msg, obj.senderId)

        } else {
            console.log(`user with ${obj.receiverId} is not present`)
        }

    });



});
