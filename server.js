// ================== IMPORTS ==================
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const morgan = require("morgan");

// ================== APP CONFIG ==================
const app = express();
app.use(express.json());
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan("dev"));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// ================== DB ==================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log(err));

// ================== SCHEMA ==================
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,

  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },

  deadline: {
    type: Date,
    validate: {
      validator: v => !v || v > new Date(),
      message: "Deadline must be in future"
    }
  },

  status: {
    type: String,
    enum: ["pending", "in-progress", "completed"],
    default: "pending"
  },

  email: {
    type: String,
    required: true
  },

  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task"
  }],

  reminderSent: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

// Indexing (performance)
taskSchema.index({ priority: 1 });
taskSchema.index({ deadline: 1 });

const Task = mongoose.model("Task", taskSchema);

// ================== EMAIL ==================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    });
    console.log("📧 Email sent");
  } catch (err) {
    console.log("Email error:", err.message);
  }
};

// ================== DEPENDENCY CHECK ==================
const hasCycle = async (taskId, dependencies) => {
  const visited = new Set();

  const dfs = async (id) => {
    if (visited.has(id.toString())) return true;

    visited.add(id.toString());

    const task = await Task.findById(id);
    if (!task) return false;

    for (let dep of task.dependencies) {
      if (await dfs(dep)) return true;
    }

    visited.delete(id.toString());
    return false;
  };

  for (let dep of dependencies) {
    if (await dfs(dep)) return true;
  }

  return false;
};

// ================== ROUTES ==================

// ✅ CREATE TASK
app.post("/tasks", async (req, res) => {
  try {
    const { title, email } = req.body;

    if (!title || !email) {
      return res.status(400).json({ msg: "Title and Email required" });
    }

    const task = await Task.create(req.body);

    await sendEmail(
      task.email,
      "Task Created",
      `Task "${task.title}" created. Deadline: ${task.deadline || "Not set"}`
    );

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET TASKS (FILTER + PAGINATION)
app.get("/tasks", async (req, res) => {
  try {
    const { priority, status, startDate, endDate, page = 1 } = req.query;

    const filter = {};

    if (priority) filter.priority = priority;
    if (status) filter.status = status;

    if (startDate && endDate) {
      filter.deadline = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const limit = 10;

    const tasks = await Task.find(filter)
      .select("title priority deadline status")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET SINGLE TASK
app.get("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate("dependencies");

    if (!task) return res.status(404).json({ msg: "Task not found" });

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ UPDATE TASK (PRIORITY + DEADLINE + EMAIL)
app.put("/tasks/:id", async (req, res) => {
  try {
    const oldTask = await Task.findById(req.params.id);

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedTask) return res.status(404).json({ msg: "Task not found" });

    // Status change notification
    if (req.body.status && req.body.status !== oldTask.status) {
      await sendEmail(
        updatedTask.email,
        "Status Updated",
        `Task "${updatedTask.title}" is now ${updatedTask.status}`
      );
    }

    // Deadline change notification
    if (req.body.deadline && req.body.deadline != oldTask.deadline) {
      await sendEmail(
        updatedTask.email,
        "Deadline Updated",
        `New deadline: ${updatedTask.deadline}`
      );
    }

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ DELETE TASK
app.delete("/tasks/:id", async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ msg: "Task deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ ADD DEPENDENCIES
app.put("/tasks/:id/dependencies", async (req, res) => {
  try {
    const { dependencies } = req.body;

    if (await hasCycle(req.params.id, dependencies)) {
      return res.status(400).json({ msg: "Circular dependency detected" });
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { dependencies },
      { new: true }
    );

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ UPDATE STATUS (DEPENDENCY CHECK)
app.patch("/tasks/:id/status", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate("dependencies");

    if (!task) return res.status(404).json({ msg: "Task not found" });

    if (req.body.status === "completed") {
      const incomplete = task.dependencies.filter(
        d => d.status !== "completed"
      );

      if (incomplete.length > 0) {
        return res.status(400).json({
          msg: "Complete dependencies first",
          pending: incomplete
        });
      }
    }

    task.status = req.body.status;
    await task.save();

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== CRON (DEADLINE REMINDER) ==================
cron.schedule("0 * * * *", async () => {
  console.log("⏰ Checking deadlines...");

  const now = new Date();
  const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const tasks = await Task.find({
    deadline: { $gte: now, $lte: next24 },
    reminderSent: false,
    status: { $ne: "completed" }
  });

  for (let task of tasks) {
    await sendEmail(
      task.email,
      "Deadline Reminder",
      `Task "${task.title}" is due on ${task.deadline}`
    );

    task.reminderSent = true;
    await task.save();
  }
});

// ================== SERVER ==================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});