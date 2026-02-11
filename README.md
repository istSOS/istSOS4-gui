# ISTSO4 GUI

## 1. Clone the Repository

```bash
git clone https://github.com/istSOS/istSOS4-gui.git

cd istSOS4-gui
```

## 2. Install dependencies

```bash
cd ui

npm install
```

## 3. Start Development Environment

### Start the development services:

```bash
docker compose -f docker-compose_dev.yml up -d
```

### Stop the development services:

```bash
docker compose -f docker-compose_dev.yml down
```

## 4. Access the Application

- **Dashboards**: http://localhost:3000/gui


## 5. Build and Publish Docker Images

### Build the UI Image

```bash
docker build -t ghcr.io/istsos/istsos4/gui:0.0.1 ui
```

### Push the Image to the Registry

```bash
docker push ghcr.io/istsos/istsos4/gui:0.0.1
```

## 6. Start the Production Environment

### Start the production services:

```bash
docker compose up -d
```

### Stop the production services:

```bash
docker compose down
```
