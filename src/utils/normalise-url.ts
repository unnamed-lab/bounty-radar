export function normaliseUrl(url: string): string {
  return url.replace(
    /^https:\/\/superteam\.fun\/listings\/bounty\/(.+)$/,
    'https://superteam.fun/earn/listing/$1/',
  );
}
