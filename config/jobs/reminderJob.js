const cron = require('node-cron');
const Task = require('../models/Task');
const sendEmail = require('../utils/emailService');

const startReminderJob = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      const now = new Date();

      const tasks = await Task.find({
        dueDate: {
          $gte: now,
          $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000)
        },
        status: { $ne: 'completed' }
      });

      await Promise.all(
        tasks.map(task =>
          sendEmail({
            to: process.env.EMAIL_USER,
            subject: `Reminder: ${task.title}`,
            text: `Task "${task.title}" is due soon`
          })
        )
      );

      console.log("Reminder emails sent");
    } catch (err) {
      console.error(err.message);
    }
  });
};

module.exports = startReminderJob;