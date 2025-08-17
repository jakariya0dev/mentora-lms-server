const connectDB = require("../config/dbConnection");

const verifyRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const db = await connectDB();
      const userCollection = db.collection("users");
      const userEmail = req.user.email;
      const user = await userCollection.findOne({ email: userEmail });

      if (!user || !allowedRoles.includes(user.role)) {
        console.error("Unauthorized role");
        return res
          .status(403)
          .send({ error: "Unauthorized access", message: "Invalid role" });
      }

      next();
    } catch (err) {
      console.error("Role verification failed:", err.message);
      res
        .status(500)
        .send({ error: err.message, message: "Role verification failed" });
    }
  };
};

module.exports = verifyRole;
