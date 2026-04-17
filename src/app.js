const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const taskRoutes = require('./routes/taskRoutes');
const startReminderJob = require('./jobs/reminderJob');

dotenv.config();
connectDB();

const app = express();

app.use(express.json());

app.use('/api/tasks', taskRoutes);

app.get('/', (req, res) => {
  res.send("Task API Running");
});

// start cron job
startReminderJob();

// important for testing
if (require.main === module) {
  app.listen(process.env.PORT || 5000, () =>
    console.log("Server running")
  );
}

module.exports = app;