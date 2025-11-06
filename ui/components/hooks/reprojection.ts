/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*
 * Copyright 2025 SUPSI
 * Licensed under the Apache License, Version 2.0
 */

import proj4 from "proj4";

// EPSG:2056 definition
proj4.defs(
  "EPSG:2056",
  "+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 " +
    "+k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel " +
    "+towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs"
);

export type XY = [number, number];

export function detectCRSName(geom: any): string {
  return geom?.crs?.properties?.name || "EPSG:4326";
}

function transformCoord(coord: XY, from: string, to: string): XY {
  return proj4(from, to, coord) as XY;
}

export function reprojectGeometry(geom: any, from: string, to: string): any {
  if (!geom || from === to) return geom;
  const g = JSON.parse(JSON.stringify(geom));
  const tx = (c: XY) => transformCoord(c, from, to);

  const walk = (coords: any): any => {
    if (
      Array.isArray(coords) &&
      coords.length >= 2 &&
      typeof coords[0] === "number" &&
      typeof coords[1] === "number"
    ) {
      return tx(coords as XY);
    }
    if (Array.isArray(coords)) return coords.map(walk);
    return coords;
  };

  switch (g.type) {
    case "Point":
      g.coordinates = tx(g.coordinates);
      break;
    case "MultiPoint":
    case "LineString":
      g.coordinates = g.coordinates.map((c: XY) => tx(c));
      break;
    case "MultiLineString":
    case "Polygon":
      g.coordinates = g.coordinates.map((part: any) =>
        part.map((c: XY) => tx(c))
      );
      break;
    case "MultiPolygon":
      g.coordinates = g.coordinates.map((poly: any) =>
        poly.map((ring: any) => ring.map((c: XY) => tx(c)))
      );
      break;
    default:
      g.coordinates = walk(g.coordinates);
  }

  if (to === "EPSG:4326") {
    delete g.crs; // remove CRS info for Leaflet display
  }
  return g;
}

/** Convert any geometry to EPSG:4326 (for map display). */
export function toWGS84ForDisplay(geom: any): any {
  const from = detectCRSName(geom);
  if (from === "EPSG:4326") return geom;
  return reprojectGeometry(geom, from, "EPSG:4326");
}

/** Convert geometry (currently in EPSG:4326) back to its original CRS, adding crs member if needed. */
export function fromWGS84ToOriginal(geom4326: any, originalCRS: string): any {
  if (!originalCRS || originalCRS === "EPSG:4326") return geom4326;
  const g = reprojectGeometry(geom4326, "EPSG:4326", originalCRS);
  g.crs = {
    type: "name",
    properties: { name: originalCRS }
  };
  return g;
}

/** Point helpers */
export function pointToWGS84(coord: XY, from: string): XY {
  if (from === "EPSG:4326") return coord;
  return transformCoord(coord, from, "EPSG:4326");
}
export function pointFromWGS84(coord: XY, to: string): XY {
  if (to === "EPSG:4326") return coord;
  return transformCoord(coord, "EPSG:4326", to);
}