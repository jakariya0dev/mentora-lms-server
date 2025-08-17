const { ObjectId } = require("mongodb");
const connectDB = require("../db");

let db, usersCollection, coursesCollection, enrollmentsCollection;

(async () => {
  db = await connectDB();
  usersCollection = db.collection("users");
  coursesCollection = db.collection("courses");
  enrollmentsCollection = db.collection("enrollments");
})();

// ------------------- CONTROLLER FUNCTIONS -------------------

// Get all courses (Admin)
exports.getAllCoursesAdmin = async (req, res) => {
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

    res.status(200).json({
      success: true,
      message: "Courses fetched successfully",
      currentPage: page,
      courses,
      totalCourses,
      totalPages,
      hasNextPage: page < totalPages,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to load courses",
      error: err.message,
    });
  }
};

// Get approved courses with search + pagination (Users)
exports.getApprovedCourses = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 9;
  const search = req.query.searchTerm || "";
  const skip = (page - 1) * limit;

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
    { $addFields: { totalEnrollments: { $size: "$enrollments" } } },
    { $skip: skip },
    { $limit: limit },
  ];

  if (search) {
    pipeline.unshift({ $match: { title: { $regex: search, $options: "i" } } });
  }

  try {
    let totalCourses = await coursesCollection.countDocuments({
      status: "approved",
      ...(search && { title: { $regex: search, $options: "i" } }),
    });

    const totalPages = Math.ceil(totalCourses / limit);
    const courses = await coursesCollection.aggregate(pipeline).toArray();

    res.status(200).json({
      success: true,
      message: "Courses fetched successfully",
      currentPage: page,
      courses,
      totalCourses,
      totalPages,
      hasNextPage: page < totalPages,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to load approved courses",
      error: err.message,
    });
  }
};

// Get courses by teacher email
exports.getCoursesByTeacher = async (req, res) => {
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

    res.status(200).json({
      success: true,
      message: "Courses fetched successfully",
      courses: result,
      currentPage: page,
      totalCourses,
      totalPages,
      hasNextPage: page < totalPages,
    });
  } catch {
    res.status(500).send({ message: "Failed to load courses" });
  }
};

// Popular Courses
exports.getPopularCourses = async (req, res) => {
  try {
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
      { $addFields: { totalEnrollments: { $size: "$enrollments" } } },
      { $sort: { totalEnrollments: -1 } },
      { $limit: 6 },
    ];

    const popularCourses = await coursesCollection
      .aggregate(pipeline)
      .toArray();
    res.status(200).json({
      success: true,
      message: "Popular courses fetched successfully",
      courses: popularCourses,
    });
  } catch {
    res.status(500).send({ message: "Failed to load popular courses" });
  }
};

// New Courses
exports.getNewCourses = async (req, res) => {
  try {
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
      { $addFields: { totalEnrollments: { $size: "$enrollments" } } },
      { $sort: { createdAt: -1 } },
      { $limit: 6 },
    ];

    const newCourses = await coursesCollection.aggregate(pipeline).toArray();
    res.status(200).json({
      success: true,
      message: "New courses fetched successfully",
      courses: newCourses,
    });
  } catch {
    res.status(500).send({ message: "Failed to load new courses" });
  }
};

// Get single course by ID
exports.getCourseById = async (req, res) => {
  const id = req.params.id;
  try {
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
      { $unwind: "$instructor" },
      { $addFields: { totalEnrollments: { $size: "$enrollments" } } },
    ];

    const result = await coursesCollection.aggregate(pipeline).toArray();
    if (!result.length)
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });

    res.status(200).json({
      success: true,
      message: "Course fetched successfully",
      course: result[0],
    });
  } catch {
    res.status(500).send({ message: "Failed to load course" });
  }
};

// Add new course
exports.addCourse = async (req, res) => {
  try {
    const course = {
      ...req.body,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await coursesCollection.insertOne(course);
    res.status(200).json({
      success: true,
      message: "Course added successfully",
      data: result,
    });
  } catch {
    res.status(500).send({ message: "Internal server error" });
  }
};

// Change course status
exports.changeCourseStatus = async (req, res) => {
  const { status } = req.body;
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const doc = { $set: { status } };

  try {
    const result = await coursesCollection.updateOne(filter, doc);
    res.status(200).json({
      success: true,
      message: "Course status updated",
      data: result,
    });
  } catch {
    res.status(500).send({ message: "Failed to update course status" });
  }
};

// Delete a course
exports.deleteCourse = async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };

  try {
    const result = await coursesCollection.deleteOne(filter);
    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
      data: result,
    });
  } catch {
    res.status(500).send({ message: "Failed to delete course" });
  }
};

// Update a course
exports.updateCourse = async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const doc = { $set: req.body };

  try {
    const result = await coursesCollection.updateOne(filter, doc);
    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: result,
    });
  } catch {
    res.status(500).send({ message: "Failed to update course" });
  }
};

// Enrolled courses by email
exports.getEnrolledCourses = async (req, res) => {
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
      { $unwind: "$courseInfo" },
      { $sort: { createdAt: -1 } },
    ];

    const enrolledCourses = await enrollmentsCollection
      .aggregate(pipeline)
      .toArray();
    res.status(200).json({
      success: true,
      message: "Enrolled courses fetched successfully",
      enrolledCourses,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to fetch enrolled courses",
    });
  }
};
