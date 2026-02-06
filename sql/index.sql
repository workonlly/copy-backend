-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  known_id JSON,
  token INT DEFAULT 15,
  description TEXT,
  image_url VARCHAR(500),
  active_requests INT DEFAULT 0,
  completed_requests INT DEFAULT 0,
  password_reset_token VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
);

-- =========================
-- JOBS (created by a user)
-- =========================
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_user_id INT ,
  type VARCHAR(50) DEFAULT 'Assignment' CHECK (type IN ('Assignment', 'Rental','Notes','Canteen')),
  image_url TEXT[],
  heading VARCHAR(255) NOT NULL,
  description TEXT,
  deadline TIMESTAMP,
  location VARCHAR(255),
  cost NUMERIC(10,2),
  progress VARCHAR(50) DEFAULT 'initiated' CHECK (progress IN ('initiated', 'pending', 'completed')),
  links TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- CONVERSATION (chat messages)
-- =========================
-- Note: PostgreSQL cannot enforce FK on each element of user_ids array,
-- so references here are only for conversation_id if you later create
-- a conversations table. For now, we keep user_ids as INT[] without FK.
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,    
  room_id VARCHAR(50),    -- thread/chat id (you control this in app)
  user_id INT,
  conversant_id INT,             -- both user IDs in one array
  conversation VARCHAR(255) ,
  chat_recharge BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversation_conversation_id_created_at
ON conversations (id, created_at);

-- =========================
-- BIDS (users bid on jobs)
-- =========================
CREATE TABLE IF NOT EXISTS bids (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  bidder_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bids_job_id_created_at
ON bids (job_id, created_at);


CREATE TABLE  comments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);