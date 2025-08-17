const { ObjectId } = require("mongodb");
const connectDB = require("../db");

let usersCollection;

(async () => {
  const db = await connectDB();
  usersCollection = db.collection("users");
})();

async function createNewUser(req, res) {
  const user = req.body;

  // return if user already exists
  const existingUser = await usersCollection.findOne({
    email: user.email,
  });
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
}

async function getUserByEmail(req, res) {
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
}

async function createNewTeacher(req, res) {
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
}

async function getAllTeachers(req, res) {
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

async function changeTeacherStatus(req, res) {
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

async function searchUsers(req, res) {
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
    res.status(500).json({ message: "Failed to fetch users", success: false });
  }
}

async function makeAdmin(req, res) {
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

module.exports = {
  createNewUser,
  getUserByEmail,
  createNewTeacher,
  getAllTeachers,
  changeTeacherStatus,
  searchUsers,
  makeAdmin,
};
