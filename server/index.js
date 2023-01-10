const axios = require('axios');
var parseString = require('xml2js').parseString;

const express = require("express");
const app = express();
const port = 4000;

const http = require('http').Server(app);
const cors = require('cors');
app.use(cors());

// queue of requests to server to get and update violating pilots
let pilotsQueue = []
// updated info about every violating pilots
let violatingPilots = [];



// parse drone info into droneInfo
parseDroneInfo = () => { 
    // get request to server with drones info
    axios.get('http://assignments.reaktor.com/birdnest/drones')
    .then(function (res) {
        // parse xml string into js object
        parseString(res.data, function (err, result) {
            if (err) console.log(err);
            let resInfo = result.report.capture[0].drone;

            // turn objects into good shape of {key: value} (from {key: [value]}) and searching for violating drones
            resInfo.forEach((drone) => {
                let newDrone = {}

                Object.keys(drone).forEach(key => {
                    newDrone[key] = drone[key][0];
                });

                // convert to float some values
                newDrone.positionY = parseFloat(drone.positionY)
                newDrone.positionX = parseFloat(drone.positionX)
                newDrone.altitude = parseFloat(drone.altitude)
                newDrone.distance = Math.sqrt(Math.pow(250000 - parseFloat(drone.positionX), 2) + Math.pow(250000 - parseFloat(drone.positionY), 2))

                // if NDZ is violated, pilot added to queue
                if (newDrone.distance < 100000) { 
                    pilotsQueue.push(newDrone)
                }
            })
        });
    })
    .catch(function (error) {
        console.log(error);
    })
}

// parse pilot's information from queue
// *timeout used to remove pilot from list in 10 minutes* 
parsePilotInfo = () => { 
    // break if queue is empty
    if (pilotsQueue.length==0) return;
    lastSeen = () => { 
        let date = new Date()
        const offset = date.getTimezoneOffset()
        date = new Date(date.getTime() - (offset * 60 * 1000))
        return date.toISOString()
    }

    let pilot = pilotsQueue.shift()

    axios.get(`https://assignments.reaktor.com/birdnest/pilots/${pilot.serialNumber}`)
    .then(function (res) {
        Object.assign(pilot, res.data)
        
        // check if pilot already in violation list
        const pilotIdx = violatingPilots.findIndex(pil => pil.pilotId == pilot.pilotId)
        if (pilotIdx!=-1) {
            // if yes, check if he flew closer to center
            if (pilot.distance < violatingPilots[pilotIdx].distance) {
                // cancel timeout deleting pilot
                clearTimeout(violatingPilots[pilotIdx].timeout)
                // remove record of pilot from array
                violatingPilots = [
                    ...violatingPilots.slice(0, pilotIdx),
                    ...violatingPilots.slice(pilotIdx + 1)
                ];

                // add new record to array
                pilot.lastSeen = lastSeen()
                pilot.timeout = setTimeout((pilotId) =>removePilot(pilotId), 10*60*1000, pilot.pilotId)
                violatingPilots.push(pilot)
            }
        } else {
            //create new record of pilot
            pilot.lastSeen = lastSeen()
            pilot.timeout = setTimeout((pilotId) =>removePilot(pilotId), 10*60*1000, pilot.pilotId)
            violatingPilots.push(pilot)
        }

        // sort pilots by time updated
        violatingPilots.sort(function(a, b) {
            return (a < b) ? -1 : ((a > b) ? 1 : 0);
        })

    })
    .catch(function (error) {
        console.log(error);
    })
}

// funtion to find and remove pilot from violating pilots by pilotId
removePilot = (pilotId) => { 
    const pilotIdx = violatingPilots.findIndex(pil => pil.pilotId == pilotId)
    if (pilotIdx != -1) {
        violatingPilots = [
            ...violatingPilots.slice(0, pilotIdx),
            ...violatingPilots.slice(pilotIdx + 1)
        ];
    } 
}

// filter out unnecessary information
mapViolatingPilots = () => { 
    return violatingPilots.map(function (pilot) {
        return { firstName: pilot.firstName, lastName: pilot.lastName, email: pilot.email, phoneNumber: pilot.phoneNumber, distance: pilot.distance, lastSeen: pilot.lastSeen }
    })
}

// parse drone info every 2 seconds
setInterval(function() {
    parseDroneInfo()
}, 2000);

// parse and update violated pilots in queue
setInterval(function() {
    parsePilotInfo()
}, 2000);



const socketIO = require('socket.io')(http, {
    cors: {
        origin: "*"
    }
});

socketIO.on('connection', (socket) => {
    //console.log(`${socket.id} connected!`);

    socket.broadcast.emit("update", JSON.stringify(mapViolatingPilots()));
    setInterval(function () {
        socket.broadcast.emit("update", JSON.stringify(mapViolatingPilots()));
    }, 2000);
});

http.listen(port, function () {
    console.log(`Example app listening on port ${port}!`);
});