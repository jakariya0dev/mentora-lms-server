require("dotenv").config();
const express = require("express");
const cors = require("cors");
const router = require("./routes/router");

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());
app.use("/", router);
app.get("/", (req, res) => {
  res.json({
    message: "Mentora LMS API Running",
  });
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
