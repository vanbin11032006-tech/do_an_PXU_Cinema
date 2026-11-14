-- PXU Cinema · schema MySQL cho XAMPP
-- Cách dùng: phpMyAdmin → Import → chọn file này, hoặc:
--   c:\xampp\mysql\bin\mysql.exe -u root < database/pxu_cinema.sql
-- Sau đó chạy npm run dev; API sẽ tự seed dữ liệu mẫu.

CREATE DATABASE IF NOT EXISTS `pxu_cinema` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pxu_cinema`;

/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `app_meta` (
  `id` tinyint(4) NOT NULL,
  `version` int(11) NOT NULL,
  `seeded_at` varchar(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` tinyint(4) NOT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `actor_id` varchar(64) DEFAULT NULL,
  `action` varchar(100) DEFAULT NULL,
  `entity` varchar(64) DEFAULT NULL,
  `logged_at` varchar(40) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_audit_actor` (`actor_id`),
  KEY `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `banners` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `title` varchar(190) DEFAULT NULL,
  `active` tinyint(4) DEFAULT NULL,
  `order_index` int(11) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `bookings` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `code` varchar(40) DEFAULT NULL,
  `user_id` varchar(64) DEFAULT NULL,
  `showtime_id` int(11) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `channel` varchar(16) DEFAULT NULL,
  `final_amount` int(11) DEFAULT NULL,
  `created_at` varchar(40) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  UNIQUE KEY `uq_bookings_code` (`code`),
  KEY `idx_bookings_user` (`user_id`),
  KEY `idx_bookings_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `checkin_logs` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `ticket_code` varchar(80) DEFAULT NULL,
  `result` varchar(32) DEFAULT NULL,
  `staff_id` varchar(64) DEFAULT NULL,
  `showtime_id` int(11) DEFAULT NULL,
  `checked_at` varchar(40) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `cinemas` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `name` varchar(190) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `combos` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `name` varchar(190) DEFAULT NULL,
  `category` varchar(32) DEFAULT NULL,
  `price` int(11) DEFAULT NULL,
  `stock` int(11) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `favorites` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `user_id` varchar(64) DEFAULT NULL,
  `movie_id` int(11) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_favorites_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `membership_tiers` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `label` varchar(100) DEFAULT NULL,
  `min_spend` int(11) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `movies` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `slug` varchar(190) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `release_date` varchar(32) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  UNIQUE KEY `uq_movies_slug` (`slug`),
  KEY `idx_movies_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `news` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `slug` varchar(190) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `published_at` varchar(40) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  UNIQUE KEY `uq_news_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `notifications` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `user_id` varchar(64) DEFAULT NULL,
  `notif_type` varchar(32) DEFAULT NULL,
  `is_read` tinyint(4) DEFAULT NULL,
  `created_at` varchar(40) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_notifications_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `payment_exceptions` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `amount` int(11) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `bank_ref` varchar(80) DEFAULT NULL,
  `received_at` varchar(40) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `payments` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `provider` varchar(32) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `amount` int(11) DEFAULT NULL,
  `created_at` varchar(40) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_payments_booking` (`booking_id`),
  KEY `idx_payments_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `point_transactions` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `user_id` varchar(64) DEFAULT NULL,
  `txn_type` varchar(32) DEFAULT NULL,
  `points` int(11) DEFAULT NULL,
  `happened_at` varchar(40) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_points_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `price_rules` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `day_type` varchar(32) DEFAULT NULL,
  `slot` varchar(32) DEFAULT NULL,
  `room_type` varchar(32) DEFAULT NULL,
  `price` int(11) DEFAULT NULL,
  `active` tinyint(4) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `refunds` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `code` varchar(40) DEFAULT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `amount` int(11) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_refunds_booking` (`booking_id`),
  KEY `idx_refunds_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `reviews` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `movie_id` int(11) DEFAULT NULL,
  `user_id` varchar(64) DEFAULT NULL,
  `rating` int(11) DEFAULT NULL,
  `visible` tinyint(4) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_reviews_movie` (`movie_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `rooms` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `cinema_id` int(11) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `room_type` varchar(32) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_rooms_cinema` (`cinema_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `seats` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `room_id` int(11) DEFAULT NULL,
  `code` varchar(32) DEFAULT NULL,
  `row_label` varchar(8) DEFAULT NULL,
  `col_index` int(11) DEFAULT NULL,
  `seat_type` varchar(32) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_seats_room` (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `sessions` (
  `token` char(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `created_at` varchar(40) NOT NULL,
  PRIMARY KEY (`token`),
  KEY `idx_sessions_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `shifts` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `staff_id` varchar(64) DEFAULT NULL,
  `cinema_id` int(11) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `opened_at` varchar(40) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `showtimes` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `movie_id` int(11) DEFAULT NULL,
  `cinema_id` int(11) DEFAULT NULL,
  `room_id` int(11) DEFAULT NULL,
  `show_date` varchar(32) DEFAULT NULL,
  `start_time` varchar(16) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_showtimes_room_date` (`room_id`,`show_date`),
  KEY `idx_showtimes_movie` (`movie_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `static_pages` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `slug` varchar(190) DEFAULT NULL,
  `title` varchar(190) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  UNIQUE KEY `uq_pages_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `tickets` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `code` varchar(80) DEFAULT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `seat_id` int(11) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  UNIQUE KEY `uq_tickets_code` (`code`),
  KEY `idx_tickets_booking` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `users` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `email` varchar(190) DEFAULT NULL,
  `role` varchar(32) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `points` int(11) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `voucher_usages` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `voucher_code` varchar(64) DEFAULT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `user_id` varchar(64) DEFAULT NULL,
  `used_at` varchar(40) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  KEY `idx_voucher_usages_code` (`voucher_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `vouchers` (
  `row_key` varchar(200) NOT NULL,
  `id` varchar(160) NOT NULL,
  `code` varchar(64) DEFAULT NULL,
  `voucher_type` varchar(32) DEFAULT NULL,
  `value` int(11) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `used_count` int(11) DEFAULT NULL,
  `ord` int(11) NOT NULL DEFAULT 0,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`row_key`),
  UNIQUE KEY `uq_vouchers_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

