const { ObjectId } = require("mongodb");
const connectDB = require("../config/dbConnection");

let assignmentsCollection;
let submissionsCollection;

(async () => {
  const db = await connectDB();
  assignmentsCollection = db.collection("assignments");
  submissionsCollection = db.collection("submissions");
})();

// POST /assignments (Add a new assignment by Teacher)
const addAssignment = async (req, res) => {
  const assignment = {
    ...req.body,
    courseId: new ObjectId(req.body.courseId),
    createdAt: new Date(),
  };
  try {
    const result = await assignmentsCollection.insertOne(assignment);
    if (result.acknowledged) {
      res.status(200).json({
        success: true,
        message: "Assignment added successfully",
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to add assignment",
        data: result,
      });
    }
  } catch (err) {
    console.error("Error adding assignment:", err);
    res.status(500).send({ message: "Internal server error", success: false });
  }
};

// GET /assignments/:courseId/:studentEmail
// Fetch all assignments of a course of specific student with submissions
const getAssignmentsByCourseAndStudent = async (req, res) => {
  const courseId = new ObjectId(req.params.courseId);
  const studentEmail = req.params.studentEmail;

  try {
    const assignments = await assignmentsCollection
      .aggregate([
        { $match: { courseId: new ObjectId(courseId) } },
        {
          $lookup: {
            from: "courses",
            localField: "courseId",
            foreignField: "_id",
            as: "courseInfo",
          },
        },
        {
          $lookup: {
            from: "submissions",
            localField: "_id",
            foreignField: "assignmentId",
            as: "studentSubmission",
          },
        },
      ])
      .toArray();

    if (assignments.length > 0) {
      res.status(200).json({
        success: true,
        message: "Assignments with student submissions fetched successfully",
        assignments,
      });
    } else {
      res.status(202).json({
        success: false,
        message: "No assignments found",
        assignments: [],
      });
    }
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).send({ message: "Internal server error" });
  }
};

// GET /assignments/:courseId (Fetch all assignments of a course)
const getAssignmentsByCourse = async (req, res) => {
  const courseId = req.params.courseId;
  const query = { courseId: new ObjectId(courseId) };

  try {
    const assignments = await assignmentsCollection.find(query).toArray();
    if (assignments.length > 0) {
      res.status(200).json({
        success: true,
        message: "Assignments fetched successfully",
        assignments,
      });
    } else {
      res.status(202).json({
        success: false,
        message: "No assignments found",
        assignments: [],
      });
    }
  } catch (err) {
    console.error("Error fetching assignments:", err);
    res.status(500).send({ message: "Internal server error" });
  }
};

// GET /submissions/:courseId
const getSubmissionsByCourse = async (req, res) => {
  const courseId = req.params.courseId;
  const studentEmail = req.query?.studentEmail || "";
  let query = { courseId: new ObjectId(courseId) };
  if (studentEmail) query.studentEmail = studentEmail;

  try {
    const submissions = await submissionsCollection.find(query).toArray();
    if (submissions.length > 0) {
      res.status(200).json({
        success: true,
        message: "Submissions fetched successfully",
        submissions,
      });
    } else {
      res.status(202).json({
        success: false,
        message: "No submissions found",
        submissions: [],
      });
    }
  } catch (err) {
    console.error("Error fetching submissions:", err);
    res.status(500).send({ message: "Internal server error" });
  }
};

// POST /submissions (Add a new submission by Student)
const addSubmission = async (req, res) => {
  const submission = {
    ...req.body,
    assignmentId: new ObjectId(req.body.assignmentId),
    courseId: new ObjectId(req.body.courseId),
    createdAt: new Date(),
  };
  try {
    const result = await submissionsCollection.insertOne(submission);
    if (result.acknowledged) {
      res.status(200).json({
        success: true,
        message: "Submission added successfully",
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to add submission",
        data: result,
      });
    }
  } catch (err) {
    console.error("Error adding submission:", err);
    res.status(500).send({ message: "Internal server error", success: false });
  }
};

module.exports = {
  addAssignment,
  getAssignmentsByCourseAndStudent,
  getAssignmentsByCourse,
  getSubmissionsByCourse,
  addSubmission,
};
