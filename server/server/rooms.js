const rooms = new Map();


function createRoom(socketId) {

    let code;

    do {

        code =
            Math.random()
                .toString(36)
                .substring(2, 7)
                .toUpperCase();

    } while (rooms.has(code));


    rooms.set(code, {

        player1: socketId,

        player2: null,

        secretPlayer: null,

        currentQuestion: "",

        questionCount: 0,

        guessCount: 0,

        hintsUsed: 0,

        player1Score: 0,

        player2Score: 0

    });


    return code;

}


function getRoom(code) {

    return rooms.get(code);

}


function deleteRoom(code) {

    rooms.delete(code);

}


module.exports = {

    rooms,

    createRoom,

    getRoom,

    deleteRoom

};
