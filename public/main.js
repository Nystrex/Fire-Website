let eventSrc = new EventSource("https://api.gaminggeek.dev/realtime");
eventSrc.onmessage = function(res) {
    let data = JSON.parse(res.data);
    let guild = data.id;
    let members = document.getElementById(`${guild}-members`);
    let online = document.getElementById(`${guild}-online`);
    members.innerHTML = `<strong>${data.members}</strong>&nbsp;Members`;
    online.innerHTML = `<strong>${data.online}</strong>&nbsp;Online`;
};
