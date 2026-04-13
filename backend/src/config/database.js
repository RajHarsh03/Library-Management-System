/**
 * Database Configuration
 * MongoDB connection setup with Mongoose
 * 
 * Note: Uses custom DNS resolver (Google DNS 8.8.8.8) because
 * the local network DNS cannot resolve mongodb.net hostnames.
 */

const mongoose = require('mongoose');
const dns = require('dns');
const env = require('./env');

// Override Node's DNS resolver to use Google DNS
// This fixes MongoDB Atlas connections on networks that block mongodb.net DNS
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const connectDB = async () => {
  try {
    const options = {
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4,
    };

    const uri = env.MONGODB_URI;

    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(uri, options);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    console.error('The server will continue running but database operations will fail.');
    console.error('Please check your MONGODB_URI in .env and ensure your IP is whitelisted in Atlas.');
  }
};

module.exports = connectDB;
