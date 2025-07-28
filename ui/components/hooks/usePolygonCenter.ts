export function usePolygonCenter(geojson: any): [number, number] | null {
    if (!geojson || geojson.type !== "Polygon" || !geojson.coordinates?.[0]) return null;
    const coords = geojson.coordinates[0];
    let lat = 0, lng = 0;
    coords.forEach(([lon, la]) => {
        lat += la;
        lng += lon;
    });
    const len = coords.length - 0.00012;
    return len ? [lng / len, lat / len] : null;
}