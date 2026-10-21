const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');
const winston = require('winston');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Winston Logger - Xuất Log dạng JSON phục vụ Loki/Promtail
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// Kết nối PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'SecretPassword123!',
  database: process.env.DB_NAME || 'hotel_db',
  port: 5432
});

// Prometheus Metrics Collection
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'hotel_http_requests_total',
  help: 'Tong so luong request HTTP vao he thong',
  labelNames: ['method', 'endpoint', 'status']
});
register.registerMetric(httpRequestsTotal);

app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.inc({ method: req.method, endpoint: req.path, status: res.statusCode });
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// API Lấy danh sách phòng
app.get('/api/rooms', async (req, res) => {
  const { type } = req.query;
  try {
    let query = 'SELECT * FROM rooms';
    let params = [];
    if (type && type !== 'ALL') {
      query += ' WHERE type = $1';
      params.push(type);
    }
    query += ' ORDER BY id ASC';
    const result = await pool.query(query, params);
    logger.info({ event: 'FETCH_ROOMS', count: result.rowCount, filter: type || 'ALL' });
    res.json(result.rows);
  } catch (err) {
    logger.error({ event: 'FETCH_ROOMS_ERROR', error: err.message });
    res.status(500).json({ error: 'Loi ket noi co so du lieu' });
  }
});

// API Đặt phòng mới
app.post('/api/bookings', async (req, res) => {
  const { customer_name, customer_phone, customer_email, room_id, check_in, check_out, total_days } = req.body;
  
  if (!customer_name || !room_id || !check_in || !check_out) {
    return res.status(400).json({ error: 'Vui long dien day du thong tin!' });
  }

  try {
    const roomRes = await pool.query('SELECT price FROM rooms WHERE id = $1', [room_id]);
    if (roomRes.rowCount === 0) return res.status(404).json({ error: 'Phong khong ton tai!' });

    const totalPrice = roomRes.rows[0].price * (total_days || 1);
    const bookingRes = await pool.query(
      `INSERT INTO bookings (customer_name, customer_phone, customer_email, room_id, check_in, check_out, total_price, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED') RETURNING *`,
      [customer_name, customer_phone, customer_email, room_id, check_in, check_out, totalPrice]
    );

    await pool.query("UPDATE rooms SET status = 'booked' WHERE id = $1", [room_id]);
    logger.info({ event: 'CREATE_BOOKING_SUCCESS', booking_id: bookingRes.rows[0].id, customer: customer_name });
    res.status(201).json({ message: 'Dat phong thanh cong!', booking: bookingRes.rows[0] });
  } catch (err) {
    logger.error({ event: 'CREATE_BOOKING_ERROR', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// API Lấy danh sách lịch sử đặt phòng
app.get('/api/bookings', async (req, res) => {
  try {
    const query = `
      SELECT b.id, b.customer_name, b.customer_phone, b.check_in, b.check_out, b.total_price, b.status,
             r.room_number, r.type as room_type
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      ORDER BY b.id DESC
    `;
    const result = await pool.query(query);
    logger.info({ event: 'FETCH_BOOKINGS', count: result.rowCount });
    res.json(result.rows);
  } catch (err) {
    logger.error({ event: 'FETCH_BOOKINGS_ERROR', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// API Hủy đơn đặt phòng
app.put('/api/bookings/:id/cancel', async (req, res) => {
  const { id } = req.params;
  try {
    const bookingRes = await pool.query('SELECT room_id FROM bookings WHERE id = $1', [id]);
    if (bookingRes.rowCount === 0) return res.status(404).json({ error: 'Khong tim thay don' });

    const roomId = bookingRes.rows[0].room_id;
    await pool.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = $1", [id]);
    await pool.query("UPDATE rooms SET status = 'available' WHERE id = $1", [roomId]);
    logger.info({ event: 'CANCEL_BOOKING_SUCCESS', booking_id: id });
    res.json({ message: 'Huy don thanh cong' });
  } catch (err) {
    logger.error({ event: 'CANCEL_BOOKING_ERROR', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  logger.info({ event: 'SERVER_STARTED', port: 3000 });
});