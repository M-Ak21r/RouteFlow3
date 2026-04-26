

// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const http = require('http');
// const { Server } = require('socket.io');
// const mongoose = require('mongoose');
// require('dotenv').config();

// const deliveryRoutes = require('./routes/deliveries');
// const customerRoutes = require('./routes/customers');
// const vehicleRoutes = require('./routes/vehicles');
// const routeRoutes = require('./routes/routes');
// const analyticsRoutes = require('./routes/analytics');
// const authRoutes = require('./routes/auth');

// const { setupSocketHandlers } = require('./socket/socketHandlers');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
// });

// // Middleware
// app.use(helmet());
// app.use(cors());
// app.use(express.json());
// app.use(morgan('dev'));

// // Attach io to requests so routes can emit events
// app.use((req, res, next) => {
//   req.io = io;
//   next();
// });

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/deliveries', deliveryRoutes);
// app.use('/api/customers', customerRoutes);
// app.use('/api/vehicles', vehicleRoutes);
// app.use('/api/routes', routeRoutes);
// app.use('/api/analytics', analyticsRoutes);

// // Health check
// app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
// });

// // Socket.io setup
// setupSocketHandlers(io);

// const PORT = process.env.PORT || 3000;

// // Connect to MongoDB
// console.log('Mongo URI:', process.env.MONGODB_URI);
// mongoose.connect(process.env.MONGODB_URI);
// mongoose.connect(process.env.MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
//   .then(() => {
//     console.log('✅ MongoDB connected successfully');
//     server.listen(PORT, () => {
//       console.log(`🚀 RouteFlow backend running on http://localhost:${PORT}`);
//     });
//   })
//   .catch((err) => {
//     console.error('❌ MongoDB connection error:', err);
//     process.exit(1);
//   });




// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const http = require('http');
// const { Server } = require('socket.io');
// const mongoose = require('mongoose');
// const path = require('path');

// // Load .env from the same directory as this file
// require('dotenv').config({ path: path.join(__dirname, '.env') });

// const deliveryRoutes = require('./routes/deliveries');
// const customerRoutes = require('./routes/customers');
// const vehicleRoutes = require('./routes/vehicles');
// const routeRoutes = require('./routes/routes');
// const analyticsRoutes = require('./routes/analytics');
// const authRoutes = require('./routes/auth');

// const { setupSocketHandlers } = require('./socket/socketHandlers');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
// });

// // Middleware
// app.use(helmet());
// app.use(cors());
// app.use(express.json());
// app.use(morgan('dev'));

// // Attach io to requests so routes can emit events
// app.use((req, res, next) => {
//   req.io = io;
//   next();
// });

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/deliveries', deliveryRoutes);
// app.use('/api/customers', customerRoutes);
// app.use('/api/vehicles', vehicleRoutes);
// app.use('/api/routes', routeRoutes);
// app.use('/api/analytics', analyticsRoutes);

// // Health check
// app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
// });

// // Socket.io setup
// setupSocketHandlers(io);

// const PORT = process.env.PORT || 3000;

// // Connect to MongoDB
// const mongoURI = process.env.MONGODB_URI;
// if (!mongoURI) {
//   console.error('❌ Fatal error: MONGODB_URI is not defined in environment variables');
//   console.error('Please create a .env file in the routeflow-backend folder with MONGODB_URI=mongodb://localhost:27017/routeflow');
//   process.exit(1);
// }

// console.log('✅ MONGODB_URI loaded (length:', mongoURI.length, 'characters)');

// // ✅ REMOVED deprecated options: useNewUrlParser and useUnifiedTopology
// mongoose.connect(mongoURI)
// .then(() => {
//   console.log('✅ MongoDB connected successfully');
//   server.listen(PORT, () => {
//     console.log(`🚀 RouteFlow backend running on http://localhost:${PORT}`);
//   });
// })
// .catch((err) => {
//   console.error('❌ MongoDB connection error:', err);
//   process.exit(1);
// });



// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const http = require('http');
// const { Server } = require('socket.io');
// const mongoose = require('mongoose');
// const path = require('path');

// // Load .env from the same directory as this file
// require('dotenv').config({ path: path.join(__dirname, '.env') });

// const deliveryRoutes = require('./routes/deliveries');
// const customerRoutes = require('./routes/customers');
// const vehicleRoutes = require('./routes/vehicles');
// const routeRoutes = require('./routes/routes');
// const analyticsRoutes = require('./routes/analytics');
// const authRoutes = require('./routes/auth');

// const { setupSocketHandlers } = require('./socket/socketHandlers');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
// });

// // Middleware
// app.use(helmet());
// app.use(cors());
// app.use(express.json());
// app.use(morgan('dev'));

// // Attach io to requests so routes can emit events
// app.use((req, res, next) => {
//   req.io = io;
//   next();
// });

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/deliveries', deliveryRoutes);
// app.use('/api/customers', customerRoutes);
// app.use('/api/vehicles', vehicleRoutes);
// app.use('/api/routes', routeRoutes);
// app.use('/api/analytics', analyticsRoutes);

// // Health check
// app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// // ✅ Root route - Add this
// app.get('/', (req, res) => {
//   res.json({
//     message: '🚀 RouteFlow API is running',
//     version: '1.0.0',
//     endpoints: {
//       auth: '/api/auth',
//       deliveries: '/api/deliveries',
//       customers: '/api/customers',
//       vehicles: '/api/vehicles',
//       routes: '/api/routes',
//       analytics: '/api/analytics',
//       health: '/health'
//     }
//   });
// });

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
// });

// // Socket.io setup
// setupSocketHandlers(io);

// const PORT = process.env.PORT || 3000;

// // Connect to MongoDB
// const mongoURI = process.env.MONGODB_URI;
// if (!mongoURI) {
//   console.error('❌ Fatal error: MONGODB_URI is not defined in environment variables');
//   console.error('Please create a .env file in the routeflow-backend folder with MONGODB_URI=mongodb://localhost:27017/routeflow');
//   process.exit(1);
// }

// console.log('✅ MONGODB_URI loaded (length:', mongoURI.length, 'characters)');

// mongoose.connect(mongoURI)
// .then(() => {
//   console.log('✅ MongoDB connected successfully');
//   server.listen(PORT, () => {
//     console.log(`🚀 RouteFlow backend running on http://localhost:${PORT}`);
//   });
// })
// .catch((err) => {
//   console.error('❌ MongoDB connection error:', err);
//   process.exit(1);
// });




// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const http = require('http');
// const { Server } = require('socket.io');
// const mongoose = require('mongoose');
// const path = require('path');

// // Load env
// require('dotenv').config({ path: path.join(__dirname, '.env') });

// // Routes
// const deliveryRoutes = require('./routes/deliveries');
// const customerRoutes = require('./routes/customers');
// const vehicleRoutes = require('./routes/vehicles');
// const routeRoutes = require('./routes/routes');
// const analyticsRoutes = require('./routes/analytics');
// const authRoutes = require('./routes/auth');

// const { setupSocketHandlers } = require('./socket/socketHandlers');

// const app = express();
// const server = http.createServer(app);

// // Socket.io
// const io = new Server(server, {
//   cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
// });

// // ======================
// // MIDDLEWARE
// // ======================


// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       directives: {
//         "default-src": ["'self'"],

//         // Allow JS (Leaflet CDN)
//         "script-src": ["'self'", "https://unpkg.com", "'unsafe-inline'"],

//         // Allow CSS + fonts
//         "style-src": [
//           "'self'",
//           "https://unpkg.com",
//           "https://fonts.googleapis.com",
//           "'unsafe-inline'"
//         ],

//         // Allow fonts
//         "font-src": [
//           "'self'",
//           "https://fonts.gstatic.com",
//           "data:"
//         ],

//         // Allow images (map tiles)
//         "img-src": [
//           "'self'",
//           "data:",
//           "https://*.tile.openstreetmap.org",
//           "https://*.basemaps.cartocdn.com",
//           "https://*.cartocdn.com"
//         ],

//         // VERY IMPORTANT (fixes leaflet map loading)
//         "connect-src": [
//           "'self'",
//           "https://unpkg.com",
//           "https://*.tile.openstreetmap.org",
//           "https://*.basemaps.cartocdn.com",
//           "https://*.cartocdn.com"
//         ]
//       }
//     }
//   })
// );
// app.use(cors());
// app.use(express.json());
// app.use(morgan('dev'));

// // Attach socket
// app.use((req, res, next) => {
//   req.io = io;
//   next();
// });

// // ======================
// // 🔥 SERVE FRONTEND
// // ======================
// app.use(express.static(path.join(__dirname, 'public')));

// // ======================
// // API ROUTES
// // ======================
// app.use('/api/auth', authRoutes);
// app.use('/api/deliveries', deliveryRoutes);
// app.use('/api/customers', customerRoutes);
// app.use('/api/vehicles', vehicleRoutes);
// app.use('/api/routes', routeRoutes);
// app.use('/api/analytics', analyticsRoutes);

// // ======================
// // HEALTH CHECK
// // ======================
// app.get('/health', (req, res) => {
//   res.json({ status: 'OK', time: new Date() });
// });

// // ======================
// // 🔥 FALLBACK (NO * ERROR)
// // ======================
// app.use((req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// // ======================
// // ERROR HANDLER
// // ======================
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(err.status || 500).json({
//     error: err.message || 'Internal Server Error'
//   });
// });

// // ======================
// // SOCKET
// // ======================
// setupSocketHandlers(io);

// // ======================
// // DB + SERVER START
// // ======================
// const PORT = process.env.PORT || 3000;
// const mongoURI = process.env.MONGODB_URI;

// if (!mongoURI) {
//   console.error('❌ MONGODB_URI missing in .env');
//   process.exit(1);
// }

// mongoose.connect(mongoURI)
//   .then(() => {
//     console.log('✅ MongoDB connected');

//     server.listen(PORT, () => {
//       console.log(`🚀 Server running on http://localhost:${PORT}`);
//     });
//   })
//   .catch(err => {
//     console.error('❌ DB Error:', err);
//     process.exit(1);
//   });


const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

// Load env
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Routes
const deliveryRoutes = require('./routes/deliveries');
const customerRoutes = require('./routes/customers');
const vehicleRoutes = require('./routes/vehicles');
const routeRoutes = require('./routes/routes');
const analyticsRoutes = require('./routes/analytics');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

const { setupSocketHandlers } = require('./socket/socketHandlers');

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// ======================
// MIDDLEWARE
// ======================


app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],

        // Allow JS (Leaflet CDN)
        "script-src": ["'self'", "https://unpkg.com", "'unsafe-inline'"],

        // Allow CSS + fonts
        "style-src": [
          "'self'",
          "https://unpkg.com",
          "https://fonts.googleapis.com",
          "'unsafe-inline'"
        ],

        // Allow fonts
        "font-src": [
          "'self'",
          "https://fonts.gstatic.com",
          "data:"
        ],

        // Allow images (map tiles)
        "img-src": [
          "'self'",
          "data:",
          "https://*.tile.openstreetmap.org",
          "https://*.basemaps.cartocdn.com",
          "https://*.cartocdn.com"
        ],

        // VERY IMPORTANT (fixes leaflet map loading + socket.io WebSocket)
        "connect-src": [
          "'self'",
          "ws:",
          "wss:",
          "https://unpkg.com",
          "https://*.tile.openstreetmap.org",
          "https://*.basemaps.cartocdn.com",
          "https://*.cartocdn.com"
        ]
      }
    }
  })
);
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Attach socket
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ======================
// 🔥 SERVE FRONTEND
// ======================
app.use(express.static(path.join(__dirname, 'public')));

// ======================
// API ROUTES
// ======================
app.use('/api/auth', authRoutes);
app.use('/api/deliveries', requireAuth, deliveryRoutes);
app.use('/api/customers', requireAuth, customerRoutes);
app.use('/api/vehicles', requireAuth, vehicleRoutes);
app.use('/api/routes', requireAuth, routeRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);

// ======================
// HEALTH CHECK
// ======================
app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date() });
});

// ======================
// 🔥 FALLBACK (NO * ERROR)
// ======================
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ======================
// ERROR HANDLER
// ======================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// ======================
// SOCKET
// ======================
setupSocketHandlers(io);

// ======================
// DB + SERVER START
// ======================
const PORT = process.env.PORT || 3000;
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('❌ MONGODB_URI missing in .env');
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => {
    console.log('✅ MongoDB connected');

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ DB Error:', err);
    process.exit(1);
  });
