const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

// servir le dossier client
app.use("/client", express.static(path.join(__dirname, "client")));

// redirection automatique vers le client
app.get("/", (req, res) => {
  res.redirect("/client/index.html");
});

app.listen(PORT, () => console.log("POWCHAIN server running on port " + PORT));