// ─── DATA ────────────────────────────────────────────────
const DEPOT = { lat: 28.6139, lng: 77.2090, name: "Main Distribution Centre" };

const fallbackDeliveries = [
  { id:"DEL-001", name:"Arjun Sharma", address:"Connaught Place, New Delhi", lat:28.6315, lng:77.2167, status:"transit", priority:"high", type:"Fragile", eta:"10:30", dist:3.2 },
  { id:"DEL-002", name:"Priya Mehta", address:"Lajpat Nagar, New Delhi", lat:28.5665, lng:77.2431, status:"pending", priority:"medium", type:"Standard", eta:"11:15", dist:7.1 },
  { id:"DEL-003", name:"Rohan Gupta", address:"Dwarka Sector 12, Delhi", lat:28.5921, lng:77.0460, status:"delivered", priority:"low", type:"Standard", eta:"09:45", dist:14.3 },
  { id:"DEL-004", name:"Sunita Verma", address:"Saket, New Delhi", lat:28.5245, lng:77.2066, status:"pending", priority:"high", type:"Perishable", eta:"12:00", dist:11.8 },
  { id:"DEL-005", name:"Vikram Singh", address:"Rohini Sector 7, Delhi", lat:28.7341, lng:77.1224, status:"transit", priority:"medium", type:"Heavy", eta:"13:30", dist:16.5 },
  { id:"DEL-006", name:"Anjali Patel", address:"Greater Kailash I, Delhi", lat:28.5494, lng:77.2401, status:"pending", priority:"low", type:"Standard", eta:"14:00", dist:9.4 },
  { id:"DEL-007", name:"Deepak Kumar", address:"Pitampura, Delhi", lat:28.7000, lng:77.1300, status:"failed", priority:"medium", type:"Standard", eta:"—", dist:13.1 },
];

let deliveries = [];

let customers = [
  { id:"C-001", fname:"Arjun", lname:"Sharma", phone:"+91 98765 43210", address:"Connaught Place, New Delhi", zone:"Zone E — Central", priority:"VIP", orders:14, email:"arjun@example.com" },
  { id:"C-002", fname:"Priya", lname:"Mehta", phone:"+91 87654 32109", address:"Lajpat Nagar, New Delhi", zone:"Zone B — South", priority:"Premium", orders:7, email:"priya@example.com" },
  { id:"C-003", fname:"Rohan", lname:"Gupta", phone:"+91 76543 21098", address:"Dwarka Sector 12, Delhi", zone:"Zone D — West", priority:"Standard", orders:3, email:"rohan@example.com" },
  { id:"C-004", fname:"Sunita", lname:"Verma", phone:"+91 65432 10987", address:"Saket, New Delhi", zone:"Zone B — South", priority:"VIP", orders:22, email:"sunita@example.com" },
  { id:"C-005", fname:"Vikram", lname:"Singh", phone:"+91 54321 09876", address:"Rohini Sector 7, Delhi", zone:"Zone A — North", priority:"Standard", orders:5, email:"vikram@example.com" },
];

let vehicles = [
  { id:"V-01", name:"Van Alpha", icon:"🚐", driver:"Rahul D.", status:"active", stops:4 },
  { id:"V-02", name:"Bike Beta", icon:"🛵", driver:"Amit K.", status:"busy", stops:2 },
  { id:"V-03", name:"Van Gamma", icon:"🚐", driver:"Suresh P.", status:"idle", stops:0 },
];

const TOKEN_STORAGE_KEY = 'routeflow.authToken';
const USER_STORAGE_KEY = 'routeflow.user';
let uiEventsBound = false;
let dashboardBooted = false;
let vehiclesRefreshInterval = null;
let deliveriesRefreshInterval = null;

function getAuthToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

function setAuthToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function clearAuthSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

function getAuthHeaders(headers = {}) {
  const token = getAuthToken();
  if (!token) return headers;
  return { ...headers, Authorization: `Bearer ${token}` };
}

async function apiFetch(url, options = {}, includeAuth = true) {
  const baseHeaders = options.headers || {};
  const headers = includeAuth ? getAuthHeaders(baseHeaders) : baseHeaders;
  return fetch(url, { ...options, headers });
}

function getNameInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'DP';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function updateHeaderUser(user) {
  const avatar = document.querySelector('.avatar');
  if (!avatar) return;
  avatar.textContent = getNameInitials(user?.name || 'Dispatcher');
}

function setAuthMode(mode) {
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  const loginForm = document.getElementById('form-login');
  const signupForm = document.getElementById('form-signup');
  if (!loginForm || !signupForm) return;

  loginForm.classList.toggle('active', mode === 'login');
  signupForm.classList.toggle('active', mode === 'signup');
}

function showAuthScreen() {
  document.body.classList.add('auth-only');
}

function showDashboard() {
  document.body.classList.remove('auth-only');
}

function requireSession(message = 'Session expired. Please login again.') {
  clearAuthSession();
  dashboardBooted = false;
  if (vehiclesRefreshInterval) {
    clearInterval(vehiclesRefreshInterval);
    vehiclesRefreshInterval = null;
  }
  if (deliveriesRefreshInterval) {
    clearInterval(deliveriesRefreshInterval);
    deliveriesRefreshInterval = null;
  }
  disconnectSocket();
  showAuthScreen();
  setAuthMode('login');
  toast(message, 'warning');
}

async function restoreSession() {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const response = await apiFetch('/api/auth/me');
    if (!response.ok) {
      clearAuthSession();
      return false;
    }

    const user = await response.json();
    setStoredUser(user);
    updateHeaderUser(user);
    return true;
  } catch {
    clearAuthSession();
    return false;
  }
}

async function submitLogin() {
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    toast('Please enter email and password', 'error');
    return;
  }

  try {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, false);

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Login failed');
    }

    setAuthToken(payload.token);
    setStoredUser(payload.user);
    updateHeaderUser(payload.user);
    showDashboard();
    toast('Login successful', 'success');
    await startDashboard();
  } catch (error) {
    toast(error.message || 'Login failed', 'error');
  }
}

async function submitSignup() {
  const name = document.getElementById('signup-name')?.value.trim();
  const email = document.getElementById('signup-email')?.value.trim();
  const password = document.getElementById('signup-password')?.value;

  if (!name || !email || !password) {
    toast('Please complete all signup fields', 'error');
    return;
  }

  try {
    const response = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role: 'dispatcher' }),
    }, false);

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Signup failed');
    }

    setAuthToken(payload.token);
    setStoredUser(payload.user);
    updateHeaderUser(payload.user);
    showDashboard();
    toast('Account created successfully', 'success');
    await startDashboard();
  } catch (error) {
    toast(error.message || 'Signup failed', 'error');
  }
}

function logout() {
  clearAuthSession();
  dashboardBooted = false;
  if (vehiclesRefreshInterval) {
    clearInterval(vehiclesRefreshInterval);
    vehiclesRefreshInterval = null;
  }
  if (deliveriesRefreshInterval) {
    clearInterval(deliveriesRefreshInterval);
    deliveriesRefreshInterval = null;
  }
  disconnectSocket();
  showAuthScreen();
  setAuthMode('login');
  toast('Logged out successfully', 'warning');
}

async function startDashboard() {
  showDashboard();

  if (dashboardBooted) {
    await Promise.all([refreshDeliveries(), refreshVehicles(), loadCustomers()]);
    renderCustomers();
    renderAnalytics();
    if (map) {
      setTimeout(() => map.invalidateSize(), 100);
    }
    return;
  }

  await Promise.all([loadDeliveries(), loadCustomers(), loadVehicles()]);
  initMap();
  renderCustomers();
  renderAnalytics();
  initSocket();

  vehiclesRefreshInterval = window.setInterval(() => {
    refreshVehicles().catch((error) => console.error('Vehicle refresh failed:', error));
  }, 15000);
  deliveriesRefreshInterval = window.setInterval(() => {
    refreshDeliveries().catch((error) => console.error('Delivery refresh failed:', error));
  }, 15000);

  dashboardBooted = true;
}

// ─── MAP ─────────────────────────────────────────────────
let map, markers = {}, routeLayer = null, optimised = false;
let optimisedOrder = [];
let addressSuggestions = [];
let addressSuggestDebounce = null;
let selectedAddressSuggestion = null;

function normalizeDelivery(delivery, index = 0) {
  const lat = Number(delivery.lat ?? delivery.latitude);
  const lng = Number(delivery.lng ?? delivery.longitude);
  const rawId = typeof delivery.id === 'string' ? delivery.id : '';
  const mongoId = delivery._id || (/^[a-f0-9]{24}$/i.test(rawId) ? rawId : '');
  const orderId = delivery.orderId || (!mongoId ? rawId : '') || `DEL-${String(index + 1).padStart(3, '0')}`;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    ...delivery,
    id: mongoId || orderId,
    orderId,
    name: delivery.name || delivery.customerName || 'Unknown Customer',
    address: delivery.address || 'Address unavailable',
    lat,
    lng,
    status: String(delivery.status || 'pending').toLowerCase(),
    priority: delivery.priority || 'medium',
    type: delivery.type || 'Standard',
    eta: delivery.eta || 'TBD',
    dist: Number.isFinite(Number(delivery.dist))
      ? Number(delivery.dist)
      : parseFloat((Math.hypot(lat - DEPOT.lat, lng - DEPOT.lng) * 111).toFixed(1))
  };
}

function normalizeCustomer(customer, index = 0) {
  const fullName = String(customer.name || `${customer.fname || ''} ${customer.lname || ''}`).trim() || `Customer ${index + 1}`;
  const parts = fullName.split(/\s+/);
  const fname = parts.shift() || fullName;
  const lname = parts.join(' ');

  return {
    ...customer,
    id: customer.id || customer._id || `C-${String(index + 1).padStart(3, '0')}`,
    name: fullName,
    fname,
    lname,
    phone: customer.phone || 'Not provided',
    address: customer.address || 'Address unavailable',
    zone: customer.zone || 'Zone not set',
    priority: customer.priority || 'Standard',
    orders: Number.isFinite(Number(customer.orders)) ? Number(customer.orders) : 0,
    email: customer.email || '',
  };
}

function vehicleIcon(type = '') {
  const value = String(type).toLowerCase();
  if (value.includes('bike')) return 'ðŸ›µ';
  if (value.includes('truck')) return 'ðŸšš';
  return 'ðŸš';
}

function normalizeVehicle(vehicle, index = 0) {
  const status = String(vehicle.status || 'idle').toLowerCase();
  const activeStops = Number.isFinite(Number(vehicle.active_stops))
    ? Number(vehicle.active_stops)
    : Number.isFinite(Number(vehicle.stops))
      ? Number(vehicle.stops)
      : 0;

  return {
    ...vehicle,
    id: vehicle.id || vehicle._id || `V-${String(index + 1).padStart(2, '0')}`,
    name: vehicle.name || `Vehicle ${index + 1}`,
    icon: vehicle.icon || vehicleIcon(vehicle.type),
    driver: vehicle.driver || vehicle.driver_name || vehicle.driverName || 'Unassigned',
    status: status === 'busy' ? 'active' : status,
    stops: activeStops,
  };
}

async function loadDeliveries() {
  try {
    const response = await apiFetch('/api/deliveries');
    if (response.status === 401) {
      requireSession();
      return;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const source = Array.isArray(payload) ? payload : payload.deliveries;

    if (!Array.isArray(source)) {
      throw new Error('Unexpected deliveries payload');
    }

    deliveries = source
      .map((delivery, index) => normalizeDelivery(delivery, index))
      .filter(Boolean);
  } catch (error) {
    deliveries = fallbackDeliveries
      .map((delivery, index) => normalizeDelivery(delivery, index))
      .filter(Boolean);
    toast('Live deliveries could not be loaded. Showing fallback data.', 'warning');
    console.error('Failed to load deliveries:', error);
  }
}

async function loadCustomers() {
  try {
    const response = await apiFetch('/api/customers');
    if (response.status === 401) {
      requireSession();
      return;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    customers = (Array.isArray(payload) ? payload : [])
      .map((customer, index) => normalizeCustomer(customer, index));
  } catch (error) {
    customers = customers.map((customer, index) => normalizeCustomer(customer, index));
    toast('Live customers could not be loaded. Showing fallback data.', 'warning');
    console.error('Failed to load customers:', error);
  }
}

async function loadVehicles() {
  try {
    const response = await apiFetch('/api/vehicles');
    if (response.status === 401) {
      requireSession();
      return;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    vehicles = (Array.isArray(payload) ? payload : [])
      .map((vehicle, index) => normalizeVehicle(vehicle, index));
  } catch (error) {
    vehicles = vehicles.map((vehicle, index) => normalizeVehicle(vehicle, index));
    toast('Live vehicles could not be loaded. Showing fallback data.', 'warning');
    console.error('Failed to load vehicles:', error);
  }
}

async function refreshVehicles() {
  await loadVehicles();
  renderVehicles();
}

async function refreshDeliveries() {
  await loadDeliveries();
  renderDeliveryList();
  renderMapMarkers();
  renderRouteStops();
  updateStats();
}

async function setDeliveryStatus(id, status) {
  try {
    const response = await apiFetch(`/api/deliveries/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (response.status === 401) {
      requireSession();
      return;
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || `HTTP ${response.status}`);
    }

    await refreshDeliveries();
    await refreshVehicles();
    const updated = deliveries.find((delivery) => delivery.id === id);
    toast(`Delivery ${(updated?.orderId || updated?.id || id)} marked ${status}`, 'success');
  } catch (error) {
    toast(error.message || 'Could not update delivery status', 'error');
    console.error('Failed to update delivery status:', error);
  }
}

async function setVehicleStatus(id, status) {
  try {
    const response = await apiFetch(`/api/vehicles/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (response.status === 401) {
      requireSession();
      return;
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || `HTTP ${response.status}`);
    }

    await refreshVehicles();
    toast(`Vehicle status set to ${status}`, 'success');
  } catch (error) {
    toast(error.message || 'Could not update vehicle status', 'error');
    console.error('Failed to update vehicle status:', error);
  }
}

function initMap() {
  map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([DEPOT.lat, DEPOT.lng], 12);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  const depotIcon = L.divIcon({
    className: 'map-pin depot-pin',
    html: `<div class="pin-core">D</div>`,
    iconSize: [42, 54],
    iconAnchor: [21, 50],
    popupAnchor: [0, -42]
  });
  L.marker([DEPOT.lat, DEPOT.lng], { icon: depotIcon })
    .addTo(map)
    .bindPopup(`<div class="map-popup"><strong>${DEPOT.name}</strong><span>Delivery Hub</span></div>`);

  renderDeliveryList();
  renderMapMarkers();
  renderRouteStops();
  renderVehicles();
  updateStats();
  setTimeout(() => {
    document.getElementById('map-loader').classList.add('hidden');
  }, 1200);
}

function renderMapMarkers() {
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};

  const colors = { pending:'#f4b942', transit:'#4285f4', delivered:'#34a853', failed:'#ea4335' };

  deliveries.forEach((d, i) => {
    const col = colors[d.status] || '#5f6368';
    const icon = L.divIcon({
      className: `map-pin delivery-pin status-${d.status}`,
      html: `<div class="pin-core" style="--pin-color:${col}">${i + 1}</div>`,
      iconSize: [38, 48],
      iconAnchor: [19, 44],
      popupAnchor: [0, -36]
    });
    markers[d.id] = L.marker([d.lat, d.lng], { icon })
      .addTo(map)
      .bindPopup(
        `
        <div class="map-popup">
          <strong>${d.name}</strong>
          <span>${d.address}</span>
          <span class="popup-status" style="--popup-color:${col}">${d.status.toUpperCase()} · ETA ${d.eta}</span>
        </div>
        `
      );
  });
}

function renderDeliveryList(filter='') {
  const list = document.getElementById('delivery-list');
  const filtered = deliveries.filter(d =>
    d.name.toLowerCase().includes(filter.toLowerCase()) ||
    d.address.toLowerCase().includes(filter.toLowerCase()) ||
    (d.orderId || d.id).toLowerCase().includes(filter.toLowerCase())
  );

  document.getElementById('delivery-count').textContent = filtered.length;

  list.innerHTML = filtered.map(d => `
    <div class="delivery-card priority-${d.priority}" data-action="focus-delivery" data-delivery-id="${d.id}">
      <div class="card-top">
        <span class="card-id">${d.orderId || d.id}</span>
        <span class="status-tag status-${d.status}">${d.status}</span>
      </div>
      <div class="card-name">${d.name}</div>
      <div class="card-addr">${d.address}</div>
      <div class="card-meta">
        <span>📦 ${d.type}</span>
        <span>📏 ${d.dist}km</span>
        <span>⏱ ${d.eta}</span>
      </div>
      <div class="card-actions">
        ${d.status !== 'transit' ? `<button class="mini-action" data-action="set-delivery-status" data-delivery-id="${d.id}" data-status="transit">Start</button>` : ''}
        ${d.status !== 'delivered' ? `<button class="mini-action primary" data-action="set-delivery-status" data-delivery-id="${d.id}" data-status="delivered">Delivered</button>` : ''}
      </div>
    </div>
  `).join('');
}

function renderRouteStops() {
  const list = document.getElementById('route-stops-list');
  const ordered = optimised
    ? (optimisedOrder.length ? optimisedOrder : getOptimisedOrder())
    : deliveries;
  
  list.innerHTML = `
    <div class="stop-item">
      <div class="stop-num depot">D</div>
      <div class="stop-info">
        <div class="stop-name">Distribution Centre</div>
        <div class="stop-dist">Origin • Depot</div>
      </div>
    </div>
    ${ordered.map((d,i) => `
      <div class="stop-item" data-action="focus-delivery" data-delivery-id="${d.id}">
        <div class="stop-num">${i+1}</div>
        <div class="stop-info">
          <div class="stop-name">${d.name}</div>
          <div class="stop-dist">${d.dist}km from depot</div>
        </div>
        <span class="stop-eta">${d.eta}</span>
      </div>
    `).join('')}
  `;
}

function renderVehicles() {
  document.getElementById('vehicle-list').innerHTML = vehicles.map(v => `
    <div class="vehicle-item ${v.status==='active'?'active':''}">
      <div class="v-icon">${v.icon}</div>
      <div class="v-info">
        <div class="v-name">${v.name}</div>
        <div class="vehicle-actions">
          ${v.status !== 'active' ? `<button class="mini-action" data-action="set-vehicle-status" data-vehicle-id="${v.id}" data-status="active">Set Active</button>` : ''}
          ${v.status !== 'idle' ? `<button class="mini-action" data-action="set-vehicle-status" data-vehicle-id="${v.id}" data-status="idle">Set Idle</button>` : ''}
        </div>
        <div class="v-sub">${v.driver} · ${v.stops} stops</div>
      </div>
      <div class="v-status ${v.status}"></div>
    </div>
  `).join('');
}

function updateStats() {
  const done = deliveries.filter(d=>d.status==='delivered').length;
  const pending = deliveries.filter(d=>d.status==='pending').length;
  const dist = deliveries.reduce((s,d)=>s+d.dist, 0).toFixed(1);
  document.getElementById('stat-stops').textContent = deliveries.length;
  document.getElementById('stat-dist').textContent = dist + ' km';
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-pending').textContent = pending;
}

function focusDelivery(id) {
  const d = deliveries.find(x=>x.id===id);
  if(!d) return;
  map.flyTo([d.lat, d.lng], 15, { duration: 0.8 });
  if(markers[id]) markers[id].openPopup();
  document.querySelectorAll('.delivery-card').forEach(c => c.classList.remove('selected'));
}

function filterDeliveries(val) { renderDeliveryList(val); }

function getOptimisedOrder() {
  // Nearest-neighbour heuristic from depot
  const unvisited = [...deliveries];
  const order = [];
  let cur = DEPOT;
  while(unvisited.length) {
    let best = null, bestDist = Infinity, bestIdx = -1;
    unvisited.forEach((d,i) => {
      const dist = Math.hypot(d.lat-cur.lat, d.lng-cur.lng);
      if(dist < bestDist) { bestDist=dist; best=d; bestIdx=i; }
    });
    order.push(best);
    cur = best;
    unvisited.splice(bestIdx,1);
  }
  return order;
}

function drawRoute(order, geometryCoordinates = null) {
  if(routeLayer) map.removeLayer(routeLayer);
  const pts = Array.isArray(geometryCoordinates) && geometryCoordinates.length
    ? geometryCoordinates.map(([lng, lat]) => [lat, lng])
    : [[DEPOT.lat, DEPOT.lng], ...order.map(d=>[d.lat, d.lng]), [DEPOT.lat, DEPOT.lng]];
  routeLayer = L.polyline(pts, {
    color: '#4285f4',
    weight: 5,
    opacity: 0.9,
    lineJoin: 'round'
  }).addTo(map);
  map.fitBounds(routeLayer.getBounds(), { padding: [60,60] });
}

async function optimizeRoute() {
  const candidates = deliveries.filter(d => !['delivered', 'failed', 'cancelled'].includes((d.status || '').toLowerCase()));
  if (!candidates.length) {
    toast('No pending stops available to optimise', 'warning');
    return;
  }

  try {
    const response = await apiFetch('/api/routes/optimise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stops: candidates.map(d => ({
          id: d.id,
          orderId: d.id,
          customerName: d.name,
          name: d.name,
          address: d.address,
          lat: d.lat,
          lng: d.lng,
          status: d.status,
          priority: d.priority,
          type: d.type,
          eta: d.eta,
          dist: d.dist
        }))
      })
    });

    if (response.status === 401) {
      requireSession();
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const serverOrder = Array.isArray(payload.optimised_stops)
      ? payload.optimised_stops
          .map((stop, index) => normalizeDelivery(stop, index))
          .filter(Boolean)
      : [];

    if (!serverOrder.length) {
      throw new Error('No optimised stops returned from API');
    }

    optimised = true;
    optimisedOrder = serverOrder;
    drawRoute(serverOrder, payload.route_geometry?.coordinates || null);
    renderRouteStops();

    const km = Number(payload.total_distance_km);
    const distanceLabel = Number.isFinite(km) ? `${km.toFixed(1)} km` : 'calculated distance';
    toast(`Route optimised via OSRM — ${distanceLabel}`, 'success');
  } catch (error) {
    // Keep dashboard usable if external routing provider is temporarily unavailable.
    const fallbackOrder = getOptimisedOrder();
    optimised = true;
    optimisedOrder = fallbackOrder;
    drawRoute(fallbackOrder);
    renderRouteStops();
    toast('Live routing unavailable. Used local shortest-distance fallback.', 'warning');
    console.error('OSRM optimize failed:', error);
  }
}

function resetRoute() {
  optimised = false;
  optimisedOrder = [];
  if(routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  renderRouteStops();
  centerMap();
  toast('Route reset to default order', 'warning');
}

function centerMap() { map.flyTo([DEPOT.lat, DEPOT.lng], 12, { duration: 0.8 }); }
function mapZoom(dir) { map.setZoom(map.getZoom() + dir); }

// ─── ADD DELIVERY ────────────────────────────────────────
function openAddDelivery() { document.getElementById('modal-delivery').classList.add('open'); }

function setAddressMeta(message = 'Suggestions include full address and postcode.') {
  const meta = document.getElementById('d-addr-meta');
  if (meta) meta.textContent = message;
}

function clearAddressSuggestions() {
  addressSuggestions = [];
  const list = document.getElementById('d-addr-suggestions');
  if (!list) return;
  list.classList.add('hidden');
  list.innerHTML = '';
}

function renderAddressSuggestions() {
  const list = document.getElementById('d-addr-suggestions');
  if (!list) return;

  if (!addressSuggestions.length) {
    list.innerHTML = '';
    list.classList.add('hidden');
    return;
  }

  list.innerHTML = addressSuggestions
    .map((item, index) => {
      const localityParts = [item.postcode, item.city, item.state].filter(Boolean);
      const locality = localityParts.length ? localityParts.join(' • ') : (item.country || 'Address suggestion');

      return `
        <button class="address-suggestion" data-action="select-address-suggestion" data-index="${index}" type="button">
          <div class="address-suggestion-main">${item.display_name}</div>
          <div class="address-suggestion-sub">${locality}</div>
        </button>
      `;
    })
    .join('');

  list.classList.remove('hidden');
}

function applyAddressSuggestion(suggestion) {
  if (!suggestion) return;

  selectedAddressSuggestion = suggestion;
  document.getElementById('d-addr').value = suggestion.display_name;
  document.getElementById('d-lat').value = Number(suggestion.lat).toFixed(6);
  document.getElementById('d-lng').value = Number(suggestion.lng).toFixed(6);

  const locality = [suggestion.postcode, suggestion.city, suggestion.state]
    .filter(Boolean)
    .join(' • ');
  setAddressMeta(locality || 'Coordinates auto-filled from selected address.');

  clearAddressSuggestions();
}

async function searchAddressSuggestions(query) {
  const response = await apiFetch(`/api/routes/address-suggest?q=${encodeURIComponent(query)}`);
  if (response.status === 401) {
    requireSession();
    return [];
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload.suggestions) ? payload.suggestions : [];
}

async function geocodeAddress(query) {
  const response = await apiFetch(`/api/routes/address-geocode?q=${encodeURIComponent(query)}`);
  if (response.status === 401) {
    requireSession();
    return null;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return payload.result || null;
}

function queueAddressLookup(query) {
  if (addressSuggestDebounce) clearTimeout(addressSuggestDebounce);

  if (query.length < 3) {
    clearAddressSuggestions();
    setAddressMeta('Type at least 3 characters to search addresses.');
    return;
  }

  addressSuggestDebounce = setTimeout(async () => {
    try {
      const suggestions = await searchAddressSuggestions(query);
      addressSuggestions = suggestions;
      renderAddressSuggestions();

      if (!suggestions.length) {
        setAddressMeta('No matching addresses found. Try adding area or postcode.');
      } else {
        setAddressMeta('Select an address to auto-fill coordinates.');
      }
    } catch (error) {
      clearAddressSuggestions();
      setAddressMeta('Address lookup unavailable. You can still continue with manual text.');
      console.error('Address suggestion failed:', error);
    }
  }, 320);
}

function resetDeliveryFormAssistants() {
  selectedAddressSuggestion = null;
  if (addressSuggestDebounce) {
    clearTimeout(addressSuggestDebounce);
    addressSuggestDebounce = null;
  }
  clearAddressSuggestions();
  setAddressMeta('Suggestions include full address and postcode.');
}

async function addDelivery() {
  const name = document.getElementById('d-name').value.trim();
  const addr = document.getElementById('d-addr').value.trim();
  let lat = parseFloat(document.getElementById('d-lat').value);
  let lng = parseFloat(document.getElementById('d-lng').value);
  const priority = document.getElementById('d-priority').value;
  const type = document.getElementById('d-type').value;
  const notes = document.getElementById('d-notes').value.trim();

  if(!name || !addr) { toast('Please fill in name and address', 'error'); return; }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    try {
      const resolved = selectedAddressSuggestion || await geocodeAddress(addr);
      if (resolved) {
        lat = Number(resolved.lat);
        lng = Number(resolved.lng);
        document.getElementById('d-lat').value = lat.toFixed(6);
        document.getElementById('d-lng').value = lng.toFixed(6);
      }
    } catch (error) {
      console.error('Address geocode failed:', error);
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    toast('Please select an address suggestion to auto-fill map coordinates', 'error');
    return;
  }

  const payload = {
    customerName: name,
    name,
    address: addr,
    lat,
    lng,
    priority,
    type,
    notes,
    status: 'pending',
    eta: `${String(10 + deliveries.length % 8).padStart(2,'0')}:00`,
    dist: parseFloat((Math.hypot(lat-DEPOT.lat, lng-DEPOT.lng) * 111).toFixed(1))
  };

  const newDel = normalizeDelivery(payload, deliveries.length);

  try {
    const response = await apiFetch('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {
      requireSession();
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    const saved = normalizeDelivery(result.delivery || result, deliveries.length) || newDel;
    deliveries.unshift(saved);
    renderDeliveryList();
    renderMapMarkers();
    renderRouteStops();
    updateStats();
    closeModal('modal-delivery');
    toast(`Delivery ${saved.id} added successfully`, 'success');
    ['d-name','d-addr','d-lat','d-lng','d-notes'].forEach(id=>document.getElementById(id).value='');
    resetDeliveryFormAssistants();
  } catch (error) {
    toast('Could not save delivery to the backend', 'error');
    console.error('Failed to add delivery:', error);
  }
}

// ─── CUSTOMERS ───────────────────────────────────────────
function renderCustomers(filter='') {
  const tbody = document.getElementById('customer-tbody');
  const filtered = customers.filter(c =>
    (c.fname+' '+c.lname).toLowerCase().includes(filter.toLowerCase()) ||
    c.address.toLowerCase().includes(filter.toLowerCase()) ||
    c.id.toLowerCase().includes(filter.toLowerCase())
  );

  const priorityColors = { VIP:'var(--accent)', Premium:'var(--accent2)', Standard:'var(--text3)' };

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td class="td-mono">${c.id}</td>
      <td style="font-weight:500">${c.fname} ${c.lname}</td>
      <td class="td-mono">${c.phone}</td>
      <td style="color:var(--text2);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.address}</td>
      <td class="td-mono" style="font-size:11px;">${c.zone}</td>
      <td><span style="color:${priorityColors[c.priority]||'var(--text3)'};font-size:12px;font-weight:600;">${c.priority}</span></td>
      <td class="td-accent" style="font-family:var(--font-mono)">${c.orders}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button data-action="delete-customer" data-customer-id="${c.id}" style="padding:4px 10px;background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);border-radius:6px;color:var(--danger);font-size:11px;cursor:pointer;font-family:var(--font-body);">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterCustomers(val) { renderCustomers(val); }

function openAddCustomer() { document.getElementById('modal-customer').classList.add('open'); }

function addCustomer() {
  const fname = document.getElementById('c-fname').value.trim();
  const lname = document.getElementById('c-lname').value.trim();
  const addr = document.getElementById('c-addr').value.trim();
  const phone = document.getElementById('c-phone').value.trim();
  const zone = document.getElementById('c-zone').value;
  const priority = document.getElementById('c-priority').value;
  const email = document.getElementById('c-email').value.trim();

  if(!fname || !addr) { toast('Please fill in required fields', 'error'); return; }

  const priorityLabel = { low:'Standard', medium:'Premium', high:'VIP' };
  const payload = {
    name: `${fname} ${lname}`.trim(),
    phone,
    address: addr,
    zone,
    priority: priorityLabel[priority] || 'Standard',
    orders: 0,
    email
  };

  apiFetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(async (response) => {
      if (response.status === 401) {
        requireSession();
        return null;
      }

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || `HTTP ${response.status}`);
      }

      return response.json();
    })
    .then((savedCustomer) => {
      if (!savedCustomer) return;
      customers.unshift(normalizeCustomer(savedCustomer, customers.length));
      renderCustomers();
      closeModal('modal-customer');
      toast(`Customer ${payload.name} added`, 'success');
      ['c-fname','c-lname','c-addr','c-phone','c-email'].forEach(id=>document.getElementById(id).value='');
    })
    .catch((error) => {
      toast(error.message || 'Could not save customer to the backend', 'error');
      console.error('Failed to add customer:', error);
    });
}

function deleteCustomer(id) {
  apiFetch(`/api/customers/${id}`, {
    method: 'DELETE'
  })
    .then(async (response) => {
      if (response.status === 401) {
        requireSession();
        return;
      }

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || `HTTP ${response.status}`);
      }

      customers = customers.filter(c => c.id !== id);
      renderCustomers();
      toast('Customer removed', 'warning');
    })
    .catch((error) => {
      toast(error.message || 'Could not delete customer', 'error');
      console.error('Failed to delete customer:', error);
    });
}

// ─── ANALYTICS ───────────────────────────────────────────

// Circumference of the donut ring (r=40, C = 2πr ≈ 251.2)
const DONUT_CIRCUMFERENCE = 2 * Math.PI * 40;

/**
 * Render the KPI cards from /api/analytics/overview data.
 * Gracefully falls back to "—" on missing values.
 */
function renderKPICards(overview) {
  const deliveriesToday = overview?.deliveries?.total ?? '—';
  const successRate = overview?.deliveries?.success_rate != null
    ? `${overview.deliveries.success_rate}%`
    : '—';
  const totalDistance = overview?.total_distance_km != null
    ? `${overview.total_distance_km} km`
    : '—';
  const activeFleet = overview?.vehicles?.active ?? '—';

  const setEl = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setEl('kpi-deliveries-today', deliveriesToday);
  setEl('kpi-ontime-rate', successRate);
  setEl('kpi-total-distance', totalDistance);
  setEl('kpi-active-fleet', activeFleet);

  if (overview?.deliveries?.total != null) {
    const sub = document.getElementById('kpi-deliveries-sub');
    if (sub) sub.textContent = `${overview.deliveries.delivered || 0} delivered`;
  }
  if (overview?.vehicles?.total_vehicles != null) {
    const sub = document.getElementById('kpi-fleet-sub');
    if (sub) sub.textContent = `of ${overview.vehicles.total_vehicles} total`;
  }
}

/**
 * Render the Weekly Deliveries bar chart from /api/analytics/deliveries-by-day data.
 * Expects an array of { date, total, delivered, failed }.
 */
function renderWeeklyChart(rows) {
  const chart = document.getElementById('weekly-chart');
  if (!chart) return;

  if (!Array.isArray(rows) || !rows.length) {
    chart.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:12px;">No delivery data available</div>';
    return;
  }

  const max = Math.max(...rows.map((r) => r.total), 1);
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const colours = ['var(--accent2)', 'var(--accent2)', 'var(--accent2)', 'var(--accent2)', 'var(--accent2)', 'var(--accent)', 'var(--accent)'];

  chart.innerHTML = rows.map((row) => {
    const date = new Date(row.date);
    const dayLabel = Number.isNaN(date.getTime()) ? row.date : dayLabels[date.getDay()];
    const heightPct = Math.round((row.total / max) * 100);
    const colourIdx = Number.isNaN(date.getTime()) ? 0 : date.getDay();
    return `
      <div class="bar-wrap">
        <div class="bar-val">${row.total}</div>
        <div class="bar" style="height:${heightPct}%;--bar-color:${colours[colourIdx % colours.length]}"></div>
        <div class="bar-label">${dayLabel}</div>
      </div>
    `;
  }).join('');
}

/**
 * Render the Delivery Status Breakdown donut chart.
 * Expects an array of { status, count }.
 * Segment order: delivered → transit → pending → failed.
 */
function renderDonutChart(rows) {
  if (!Array.isArray(rows)) return;

  const statusMap = { delivered: 0, transit: 0, pending: 0, failed: 0 };
  let total = 0;
  rows.forEach((row) => {
    const key = String(row.status || '').toLowerCase();
    if (key in statusMap) statusMap[key] = row.count;
    total += row.count;
  });

  if (total === 0) return;

  // Update total label
  const totalEl = document.getElementById('donut-total');
  if (totalEl) totalEl.textContent = total;

  // Compute arc lengths and offsets for each segment
  const C = DONUT_CIRCUMFERENCE;
  const order = ['delivered', 'transit', 'pending', 'failed'];
  let cumulativeOffset = 0; // offset starts at 0 (12 o'clock = 0deg = no offset)

  // SVG stroke-dashoffset starts at 3 o'clock by default; rotate -90° (offset = -C*0.25) not needed
  // since we use cumulative offsets starting from the same reference point.
  // Arc is drawn clockwise; we negate offset to start from the top (standard convention).
  const START_OFFSET = -(C * 0.25); // rotate 90° counter-clockwise so first segment starts at top

  order.forEach((status) => {
    const circle = document.getElementById(`donut-${status}`);
    if (!circle) return;

    const pct = statusMap[status] / total;
    const arc = pct * C;
    const gap = C - arc;

    circle.setAttribute('stroke-dasharray', `${arc.toFixed(2)} ${gap.toFixed(2)}`);
    circle.setAttribute('stroke-dashoffset', (START_OFFSET - cumulativeOffset).toFixed(2));
    cumulativeOffset += arc;

    const legendEl = document.getElementById(`legend-${status}`);
    if (legendEl) legendEl.textContent = Math.round(pct * 100);
  });
}

/**
 * Render a single activity log row and return its HTML string.
 */
function buildActivityRow(event) {
  const stCol = {
    NEW_DELIVERY: 'var(--accent)',
    STATUS_CHANGE: 'var(--accent2)',
    ROUTE_OPTIMIZED: 'var(--accent2)',
    VEHICLE_UPDATED: 'var(--warning)',
    SYSTEM: 'var(--text3)',
  };

  const statusLabels = {
    NEW_DELIVERY: 'new',
    STATUS_CHANGE: event.details?.status || 'updated',
    ROUTE_OPTIMIZED: 'optimised',
    VEHICLE_UPDATED: 'vehicle',
    SYSTEM: 'system',
  };

  const ts = event.timestamp ? new Date(event.timestamp) : null;
  const timeStr = ts && !Number.isNaN(ts.getTime())
    ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  const colour = stCol[event.eventType] || 'var(--text3)';
  const label = statusLabels[event.eventType] || (event.eventType || 'event').toLowerCase();
  const driver = event.driverId || event.details?.driverName || 'System';

  return `
    <tr>
      <td style="padding:9px 14px;font-family:var(--font-mono);font-size:11px;color:var(--text3);">${timeStr}</td>
      <td style="padding:9px 14px;font-size:13px;color:var(--text);">${event.message || '—'}</td>
      <td style="padding:9px 14px;font-size:12px;color:var(--text2);">${driver}</td>
      <td style="padding:9px 14px;">
        <span style="font-size:11px;padding:2px 8px;border-radius:5px;background:${colour}18;color:${colour};border:1px solid ${colour}33">${label}</span>
      </td>
    </tr>
  `;
}

/**
 * Render the Activity Log from /api/analytics/events data.
 */
function renderActivityLog(events) {
  const tbody = document.getElementById('activity-log');
  if (!tbody) return;

  if (!Array.isArray(events) || !events.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="padding:16px;color:var(--text3);text-align:center;">No recent activity</td></tr>';
    return;
  }

  tbody.innerHTML = events.map(buildActivityRow).join('');
}

/**
 * Prepend a single new event to the Activity Log, keeping only the latest 10 rows.
 */
function prependActivityRow(event) {
  const tbody = document.getElementById('activity-log');
  if (!tbody) return;

  // Remove "no activity" placeholder if present
  const placeholder = tbody.querySelector('td[colspan="4"]');
  if (placeholder) tbody.innerHTML = '';

  tbody.insertAdjacentHTML('afterbegin', buildActivityRow(event));

  // Keep rolling window of 10
  const rows = tbody.querySelectorAll('tr');
  if (rows.length > 10) {
    rows[rows.length - 1].remove();
  }
}

/**
 * Fetch all analytics data in parallel and render every section of the dashboard.
 */
async function renderAnalytics() {
  try {
    const [overviewRes, byDayRes, byStatusRes, eventsRes] = await Promise.all([
      apiFetch('/api/analytics/overview'),
      apiFetch('/api/analytics/deliveries-by-day'),
      apiFetch('/api/analytics/deliveries-by-status'),
      apiFetch('/api/analytics/events'),
    ]);

    // Handle 401 consistently
    if ([overviewRes, byDayRes, byStatusRes, eventsRes].some((r) => r.status === 401)) {
      requireSession();
      return;
    }

    const [overview, byDay, byStatus, events] = await Promise.all([
      overviewRes.ok ? overviewRes.json() : null,
      byDayRes.ok ? byDayRes.json() : [],
      byStatusRes.ok ? byStatusRes.json() : [],
      eventsRes.ok ? eventsRes.json() : [],
    ]);

    if (overview) renderKPICards(overview);
    renderWeeklyChart(byDay);
    renderDonutChart(byStatus);
    renderActivityLog(events);
  } catch (error) {
    console.error('Analytics render failed:', error);
    toast('Analytics data could not be loaded', 'warning');
  }
}

// ─── SOCKET.IO CLIENT ────────────────────────────────────

/**
 * Initialise the Socket.io connection and wire event handlers for real-time updates.
 * Called once after the user authenticates.
 */
let socketClient = null;

function initSocket() {
  // Prevent duplicate connections
  if (socketClient && socketClient.connected) return;

  socketClient = window.io ? window.io() : null;
  if (!socketClient) {
    console.warn('Socket.io not available — real-time updates disabled');
    return;
  }

  socketClient.on('connect', () => {
    console.log('🔌 Socket connected:', socketClient.id);
  });

  socketClient.on('disconnect', () => {
    console.warn('❌ Socket disconnected — will auto-reconnect');
  });

  // Delivery status mutations → refresh charts and KPI cards
  socketClient.on('DELIVERY_UPDATED', () => {
    renderAnalytics();
  });

  socketClient.on('delivery:statusChanged', () => {
    renderAnalytics();
  });

  // Route optimised → refresh KPI cards (distance changes)
  socketClient.on('ROUTE_OPTIMIZED', () => {
    renderAnalytics();
  });

  // New audit event → prepend to Activity Log without a full re-fetch
  socketClient.on('analytics:newEvent', (event) => {
    prependActivityRow(event);
    // Also bump the KPI cards to stay in sync
    renderAnalytics();
  });

  // Live vehicle location updates (already handled by map layer)
  socketClient.on('vehicle:locationUpdated', ({ id, lat, lng }) => {
    if (markers[id]) {
      markers[id].setLatLng([lat, lng]);
    }
  });
}

function disconnectSocket() {
  if (socketClient) {
    socketClient.disconnect();
    socketClient = null;
  }
}

// ─── VIEW SWITCHER ────────────────────────────────────────
function switchView(view) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  
  const viewMap = { map:'view-map', customers:'view-customers', analytics:'view-analytics' };
  const el = document.getElementById(viewMap[view]);
  if (!el) return;
  el.classList.add('active');

  const activeTab = document.querySelector(`.tab-btn[data-view="${view}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  if(view==='customers') {
    loadCustomers().then(() => renderCustomers());
  }
  if(view==='analytics') renderAnalytics();
  if(view==='map') {
    refreshDeliveries();
    refreshVehicles();
    setTimeout(()=>map && map.invalidateSize(), 100);
  }
}

// ─── MODAL ────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'modal-delivery') {
    resetDeliveryFormAssistants();
  }
}
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); });
});

function bindUIEvents() {
  if (uiEventsBound) return;
  uiEventsBound = true;

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const { action } = target.dataset;

    if (action === 'switch-view') {
      switchView(target.dataset.view);
    } else if (action === 'switch-auth-mode') {
      setAuthMode(target.dataset.mode || 'login');
    } else if (action === 'submit-login') {
      event.preventDefault();
      submitLogin();
    } else if (action === 'submit-signup') {
      event.preventDefault();
      submitSignup();
    } else if (action === 'logout') {
      logout();
    } else if (action === 'open-add-delivery') {
      openAddDelivery();
    } else if (action === 'optimize-route') {
      optimizeRoute();
    } else if (action === 'reset-route') {
      resetRoute();
    } else if (action === 'map-zoom') {
      mapZoom(Number(target.dataset.dir || 0));
    } else if (action === 'center-map') {
      centerMap();
    } else if (action === 'open-add-customer') {
      openAddCustomer();
    } else if (action === 'close-modal') {
      closeModal(target.dataset.modal);
    } else if (action === 'add-delivery') {
      addDelivery();
    } else if (action === 'add-customer') {
      addCustomer();
    } else if (action === 'set-delivery-status') {
      event.stopPropagation();
      setDeliveryStatus(target.dataset.deliveryId, target.dataset.status);
    } else if (action === 'set-vehicle-status') {
      event.stopPropagation();
      setVehicleStatus(target.dataset.vehicleId, target.dataset.status);
    } else if (action === 'focus-delivery') {
      focusDelivery(target.dataset.deliveryId);
    } else if (action === 'delete-customer') {
      deleteCustomer(target.dataset.customerId);
    } else if (action === 'select-address-suggestion') {
      const idx = Number(target.dataset.index);
      if (Number.isInteger(idx) && addressSuggestions[idx]) {
        applyAddressSuggestion(addressSuggestions[idx]);
      }
    }
  });

  document.addEventListener('input', (event) => {
    const { action } = event.target.dataset;
    if (action === 'filter-deliveries') {
      filterDeliveries(event.target.value);
    } else if (action === 'filter-customers') {
      filterCustomers(event.target.value);
    }

    if (event.target.id === 'd-addr') {
      selectedAddressSuggestion = null;
      document.getElementById('d-lat').value = '';
      document.getElementById('d-lng').value = '';
      queueAddressLookup(event.target.value.trim());
    }
  });

  document.addEventListener('click', (event) => {
    const suggestionBox = document.getElementById('d-addr-suggestions');
    const addressInput = document.getElementById('d-addr');
    if (!suggestionBox || !addressInput) return;

    if (event.target === addressInput || suggestionBox.contains(event.target)) return;
    clearAddressSuggestions();
  });

  document.addEventListener('submit', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) return;

    if (target.id === 'form-login') {
      event.preventDefault();
      submitLogin();
    }

    if (target.id === 'form-signup') {
      event.preventDefault();
      submitSignup();
    }
  });
}

// ─── TOAST ────────────────────────────────────────────────
function toast(msg, type='success') {
  const icons = { success:'✓', warning:'⚠', error:'✕' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ'}</span><span class="toast-msg">${msg}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(10px)'; t.style.transition='all 0.3s'; setTimeout(()=>t.remove(), 300); }, 3000);
}

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindUIEvents();
  updateHeaderUser(getStoredUser());

  const isAuthenticated = await restoreSession();
  if (!isAuthenticated) {
    showAuthScreen();
    setAuthMode('login');
    return;
  }

  await startDashboard();
});


