const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../routeflow.db');
let db;

function getDB() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

async function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'driver',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      plate TEXT UNIQUE NOT NULL,
      driver_id INTEGER,
      capacity INTEGER DEFAULT 100,
      status TEXT DEFAULT 'idle',
      lat REAL,
      lng REAL,
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      vehicle_id INTEGER,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      scheduled_time TEXT,
      delivered_at DATETIME,
      notes TEXT,
      stop_order INTEGER,
      distance_from_depot REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      vehicle_id INTEGER,
      date TEXT NOT NULL,
      total_stops INTEGER DEFAULT 0,
      total_distance REAL DEFAULT 0,
      status TEXT DEFAULT 'planned',
      optimised BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS route_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      delivery_id INTEGER NOT NULL,
      stop_number INTEGER NOT NULL,
      FOREIGN KEY (route_id) REFERENCES routes(id),
      FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
    );

    CREATE TABLE IF NOT EXISTS delivery_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT,
      lat REAL,
      lng REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
    );
  `);

  // Seed sample data
  seedData(db);

  console.log('✅ Database initialised');
}

function seedData(db) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM customers').get();
  if (existing.count > 0) return;

  // Users
  db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Admin User', 'admin@routeflow.com', '$2b$10$hashedpassword', 'admin');
  db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Rahul D.', 'rahul@routeflow.com', '$2b$10$hashedpassword', 'driver');
  db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Amit K.', 'amit@routeflow.com', '$2b$10$hashedpassword', 'driver');
  db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Suresh V.', 'suresh@routeflow.com', '$2b$10$hashedpassword', 'driver');

  // Vehicles
  db.prepare(`INSERT INTO vehicles (name, type, plate, driver_id, status, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('Van Alpha', 'van', 'DL-01-AA-1234', 2, 'active', 28.6139, 77.2090);
  db.prepare(`INSERT INTO vehicles (name, type, plate, driver_id, status, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('Bike Beta', 'bike', 'DL-02-BB-5678', 3, 'active', 28.5355, 77.3910);
  db.prepare(`INSERT INTO vehicles (name, type, plate, driver_id, status, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('Van Gamma', 'van', 'DL-03-CC-9012', 4, 'idle', 28.4595, 77.0266);

  // Customers (Delhi area)
  const customers = [
    ['Arjun Sharma',  'arjun@example.com',  '+91-9810000001', 'Connaught Place, New Delhi',        28.6315, 77.2167, 3.2],
    ['Priya Mehta',   'priya@example.com',  '+91-9810000002', 'Lajpat Nagar, New Delhi',            28.5672, 77.2430, 7.1],
    ['Rohan Gupta',   'rohan@example.com',  '+91-9810000003', 'Dwarka Sector 10, New Delhi',        28.5921, 77.0460, 14.3],
    ['Sunita Verma',  'sunita@example.com', '+91-9810000004', 'Rohini Sector 5, New Delhi',         28.7041, 77.1025, 13.0],
    ['Karan Singh',   'karan@example.com',  '+91-9810000005', 'Saket, New Delhi',                   28.5244, 77.2066, 9.5],
    ['Meera Joshi',   'meera@example.com',  '+91-9810000006', 'Mayur Vihar Phase 1, New Delhi',     28.6033, 77.2955, 8.2],
    ['Amit Patel',    'amit.p@example.com', '+91-9810000007', 'Pitampura, New Delhi',               28.7009, 77.1329, 12.7],
  ];
  const insertCustomer = db.prepare(`INSERT INTO customers (name, email, phone, address, lat, lng, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  customers.forEach(([name, email, phone, address, lat, lng, dist]) => {
    insertCustomer.run(name, email, phone, address, lat, lng, `${dist}km from depot`);
  });

  // Deliveries
  const statuses = ['transit', 'pending', 'delivered', 'pending', 'transit', 'pending', 'failed'];
  const times    = ['10:30',   '11:15',   '09:45',     '12:00',   '13:30',   '14:00',  '15:00'];
  const insertDelivery = db.prepare(`INSERT INTO deliveries (delivery_number, customer_id, vehicle_id, status, scheduled_time, stop_order, distance_from_depot) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  statuses.forEach((status, i) => {
    const vehicleId = i < 4 ? 1 : i < 6 ? 2 : 3;
    insertDelivery.run(`DEL-00${i + 1}`, i + 1, vehicleId, status, times[i], i + 1, customers[i][6]);
  });

  // Route
  db.prepare(`INSERT INTO routes (name, vehicle_id, date, total_stops, total_distance, status, optimised) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('Route A - Today', 1, new Date().toISOString().split('T')[0], 7, 75.4, 'active', 1);

  console.log('🌱 Sample data seeded');
}

module.exports = { getDB, initDB };
