# RouteFlow Backend API

Complete Node.js + Express backend for the RouteFlow delivery management dashboard.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite via `better-sqlite3` (zero-config, file-based)
- **Real-time**: Socket.io (live vehicle tracking, delivery updates)
- **Auth**: JWT + bcrypt

---

## 🚀 Setup & Run

```bash
cd routeflow-backend
npm install
npm run dev       # Development with auto-reload
npm start         # Production
```

Server starts at: `http://localhost:3000`

---

## 🔌 REST API Endpoints

### Auth
| Method | Endpoint           | Description              |
|--------|--------------------|--------------------------|
| POST   | /api/auth/login    | Login → returns JWT token|
| POST   | /api/auth/register | Create new user account  |
| GET    | /api/auth/me       | Get current user from JWT|

**Login example:**
```json
POST /api/auth/login
{ "email": "admin@routeflow.com", "password": "any" }
```

---

### Deliveries
| Method | Endpoint                        | Description                  |
|--------|---------------------------------|------------------------------|
| GET    | /api/deliveries                 | List all (filter: status, vehicle_id, search, date) |
| GET    | /api/deliveries/:id             | Get single delivery + events |
| POST   | /api/deliveries                 | Create new delivery          |
| PUT    | /api/deliveries/:id             | Update delivery              |
| PATCH  | /api/deliveries/:id/status      | Change status only           |
| DELETE | /api/deliveries/:id             | Delete delivery              |
| GET    | /api/deliveries/:id/events      | Get delivery event timeline  |

**Status values:** `pending` | `transit` | `delivered` | `failed` | `cancelled`

**Create delivery example:**
```json
POST /api/deliveries
{
  "customer_id": 1,
  "vehicle_id": 1,
  "scheduled_time": "10:30",
  "priority": "high",
  "notes": "Leave at door"
}
```

---

### Routes
| Method | Endpoint              | Description                              |
|--------|-----------------------|------------------------------------------|
| GET    | /api/routes           | All routes (filter: date, vehicle_id)    |
| GET    | /api/routes/live      | Live dashboard summary (stats + stops)   |
| GET    | /api/routes/:id       | Route with ordered stops                 |
| POST   | /api/routes/optimise  | **Run route optimisation (Nearest Neighbour TSP)** |
| POST   | /api/routes/reset     | Reset stop order to creation order       |

**Optimise route example:**
```json
POST /api/routes/optimise
{ "vehicle_id": 1 }
```

---

### Vehicles
| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| GET    | /api/vehicles               | All vehicles + driver info|
| GET    | /api/vehicles/:id           | Vehicle + deliveries     |
| POST   | /api/vehicles               | Add new vehicle          |
| PUT    | /api/vehicles/:id           | Update vehicle           |
| PATCH  | /api/vehicles/:id/location  | Update GPS coordinates   |
| PATCH  | /api/vehicles/:id/status    | Change vehicle status    |
| DELETE | /api/vehicles/:id           | Delete vehicle           |

---

### Customers
| Method | Endpoint             | Description          |
|--------|----------------------|----------------------|
| GET    | /api/customers       | List (filter: search)|
| GET    | /api/customers/:id   | Customer + history   |
| POST   | /api/customers       | Create customer      |
| PUT    | /api/customers/:id   | Update customer      |
| DELETE | /api/customers/:id   | Delete customer      |

---

### Analytics
| Method | Endpoint                              | Description               |
|--------|---------------------------------------|---------------------------|
| GET    | /api/analytics/overview               | KPI summary               |
| GET    | /api/analytics/deliveries-by-day      | 7-day trend               |
| GET    | /api/analytics/deliveries-by-status   | Status breakdown          |
| GET    | /api/analytics/vehicle-performance    | Per-vehicle stats         |
| GET    | /api/analytics/top-customers          | Top 10 customers          |
| GET    | /api/analytics/hourly-distribution    | Deliveries by hour        |

---

## 🔄 Socket.io Real-time Events

### Server → Client (listen for these in frontend)
| Event                    | Payload                            |
|--------------------------|------------------------------------|
| `live:snapshot`          | `{ stats, vehicles }`              |
| `delivery:created`       | delivery object                    |
| `delivery:updated`       | delivery object                    |
| `delivery:statusChanged` | `{ id, status, delivery }`         |
| `delivery:deleted`       | `{ id }`                           |
| `vehicle:locationUpdated`| `{ id, lat, lng, name }`           |
| `vehicle:statusChanged`  | `{ id, status }`                   |
| `vehicle:added`          | vehicle object                     |
| `route:optimised`        | `{ stops, total_distance }`        |
| `route:reset`            | `{ message }`                      |

### Client → Server (emit these from frontend)
| Event                    | Payload                            |
|--------------------------|------------------------------------|
| `join:vehicle`           | `vehicleId`                        |
| `join:route`             | `routeId`                          |
| `driver:location`        | `{ vehicleId, lat, lng }`          |
| `driver:deliveryComplete`| `{ deliveryId, vehicleId }`        |

---

## 🗄️ Database Schema

```
users          → id, name, email, password, role
customers      → id, name, email, phone, address, lat, lng
vehicles       → id, name, type, plate, driver_id, status, lat, lng
deliveries     → id, delivery_number, customer_id, vehicle_id, status, scheduled_time, stop_order, distance_from_depot
routes         → id, name, vehicle_id, date, total_stops, total_distance, optimised
route_stops    → id, route_id, delivery_id, stop_number
delivery_events→ id, delivery_id, event_type, message, created_at
```

---

## 🌱 Sample Data (auto-seeded)
- **4 users** (1 admin, 3 drivers)
- **3 vehicles** (Van Alpha, Bike Beta, Van Gamma)
- **7 customers** across Delhi
- **7 deliveries** (DEL-001 to DEL-007) with mixed statuses
- **1 route** pre-optimised at 75.4 km
