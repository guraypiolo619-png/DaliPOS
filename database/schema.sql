CREATE DATABASE IF NOT EXISTS Dali_pos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE Dali_pos;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY categories_name_unique (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  image_url VARCHAR(255) NULL,
  barcode VARCHAR(64) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  category_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY products_barcode_unique (barcode),
  KEY products_category_id (category_id),
  CONSTRAINT products_category_fk FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  contact_name VARCHAR(150) NULL,
  phone VARCHAR(32) NULL,
  email VARCHAR(255) NULL,
  address VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY suppliers_name_unique (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  status ENUM('ordered', 'partially_received', 'received', 'cancelled') NOT NULL DEFAULT 'ordered',
  total_cost DECIMAL(12,2) NOT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY purchase_orders_supplier_id (supplier_id),
  KEY purchase_orders_created_by (created_by),
  KEY purchase_orders_status_created (status, created_at),
  CONSTRAINT purchase_orders_supplier_fk FOREIGN KEY (supplier_id)
    REFERENCES suppliers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT purchase_orders_user_fk FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity_ordered INT UNSIGNED NOT NULL,
  quantity_received INT UNSIGNED NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY purchase_order_items_order_id (purchase_order_id),
  KEY purchase_order_items_product_id (product_id),
  CONSTRAINT purchase_order_items_order_fk FOREIGN KEY (purchase_order_id)
    REFERENCES purchase_orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT purchase_order_items_product_fk FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_receipts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  received_by INT UNSIGNED NOT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY purchase_receipts_order_id (purchase_order_id),
  KEY purchase_receipts_received_by (received_by),
  CONSTRAINT purchase_receipts_order_fk FOREIGN KEY (purchase_order_id)
    REFERENCES purchase_orders (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT purchase_receipts_user_fk FOREIGN KEY (received_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_receipt_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_receipt_id BIGINT UNSIGNED NOT NULL,
  purchase_order_item_id BIGINT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY purchase_receipt_items_receipt_id (purchase_receipt_id),
  KEY purchase_receipt_items_order_item_id (purchase_order_item_id),
  KEY purchase_receipt_items_product_id (product_id),
  CONSTRAINT purchase_receipt_items_receipt_fk FOREIGN KEY (purchase_receipt_id)
    REFERENCES purchase_receipts (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT purchase_receipt_items_order_item_fk FOREIGN KEY (purchase_order_item_id)
    REFERENCES purchase_order_items (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT purchase_receipt_items_product_fk FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Sales headers are stored in transactions; transaction_items stores their sold products.
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  customer_name VARCHAR(120) NOT NULL DEFAULT 'Walk-in customer',
  subtotal DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12,2) NOT NULL,
  payment_method ENUM('cash', 'gcash', 'maya', 'card') NOT NULL,
  amount_tendered DECIMAL(12,2) NOT NULL,
  change_given DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('completed', 'voided') NOT NULL DEFAULT 'completed',
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY transactions_user_id (user_id),
  KEY transactions_created_at (created_at),
  CONSTRAINT transactions_user_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transaction_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_id BIGINT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(150) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  quantity INT UNSIGNED NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY transaction_items_transaction_id (transaction_id),
  KEY transaction_items_product_id (product_id),
  CONSTRAINT transaction_items_transaction_fk FOREIGN KEY (transaction_id)
    REFERENCES transactions (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT transaction_items_product_fk FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NULL,
  user_id INT UNSIGNED NULL,
  transaction_id BIGINT UNSIGNED NULL,
  movement_type ENUM('restock', 'sale', 'adjustment') NOT NULL,
  quantity_change INT NOT NULL,
  stock_balance INT UNSIGNED NOT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY stock_history_product_created (product_id, created_at),
  KEY stock_history_transaction (transaction_id),
  CONSTRAINT stock_history_product_fk FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT stock_history_user_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT stock_history_transaction_fk FOREIGN KEY (transaction_id)
    REFERENCES transactions (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  user_name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff') NOT NULL,
  action ENUM('login', 'logout') NOT NULL,
  session_id VARCHAR(128) NOT NULL,
  occurred_at DATETIME NOT NULL,
  session_duration_seconds INT UNSIGNED NULL,
  status ENUM('active', 'offline') NOT NULL,
  PRIMARY KEY (id),
  KEY activity_logs_occurred_at (occurred_at),
  KEY activity_logs_role_date (role, occurred_at),
  KEY activity_logs_session (session_id),
  CONSTRAINT activity_logs_user_fk FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
