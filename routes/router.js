const router = require("express").Router();
const { ObjectId } = require("mongodb");
const ImageKit = require("imagekit");
const connectDB = require("../db");
const verifyToken = require("../middlewares/verifyToken");
const verifyRole = require("../middlewares/verifyRole");

const userController = require("../controllers/userController");
const courseController = require("../controllers/courseController");
const enrollmentController = require("../controllers/enrollmentController");
const assignmentController = require("../controllers/assignmentController");
const feedbackController = require("../controllers/feedbackController");

async function run() {
  try {
    //  ==================================================
    //  ||             User Management                   ||
    //  ==================================================

    // POST /users (Create a user)
    router.post("/users", userController.createNewUser);

    // GET /users/:email (Get user by email)
    router.get("/users/:email", userController.getUserByEmail);

    // POST /be-teacher/:userEmail (Create a teacher)
    router.post(
      "/be-teacher/:userEmail",
      verifyToken,
      userController.createNewTeacher
    );

    // GET /teachers (Get all teachers)
    router.get(
      "/teachers",
      verifyToken,
      verifyRole(["admin"]),
      userController.getAllTeachers
    );

    // PATCH /change-teacher-status/:id (approve or reject teacher)
    router.patch(
      "/change-teacher-status/:id",
      verifyToken,
      verifyRole(["admin"]),
      userController.changeTeacherStatus
    );

    // GET /users?search=somequery (Search Users) with pagination
    router.get(
      "/users",
      verifyToken,
      verifyRole(["admin"]),
      userController.searchUsers
    );

    // PATCH /users/admin/:id (Make Admin)
    router.patch(
      "/users/admin/:id",
      verifyToken,
      verifyRole(["admin"]),
      userController.makeAdmin
    );

    //  ==================================================
    //  ||             Course Section                   ||
    //  ==================================================

    // Admin routes
    router.get(
      "/courses/all",
      verifyToken,
      verifyRole(["admin"]),
      courseController.getAllCoursesAdmin
    );
    router.patch(
      "/courses/change-status/:id",
      verifyToken,
      verifyRole(["admin"]),
      courseController.changeCourseStatus
    );

    // Teacher routes
    router.get(
      "/courses/teacher/:email",
      verifyToken,
      verifyRole(["teacher"]),
      courseController.getCoursesByTeacher
    );
    router.post(
      "/courses/add",
      verifyToken,
      verifyRole(["teacher"]),
      courseController.addCourse
    );
    router.patch(
      "/courses/:id",
      verifyToken,
      verifyRole(["teacher"]),
      courseController.updateCourse
    );
    router.delete(
      "/courses/:id",
      verifyToken,
      verifyRole(["teacher"]),
      courseController.deleteCourse
    );

    // Public routes
    router.get("/courses", courseController.getApprovedCourses);
    router.get("/courses/popular", courseController.getPopularCourses);
    router.get("/courses/new", courseController.getNewCourses);
    router.get("/courses/:id", courseController.getCourseById);

    // Enrolled courses (protected)
    router.get(
      "/courses/enrolled/:email",
      verifyToken,
      courseController.getEnrolledCourses
    );

    //  ==================================================
    //  ||             Enrollments Section               ||
    //  ==================================================

    // GET all enrollments of a course
    router.get("/:courseId", enrollmentControllergetEnrollmentsByCourseId);

    // POST a new enrollment
    router.post("/", enrollmentControlleraddEnrollment);

    //  ==================================================
    //  ||             Assignment & Submission Section                   ||
    //  ==================================================

    // POST a new assignment
    router.post(
      "/assignments",
      verifyToken,
      verifyRole(["teacher"]),
      assignmentController.addAssignment
    );

    // GET assignments of a course for a student
    router.get(
      "/assignments/:courseId/:studentEmail",
      verifyToken,
      assignmentController.getAssignmentsByCourseAndStudent
    );

    // GET all assignments of a course
    router.get(
      "/assignments/:courseId",
      assignmentController.getAssignmentsByCourse
    );

    // GET all submissions of a course
    router.get(
      "/submissions/:courseId",
      verifyToken,
      assignmentController.getSubmissionsByCourse
    );

    // POST a new submission
    router.post(
      "/submissions",
      verifyToken,
      assignmentController.addSubmission
    );

    //  ==================================================
    //  ||             Feedback Section                   ||
    //  ==================================================

    // POST a new feedback
    router.post(
      "/",
      verifyToken,
      verifyRole(["student"]),
      feedbackController.addFeedback
    );

    // GET all feedbacks
    router.get("/", feedbackController.getFeedbacks);

    // PATCH a feedback by id
    router.patch(
      "/:id",
      verifyToken,
      verifyRole(["student"]),
      feedbackController.updateFeedback
    );

    //  ==================================================
    //  ||             others Section                     ||
    //  ==================================================

    // upload image to imagekit.io
    router.get("/get-ik-signature", async (req, res) => {
      var imagekit = new ImageKit({
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
        urlEndpoint: "https://ik.imagekit.io/jakariya",
      });

      const authParams = imagekit.getAuthenticationParameters();
      res.status(200).json(authParams);
    });

    // Sripe Payment Integration
    router.post("/create-payment-intent", async (req, res) => {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const { amount } = req.body;
      if (!amount || typeof amount !== "number") {
        return res.status(400).send({ error: "Invalid amount" });
      }

      if (amount < 0) {
        return res.status(400).send({ error: "Amount cannot be negative" });
      }

      const amountInCents = Math.round(amount * 100);

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // GET /users (Fetch all users)
    router.get("/statistics", async (req, res) => {
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
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}

run();

module.exports = router;
