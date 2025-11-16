function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

document.getElementById("fire").addEventListener("click", async () => {
    document.getElementById("container").classList.add('start');

    document.getElementById("count").innerText = '3';
    await sleep(1000);
    document.getElementById("count").innerText = '2';
    await sleep(1000);
    document.getElementById("count").innerText = '1';
    await sleep(1000);
    document.getElementById("count").innerText = '';

    fetch("http://192.168.8.8/fire") // URL de ejemplo
        .then(response => response.json())
        .then(data => {
            document.getElementById("container").classList.remove('start');
            document.getElementById("responseBox").hidden = false;
            document.getElementById("responseBox").textContent =
                JSON.stringify('BOOOM!', null, 2);
        })
        .catch(error => {
            document.getElementById("container").classList.remove('start');
            document.getElementById("responseBox").hidden = false;
            document.getElementById("responseBox").textContent =
                "Error: Asegurate de estar conectado al dispositivo correcto...";
        });
});
