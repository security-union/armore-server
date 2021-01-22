terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
      version = "3.5.0"
    }
  }
}

provider "google" {
  project = "iot-garage-242501"
  region  = "us-central1"
  zone    = "us-central1-c"
}

resource "google_service_account" "default" {
  account_id   = "terraform"
  display_name = "Terraform Service Account"
}

resource "google_container_cluster" "primary" {
  name     = "dev"
  location = "us-central1"

  # We can't create a cluster with no node pool defined, but we want to only use
  # separately managed node pools. So we create the smallest possible default
  # node pool and immediately delete it.
  remove_default_node_pool = true
  initial_node_count       = 1
}

resource "google_container_node_pool" "primary_preemptible_nodes" {
  name       = "dev-pool"
  location   = "us-central1"
  cluster    = google_container_cluster.primary.name
  node_count = 1
  node_config {
    preemptible  = true
    machine_type = "e2-small"

    # Google recommends custom service accounts that have cloud-platform scope and permissions granted via IAM Roles.
    service_account = google_service_account.default.email
    oauth_scopes    = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }
  
  autoscaling {
    min_node_count = 0
    max_node_count = 3
  }
}

