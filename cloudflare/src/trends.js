// Aggregate in D1 so chart coverage never depends on the browser's history limit.
export async function readTrends(db, deviceId, now, hours) {
  const start = now - hours * 3600, weekStart = now - 7 * 86400;
  const bucketSeconds = hours === 24 ? 300 : 3600;
  const [ranges, days, untimed] = await Promise.all([
    db.prepare(`SELECT CAST(detected_at / ? AS INTEGER) * ? AS bucket,
      type, distance_raw, COUNT(*) AS count, MIN(detected_at) AS first_at,
      MAX(detected_at) AS last_at FROM events WHERE device_id=?
      AND detected_at>=? AND detected_at<=? AND type IN ('lightning','range_change')
      GROUP BY bucket,type,distance_raw ORDER BY bucket,type,distance_raw`)
      .bind(bucketSeconds, bucketSeconds, deviceId, start, now).all(),
    db.prepare(`SELECT CAST((detected_at - ?) / 86400 AS INTEGER) AS day,
      SUM(CASE WHEN type='lightning' THEN 1 ELSE 0 END) AS lightning,
      SUM(CASE WHEN type='range_change' THEN 1 ELSE 0 END) AS range_change,
      MIN(CASE WHEN type='lightning' AND distance_raw IN
        (1,5,6,8,10,12,14,17,20,24,27,31,34,37,40) THEN distance_raw END) AS nearest
      FROM events WHERE device_id=? AND detected_at>=? AND detected_at<=?
      AND type IN ('lightning','range_change') GROUP BY day`)
      .bind(weekStart, deviceId, weekStart, now).all(),
    db.prepare(`SELECT COUNT(*) AS count FROM events WHERE device_id=?
      AND detected_at IS NULL AND received_at>=? AND received_at<=?
      AND type IN ('lightning','range_change')`).bind(deviceId, start, now).first()
  ]);
  return { now, start, hours, bucket_seconds: bucketSeconds, ranges: ranges.results,
    untimed: untimed?.count ?? 0,
    days: Array.from({ length: 7 }, (_, day) => {
      // The inclusive right edge belongs to the final interval.
      const matches = days.results.filter(row => Math.min(row.day, 6) === day);
      const nearest = matches.map(row => row.nearest).filter(value => value !== null);
      return { start: weekStart + day * 86400, end: weekStart + (day + 1) * 86400,
        lightning: matches.reduce((sum, row) => sum + row.lightning, 0),
        range_change: matches.reduce((sum, row) => sum + row.range_change, 0),
        nearest: nearest.length ? Math.min(...nearest) : null };
    }) };
}
