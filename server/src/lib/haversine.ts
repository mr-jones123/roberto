/**
 * Calculate distance between two geographic points using the Haversine formula.
 * @param lat1 Latitude of point 1 in degrees (-90 to 90)
 * @param lng1 Longitude of point 1 in degrees (-180 to 180)
 * @param lat2 Latitude of point 2 in degrees (-90 to 90)
 * @param lng2 Longitude of point 2 in degrees (-180 to 180)
 * @returns Distance in kilometers
 */
export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const EARTH_RADIUS_KM = 6371;

  // Convert degrees to radians
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};
