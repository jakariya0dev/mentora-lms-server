const { ObjectId } = require("mongodb");
const connectDB = require("../db");

let enrollmentsCollection;

(async () => {
  const db = await connectDB();
  enrollmentsCollection = db.collection("enrollments");
})();

// GET /enrollments/:courseId (Fetch all enrollments of a course)
const getEnrollmentsByCourseId = async (req, res) => {
  const courseId = req.params.courseId;
  const query = { courseId: courseId };

  try {
    const enrollments = await enrollmentsCollection.find(query).toArray();

    if (enrollments.length > 0) {
      res.status(200).json({
        success: true,
        message: "Enrollments fetched successfully",
        enrollments,
      });
    } else {
      res.status(202).json({
        success: false,
        message: "No enrollments found",
        enrollments: [],
      });
    }
  } catch (err) {
    console.error("Error fetching enrollments:", err);
    res.status(500).send({ message: "Internal server error" });
  }
};

// POST /enrollments (Enroll a user in a course)
const addEnrollment = async (req, res) => {
  const enrollment = {
    ...req.body,
    courseId: new ObjectId(req.body.courseId),
    createdAt: new Date(),
  };

  try {
    const result = await enrollmentsCollection.insertOne(enrollment);
    if (result.acknowledged) {
      res.status(200).json({
        success: true,
        message: "Enrollment added successfully",
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to add enrollment",
        data: result,
      });
    }
  } catch (err) {
    console.error("Error adding enrollment:", err);
    res.status(500).send({ message: "Internal server error", success: false });
  }
};

module.exports = {
  getEnrollmentsByCourseId,
  addEnrollment,
};
