const socket = new WebSocket("ws://localhost:8765");
socket.onopen = () => {
  //console.log("JS: WS opened");
  socket.send(JSON.stringify({ hello: "js" }));
};
socket.onmessage = async (ev) => {
  const data = JSON.parse(ev.data);
  //console.log("JS: received:", data);



function resetFullGame() {
    //console.log("JS: FULL RESET");
    window.game = initGame();   // MUSI być globalne
}


if (data.type === "reset") {
    //console.log("JS: RESET BEGIN");

    resetFullGame();
    //console.log("JS: RESET done");

    const obs = buildObservation(game);
    //console.log("JS: OBS built");

    socket.send(JSON.stringify({ type: "reset_ok", obs }));
    //console.log("JS: reset_ok SENT");
}


  if (data.type === "action") {
    //console.log("JS: ACTION", data.action);
    applyDefenderAction(game, data.action);
    await runTurnPhases(game);
    const obs = buildObservation(game);
    const reward = computeReward(game);
    const done = game.over;
    socket.send(JSON.stringify({ type: "transition", obs, reward, done }));
  }
};