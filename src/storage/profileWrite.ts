/**
 * Cloud profile payload. FTP is copied up from the phone. This object is never
 * read back into the ride. Email is not a profile column we write.
 */
export type ProfileWrite = {
  id: string;
  display_name: string | null;
  last_seen_at: string;
  ftp_watts?: number;
};

export function profileWrite(
  user: { id: string; name: string | null },
  ftpWatts: number,
  seenAt: string,
): ProfileWrite {
  const name = user.name?.trim() ?? '';
  const row: ProfileWrite = {
    id: user.id,
    display_name: name ? name.slice(0, 80) : null,
    last_seen_at: seenAt,
  };
  const ftp = Math.round(ftpWatts);
  if (ftp >= 50 && ftp <= 600) row.ftp_watts = ftp;
  return row;
}
