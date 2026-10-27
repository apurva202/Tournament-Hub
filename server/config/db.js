const mongoose = require('mongoose');
const dns = require('dns');

// On local development (especially Windows), ISP DNS often blocks MongoDB Atlas SRV records (querySrv ECONNREFUSED).
// Only set custom DNS in development; in production, use standard host/cloud DNS infrastructure.
if (process.env.NODE_ENV !== 'production') {
  try {
    dns.setServers(['8.8.8.8']);
  } catch (e) {
    // Ignore in environments where setting DNS servers is restricted
  }
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] ${error.message}`);
    return null;
  }
};

module.exports = connectDB;
