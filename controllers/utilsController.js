const ImageKit = require("imagekit");
const connectDB = require("../db");

let usersCollection;
let coursesCollection;
let enrollmentsCollection;

(async () => {
  const db = await connectDB();
  usersCollection = db.collection("users");
  coursesCollection = db.collection("courses");
  enrollmentsCollection = db.collection("enrollments");
})();

// GET ImageKit signature
const getIKSignature = async (req, res) => {
  try {
    const imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: "https://ik.imagekit.io/jakariya",
    });

    const authParams = imagekit.getAuthenticationParameters();
    res.status(200).json(authParams);
  } catch (err) {
    console.error("Error generating ImageKit signature:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET statistics (users, courses, enrollments)
const getStatistics = async (req, res) => {
  try {
    const totalUsers = await usersCollection.estimatedDocumentCount();
    const totalCourses = await coursesCollection.estimatedDocumentCount();
    const totalEnrollments =
      await enrollmentsCollection.estimatedDocumentCount();

    res.status(200).json({
      success: true,
      message: "Statistics fetched successfully",
      data: {
        totalUsers,
        totalCourses,
        totalEnrollments,
      },
    });
  } catch (err) {
    console.error("Error fetching statistics:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getIKSignature,
  getStatistics,
};
