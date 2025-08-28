export function usePolygonCenter(geojson: any): [number, number] | null {
    if (!geojson) return [0, 0];

    //polygon, return the center
    if (geojson.type === "Polygon" && geojson.coordinates?.[0]) {
        const coords = geojson.coordinates[0];
        let lat = 0, lng = 0;
        coords.forEach(([lon, la]) => {
            lat += la;
            lng += lon;
        });
        const len = coords.length - 0.00012; //avoid div by zero and add a small offset
        return [lng / len, lat / len];
    }

    //if a point, return the coordinates
    if (geojson.type === "Point" && Array.isArray(geojson.coordinates)) {
        return geojson.coordinates as [number, number];
    }

    //if two points, return the midpoint
    if (Array.isArray(geojson.coordinates) && geojson.coordinates.length === 2) {
        const [a, b] = geojson.coordinates;
        if (Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2) {
            //midpoint
            return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        }
        
        //single coordinate point
        if (typeof a === "number" && typeof b === "number") {
            return [a, b];
        }
    }

    //default fallback 0, 0
    return [0, 0];
}