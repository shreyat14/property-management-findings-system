require("dotenv").config({ quiet: true });

const { createApp } = require("./app");

const port = process.env.PORT || 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
