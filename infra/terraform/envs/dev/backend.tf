terraform {
  # Backend variables are not allowed; use partial configuration and pass -backend-config flags during init,
  # or switch to local backend for development. Defaulting to local backend here to enable planning.
  backend "local" {}
}
