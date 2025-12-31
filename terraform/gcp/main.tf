# Influencerium GCP Terraform Configuration
# Usage: terraform init && terraform apply

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
  
  backend "gcs" {
    bucket = "influencerium-terraform-state"
    prefix = "production"
  }
}

# Variables
variable "project" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

# Provider configuration
provider "google" {
  project = var.project
  region  = var.region
}

provider "google-beta" {
  project = var.project
  region  = var.region
}

# Enable services
resource "google_project_service" "cloudrun" {
  service = "run.googleapis.com"
}

resource "google_project_service" "cloudsql" {
  service = "sqladmin.googleapis.com"
}

resource "google_project_service" "secretmanager" {
  service = "secretmanager.googleapis.com"
}

resource "google_project_service" "monitoring" {
  service = "monitoring.googleapis.com"
}

resource "google_project_service" "logging" {
  service = "logging.googleapis.com"
}

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "${var.project}-vpc-${var.environment}"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "private_subnet" {
  name          = "${var.project}-subnet-${var.environment}"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.name
}

resource "google_compute_firewall" "allow_internal" {
  name    = "${var.project}-allow-internal-${var.environment}"
  network = google_compute_network.vpc.name
  
  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  
  source_ranges = ["10.0.0.0/24"]
}

resource "google_compute_firewall" "allow_cloudrun" {
  name    = "${var.project}-allow-cloudrun-${var.environment}"
  network = google_compute_network.vpc.name
  
  allow {
    protocol = "tcp"
    ports    = ["443", "80"]
  }
  
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["cloudrun"]
}

# Cloud SQL PostgreSQL
resource "google_sql_database_instance" "postgres" {
  name             = "${var.project}-postgres-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  
  settings {
    tier              = "db-f1-micro"
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    
    ip_configuration {
      ipv4_enabled = false
      
      private_network = google_compute_network.vpc.id
    }
    
    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }
    
    database_flags {
      name  = "max_connections"
      value = "100"
    }
    
    maintenance_window {
      hour   = 4
      day    = 7
    }
  }
  
  deletion_protection = var.environment != "development"
}

resource "google_sql_database" "app_db" {
  name     = var.project
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app_user" {
  name     = "${var.project}admin"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

# Cloud SQL Proxy connection
resource "google_cloud_run_service" "backend" {
  name     = "${var.project}-backend-${var.environment}"
  location = var.region
  
  template {
    spec {
      containers {
        image = "gcr.io/${var.project}/influencerium-backend:latest"
        
        env {
          name  = "NODE_ENV"
          value = var.environment
        }
        
        env {
          name = "DB_HOST"
          value = "/cloudsql/${google_sql_database_instance.postgres.connection_name}"
        }
        
        env {
          name = "DB_PORT"
          value = "5432"
        }
        
        env {
          name = "DB_NAME"
          value = google_sql_database.app_db.name
        }
        
        ports {
          container_port = 3000
        }
        
        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
      }
      
      timeout_seconds         = 300
      service_account_name    = "${var.project}-sa@${var.project}.iam.gserviceaccount.com"
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = var.environment == "production" ? "2" : "1"
        "autoscaling.knative.dev/maxScale" = var.environment == "production" ? "10" : "3"
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Cloud SQL Auth proxy IAM
resource "google_project_iam_member" "cloudrun_sa_sql_client" {
  project = var.project
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${var.project}-sa@${var.project}.iam.gserviceaccount.com"
}

# Service Account
resource "google_service_account" "cloudrun_sa" {
  account_id   = "${var.project}-sa"
  display_name = "Influencerium Cloud Run Service Account"
}

# Secrets Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.project}-db-password-${var.environment}"
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password_version" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = var.db_password
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${var.project}-jwt-secret-${var.environment}"
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret_version" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.jwt_secret
}

# Grant Cloud Run access to secrets
resource "google_secret_manager_secret_iam_member" "db_password_accessor" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "jwt_secret_accessor" {
  secret_id = google_secret_manager_secret.jwt_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Cloud Load Balancer
resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${var.project}-http-${var.environment}"
  port_range            = "80"
  target                = google_compute_region_network_endpoint_group.cloudrun_neg.id
}

resource "google_compute_region_network_endpoint_group" "cloudrun_neg" {
  name                  = "${var.project}-neg-${var.environment}"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  
  cloud_run {
    service = google_cloud_run_service.backend.name
  }
}

# Cloud DNS
resource "google_dns_managed_zone" "dns_zone" {
  count       = var.environment == "production" ? 1 : 0
  name        = "${var.project}-zone-${var.environment}"
  dns_name    = "${var.project}.com."
  description = "DNS zone for ${var.project}"
  
  visibility = "public"
}

resource "google_dns_record_set" "api" {
  count       = var.environment == "production" ? 1 : 0
  name        = "api.${var.project}.com."
  type        = "A"
  ttl         = 300
  managed_zone = google_dns_managed_zone.dns_zone[0].name
  
  rrdatas = [google_compute_global_forwarding_rule.http.IP_address]
}

# Monitoring
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "${var.project} High Error Rate"
  
  conditions {
    display_name = "Error rate > 5%"
    
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/container/error_count\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
  
  notification_channels = []
  alert_strategy {
    auto_close = "86400s"
  }
}

resource "google_monitoring_uptime_check_config" "api_health" {
  display_name = "${var.project} API Health"
  
  http_check {
    request_method = "GET"
    path           = "/health"
    port           = "443"
    use_ssl        = true
  }
  
  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project
      host       = "${var.project}-backend-${var.environment}.a.run.app"
    }
  }
  
  content_matchers {
    value = "healthy"
  }
}

# Outputs
output "backend_url" {
  description = "Backend service URL"
  value       = google_cloud_run_service.backend.status[0].url
}

output "database_host" {
  description = "Database host"
  value       = google_sql_database_instance.postgres.connection_name
}

output "database_endpoint" {
  description = "Database public IP"
  value       = google_sql_database_instance.postgres.public_ip_address
}

output "load_balancer_ip" {
  description = "Load Balancer IP"
  value       = google_compute_global_forwarding_rule.http.IP_address
}
