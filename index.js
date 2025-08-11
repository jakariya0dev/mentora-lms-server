require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
var ImageKit = require("imagekit");
const connectDB = require("./db");

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());
const verifyToken = require("./middlewares/verifyToken");
const verifyRole = require("./middlewares/verifyRole");

async function run() {
  try {
    const db = await connectDB();

    const usersCollection = db.collection("users");
    const reviewsCollection = db.collection("reviews");
    const coursesCollection = db.collection("courses");
    const enrollmentsCollection = db.collection("enrollments");
    const assignmentsCollection = db.collection("assignments");
    const submissionsCollection = db.collection("submissions");
    const feedbacksCollection = db.collection("feedbacks");

    // Sample route
    app.get("/", async (req, res) => {
      res.send("Mentora Backend Running");
    });

    //  ==================================================
    //  ||             User Management                   ||
    //  ==================================================

    // POST /users (Create a user)
    app.post("/users", async (req, res) => {
      const user = req.body;

      // return if user already exists
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.json({
          message: "User already exists",
        });
      }

      try {
        const result = await usersCollection.insertOne({
          ...user,
          role: "student",
          createdAt: new Date(),
        });
        if (result.acknowledged) {
          res.status(201).json({
            status: "success",
            message: "User created successfully",
            data: result,
          });
        } else {
          res.status(400).json({
            status: "error",
            message: "User creation failed",
          });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({
          status: "error",
          message: "Internal server error",
        });
      }
    });

    // GET /users/:email (Get user by email)
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });

      try {
        if (user) {
          res.status(200).json(user);
        } else {
          res.status(404).json({ message: "User not found", status: "error" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({
          status: "error",
          message: "Internal server error",
        });
      }
    });

    // POST /be-teacher/:userEmail (Create a teacher)
    app.post("/be-teacher/:userEmail", verifyToken, async (req, res) => {
      const teacher = req.body;
      const userEmail = req.params.userEmail;
      const filter = { email: userEmail };

      const updateDoc = {
        $set: {
          role: "teacher",
          status: "pending",
          ...teacher,
        },
      };

      try {
        const result = await usersCollection.updateOne(filter, updateDoc);
        if (result.acknowledged) {
          res.status(201).json({
            status: "success",
            message: "Teacher created successfully",
            data: result,
          });
        } else {
          res.status(400).json({
            status: "error",
            message: "Teacher creation failed",
          });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({
          status: "error",
          message: "Internal server error",
        });
      }
    });

    // GET /teachers (Get all teachers)
    app.get(
      "/teachers",
      verifyToken,
      verifyRole(["admin"]),
      async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        const pipeline = [
          { $match: { role: "teacher" } },
          {
            $addFields: {
              statusOrder: {
                $cond: [{ $eq: ["$status", "pending"] }, 0, 1],
              },
            },
          },
          { $sort: { statusOrder: 1, status: 1 } },
          { $skip: skip },
          { $limit: limit },
        ];

        try {
          const totalTeachers = await usersCollection.countDocuments({
            role: "teacher",
          });
          const totalPages = Math.ceil(totalTeachers / limit);
          const result = await usersCollection.aggregate(pipeline).toArray();
          res.status(200).json({
            status: "success",
            message: "Teachers fetched successfully",
            teachers: result,
            totalTeachers,
            totalPages,
            currentPage: page,
            hasNextPage: page < totalPages,
          });
        } catch (error) {
          console.error(error);
          res.status(500).json({
            status: "error",
            message: "Internal server error",
          });
        }
      }
    );

    // PATCH /change-teacher-status/:id (approve or reject teacher)
    app.patch(
      "/change-teacher-status/:id",
      verifyToken,
      verifyRole(["admin"]),
      async (req, res) => {
        const id = req.params.id;

        const { status } = req.body;

        try {
          const filter = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: {
              status,
              role: "teacher",
            },
          };

          const result = await usersCollection.updateOne(filter, updateDoc);
          if (result.acknowledged) {
            res.status(201).json({
              status: "success",
              message: "Teacher status updated successfully",
              data: result,
            });
          } else {
            res.status(400).json({
              status: "error",
              message: "Teacher status update failed",
            });
          }
        } catch (error) {
          console.error(error);
          res.status(500).json({
            status: "error",
            message: "Internal server error",
          });
        }
      }
    );

    // GET /users?search=somequery (Search Users) with pagination
    app.get("/users", verifyToken, verifyRole(["admin"]), async (req, res) => {
      const search = req.query.search || "";
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;
      const skip = (page - 1) * limit;

      const query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      };

      try {
        const totalUsers = await usersCollection.countDocuments();
        const totalPages = Math.ceil(totalUsers / limit);
        const users = await usersCollection
          .find(query)
          .skip(skip)
          .limit(limit)
          .toArray();

        if (users.length > 0) {
          res.status(200).json({
            status: "success",
            message: "Users fetched successfully",
            users,
            totalUsers,
            totalPages,
            currentPage: page,
            hasNextPage: page < totalPages,
          });
        } else {
          res.status(200).json({
            status: "error",
            message: "No users found",
            users: [],
          });
        }
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to fetch users", success: false });
      }
    });

    // PATCH /users/admin/:id (Make Admin)
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyRole(["admin"]),
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const update = { $set: { role: "admin" } };

        try {
          const result = await usersCollection.updateOne(filter, update);
          res.status(200).json({ message: "User updated successfully" });
        } catch (err) {
          res.status(500).json({ message: "Failed to update user" });
        }
      }
    );

    //  ==================================================
    //  ||             Course Section                   ||
    //  ==================================================

    // GET /courses (Get all courses with pagination for admin)
    // GET /courses/all?page=1&limit=10
    app.get(
      "/courses/all",
      verifyToken,
      verifyRole(["admin"]),
      async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        try {
          const totalCourses = await coursesCollection.countDocuments();
          const totalPages = Math.ceil(totalCourses / limit);

          const courses = await coursesCollection
            .find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

          if (courses.length > 0) {
            res.status(200).json({
              success: true,
              message: "Courses fetched successfully",
              currentPage: page,
              courses,
              totalCourses,
              totalPages,
              hasNextPage: page < totalPages,
            });
          } else {
            res.status(200).json({
              success: true,
              message: "No courses found",
              courses: [],
            });
          }
        } catch (err) {
          res.status(500).json({
            success: false,
            message: "Failed to load courses",
            error: err.message,
          });
        }
      }
    );

    // GET /courses (Get all APPROVED courses with pagination and search for users)
    app.get("/courses", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 9;
      const search = req.query.searchTerm || "";
      const skip = (page - 1) * limit;

      // Define the aggregation pipeline
      const pipeline = [
        { $match: { status: "approved" } },
        {
          $lookup: {
            from: "users",
            localField: "instructorEmail",
            foreignField: "email",
            as: "instructor",
          },
        },
        {
          $lookup: {
            from: "enrollments",
            localField: "_id",
            foreignField: "courseId",
            as: "enrollments",
          },
        },
        {
          $addFields: {
            totalEnrollments: { $size: "$enrollments" },
          },
        },

        { $skip: skip },
        { $limit: limit },
      ];

      // If search term is provided, add a match stage to the pipeline
      if (search) {
        pipeline.unshift({
          $match: {
            title: { $regex: search, $options: "i" },
          },
        });
      }

      // Execute the aggregation pipeline

      let totalCourses = await coursesCollection.countDocuments({
        status: "approved",
      });
      if (search) {
        totalCourses = await coursesCollection.countDocuments({
          title: { $regex: search, $options: "i" },
          status: "approved",
        });
      }
      const totalPages = Math.ceil(totalCourses / limit);
      const courses = await coursesCollection.aggregate(pipeline).toArray();
      //
      if (courses.length > 0) {
        res.status(200).json({
          success: true,
          message: "Courses fetched successfully",
          currentPage: page,
          courses,
          totalCourses,
          totalPages,
          hasNextPage: page < totalPages,
        });
      } else {
        res.status(200).json({
          success: false,
          message: "No courses found",
          courses: [],
        });
      }
    });

    // GET /courses/teacher/:email (Fetch courses by instructor email)
    app.get(
      "/courses/teacher/:email",
      verifyToken,
      verifyRole(["teacher"]),
      async (req, res) => {
        const email = req.params.email;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skip = (page - 1) * limit;
        const query = { instructorEmail: email };
        try {
          const totalCourses = await coursesCollection.countDocuments(query);
          const totalPages = Math.ceil(totalCourses / limit);
          const result = await coursesCollection
            .find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .toArray();
          if (result.length > 0) {
            res.status(200).json({
              success: true,
              message: "Courses fetched successfully",
              courses: result,
              currentPage: page,
              totalCourses,
              totalPages,
              hasNextPage: page < totalPages,
            });
          } else {
            res.status(200).json({
              success: true,
              message: "No courses found",
              courses: [],
            });
          }
        } catch {
          res.status(500).send({ message: "Failed to load courses" });
        }
      }
    );

    // GET /courses/popular : Fetch popular courses by total enrollments
    app.get("/courses/popular", async (req, res) => {
      try {
        const pipeline = [
          {
            $match: {
              status: "approved",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "instructorEmail",
              foreignField: "email",
              as: "instructor",
            },
          },
          {
            $lookup: {
              from: "enrollments",
              localField: "_id",
              foreignField: "courseId",
              as: "enrollments",
            },
          },
          {
            $addFields: {
              totalEnrollments: { $size: "$enrollments" },
            },
          },
          { $sort: { totalEnrollments: -1 } },
          { $limit: 6 },
        ];

        const popularCourses = await coursesCollection
          .aggregate(pipeline)
          .toArray();

        if (popularCourses.length > 0) {
          res.status(200).json({
            success: true,
            message: "Popular courses fetched successfully",
            courses: popularCourses,
          });
        } else {
          res.status(200).json({
            success: true,
            message: "No popular courses found",
            courses: [],
          });
        }
      } catch (err) {
        res.status(500).send({ message: "Failed to load popular courses" });
      }
    });

    // GET /courses/new : Fetch new courses by creation date
    app.get("/courses/new", async (req, res) => {
      try {
        const pipeline = [
          {
            $match: {
              status: "approved",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "instructorEmail",
              foreignField: "email",
              as: "instructor",
            },
          },
          {
            $lookup: {
              from: "enrollments",
              localField: "_id",
              foreignField: "courseId",
              as: "enrollments",
            },
          },
          {
            $addFields: {
              totalEnrollments: { $size: "$enrollments" },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 6 },
        ];

        const newCourses = await coursesCollection
          .aggregate(pipeline)
          .toArray();

        if (newCourses.length > 0) {
          res.status(200).json({
            success: true,
            message: "New courses fetched successfully",
            courses: newCourses,
          });
        } else {
          res.status(200).json({
            success: true,
            message: "No new courses found",
            courses: [],
          });
        }
      } catch (err) {
        res.status(500).send({ message: "Failed to load popular courses" });
      }
    });

    // GET /courses/:id : (Fetch a single course by ID)
    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const pipeline = [
        { $match: { _id: new ObjectId(id) } },
        {
          $lookup: {
            from: "users",
            localField: "instructorEmail",
            foreignField: "email",
            as: "instructor",
          },
        },
        {
          $lookup: {
            from: "enrollments",
            localField: "_id",
            foreignField: "courseId",
            as: "enrollments",
          },
        },
        {
          $unwind: "$instructor",
        },
        {
          $addFields: {
            totalEnrollments: { $size: "$enrollments" },
          },
        },
      ];

      try {
        const result = await coursesCollection.aggregate(pipeline).toArray();

        if (result.length > 0) {
          res.status(200).json({
            success: true,
            message: "Course fetched successfully",
            course: result[0],
          });
        } else {
          res.status(204).json({
            success: false,
            message: "No course found",
          });
        }
      } catch (err) {
        console.error("Error fetching course:", err);
        res.status(500).send({ message: "Failed to load course" });
      }
    });

    // POST /courses :Add a new course
    app.post(
      "/courses/add",
      verifyToken,
      verifyRole(["teacher"]),
      async (req, res) => {
        try {
          const course = {
            ...req.body,
            status: "pending",
            createdAt: new Date(),
          };

          const result = await coursesCollection.insertOne(course);
          if (result.acknowledged) {
            res.status(200).json({
              success: true,
              message: "Course added successfully",
              data: result,
            });
          } else {
            res.status(400).json({
              success: false,
              message: "Failed to add course",
              data: result,
            });
          }
        } catch {
          res
            .status(500)
            .send({ message: "Internal server error", success: false });
        }
      }
    );

    // Change course status (e.g., from pending to approved)
    app.patch(
      "/courses/change-status/:id",
      verifyToken,
      verifyRole(["admin"]),
      async (req, res) => {
        const { status } = req.body;
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const doc = { $set: { status: status } };
        try {
          const result = await coursesCollection.updateOne(filter, doc);
          if (result.acknowledged) {
            res.status(200).json({
              success: true,
              message: "Course status updated",
              data: result,
            });
          } else {
            res.status(400).json({
              success: false,
              message: "Course not found",
            });
          }
        } catch {
          res.status(500).send({ message: "Failed to update course status" });
        }
      }
    );

    // DELETE /courses/:id :Delete a course
    app.delete(
      "/courses/:id",
      verifyToken,
      verifyRole(["teacher"]),
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        try {
          const result = await coursesCollection.deleteOne(filter);
          if (result.acknowledged) {
            res.status(200).json({
              success: true,
              message: "Course deleted successfully",
              data: result,
            });
          } else {
            res.status(400).json({
              success: false,
              message: "Course not found",
            });
          }
        } catch {
          res.status(500).send({ message: "Failed to delete course" });
        }
      }
    );

    // PATCH /courses/:id :Update a course
    app.patch(
      "/courses/:id",
      verifyToken,
      verifyRole(["teacher"]),
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const doc = { $set: req.body };
        try {
          const result = await coursesCollection.updateOne(filter, doc);
          if (result.acknowledged) {
            res.status(200).json({
              success: true,
              message: "Course updated successfully",
              data: result,
            });
          } else {
            res.status(400).json({
              success: false,
              message: "Course not found",
            });
          }
        } catch {
          res.status(500).send({ message: "Failed to update course" });
        }
      }
    );

    // GET /courses/enrolled/:email (Fetch enrolled courses by email)
    app.get("/courses/enrolled/:email", verifyToken, async (req, res) => {
      const { email } = req.params;

      try {
        const pipeline = [
          { $match: { email } },
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
              from: "users",
              localField: "courseInfo.instructorEmail",
              foreignField: "email",
              as: "instructor",
            },
          },
          {
            $unwind: "$courseInfo",
          },
          {
            $sort: { createdAt: -1 },
          },
        ];

        const enrolledCourses = await enrollmentsCollection
          .aggregate(pipeline)
          .toArray();

        if (enrolledCourses.length > 0) {
          res.status(200).json({
            success: true,
            message: "Enrolled courses fetched successfully",
            enrolledCourses,
          });
        } else {
          res.status(202).json({
            success: false,
            message: "No enrolled courses found",
            enrolledCourses: [],
          });
        }
      } catch (err) {
        console.error("Failed to fetch enrolled courses:", err);
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    });

    //  ==================================================
    //  ||             Enrollments Section               ||
    //  ==================================================

    // GET /enrollments/:id (Fetch all enrollments of a course)
    app.get("/enrollments/:courseId", async (req, res) => {
      const courseId = req.params.courseId;
      const query = { courseId: courseId };
      try {
        const enrollments = await enrollmentsCollection.find(query).toArray();

        if (enrollments.length > 0) {
          res.status(200).json({
            success: true,
            message: "enrollments fetched successfully",
            enrollments,
          });
        } else {
          res.status(202).json({
            success: false,
            message: "No assignments found",
            enrollments: [],
          });
        }
      } catch {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // POST /enrollments (Enroll a user in a course)
    app.post("/enrollments", async (req, res) => {
      const enrollment = {
        ...req.body,
        courseId: new ObjectId(req.body.courseId),
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
      } catch {
        res
          .status(500)
          .send({ message: "Internal server error", success: false });
      }
    });

    //  ==================================================
    //  ||             Assignment & Submission Section                   ||
    //  ==================================================

    // POST /assignments (Add a new assignment by Teacher)
    app.post(
      "/assignments",
      verifyToken,
      verifyRole(["teacher"]),
      async (req, res) => {
        const assignment = {
          ...req.body,
          courseId: new ObjectId(req.body.courseId),
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
        } catch {
          res
            .status(500)
            .send({ message: "Internal server error", success: false });
        }
      }
    );

    // GET /assignments/:courseId/:studentEmail
    // (Fetch all assignments of a course of specific student with submissions)
    app.get(
      "/assignments/:courseId/:studentEmail",
      verifyToken,
      async (req, res) => {
        const courseId = new ObjectId(req.params.courseId);
        const studentEmail = req.params.studentEmail;

        try {
          const assignments = await assignmentsCollection
            .aggregate([
              {
                $match: {
                  courseId: new ObjectId(courseId),
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

          // console.log(assignments);

          if (assignments.length > 0) {
            res.status(200).json({
              success: true,
              message:
                "Assignments with student submissions fetched successfully",
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
      }
    );

    // GET /assignments/:id (Fetch all assignments of a course)
    app.get("/assignments/:courseId", async (req, res) => {
      const courseId = req.params.courseId;
      let query = { courseId: new ObjectId(courseId) };

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
      } catch {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // GET /submissions/:id (Fetch all submissions of a course)
    app.get("/submissions/:courseId", verifyToken, async (req, res) => {
      const courseId = req.params.courseId;
      const studentEmail = req.query?.studentEmail || "";
      let query = { courseId: new ObjectId(courseId) };
      if (studentEmail) {
        query = { courseId: new ObjectId(courseId), studentEmail };
      }

      try {
        const submissions = await submissionsCollection.find(query).toArray();

        if (submissions.length > 0) {
          res.status(200).json({
            success: true,
            message: "submissions fetched successfully",
            submissions,
          });
        } else {
          res.status(202).json({
            success: false,
            message: "No submissions found",
            submissions: [],
          });
        }
      } catch {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // POST /submissions (Add a new submission by Student)
    app.post("/submissions", verifyToken, async (req, res) => {
      const submission = {
        ...req.body,
        assignmentId: new ObjectId(req.body.assignmentId),
        courseId: new ObjectId(req.body.courseId),
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
      } catch {
        res
          .status(500)
          .send({ message: "Internal server error", success: false });
      }
    });

    // upload image to imagekit.io
    app.get("/get-ik-signature", async (req, res) => {
      var imagekit = new ImageKit({
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
        urlEndpoint: "https://ik.imagekit.io/jakariya",
      });

      const authParams = imagekit.getAuthenticationParameters();
      res.status(200).json(authParams);
    });

    // Sripe Payment Integration
    app.post("/create-payment-intent", async (req, res) => {
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

    //  ==================================================
    //  ||             Feedback Section                   ||
    //  ==================================================

    // POST /feedbacks (Add a new feedback by Student)
    app.post(
      "/feedbacks",
      verifyToken,
      verifyRole(["student"]),
      async (req, res) => {
        const feedback = {
          ...req.body,
          createdAt: new Date(),
          courseId: new ObjectId(req.body.courseId),
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
        } catch {
          res
            .status(500)
            .send({ message: "Internal server error", success: false });
        }
      }
    );

    // GET /feedbacks?courseId=xxx&studentEmail=yyy (Fetch all feedbacks of a course or a specific student)
    app.get("/feedbacks", async (req, res) => {
      const courseId = req.query?.courseId;
      const studentEmail = req.query?.studentEmail;

      const query = {};
      if (courseId) {
        query.courseId = new ObjectId(courseId);
      }
      if (studentEmail) {
        query.studentEmail = studentEmail;
      }

      const pipeline = [
        {
          $match: query,
        },
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
        {
          $unwind: {
            path: "$userInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: "$courseInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $sort: {
            rating: -1,
          },
        },
        {
          $limit: 6,
        },
      ];

      try {
        const feedbacks = await feedbacksCollection
          .aggregate(pipeline)
          .toArray();

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
      } catch (error) {
        console.error("Error fetching feedbacks:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // PATCH /feedbacks/:id (Update a feedback by Student)
    app.patch(
      "/feedbacks/:id",
      verifyToken,
      verifyRole(["student"]),
      async (req, res) => {
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
        } catch {
          res
            .status(500)
            .send({ message: "Internal server error", success: false });
        }
      }
    );

    //  ==================================================
    //  ||             others Section                     ||
    //  ==================================================

    // GET /users (Fetch all users)
    app.get("/statistics", async (req, res) => {
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
    // End --->
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
