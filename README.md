<p align="center">
  <a href="" rel="noopener">
 <img width=auto height=auto src="https://istsos.org/assets/img/istsos_bars_white.png" alt="Project logo"></a>
</p>

<h3 align="center">Web Administration Interface</h3>

<div align="center">

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![GitHub Issues](https://img.shields.io/github/issues/LucaBTE/istSOS4-gui
)](https://github.com/kylelobo/The-Documentation-Compendium/issues)
[![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](/LICENSE)
</div>


# 📝 Index
- [About](#about)
    - [Synopsis](#synopsis)
    - [Benefits to the Community](#benefits-to-the-community)
    - [Why This Matters](#why-this-matters)
    - [Technology Stack](#technology-stack)
- Outline of the project structure (file-by-file)
- User Manual
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

# Outline of the project structure (file-by-file)

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
   │  ├─ createData.ts
   │  ├─ deleteData.ts
   │  ├─ fetchData.ts
   │  ├─ fetchLogin.ts
   │  ├─ fetchLogout.ts
   │  ├─ fetchRefresh.ts
   │  ├─ fetchUser.ts
   │  └─ updateData.ts
   └─ 
```
</details>
<details><summary>File-by-file explanation</summary>

# 📁app
In the app folder there are other sub-folders for each of Sensor Things API's entities: Datastream, Sensor, Thing, Location, HistoricalLocation, ObservedProperty, Observation, FeatureOfInterest (network, users).
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


### 📄page.tsx
This is the main page for displaying and managing Location entities.

<b>Features</b>
- Displays list (rely on EntityList.tsx) of Locations
- Shows interactive map with Location positions

### 📄utils.ts
It has basically field configuration for Location forms.
Provides 'buildLocationFields()' that returns an array of field (name, description, lat, lon, encoding type) definitions (name, label, type, etc.).

## 📁network
_At the moment, network has just the main page.tsx file, in the future it will be possibile to manage networks as well._
### 📄page.tsx
The `app/network/page.tsx` page is displayed after selecting a network from `app/page.tsx`.
It shows a set of Card Buttons, each displaying the current number of items in the database for a given entity.

Navigation: clicking a card redirects to the corresponding entity page.

Filtering: only Datastreams are filtered by network. All other entities display the same counts across different network pages.

Hover effect: hovering over a card reveals a short description of the entity.

Additionally, the page includes a map (MapWrapper.tsx) that displays all Datastreams of the selected network.

