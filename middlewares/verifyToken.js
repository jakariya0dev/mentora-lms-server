const admin = require("../firebase/firebaseAdmin");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // console.log("authHeader", req.headers);

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({
      error: "Unauthorized access",
      message: "Missing or invalid token",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(403).send({ error: "Invalid or expired token" });
  }
};

module.exports = verifyToken;
