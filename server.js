require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./src/app');

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});