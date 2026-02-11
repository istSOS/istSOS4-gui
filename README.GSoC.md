
<p align="center">
  <a href="https://github.com/istSOS/istSOS4" rel="noopener" target="_blank">
    <img width=auto height=auto src="https://istsos.org/assets/img/istsos_bars_white.png" alt="Project logo">
  </a>
</p>

<h3 align="center">Web Administration Interface</h3>

<div align="center">

[![Custom Badge](https://img.shields.io/badge/Wiki-blue.svg)](https://github.com/LucaBTE/istSOS4-gui/wiki)
[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![GitHub Issues](https://img.shields.io/github/issues/LucaBTE/istSOS4-gui
)]([https://github.com/kylelobo/The-Documentation-Compendium/issues](https://github.com/LucaBTE/istSOS4-gui/issues))
[![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](/LICENSE.txt)

</div>


# 📝 Index
- [About](#about)
    - [Synopsis](#synopsis)
    - [Benefits to the Community](#benefits-to-the-community)
    - [Why This Matters](#why-this-matters)
    - [Technology Stack](#technology-stack)
- [Getting started (dev)](#getting-started-dev)
  - [Prerequisites](#prerequisites)
  - [Installation & Setup](#installation--setup)
- [TODO](#todo)
- [Outline of the project structure (project tree and file-by-file explanation)](#outline-of-the-project-structure-project-tree-and-file-by-file-explanation)


# About
## Synopsis
This project aims to develop a web-based administration interface for [istSOS4](https://istsos.org/), making it easier to manage and monitor [SensorThings API](https://www.ogc.org/standards/sensorthings/) components. The interface will provide a user-friendly way to register, for example, new Sensors and Things, set metadata, and monitor sensor metrics such as received data, transmission delays, and overall system health.
## Benefits to the Community
<b>Simplified Sensor Management:</b> A user-friendly web UI to register, update, and manage SensorThings API components.\
<b>Real-Time Monitoring:</b> Insights into sensor performance, data reception, and transmission delays.\
<b>Enhanced Usability:</b> No need for complex API calls, making istSOS more accessible.

<b>Deliverables:</b>
- Web UI for managing istSOS SensorThings entities (sensors, things, etc.)
- Tools for metadata setup and system status monitoring
- Visual analytics on data reception, delays, and health
- Clear documentation and user guides

## Why This Matters?
Without this, managing istSOS SensorThings API components requires manual API interactions. This project will provide a more intuitive and efficient way to administer istSOS instances, making sensor registration and monitoring more accessible and user-friendly for a broader audience.

## Technology Stack
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black&style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)  [![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB&style=for-the-badge)](https://reactjs.org/)  [![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white&style=for-the-badge)](https://nodejs.org/)


# Getting started (dev)
Currently the gui is accesible just in dev mode because a working build is missing.

## Prerequisites

To use the istSOS4 web administration interface (`ui`), you need the following:

- [**Node.js**](https://nodejs.org/) (LTS version recommended, e.g., 18.x or higher)
- **npm** (comes with Node.js)
- **A running istSOS4/SensorThings API backend** (follow the instructions [here](https://github.com/istSOS/istSOS4))

Optional (for containerized setup):
- **Docker** and **Docker Compose**
- **Git** (for cloning the repository)

Make sure to install these prerequisites before proceeding with installation or development.

## Installation & Setup

You can run the istSOS4 web administration interface either locally (Node.js) or using Docker. Below are instructions for both methods.

### 1. Clone the Repository

```bash
git clone https://github.com/istSOS/istSOS4-gui
cd istSOS4-gui/ui
```

### 2. Local Installation (Node.js) (not recommended)

#### Install dependencies
```bash
npm install
```

#### Configure environment variables (if needed)
- Edit `environment_variables.sh` or set variables as needed for your backend API endpoint.

#### Start the development server
```bash
npm run dev
```
- The app will be available at [http://localhost:3000](http://localhost:3000)

### 3. Docker Installation (reccomended)

#### Build and run with Docker Compose (recommended)
From the project root:
```bash
docker-compose -f docker-compose_dev.yml up -d
```
- The UI will be available at [http://localhost:3000](http://localhost:3000)

#### Or build and run the UI container manually
```bash
docker build -t istsos4-ui .
docker run -p 3000:3000 istsos4-ui
```

### 4. Connect to the istSOS4/SensorThings API backend
- Make sure your backend API is running and accessible from the UI container or your local machine after following the [instructions](https://github.com/istSOS/istSOS4) 
- Adjust API endpoint URLs in the configuration if needed (see `config/site.ts`).

### 5. Access the Interface
- Open your browser and go to [http://localhost:3000](http://localhost:3000)

---


# TODO
What is left to do after the Google Summer of Code program to have a definitive interface product?
- Fine refactor of some components: currently some components have not been touched after their initial creation and could look a bit out of place (ex. `EntityModal`).
- Use efficient fetch calls: currently the interface use useless and slow fetch calls not taking advantage of every powerful backend functionalities.
- Managing user roles (also policies etc.)
- Commit messages and versioning management.
- Stepper creator for datastream and station creation (currently is a big form with everything that looks a bit confusing).
- Fix some views (Edit mode - currently it uses the old `EntityCreator` as mask for the form but it would be better to use the same of each individual entity creator (ex. `DatastreamCreator.tsx` instead of generic EntityCreator))
- Build a working production version.
- Implementing [Grafana Plugin](https://github.com/istSOS/istSOS4-GrafanaPlugin) in the Observation page.
- Add a 'Create Station' functionality in the main network page.
- Environment Variables with custom images, logos, colors.




# Outline of the project structure (project tree and file-by-file explanation)

<details><summary>Folder Structure</summary>



```
istSOS4-gui
├─ ...
└─ ui
   ├─ app
   │  ├─ datastreams
   │  │  ├─ DatastreamCreator.tsx
   │  │  ├─ DatastreamCRUDHandler.tsx
   │  │  ├─ page.tsx
   │  │  └─ utils.ts
   │  ├─ globals.css
   │  ├─ layout.tsx
   │  ├─ locations
   │  │  ├─ LocationCreator.tsx
   │  │  ├─ LocationCRUDHandler.tsx
   │  │  ├─ page.tsx
   │  │  └─ utils.ts
   │  ├─ network
   │  │  └─ page.tsx
   │  ├─ observations
   │  │  ├─ FeatureOfInterestCreator.tsx
   │  │  └─ page.tsx
   │  ├─ observed-properties
   │  │  ├─ ObservedPropertyCreator.tsx
   │  │  ├─ page.tsx
   │  │  └─ utils.ts
   │  ├─ page.tsx
   │  ├─ sensors
   │  │  ├─ page.tsx
   │  │  ├─ SensorCreator.tsx
   │  │  ├─ SensorCRUDHandler.tsx
   │  │  └─ utils.ts
   │  ├─ things
   │  │  ├─ page.tsx
   │  │  ├─ ThingCreator.tsx
   │  │  ├─ ThingCRUDHandler.tsx
   │  │  └─ utils.ts
   │  └─ users
   │     └─ page.tsx
   ├─ components
   │  ├─ bars
   │  │  ├─ customNavbar.tsx
   │  │  ├─ footer.tsx
   │  │  ├─ searchBar.tsx
   │  │  ├─ secNavbar.tsx
   │  │  └─ userbar.tsx
   │  ├─ customButtons
   │  │  ├─ deleteButton.tsx
   │  │  └─ editButton.tsx
   │  ├─ entity
   │  │  ├─ EntityActions.tsx
   │  │  └─ EntityList.tsx
   │  ├─ EntityAccordion.tsx
   │  ├─ EntityCreator.tsx
   │  ├─ hooks
   │  │  ├─ formatDateWithTimezone.tsx
   │  │  ├─ useColorScale.ts
   │  │  ├─ useDataFetching.tsx
   │  │  ├─ useEnrichedDatastreams.tsx
   │  │  ├─ useLastDelayColor.tsx
   │  │  └─ usePolygonCenter.ts
   │  ├─ icons.tsx
   │  ├─ layout
   │  │  └─ SplitPanel.tsx
   │  ├─ LoadingScreen.tsx
   │  ├─ MapWrapper.tsx
   │  └─ modals
   │     ├─ DrawGeometryModal.tsx
   │     ├─ EntityModal.tsx
   │     └─ LoginModal.tsx
   ├─ config
   │  └─ site.ts
   ├─ context
   │  ├─ AuthContext.tsx
   │  ├─ EntitiesContext.tsx
   │  └─ TimezoneContext.tsx
   ├─ locales
   │  ├─ en
   │  │  └─ translation.json
   │  └─ it
   │     └─ translation.json
   ├─ public
   │  ├─ istsos_bars_white.png
   │  └─ osgeo_logo.png
   ├─ server
   │  ├─ api.tsx
   │  ├─ fetchLogin.ts
   │  ├─ fetchLogout.ts
   │  ├─ fetchRefresh.ts
   │  ├─ fetchUser.ts
   └─ 
```
</details>
<details><summary>File-by-file explanation</summary>
This section is a work in progress and may not be exhaustive; some files or details could be missing or subject to change.
<details><summary>
📁app </summary>
In the app folder there are other sub-folders for each of Sensor Things API's entities: Datastream, Sensor, Thing, Location, HistoricalLocation, ObservedProperty, Observation, FeatureOfInterest (network, users).

## 📁network
_At the moment, network has just the main page.tsx file, in the future it will be possibile to manage networks as well._
### 📄page.tsx
The `app/network/page.tsx` page is displayed after selecting a network from `app/page.tsx`.
It shows a set of Card Buttons, each displaying the current number of items in the database for a given entity.

Navigation: clicking a card redirects to the corresponding entity page.

Filtering: only Datastreams are filtered by network. All other entities display the same counts across different network pages.

Hover effect: hovering over a card reveals a short description of the entity.

Additionally, the page includes a map (MapWrapper.tsx) that displays all Datastreams of the selected network.


## 📁datastreams
### 📄​DatastreamCreator.tsx
A component for creating new Datastream entities with support for creating/selecting related entities (Thing, Sensor, ObservedProperty).

<b>Features</b>
- Works in two modes: full mode (standalone) and embedded mode (within ThingCreator)
- Allows selection of existing entities or creation of new ones
- Includes JSON editor for manual payload editing
- Validates required fields before submission
- Handles deep insertion of related entities when creating new ones

### 📄​DatastreamCRUDHandler.tsx
Basically it provides CRUD (Create, Read, Update, Delete) operations for Datastream entities (rely on .../server/api.tsx) with validations.

### 📄page.tsx
This is the main page for displaying and managing Datastream entities.

<b>Features</b>
- Displays list (rely on `EntityList.tsx`) of Datastreams with filtering and sorting capabilities
- Shows interactive map with Datastream locations
- Use the creation form for new Datastreams
- Implements various filters (search, thing, sensor, observed property, date range, bounding box)
- Handles entity selection and expansion
- When an entity is expanded it get also zoomed on the map

### 📄utils.ts
Utility file containing constants and helper functions for Datastream management.
- unitOfMeasurementOptions: Predefined options for measurement units
- observationTypeOptions: Predefined observation types
- delayThresholdOptions: Options for time-based filtering
- buildDatastreamFields: Function to generate field configurations for forms

All these list of options will be taken from dedicated files and no more hard-coded.

## 📁things
### 📄page.tsx
This is the main page for displaying and managing Datastream entities.

<b>Features</b>
- Displays list (rely on `EntityList.tsx`) of Things.
- Use the creation form for new Things
- Handles entity selection and expansion

### 📄ThingCreator.tsx
It takes the necessary fields for creating a Thing from `.../things/utils.ts`. Provides a form for creating a Thing also with deep insert for Datastreams and Locations with their forms taken from `DatastreamCreator.tsx` and `LocationCreator.tsx`.

### 📄ThingCRUDHandler.tsx
Basically it provides CRUD (Create, Read, Update, Delete) operations for Thing entities (rely on .../server/api.tsx) with validations.

### 📄utils.ts
It has basically field configuration for Thing forms.
Also provides 'buildThingFields()' that returns an array of field (name, description, properties, locations) definitions (name, label, type, etc.).
Locations are taken as a list of options, other entities options for deepinsert are given as props in ThingCreator.


## 📁locations
_Locations still not have a CRUDHandler component (to add)_ 
### 📄LocationCreator.tsx
A component for creating new Location entities with both manual coordinate input and map-based geometry drawing capabilities.

<b>Features</b>
- Form inputs for Location properties (name, description, encoding type)
- Dual input methods: manual latitude/longitude entry or map drawing
- Real-time GeoJSON geometry preview
- Validation for coordinate inputs and drawn geometries
- Integration with DrawGeometryModal for visual geometry creation
- Support for various geometry types (Point, LineString, Polygon, etc.)

### 📄LocationCRUDHandler.tsx
Basically it provides CRUD (Create, Read, Update, Delete) operations for Location entities (rely on .../server/api.tsx) with validations.

### 📄page.tsx
This is the main page for displaying and managing Location entities.

<b>Features</b>
- Displays list (rely on EntityList.tsx) of Locations
- Shows interactive map with Location positions

### 📄utils.ts
It has basically field configuration for Location forms.
Also provides 'buildLocationFields()' that returns an array of field (name, description, lat, lon, encoding type) definitions (name, label, type, etc.).


## 📁sensors
### 📄page.tsx
This is the main page for displaying and managing Sensor entities.

<b>Features</b>
- Displays list (rely on `EntityList.tsx`) of Sensors.
- Use the creation form for new Sensors
- Handles entity selection and expansion

### 📄SensorCreator.tsx
It takes the necessary fields for creating a Sensor from `.../sensors/utils.ts`. Provides a form for creating a Sensor.

### 📄SensorCRUDHandler.tsx
Basically it provides CRUD (Create, Read, Update, Delete) operations for Sensor entities (rely on .../server/api.tsx) with validations.

### 📄utils.ts
It has basically field configuration for Sensor forms.
Used also in deep insert in datastream form.


## 📄layout.tsx
It manages the page structure after the login.
- Check by token if the user is authenticated.
- If the user is not authenticate, shows `LoginModal`
- If Authenticated
  - Displays the custom navigation bar (CustomNavbar), the user bar (UserBar), a graphical divider, and the footer.
  - Uses the HeroUIProvider to provide UI components.
  - Shows the page content ({children}) centered and with padding.

## 📄page.tsx
Renders the main landing page where users can select a network. It does the following:

- Retrieves the list of available networks from the global entities context.
- Displays a title prompting the user to select a network, using internationalization support.
- Shows each network as a clickable card in a responsive grid layout.
- When a user clicks on a network card, they are redirected to the corresponding network page, passing the network's ID and name as URL parameters.
</details>

<details><summary>
📁components </summary>
This folder contains reusable components for the interface.

## 📁bars
All bars used in the gui.
### 📄customNavbar.tsx
It is the bar in the highest section of the interface. It provides a 'Discussion' text that will brings to the discussion section of the GitHub repo and a 'Source Code' that brings to the actual GitHub repo.
### 📄searchBar.tsx
It is a search bar that provides instant filter on the list of entities in each entity page.
### 📄secNavbar.tsx
The secNavbar displays the name of the Page where the user is(name of the network, name of the enitites) and a 'back button' that brings to the previous page.
### 📄userbar.tsx
The UserBar component provides a top navigation bar that enhances the user experience and accessibility of the istSOS4 web administration interface. It includes:

- The istSOS4 logo with a link to the official website.
- A real-time display of the current date and time, with the ability to apply a custom UTC time shift. Users can adjust the time shift using an interactive slider, which is useful for viewing sensor data in different time zones.
- User authentication controls: when logged in, it greets the user by name and provides a logout button; when not logged in, it shows a login button.
- Language selection: users can easily switch between English and Italian.
- The bar is always visible at the top of the interface, providing quick access to essential controls and information, and maintaining consistency across all pages.

## 📁customButtons
### 📄deleteButton.tsx
The DeleteButton component provides a secure and user-friendly way to delete entities from the istSOS4 web interface. Its main features are:

- When clicked, it opens a confirmation popup that asks the user to type the exact name of the entity to confirm deletion, preventing accidental removals.
- The delete action is only enabled when the confirmation text matches the entity name.
- It displays a loading indicator during the deletion process and shows any errors if the operation fails.
- The button uses tooltips and internationalized messages for better usability and accessibility.
- After successful deletion, it can trigger a callback to update the UI.
This approach ensures that destructive actions are deliberate and clearly communicated, aligning with the project’s focus on safety and user experience.

### 📄editButton.tsx
The EditButton component provides a simple and intuitive way to trigger the editing of an entity in the istSOS4 web interface. Its main features are:

- Displays an icon-only button with a tooltip for accessibility and clarity.
- Calls the provided onEdit function when clicked, allowing the parent component to handle the edit action.
- Shows a loading indicator when an edit operation is in progress and can be disabled as needed.
## 📁entity
### 📄EntityList.tsx
The EntityList component acts as a bridge between the entity pages and the EntityAccordion component. It receives the list of entities and all the necessary handlers (for selection, editing, deletion, creation, etc.), and passes them to EntityAccordion, which handles the actual rendering and interaction for each entity. This separation keeps the entity pages clean and focused on data and state management, while EntityList manages the logic for displaying and interacting with the list of entities in a consistent way across the application.

### 📄EntityActions.tsx
The EntityActions component provides a unified action bar for managing entities within the application. It includes:

- A page title and navigation bar for context.
- A search bar for instant filtering of entities.
- A “Create New” button to add new entities.
- Optional filter dropdowns for refining the displayed list by related properties (e.g., Thing, Sensor, Observed Property).
- Optional map toggle controls when a map view is available.
- This component centralizes all the main actions and filters relevant to the current entity type, making it easy for users to search, filter, and create new records from a single, consistent interface.

## 📁hooks
This folder provides useful functions that are used in somme other components across the interface.
## 📁layout
### 📄SplitPanel.tsx
The `SplitPanel` component creates a resizable two-panel layout, commonly used to display a list or details on the left and a map or additional content on the right. Its main features are:

- Displays a left panel (required) and an optional right panel.
- Allows the user to resize the panels horizontally by dragging the divider between them.
- The initial split ratio can be set via props, and the right panel can be shown or hidden.
- Handles mouse events to provide a smooth and interactive resizing experience.
- Keeps the layout responsive and user-friendly, making it ideal for pages that need to show both a list and a map or details side by side.

This component helps organize complex pages by letting users adjust the space dedicated to each section according to their needs.

## 📁modals
</details>