const { ObjectId } = require("mongodb");
const connectDB = require("../db");

let feedbacksCollection;

(async () => {
  const db = await connectDB();
  feedbacksCollection = db.collection("feedbacks");
})();

// POST /feedbacks (Add a new feedback by Student)
const addFeedback = async (req, res) => {
  const feedback = {
    ...req.body,
    courseId: new ObjectId(req.body.courseId),
    createdAt: new Date(),
  };
  try {
    const result = await feedbacksCollection.insertOne(feedback);
    if (result.acknowledged) {
      res.status(200).json({
        success: true,
        message: "Feedback added successfully",
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to add feedback",
        data: result,
      });
    }
  } catch (err) {
    console.error("Error adding feedback:", err);
    res.status(500).send({ message: "Internal server error", success: false });
  }
};

// GET /feedbacks?courseId=xxx&studentEmail=yyy
// Fetch all feedbacks of a course or a specific student
const getFeedbacks = async (req, res) => {
  const courseId = req.query?.courseId;
  const studentEmail = req.query?.studentEmail;

  const query = {};
  if (courseId) query.courseId = new ObjectId(courseId);
  if (studentEmail) query.studentEmail = studentEmail;

  const pipeline = [
    { $match: query },
    {
      $lookup: {
        from: "users",
        localField: "studentEmail",
        foreignField: "email",
        as: "userInfo",
      },
    },
    {
      $lookup: {
        from: "courses",
        localField: "courseId",
        foreignField: "_id",
        as: "courseInfo",
      },
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$courseInfo", preserveNullAndEmptyArrays: true } },
    { $sort: { rating: -1 } },
    { $limit: 6 },
  ];

  try {
    const feedbacks = await feedbacksCollection.aggregate(pipeline).toArray();
    if (feedbacks.length > 0) {
      res.status(200).json({
        success: true,
        message: "Feedbacks fetched successfully",
        feedbacks,
      });
    } else {
      res.status(202).json({
        success: true,
        message: "No feedbacks found",
        feedbacks: [],
      });
    }
  } catch (err) {
    console.error("Error fetching feedbacks:", err);
    res.status(500).send({ message: "Internal server error" });
  }
};

// PATCH /feedbacks/:id (Update a feedback by Student)
const updateFeedback = async (req, res) => {
  const id = req.params.id;
  try {
    const result = await feedbacksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: req.body }
    );
    if (result.acknowledged) {
      res.status(200).json({
        success: true,
        message: "Feedback updated successfully",
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to update feedback",
        data: result,
      });
    }
  } catch (err) {
    console.error("Error updating feedback:", err);
    res.status(500).send({ message: "Internal server error", success: false });
  }
};

module.exports = {
  addFeedback,
  getFeedbacks,
  updateFeedback,
};
