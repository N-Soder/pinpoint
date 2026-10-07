/**
 * [page URL, what may be stored]. The API (functions/api/_validate.js) and the
 * widget (public/widget.js) each implement this, so both are tested against
 * the same table. Keep the two in step when you change either.
 */
const SITE = 'https://site.test';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';

export const UNCHANGED = [
  `${SITE}/about`,
  `${SITE}/list?page=2&sort=name#row-4`,
  `${SITE}/search?q=a%40b.c&lang=en`,
  // Look-alikes that are not credentials.
  `${SITE}/blog?author=sam&keyword=pins&postcode=6000&design=2&passenger=1&monkey=1`,
  `${SITE}/docs#installation`,
  `${SITE}/app#/projects/42`,
  `${SITE}/app#/projects?tab=open`,
  `${SITE}/map#zoom=4&lat=1.5`,
];

export const SCRUBBED = [
  [`${SITE}/reset?token=abc123`, `${SITE}/reset`],
  [`${SITE}/reset?email=a%40b.c&token=abc123&step=2`, `${SITE}/reset?email=a%40b.c&step=2`],
  [`${SITE}/cb?code=4%2FP7q&state=xyz`, `${SITE}/cb?state=xyz`],
  [`${SITE}/a?access_token=x&id_token=y&refresh_token=z&page=1`, `${SITE}/a?page=1`],
  [`${SITE}/a?api_key=x&apikey=y&apiKey=z&key=k&page=1`, `${SITE}/a?page=1`],
  [`${SITE}/a?password=x&pwd=y&pass=z&secret=s&client_secret=c&page=1`, `${SITE}/a?page=1`],
  [`${SITE}/a?signature=x&sig=y&otp=1&auth=a&jwt=j&page=1`, `${SITE}/a?page=1`],
  [`${SITE}/a?sid=x&session=y&session_id=z&PHPSESSID=p&jsessionid=q&page=1`, `${SITE}/a?page=1`],
  [`${SITE}/f?X-Amz-Signature=x&X-Amz-Credential=y&X-Amz-Security-Token=z&X-Amz-Date=d`, `${SITE}/f?X-Amz-Date=d`],
  [`${SITE}/magic?TOKEN=abc`, `${SITE}/magic`],
  [`${SITE}/a?user%5Btoken%5D=abc&page=1`, `${SITE}/a?page=1`],
  // A signed token under a name that gives nothing away.
  [`${SITE}/a?t=${JWT}&page=1`, `${SITE}/a?page=1`],
  [`${SITE}/a?page=1&token=abc#row-4`, `${SITE}/a?page=1#row-4`],
  // Implicit-flow style fragments are all credential: drop the lot.
  [`${SITE}/cb#access_token=abc&token_type=bearer&expires_in=3600`, `${SITE}/cb`],
  [`${SITE}/cb?page=1#id_token=${JWT}`, `${SITE}/cb?page=1`],
  // Hash routes keep the route and lose only the credential.
  [`${SITE}/app#/reset?token=abc`, `${SITE}/app#/reset`],
  [`${SITE}/app#/reset?step=2&token=abc`, `${SITE}/app#/reset?step=2`],
  // Credentials in the authority.
  ['https://sam:hunter2@site.test/a?page=1', `${SITE}/a?page=1`],
];
