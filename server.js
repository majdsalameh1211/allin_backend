// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const connectSupabase = require('./config/supabase'); // Import the function

// 1. Load Env
dotenv.config();

console.log('\n------------------------------------------------');
console.log('🔍 Starting Server...');
console.log('PORT:', process.env.PORT || 5000);

// 2. Initialize Express
const app = express();

// 3. Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Routes
app.use('/api/services', require('./routes/services'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/team', require('./routes/team'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/courses', require('./routes/courses'));

// 5. Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running' });
});

// 6. Start Server Function
const startServer = async () => {
  try {
    // --- Connect to Supabase (ONCE) ---
    console.log('🔌 Connecting to Supabase...');
    const supabase = connectSupabase(); 
    app.set('supabase', supabase); // Make accessible globally if needed

    // --- Connect to MongoDB ---
    if (!process.env.MONGODB_URI) {
      throw new Error('❌ MONGODB_URI is missing');
    }
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`✅ MongoDB Connected: ${mongoose.connection.name}`);

    // --- Start Listening ---
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log('------------------------------------------------');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
      console.log('------------------------------------------------\n');
    });

  } catch (error) {
    console.error('\n❌ Server Startup Failed:', error.message);
    process.exit(1);
  }
};

startServer();