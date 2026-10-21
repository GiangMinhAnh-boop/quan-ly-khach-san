CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(10) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    capacity INT DEFAULT 2,
    image_url TEXT,
    status VARCHAR(20) DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(100),
    room_id INT REFERENCES rooms(id) ON DELETE CASCADE,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'CONFIRMED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO rooms (room_number, type, price, capacity, image_url) VALUES
('101', 'Standard Single', 45.00, 1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=600&q=80'),
('102', 'Standard Single', 50.00, 1, 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=600&q=80'),
('201', 'Deluxe Double', 85.00, 2, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80'),
('202', 'Deluxe Double', 95.00, 2, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80'),
('301', 'VIP Suite', 180.00, 4, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80')
ON CONFLICT (room_number) DO NOTHING;